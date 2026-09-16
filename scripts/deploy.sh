#!/usr/bin/env bash
# deploy.sh — One-time/rare stack lifecycle for rob.cmposer.cc.
#
# Flow: DNS guard -> ACM cert (us-east-1) + manual TXT record at Namecheap ->
# CloudFormation stack (us-east-2: bucket + OAC + CloudFront) -> CNAME step -> verify.
set -euo pipefail

DOMAIN="rob.cmposer.cc"
BUCKET="rob.cmposer.cc"
STACK_NAME="rob-cmposer-cc"
CERT_REGION="us-east-1"
STACK_REGION="us-east-2"
TEMPLATE="cloudformation/stack.yaml"

echo "=== [1/7] DNS guard: confirm ${DOMAIN} has no A record ==="
command -v dig >/dev/null 2>&1 || { echo "ERROR: dig not found -> install dnsutils" >&2; exit 1; }
records="$(dig +short "${DOMAIN}" || true)"
if grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' <<<"${records}"; then
  echo "ERROR: ${DOMAIN} resolves to an IPv4 A record — a stale DDNS host or A record exists." >&2
  echo "ERROR: Clean it up at Namecheap before deploying:" >&2
  echo "ERROR:   Domain List -> ${DOMAIN#*.} -> Advanced DNS -> delete the 'rob' A record." >&2
  echo "ERROR:   Also delete the DDNS host under 'Dynamic DNS' if one exists (it points at a changing EC2 IP)." >&2
  exit 1
fi
echo "Clean slate: no A record for ${DOMAIN}."

echo "=== [2/7] ACM certificate (${CERT_REGION}) ==="
cert_arn="$(aws acm list-certificates \
  --region "${CERT_REGION}" \
  --query "CertificateSummaryList[?DomainName=='${DOMAIN}' && Status=='ISSUED'].CertificateArn | [0]" \
  --output text)"
if [ -z "${cert_arn}" ] || [ "${cert_arn}" = "None" ]; then
  echo "No existing certificate for ${DOMAIN}; requesting one..."
  cert_arn="$(aws acm request-certificate \
    --region "${CERT_REGION}" \
    --domain-name "${DOMAIN}" \
    --validation-method DNS \
    --output text \
    --query CertificateArn)"
  echo "Requested certificate: ${cert_arn}"
else
  echo "Reusing existing certificate: ${cert_arn}"
fi

echo "=== [3/7] DNS validation record at Namecheap ==="
echo "Waiting for ACM to issue the DNS validation record..."
record_name=""
record_value=""
record_type=""
for _ in $(seq 1 30); do
  record_name="$(aws acm describe-certificate \
    --region "${CERT_REGION}" \
    --certificate-arn "${cert_arn}" \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord.Name" \
    --output text)"
  record_value="$(aws acm describe-certificate \
    --region "${CERT_REGION}" \
    --certificate-arn "${cert_arn}" \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord.Value" \
    --output text)"
  record_type="$(aws acm describe-certificate \
    --region "${CERT_REGION}" \
    --certificate-arn "${cert_arn}" \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord.Type" \
    --output text)"
  if [ -n "${record_name}" ] && [ "${record_name}" != "None" ] \
     && [ -n "${record_value}" ] && [ "${record_value}" != "None" ] \
     && [ -n "${record_type}" ] && [ "${record_type}" != "None" ]; then
    break
  fi
  sleep 5
done

if [ -z "${record_name}" ] || [ "${record_name}" = "None" ] \
   || [ -z "${record_value}" ] || [ "${record_value}" = "None" ] \
   || [ -z "${record_type}" ] || [ "${record_type}" = "None" ]; then
  echo "ERROR: ACM did not issue a DNS validation record for ${DOMAIN} within the wait window." >&2
  exit 1
fi

# Namecheap appends the domain automatically, so the Host field must hold only
# the subdomain labels (e.g. "_<hash>.rob"), not the full FQDN.
namecheap_host="${record_name%.${DOMAIN}}"
if [ -z "${namecheap_host}" ]; then
  echo "ERROR: could not derive a Namecheap Host from record name '${record_name}'." >&2
  exit 1
fi

