import { GRID_SIZE } from './constants.js';

export class Entity {
    constructor(x, y, stats, spritePath) {
        this.x = x;
        this.y = y;
        this.gridX = Math.round(x / GRID_SIZE);
        this.gridY = Math.round(y / GRID_SIZE);
        this.stats = { ...stats };
        this.isElite = Boolean(stats.isElite);
        this.isBoss = Boolean(stats.isBoss);
        this.elitePulse = 0;
        this.bossPulse = 0;
        this.hp = stats.maxHp;
        this.sprite = new Image();
        this.sprite.crossOrigin = 'anonymous';
        this.sprite.onload = () => this.onSpriteLoad?.();
        this.sprite.src = spritePath;
        this.equipmentVisuals = {};
        this.isDead = false;
        this.target = null;
        this.attackTimer = 0;
        this.moveTimer = 0;
        this.direction = 1; // 1 for right, -1 for left
        this.hitFlash = 0;
        this.hitPulse = 0;
        this.castPulse = 0;
        this.recoveryVisual = false;
        this.visualTime = 0;
        this.attackMotion = 0;
        this.attackStyle = stats.attackStyle || '';
        this.attackDirection = 1;
        this.shield = Math.max(0, stats.shield || 0);
        this.shieldRechargeTimer = 0;
        this.lastDamageTaken = 0;
        this.lastShieldAbsorbed = 0;
        this.lastShieldBroken = false;
        this.lastShieldRecharged = 0;
        this.levelStats = { maxHp: 0, atk: 0, speed: 0, regenHp: 0, crit: 0, critDamage: 0 };
        this.equipmentStats = { maxHp: 0, atk: 0, speed: 0, regenHp: 0, crit: 0, critDamage: 0 };
        this.titleStats = { maxHp: 0, atk: 0, speed: 0, regenHp: 0, crit: 0, critDamage: 0 };
        this.journalStats = { maxHp: 0, atk: 0, speed: 0, regenHp: 0, crit: 0, critDamage: 0 };
        this.achievementStats = { maxHp: 0, atk: 0, speed: 0, regenHp: 0, crit: 0, critDamage: 0 };
        // Game assigns this for the wizard from persistent upgrade ranks. Keeping
        // it on the entity makes the final stat calculation explicit and lets
        // gear, titles, and preparations all benefit from permanent attunement.
        this.upgradeMultipliers = { maxHp: 0, atk: 0, speed: 0, regenHp: 0, crit: 0, critDamage: 0 };
    }

    getEffectiveStats() {
        const upgradeMultiplier = stat => 1 + Math.max(0, Number(this.upgradeMultipliers?.[stat]) || 0);
        const maxHp = this.stats.maxHp + (this.levelStats.maxHp || 0) + (this.equipmentStats.maxHp || 0) + (this.titleStats.maxHp || 0) + (this.journalStats.maxHp || 0) + (this.achievementStats.maxHp || 0);
        const atk = this.stats.atk + (this.levelStats.atk || 0) + (this.equipmentStats.atk || 0) + (this.titleStats.atk || 0) + (this.journalStats.atk || 0) + (this.achievementStats.atk || 0);
        const speed = this.stats.speed + (this.levelStats.speed || 0) + (this.equipmentStats.speed || 0) + (this.titleStats.speed || 0) + (this.journalStats.speed || 0) + (this.achievementStats.speed || 0);
        const regenHp = Math.max(0, this.stats.regenHp || 0) + (this.levelStats.regenHp || 0) + (this.equipmentStats.regenHp || 0) + (this.titleStats.regenHp || 0) + (this.journalStats.regenHp || 0) + (this.achievementStats.regenHp || 0);
        const crit = Math.max(0, this.stats.crit ?? 0) + (this.levelStats.crit || 0) + (this.equipmentStats.crit || 0) + (this.titleStats.crit || 0) + (this.journalStats.crit || 0) + (this.achievementStats.crit || 0);
        const critDamage = Math.max(1, (this.stats.critDamage ?? 1.5) + (this.levelStats.critDamage || 0) + (this.equipmentStats.critDamage || 0) + (this.titleStats.critDamage || 0) + (this.journalStats.critDamage || 0) + (this.achievementStats.critDamage || 0));
        return {
            ...this.stats,
            maxHp: maxHp * upgradeMultiplier('maxHp'),
            atk: atk * upgradeMultiplier('atk'),
            speed: speed * upgradeMultiplier('speed'),
            regenHp: regenHp * upgradeMultiplier('regenHp'),
            crit: Math.min(1, crit * upgradeMultiplier('crit')),
            critDamage: critDamage * upgradeMultiplier('critDamage'),
            shield: this.stats.shield || 0,
            shieldAbsorption: this.stats.shieldAbsorption ?? 0.65,
            shieldRechargeDelay: Math.max(0, this.stats.shieldRechargeDelay ?? 3),
            shieldRechargeRate: Math.max(0, this.stats.shieldRechargeRate ?? 0.15)
        };
    }

