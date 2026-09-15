# Namecheap setup for rob.cmposer.cc

One-time manual runbook for the operator at Namecheap. `make deploy` prints the exact
values at each step — follow the sections below in order.

## (a) Confirm no existing `rob` records

Before deploying, `rob.cmposer.cc` must be a clean slate (the DNS guard in `make deploy`
also enforces this).

1. Sign in to Namecheap → **Domain List** → `cmposer.cc` → **Advanced DNS**.
2. Look for any `rob` host records:
   - **A record** for host `rob` (a DDNS-style record pointing at an EC2 IP): **delete it.**
   - Under **Dynamic DNS** (left sidebar): if a DDNS host for `rob` exists, **delete it**
     (a DDNS A record would shadow the CNAME we add in section c).
3. There should be **no** `rob` records at all before proceeding.

## (b) Add the ACM validation record

Run `make deploy`. When it reaches the DNS validation step, it prints the record to
add. The printed `Type` is typically **CNAME** (pointing at `<hash>.acm-validations.aws`)
but may be **TXT** — use whichever `Type` the script prints.

```
Type:  CNAME                                   <- use whichever Type the script prints
Host:  _<hash>.rob
Value: _<hash>.<long-validation-string>.acm-validations.aws
```

1. Back in **Advanced DNS**, click **Add New Record**.
2. Add the record exactly as printed:
   - **Type:** the printed `Type` (usually `CNAME`, sometimes `TXT`)
   - **Host:** the printed `Host` value — enter ONLY the subdomain labels (e.g.
     `_<hash>.rob`), **never** the full FQDN, and do **not** add `.cmposer.cc`
     (Namecheap appends the domain automatically).
   - **Value:** paste exactly as printed. For **CNAME** do **not** add a trailing period
     (Namecheap adds it); for **TXT** do **not** wrap the value in quotes (Namecheap adds them).
3. Save, then return to the terminal and press **Enter** in the `make deploy` prompt.
4. ACM polls until the certificate is **ISSUED** (up to ~15 minutes).

### Troubleshooting

The two most common mistakes are:
- (a) creating a **TXT** record when ACM requires a **CNAME** (or vice-versa) — always
  match the printed `Type`; and
- (b) putting the full FQDN (`_<hash>.rob.cmposer.cc`) in the **Host** field instead of
  only the subdomain labels (`_<hash>.rob`).

## (c) Add the CNAME `rob -> <DistributionDomainName>.cloudfront.net`

After the stack is created, `make deploy` prints:

```
Host: rob / Type: CNAME / Value: <dxxxxxxxyyyyy.cloudfront.net>
```

1. In **Advanced DNS**, click **Add New Record**.
2. Add the CNAME record:
   - **Type:** `CNAME`
   - **Host:** `rob`
   - **Value:** `<dxxxxxxxyyyyy.cloudfront.net>` (the printed distribution domain name)
   - **TTL:** Automatic (or 30 min while testing)
3. Save. Propagation can take minutes to hours.

## (d) Verify

Once the CNAME has propagated:

```bash
host rob.cmposer.cc
# Expected: rob.cmposer.cc is an alias for <dxxxxxxxyyyyy.cloudfront.net>.

curl -I https://rob.cmposer.cc/
# Expected: HTTP/2 200, valid TLS certificate for rob.cmposer.cc.
```

Then run `make publish` to push the game.