echo "Add this ${record_type} record at Namecheap (Domain List -> ${DOMAIN#*.} -> Advanced DNS):"
echo "  Type:  ${record_type}"
echo "  Host:  ${namecheap_host}   (do NOT include .${DOMAIN} — Namecheap appends it automatically)"
if [ "${record_type}" = "CNAME" ]; then
  echo "  Value: ${record_value}   (CNAME: do NOT add a trailing period — Namecheap adds it)"
else
  echo "  Value: ${record_value}   (TXT: do NOT wrap the value in quotes — Namecheap adds them)"
fi
read -r -p "Press Enter once this ${record_type} record is added at Namecheap... "

echo "Waiting for certificate issuance (polling every 20s)..."
status=""
for _ in $(seq 1 45); do
  status="$(aws acm describe-certificate \
    --region "${CERT_REGION}" \
    --certificate-arn "${cert_arn}" \
    --query "Certificate.Status" \
    --output text)"
  echo "  Certificate status: ${status}"
  if [ "${status}" = "ISSUED" ]; then
    break
  fi
  if [ "${status}" = "FAILED" ]; then
    echo "ERROR: Certificate validation FAILED. Check the TXT record at Namecheap and request a new certificate." >&2
    exit 1
  fi
  sleep 20
done

if [ "${status}" != "ISSUED" ]; then
  echo "ERROR: Certificate did not reach ISSUED within the wait window (last status: ${status})." >&2
  exit 1
fi
echo "Certificate ISSUED."

echo "=== [4/7] Create/update CloudFormation stack (${STACK_REGION}) ==="
stack_params=(ParameterKey=DomainName,ParameterValue="${DOMAIN}" ParameterKey=BucketName,ParameterValue="${BUCKET}" ParameterKey=CertificateArn,ParameterValue="${cert_arn}")

operation=""
if aws cloudformation describe-stacks --region "${STACK_REGION}" --stack-name "${STACK_NAME}" >/dev/null 2>&1; then
  echo "Stack ${STACK_NAME} exists; updating..."
  operation="update"
  if ! update_output="$(aws cloudformation update-stack \
    --region "${STACK_REGION}" \
    --stack-name "${STACK_NAME}" \
    --template-body "file://${TEMPLATE}" \
    --parameters "${stack_params[@]}" \
    --capabilities CAPABILITY_NAMED_IAM 2>&1)"; then
    if printf '%s\n' "${update_output}" | grep -q "No updates are to be performed"; then
      echo "No updates are to be performed — stack is already current."
      operation="noop"
    else
      echo "ERROR: update-stack failed:" >&2
      printf '%s\n' "${update_output}" >&2
      exit 1
    fi
  fi
else
  echo "Stack ${STACK_NAME} does not exist; creating..."
  operation="create"
  aws cloudformation create-stack \
    --region "${STACK_REGION}" \
    --stack-name "${STACK_NAME}" \
    --template-body "file://${TEMPLATE}" \
    --parameters "${stack_params[@]}" \
    --capabilities CAPABILITY_NAMED_IAM
fi

echo "=== [5/7] Wait for stack operation to complete ==="
case "${operation}" in
  create)
    aws cloudformation wait stack-create-complete --region "${STACK_REGION}" --stack-name "${STACK_NAME}"
    echo "Stack creation complete."
    ;;
  update)
    aws cloudformation wait stack-update-complete --region "${STACK_REGION}" --stack-name "${STACK_NAME}"
    echo "Stack update complete."
    ;;
  noop)
    echo "Stack already current — no wait needed."
    ;;
esac

echo "=== [6/7] Print CNAME instruction ==="
distribution_domain="$(aws cloudformation describe-stacks \
  --region "${STACK_REGION}" \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" \
  --output text)"
if [ -z "${distribution_domain}" ] || [ "${distribution_domain}" = "None" ]; then
  echo "ERROR: DistributionDomainName output not found in stack ${STACK_NAME}." >&2
  exit 1
fi
echo "At Namecheap (Domain List -> ${DOMAIN#*.} -> Advanced DNS) add:"
echo "  Host: rob / Type: CNAME / Value: ${distribution_domain}"

echo "=== [7/7] Verification guidance ==="
echo "After the CNAME propagates (minutes to hours), confirm with:"
echo "  dig +short ${DOMAIN}"
echo "  curl -I https://${DOMAIN}/"
echo "Then run 'make publish' to push the site."