    setEquipmentVisuals(visuals = {}) {
        this.equipmentVisuals = visuals && typeof visuals === 'object' ? { ...visuals } : {};
    }

    triggerCastPulse(duration = 0.28) {
        this.castPulse = Math.max(this.castPulse, Math.max(0.12, Number(duration) || 0.28));
    }

    setRecoveryVisual(active) {
        this.recoveryVisual = Boolean(active);
    }

    updateVisuals(dt) {
        const safeDt = Math.max(0, Number(dt) || 0);
        this.visualTime += safeDt;
        this.attackMotion = Math.max(0, this.attackMotion - safeDt);
        this.hitFlash = Math.max(0, this.hitFlash - safeDt);
        this.hitPulse = Math.max(0, this.hitPulse - safeDt);
        this.castPulse = Math.max(0, this.castPulse - safeDt);
    }

    drawEquipmentVisuals(ctx, size) {
        if (!this.stats.isPlayer || !this.equipmentVisuals) return;

        const combatPulse = Math.max(
            this.hitPulse > 0 ? Math.min(1, this.hitPulse / 0.18) : 0,
            this.castPulse > 0 ? Math.min(1, this.castPulse / 0.42) : 0
        );
        const recoveryPulse = this.recoveryVisual
            ? 0.48 + Math.sin(this.visualTime * 4.2) * 0.12
            : 0;
        const accessoryPulse = Math.max(combatPulse, recoveryPulse);

        const drawContained = (slot, centerX, centerY, maxWidth, maxHeight) => {
            const visual = this.equipmentVisuals[slot];
            const image = visual?.image;
            if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;

            const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
            const pulseScale = slot === 'ring' || slot === 'relic'
                ? 1 + accessoryPulse * 0.06
                : 1;
            const width = image.naturalWidth * scale * pulseScale;
            const height = image.naturalHeight * scale * pulseScale;
            ctx.save();
            ctx.globalAlpha = 0.97;
            if (visual.color) {
                const rarityGlow = visual.rarity === 'Legendary' ? 8 : 3;
                const pulseGlow = slot === 'ring' || slot === 'relic'
                    ? accessoryPulse * (visual.rarity === 'Legendary' ? 15 : 10)
                    : recoveryPulse * 9;
                ctx.shadowColor = visual.color;
                ctx.shadowBlur = rarityGlow + pulseGlow;
                if (recoveryPulse > 0) ctx.globalAlpha = Math.min(1, 0.97 + recoveryPulse * 0.03);
            }
            ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
            ctx.restore();
        };

        this.drawWeaponFlourish(ctx, size, combatPulse);

        // The generated equipment icons are transparent cutouts, so they can be
        // composited over the base wizard without changing combat or save data.
        drawContained('chest', 0, size * 0.06, size * 0.68, size * 0.70);
        drawContained('boots', 0, size * 0.34, size * 0.66, size * 0.30);
        drawContained('head', 0, -size * 0.29, size * 0.66, size * 0.48);
        drawContained('relic', -size * 0.30, size * 0.08, size * 0.20, size * 0.28);
        drawContained('ring', size * 0.30, size * 0.18, size * 0.16, size * 0.16);
        drawContained('weapon', size * 0.31, 0, size * 0.23, size * 0.82);
    }

    drawWeaponFlourish(ctx, size, intensity) {
        const weapon = this.equipmentVisuals.weapon;
        const spell = weapon?.spell;
        if (!weapon || !spell || intensity <= 0) return;

        const colors = spell.colors || {};
        const core = colors.core || '#fff1bd';
        const primary = colors.primary || weapon.color || '#b98cff';
        const secondary = colors.secondary || '#75b8ff';
        const progress = 1 - intensity;
        const handX = size * 0.22;
        const handY = size * 0.04;
        const sweep = progress * Math.PI * 0.9 - Math.PI * 0.45;
        const radius = size * (0.25 + progress * 0.08);

        ctx.save();
        ctx.globalAlpha = 0.18 + intensity * 0.44;
        ctx.lineWidth = 2 + intensity * 1.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = primary;
        ctx.shadowColor = colors.glow || primary;
        ctx.shadowBlur = 7 + intensity * 8;

        if (spell.projectileShape === 'ember-bolt') {
            ctx.beginPath();
            ctx.moveTo(handX - size * 0.06, handY + size * 0.12);
            ctx.quadraticCurveTo(handX + size * 0.2, handY - size * 0.14, handX + size * 0.28, handY - size * 0.28);
            ctx.stroke();
            ctx.strokeStyle = secondary;
            ctx.globalAlpha *= 0.72;
            ctx.beginPath();
            ctx.moveTo(handX - size * 0.02, handY + size * 0.16);
            ctx.lineTo(handX + size * 0.26, handY - size * 0.2);
            ctx.stroke();
        } else if (spell.projectileShape === 'dragon-comet') {
            ctx.beginPath();
            ctx.arc(handX, handY, radius, Math.PI * 0.55, Math.PI * 1.45);
            ctx.stroke();
            ctx.fillStyle = core;
            ctx.globalAlpha = 0.35 + intensity * 0.5;
            ctx.beginPath();
            ctx.arc(handX + Math.cos(sweep) * radius, handY + Math.sin(sweep) * radius, 2.5 + intensity * 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(handX, handY, radius, sweep - 0.72, sweep + 0.72);
            ctx.stroke();
            ctx.strokeStyle = secondary;
            ctx.globalAlpha *= 0.68;
            ctx.beginPath();
            ctx.arc(handX, handY, radius * 0.62, sweep - 0.5, sweep + 0.5);
            ctx.stroke();
            ctx.fillStyle = core;
            ctx.globalAlpha = 0.28 + intensity * 0.42;
            ctx.beginPath();
            ctx.arc(handX + Math.cos(sweep) * radius, handY + Math.sin(sweep) * radius, 2 + intensity * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    update(dt) {
        if (this.isDead) return;
        this.updateVisuals(dt);
        if (this.attackTimer > 0) this.attackTimer -= dt;
        if (this.isElite) this.elitePulse = (this.elitePulse + dt * 3) % (Math.PI * 2);
        if (this.isBoss) this.bossPulse = (this.bossPulse + dt * 2.2) % (Math.PI * 2);
        this.lastShieldRecharged = 0;

        const effectiveStats = this.getEffectiveStats();
        const maxShield = effectiveStats.shield;
        if (maxShield > 0 && this.shield < maxShield) {
            this.shieldRechargeTimer = Math.max(0, this.shieldRechargeTimer - dt);
            if (this.shieldRechargeTimer <= 0) {
                const rechargeAmount = maxShield * effectiveStats.shieldRechargeRate * dt;
                const shieldBefore = this.shield;
                this.shield = Math.min(maxShield, this.shield + rechargeAmount);
                this.lastShieldRecharged = this.shield - shieldBefore;
            }
        }
    }

    takeDamage(amount) {
        const incomingDamage = Math.max(0, Number(amount) || 0);
        const effectiveStats = this.getEffectiveStats();
        const shieldBefore = this.shield;
        const absorptionRate = this.shield > 0
            ? Math.max(0, Math.min(1, effectiveStats.shieldAbsorption))
            : 0;
        const shieldAbsorbed = Math.min(this.shield, incomingDamage * absorptionRate);
        const healthDamage = incomingDamage - shieldAbsorbed;
        this.shield -= shieldAbsorbed;
        this.hp -= healthDamage;
        this.shieldRechargeTimer = incomingDamage > 0 && effectiveStats.shield > 0
            ? effectiveStats.shieldRechargeDelay
            : this.shieldRechargeTimer;
        this.lastShieldAbsorbed = shieldAbsorbed;
        this.lastDamageTaken = healthDamage;
        this.lastShieldBroken = shieldBefore > 0 && this.shield <= 0;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
        return this.isDead;
    }

    draw(ctx) {
        if (this.isDead) return;
        const size = GRID_SIZE * 0.9 * (this.isBoss ? 2.35 : 1);
        const pulseAmount = this.hitPulse > 0 ? Math.min(1, this.hitPulse / 0.18) : 0;
        const attackAmount = this.attackMotion > 0 ? Math.min(1, this.attackMotion / 0.26) : 0;
        const attackPhase = 1 - attackAmount;
        let attackOffsetX = 0;
        let attackOffsetY = 0;
        if (attackAmount > 0) {
            const direction = this.attackDirection || this.direction || 1;
            const snap = Math.sin(attackPhase * Math.PI);
            if (this.attackStyle === 'lunge') {
                attackOffsetX = direction * snap * 13;
            } else if (this.attackStyle === 'quake') {
                attackOffsetX = Math.sin(attackPhase * Math.PI * 4) * 3;
                attackOffsetY = snap * 3;
            } else if (this.attackStyle === 'breath') {
                attackOffsetX = direction * snap * 5;
                attackOffsetY = -snap * 3;
            } else if (this.attackStyle === 'sprout') {
                attackOffsetX = direction * snap * 4;
                attackOffsetY = -snap * 8;
            } else if (this.attackStyle === 'thorn') {
                attackOffsetX = direction * snap * 9;
                attackOffsetY = -snap * 3;
            } else if (this.attackStyle === 'guard') {
                attackOffsetX = -direction * snap * 4;
                attackOffsetY = snap * 3;
            } else if (this.attackStyle === 'meteor') {
                attackOffsetX = direction * snap * 3;
                attackOffsetY = -snap * 6;
            } else if (this.attackStyle === 'void') {
                attackOffsetX = -direction * snap * 6;
                attackOffsetY = -snap * 2;
            } else {
                attackOffsetX = direction * snap * 7;
                attackOffsetY = -snap * 2;
            }
        }
        ctx.save();
        ctx.translate(this.x + attackOffsetX, this.y + attackOffsetY);
        if (pulseAmount > 0) {
            ctx.scale(1 + pulseAmount * 0.08, 1 + pulseAmount * 0.08);
        }
        if (this.direction === -1) {
            ctx.scale(-1, 1);
        }

        if (this.isBoss) {
            const bossGlow = 0.58 + Math.sin(this.bossPulse) * 0.16;
            ctx.save();
            ctx.globalAlpha = bossGlow;
            ctx.strokeStyle = '#ff6b45';
            ctx.shadowColor = '#ff6b45';
            ctx.shadowBlur = 28;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(0, 0, size * (0.54 + Math.sin(this.bossPulse) * 0.025), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (this.isElite) {
            const eliteGlow = 0.42 + Math.sin(this.elitePulse) * 0.12;
            ctx.save();
            ctx.globalAlpha = eliteGlow;
            ctx.strokeStyle = '#ffb84d';
            ctx.shadowColor = '#ffb84d';
            ctx.shadowBlur = 16;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        // Simple shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, size * 0.45, size * 0.3, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.sprite.complete) {
            ctx.drawImage(this.sprite, -size / 2, -size / 2, size, size);
        } else {
            ctx.fillStyle = '#f0f';
            ctx.fillRect(-size / 2, -size / 2, size, size);
        }
        this.drawEquipmentVisuals(ctx, size);
        if (this.hitFlash > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255, 242, 183, ${Math.min(0.72, this.hitFlash / 0.18 * 0.72)})`;
            ctx.fillRect(-size / 2, -size / 2, size, size);
        }
        ctx.restore();

        // Health bar
        const barW = size * 0.8;
        const barH = 6;
        const healthPer = this.hp / this.getEffectiveStats().maxHp;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barW / 2, this.y - size / 2 - 15, barW, barH);
        ctx.fillStyle = this.stats.isPlayer ? '#4caf50' : '#f44336';
        ctx.fillRect(this.x - barW / 2, this.y - size / 2 - 15, barW * healthPer, barH);

        const maxShield = this.getEffectiveStats().shield;
        if (maxShield > 0) {
            const shieldPer = Math.max(0, Math.min(1, this.shield / maxShield));
            ctx.fillStyle = '#253044';
            ctx.fillRect(this.x - barW / 2, this.y - size / 2 - 7, barW, 4);
            ctx.fillStyle = '#78c8ff';
            ctx.fillRect(this.x - barW / 2, this.y - size / 2 - 7, barW * shieldPer, 4);
        }

        if (this.isBoss || this.isElite) {
            const badgeLabel = this.isBoss ? 'BOSS' : 'ELITE';
            const badgeWidth = this.isBoss ? 78 : 56;
            const badgeY = this.y - size / 2 - (maxShield > 0 ? 38 : 31);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `${this.isBoss ? 900 : 800} ${this.isBoss ? 10 : 8}px Orbitron, Inter, sans-serif`;
            ctx.fillStyle = 'rgba(20, 12, 8, 0.94)';
            ctx.strokeStyle = this.isBoss ? '#ff6b45' : '#ffb84d';
            ctx.lineWidth = this.isBoss ? 2 : 1;
            ctx.fillRect(this.x - badgeWidth / 2, badgeY - 8, badgeWidth, 16);
            ctx.strokeRect(this.x - badgeWidth / 2, badgeY - 8, badgeWidth, 16);
            ctx.fillStyle = this.isBoss ? '#ff9a6b' : '#ffb84d';
            ctx.fillText(badgeLabel, this.x, badgeY);
            ctx.restore();
        }
    }
}

export class Wizard extends Entity {
    constructor(x, y, stats, spritePath) {
        super(x, y, { ...stats, isPlayer: true }, spritePath);
        this.xp = 0;
        this.level = 1;
        this.resources = {
            Gold: 0,
            Mana: 0,
            Rubies: 0
        };
        this.resBonus = 1;
    }

    moveTowards(targetX, targetY, dt) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
            const speed = this.getEffectiveStats().speed * 60; // normalized to pixels/sec
            this.x += (dx / dist) * speed * dt;
            this.y += (dy / dist) * speed * dt;
            this.direction = dx >= 0 ? 1 : -1;
            return false;
        }
        return true;
    }
}

export class Monster extends Entity {
    constructor(x, y, stats, spritePath, type, trait = '') {
        super(x, y, { ...stats, isPlayer: false }, spritePath);
        this.type = type;
        this.trait = trait;
        this.signature = stats.signature || null;
        this.signatureCooldown = this.signature ? 1.8 + Math.random() * 2.2 : Infinity;
        this.signatureState = null;
        this.signaturePrimed = false;
        this.signatureGuardActive = false;
        this.lastSignatureGuarded = false;
        this.spawnX = x;
        this.spawnY = y;
        this.patrolRadius = 86 + Math.random() * 38;
        this.patrolTargetX = x;
        this.patrolTargetY = y;
        this.patrolTimer = 0.5 + Math.random() * 1.5;
        this.aggroRange = 145;
    }

    choosePatrolPoint() {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.patrolRadius;
        this.patrolTargetX = this.spawnX + Math.cos(angle) * distance;
        this.patrolTargetY = this.spawnY + Math.sin(angle) * distance;
        this.patrolTimer = 1.5 + Math.random() * 2.5;
    }

    moveTowardsPoint(targetX, targetY, speed, dt, stopDistance = 4) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= stopDistance) return true;

        this.x += (dx / distance) * speed * dt;
        this.y += (dy / distance) * speed * dt;
        this.direction = dx >= 0 ? 1 : -1;
        return false;
    }

    resetSignatureCooldown() {
        this.signatureCooldown = Math.max(1, this.signature?.cooldown || 6);
    }

    getSignatureRange(signature = this.signature) {
        const configuredRange = signature?.range
            ?? this.stats.signatureRange
            ?? this.getEffectiveStats().attackRange
            ?? 110;
        return Math.max(1, Number(configuredRange) || 110);
    }

    startSignature(wizard, distance) {
        const signature = this.signature;
        if (!signature || this.signatureCooldown > 0 || this.signatureState) return null;
        if (distance > this.getSignatureRange(signature)) return null;

        if (signature.id === 'bramble-thorns') return null;

        if (signature.id === 'sprout-rush' || signature.id === 'dust-lunge') {
            if (distance <= (this.stats.attackRange || 110) * 0.75) return null;
            this.signatureState = {
                id: signature.id,
                remaining: signature.duration || 1
            };
            this.resetSignatureCooldown();
            return { type: 'signature-start', signature };
        }

        this.resetSignatureCooldown();
        if (signature.id === 'bone-shield-bash') {
            this.signaturePrimed = true;
            return { type: 'signature-start', signature };
        }

        this.signatureState = {
            id: signature.id,
            remaining: signature.castTime || 0.6
        };
        return { type: 'signature-start', signature };
    }

    completeSignature(wizard) {
        const signature = this.signature;
        const id = this.signatureState?.id;
        this.signatureState = null;
        if (!signature || !id) return null;

        const distance = Math.hypot(wizard.x - this.x, wizard.y - this.y);
        if (distance > this.getSignatureRange(signature)) return null;

        if (id === 'mossback-guard') {
            const maxShield = this.getEffectiveStats().shield;
            const shieldBefore = this.shield;
            const shieldGain = Math.max(3, Math.ceil(maxShield * (signature.shieldMultiplier || 0.25)));
            this.shield = Math.min(maxShield, this.shield + shieldGain);
            return {
                type: 'signature-impact',
                signature,
                shieldRestored: Math.max(0, this.shield - shieldBefore)
            };
        }

        if (id === 'obsidian-guard') {
            this.signatureGuardActive = true;
            return { type: 'signature-impact', signature, guardActivated: true };
        }

        if (id === 'sprout-rush' || id === 'dust-lunge') {
            const damage = Math.max(1, Math.round(this.stats.atk * (signature.damageMultiplier || 1)));
            wizard.takeDamage(damage);
            return {
                type: 'signature-impact',
                signature,
                damage: wizard.lastDamageTaken,
                absorbed: wizard.lastShieldAbsorbed
            };
        }

        if (id === 'sandstone-quake' || id === 'cinder-breath' || id === 'dragon-meteor') {
            const damage = Math.max(1, Math.round(this.stats.atk * (signature.damageMultiplier || 1)));
            wizard.takeDamage(damage);
            return {
                type: 'signature-impact',
                signature,
                damage: wizard.lastDamageTaken,
                absorbed: wizard.lastShieldAbsorbed
            };
        }

        return null;
    }

    update(dt, wizard) {
        super.update(dt);
        if (this.isDead || wizard.isDead) return null;

        if (Number.isFinite(this.signatureCooldown)) {
            this.signatureCooldown = Math.max(0, this.signatureCooldown - dt);
        }

        const dx = wizard.x - this.x;
        const dy = wizard.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const monsterStats = this.getEffectiveStats();
        const attackRange = monsterStats.attackRange || 110;
        let speed = Math.max(0, monsterStats.speed || 1.5) * 60;
        const events = [];

        if (this.signatureState) {
            this.signatureState.remaining -= dt;
            if (this.signatureState.remaining <= 0) {
                const impact = this.completeSignature(wizard);
                if (impact) {
                    events.push(impact);
                    return events;
                }
            } else if (this.signatureState.id !== 'sprout-rush' && this.signatureState.id !== 'dust-lunge') {
                return null;
            }
        }

        const signatureStart = this.startSignature(wizard, dist);
        if (signatureStart) {
            events.push(signatureStart);
            if (this.signatureState && this.signatureState.id !== 'sprout-rush' && this.signatureState.id !== 'dust-lunge') {
                return events;
            }
        }

        if (this.signatureState?.id === 'sprout-rush' || this.signatureState?.id === 'dust-lunge') {
            speed *= this.signature.speedMultiplier || 2;
        }

        if (dist <= attackRange) {
            if (this.attackTimer <= 0) events.push(this.attack(wizard));
            return events.length > 0 ? events : null;
        }

        // Monsters hold their own ground until the wizard comes close instead
        // of pathing across the entire battlefield and forming one central pile.
        if (dist <= this.aggroRange) {
            this.moveTowardsPoint(wizard.x, wizard.y, speed, dt);
            return events.length > 0 ? events : null;
        }

        const homeDistance = Math.hypot(this.x - this.spawnX, this.y - this.spawnY);
        if (homeDistance > this.patrolRadius * 2.5) {
            this.moveTowardsPoint(this.spawnX, this.spawnY, speed, dt);
            return events.length > 0 ? events : null;
        }

        this.patrolTimer -= dt;
        if (this.patrolTimer <= 0 || this.moveTowardsPoint(this.patrolTargetX, this.patrolTargetY, speed * 0.45, dt)) {
            this.choosePatrolPoint();
        }
        return events.length > 0 ? events : null;
    }

    takeDamage(amount) {
        this.lastSignatureGuarded = this.signatureGuardActive;
        const adjustedAmount = this.signatureGuardActive
            ? amount * (1 - (this.signature?.damageReduction || 0.5))
            : amount;
        this.signatureGuardActive = false;
        return super.takeDamage(adjustedAmount);
    }

    onHit() {
        if (this.isDead || this.signature?.id !== 'bramble-thorns' || this.signatureCooldown > 0) return null;
        this.resetSignatureCooldown();
        return {
            type: 'signature-impact',
            signature: this.signature,
            damage: Math.max(1, Math.ceil(this.stats.atk * (this.signature.damageMultiplier || 0.35))),
            absorbed: 0
        };
    }

    getAttackStyle(signature = null) {
        const signatureId = signature?.id || null;
        if (signatureId === 'cinder-breath') return 'breath';
        if (signatureId === 'dragon-meteor') return 'meteor';
        if (signatureId === 'sandstone-quake') return 'quake';
        if (signatureId === 'bone-shield-bash') return 'shield-bash';
        if (signatureId === 'dust-lunge') return 'lunge';
        if (signatureId === 'bramble-thorns') return 'thorn';
        if (signatureId === 'mossback-guard') return 'guard';
        if (signatureId === 'obsidian-guard') return 'void';
        if (signatureId === 'sprout-rush') return 'sprout';
        if (this.stats.attackStyle) return this.stats.attackStyle;
        if (this.type.includes('Slime') || this.type.includes('Guardian')) return 'nature';
        if (this.type.includes('Scuttler')) return 'lunge';
        if (this.type.includes('Shieldbearer') || this.type.includes('Warden')) return 'shield-bash';
        if (this.type.includes('Whelp') || this.type.includes('Dragon')) return 'breath';
        return 'slash';
    }

    attack(target) {
        this.attackTimer = Math.max(0.35, this.stats.attackInterval || 1.0);
        const signature = this.signaturePrimed ? this.signature : null;
        const style = this.getAttackStyle(signature);
        const damage = this.stats.atk * (signature?.damageMultiplier || 1);
        this.signaturePrimed = false;
        this.attackStyle = style;
        this.attackDirection = target.x >= this.x ? 1 : -1;
        this.attackMotion = 0.26;
        target.takeDamage(damage);
        return {
            type: 'attack',
            damage: target.lastDamageTaken,
            absorbed: target.lastShieldAbsorbed,
            signature,
            style,
            attackName: this.stats.attackName || '',
            originX: this.x,
            originY: this.y,
            targetX: target.x,
            targetY: target.y
        };
    }
}
