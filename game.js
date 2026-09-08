import {
    ASSETS,
    MAPS,
    GRID_SIZE,
    INVENTORY_SIZE,
    INVENTORY_EXPANSION_SLOT_COUNT,
    INVENTORY_EXPANSIONS,
    CONSUMABLE_LOADOUT_INITIAL_SLOTS,
    CONSUMABLE_LOADOUT_MAX_SLOTS,
    CONSUMABLE_LOADOUT_UPGRADES,
    DESIGN_WIDTH,
    DESIGN_HEIGHT,
    SAVE_KEY,
    SAVE_SLOT_KEY_PREFIX,
    SAVE_SLOT_COUNT,
    SAVE_VERSION,
    AUDIO_SETTINGS_KEY,
    AUDIO_SETTINGS_VERSION,
    CHARACTER_ITEMS,
    FUTURE_DROP_ITEMS,
    CONSUMABLE_ITEMS,
    CRAFTING_RECIPES,
    RARITIES,
    LOOT_RARITY_DEPTH_BALANCE,
    EQUIPMENT_STAT_ORDER,
    EQUIPMENT_STAT_DEFAULTS,
    EQUIPMENT_STAT_ROLL_RANGES,
    EQUIPMENT_STAT_LABELS,
    EQUIPMENT_SLOT_SPECIALIZATIONS,
    EXCEPTIONAL_GEAR,
    EQUIPMENT_JOURNAL_MASTERY,
    SALVAGE_CURRENCY,
    GEAR_ENHANCEMENT_BALANCE,
    GEAR_RARITY_ART,
    GEAR_RARITY_NAME_PREFIXES,
    WAVE_PATTERNS,
    BOSS_WAVE_BALANCE,
    MONSTER_SPRITES,
    ELITE_MONSTER_SPRITES,
    BOSS_MONSTER_SPRITES,
    DEFAULT_WEAPON_SPELL,
    WEAPON_SPELLS,
    UPGRADE_COSTS,
    UPGRADE_ATTUNEMENT,
    ENDGAME_BALANCE,
    HERO_XP_BALANCE,
    ACHIEVEMENTS,
    ACHIEVEMENT_TIER_NAMES,
    ACHIEVEMENT_TITLES,
    TITLE_SLOT_UNLOCKS,
    TITLE_BONUS_STAT_LABELS,
    ACHIEVEMENT_BADGES,
    ACHIEVEMENT_BADGE_DISPLAY_LIMIT
} from './constants.js';
import { Wizard, Monster } from './entity.js';

const DEFEAT_ADVISORY_THRESHOLD = 2;
const ZONE_DEATH_RETREAT_THRESHOLD = 2;
// Keep enough history for filtered views without allowing the DOM to grow forever.
const MAX_LOG_ENTRIES = 240;

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.currentMapKey = 'grass';
        this.zoneNumber = 1;
        this.waveNumber = 1;
        this.autoAdvanceZones = true;
        this.autoAdvanceSuspendedByDefeat = false;
        this.zoneDeathsInCurrentZone = 0;
        this.zoneUnlocks = this.createDefaultZoneUnlocks();
        this.maxZoneUnlocked = 1;
        this.maxLootRarityUnlocked = 0;
        this.saveSlot = 1;
        this.inventoryExpansionCount = 0;
        this.autoSalvageNonExceptional = false;
        this.mapMastery = this.createDefaultMapMastery();
        this.equipment = this.createDefaultEquipment();
        this.inventory = this.createDefaultInventory();
        this.consumableStacks = this.createDefaultConsumableStacks();
        this.consumableLoadoutUpgradeCount = 0;
        this.equippedConsumables = [];
        this.consumableAutoUse = {};
        this.discoveredRecipeIds = this.createDefaultDiscoveredRecipeIds();
        this.itemLevels = this.createDefaultItemLevels();
        this.itemEnhancementCounts = this.createDefaultItemEnhancementCounts();
        this.itemEnhancementRolls = this.createDefaultItemEnhancementRolls();
        this.itemEnhancementCriticals = this.createDefaultItemEnhancementCriticals();
        this.itemInstances = {};
        this.equipmentJournal = this.createDefaultEquipmentJournal();
        this.materials = this.createDefaultMaterials();
        this.salvageCurrency = 0;
        this.upgradeCounts = this.createDefaultUpgradeCounts();
        this.upgradeReadySignature = '';
        this.lifetimeStats = this.createDefaultLifetimeStats();
        this.achievementRanks = this.createDefaultAchievementRanks();
        this.equippedAchievementTitles = [];
        this.displayedAchievementBadges = this.createDefaultDisplayedAchievementBadges();
        this.tabUnlocks = this.createDefaultTabUnlocks();
        this.activeConsumableEffects = {};
        this.wizard = null;
        this.monsters = [];
        this.vfx = [];
        this.lastTime = 0;
        this.running = false;
        this.logs = [];
        this.logFilters = {
            combat: true,
            enemy: true,
            defeat: true,
            system: true
        };
        this.respawnTimeout = null;
        this.deathRecovery = {
            active: false,
            remaining: 0,
            duration: 5
        };
        this.saveAccumulator = 0;
        this.uiAccumulator = 0;
        this.backgroundSurfaceCache = new Map();
        this.hasRestoredProgress = false;
        this.preventSaving = false;
        this.session = {
            active: false,
            paused: false,
            hasRun: false,
            elapsed: 0,
            defeats: 0,
            zoneDefeats: 0,
            xpEarned: 0,
            damageDealt: 0,
            resources: { Gold: 0, Mana: 0, Rubies: 0 },
            lootDrops: 0,
            recentLoot: [],
        };
        
        this.images = {};
        this.loadImages();

        this.audio = {
            ambient: new Audio(ASSETS.MUSIC_AMBIENT),
            attack: new Audio(ASSETS.SFX_ATTACK),
            hit: new Audio(ASSETS.SFX_HIT),
            celebration: new Audio(ASSETS.SFX_CELEBRATION)
        };
        this.audio.ambient.loop = true;
        this.audioBaseVolumes = {
            ambient: 0.12,
            // Keep the attack cue comfortably below the older default level.
            attack: 0.12,
            hit: 0.18,
            celebration: 0.24
        };
        this.audioSettings = this.loadAudioSettings();
        this.applyAudioVolumes();

        this.init();
    }

    loadImages() {
        const toLoad = [
            ...Object.values(ASSETS),
            ...Object.values(MAPS).map(m => m.tile),
            ...Object.values(MAPS).map(m => m.monsterSprite),
            ...Object.values(MONSTER_SPRITES),
            ...Object.values(ELITE_MONSTER_SPRITES),
            ...Object.values(BOSS_MONSTER_SPRITES),
            ...FUTURE_DROP_ITEMS.map(item => item.image).filter(Boolean),
            ...CHARACTER_ITEMS.flatMap(item => Object.values(item.rarityImages || {})).filter(Boolean),
            ...Object.values(GEAR_RARITY_ART).flatMap(images => Object.values(images))
        ];
        
        toLoad.forEach(src => {
            if (this.images[src]) return;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.backgroundSurfaceCache.delete(src);
                if (this.wizard && !this.running) this.draw();
            };
            img.src = src;
            this.images[src] = img;
        });
    }

    loadAudioSettings() {
        const defaults = { master: 1, ambient: 1, attack: 1, hit: 1, celebration: 1 };
        try {
            const rawSettings = localStorage.getItem(AUDIO_SETTINGS_KEY);
            if (!rawSettings) return defaults;
            const savedSettings = JSON.parse(rawSettings);
            const isCurrentVersion = savedSettings?.version === AUDIO_SETTINGS_VERSION;
            const isLegacyVersion = savedSettings?.version === 1;
            if (!isCurrentVersion && !isLegacyVersion) return defaults;

            const loadedSettings = { ...defaults };
            for (const key of Object.keys(defaults)) {
                const value = savedSettings[key];
                // Version 1 had no celebration channel; retain all existing
                // preferences and initialize only the new channel.
                if (isLegacyVersion && key === 'celebration' && value === undefined) continue;
                if (!Number.isFinite(value) || value < 0 || value > 1) return defaults;
                loadedSettings[key] = value;
            }
            return loadedSettings;
        } catch (error) {
            console.warn('Unable to read Robstradomus audio settings.', error);
            return defaults;
        }
    }

    saveAudioSettings() {
        try {
            localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({
                version: AUDIO_SETTINGS_VERSION,
                ...this.audioSettings
            }));
        } catch (error) {
            console.warn('Unable to save Robstradomus audio settings.', error);
        }
    }

    applyAudioVolumes() {
        for (const key of Object.keys(this.audio)) {
            const volume = this.audioBaseVolumes[key] * this.audioSettings.master * this.audioSettings[key];
            this.audio[key].volume = Math.max(0, Math.min(1, volume));
        }
    }

    setAudioSetting(key, value) {
        if (!Object.prototype.hasOwnProperty.call(this.audioSettings, key)) return;
        if (!Number.isFinite(value)) return;
        this.audioSettings[key] = Math.max(0, Math.min(1, value));
        this.applyAudioVolumes();
        this.saveAudioSettings();
    }

    createDefaultZoneUnlocks() {
        return Object.fromEntries(
            Object.keys(MAPS).map(mapKey => [mapKey, 1])
        );
    }

    getZoneDefeatAdvisory() {
        if (!this.session.active) return null;
        if (this.autoAdvanceSuspendedByDefeat) {
            return {
                text: 'SAFETY RETREAT · AUTO-ADVANCE PAUSED',
                title: `Repeated wizard defeats triggered a safety pause in Zone ${this.zoneNumber}. Check Auto-advance zones to resume automatic progression.`
            };
        }
        if (this.session.zoneDefeats < DEFEAT_ADVISORY_THRESHOLD) return null;
        if (this.zoneNumber > 1) {
            const saferZone = this.zoneNumber - 1;
            return {
                text: `ADVISORY · ${this.session.zoneDefeats} DEFEATS · TRY ZONE ${saferZone}`,
                title: `Repeated defeats in Zone ${this.zoneNumber}. Lower difficulty to Zone ${saferZone} or improve your combat upgrades.`
            };
        }
        return {
            text: `ADVISORY · ${this.session.zoneDefeats} DEFEATS · UPGRADE OR HOLD`,
            title: 'Repeated defeats in Zone 1. Improve combat upgrades before pushing into harder zones.'
        };
    }

    getMaxZoneUnlocked(mapKey = this.currentMapKey) {
        const unlockedZone = this.zoneUnlocks?.[mapKey];
        return Number.isInteger(unlockedZone) && unlockedZone >= 1
            ? Math.min(ENDGAME_BALANCE.maxZone, unlockedZone)
            : 1;
    }

    setMaxZoneUnlocked(zoneNumber) {
        const nextUnlockedZone = Math.min(
            ENDGAME_BALANCE.maxZone,
            Math.max(
                this.getMaxZoneUnlocked(),
                Math.max(1, Math.floor(Number(zoneNumber) || 1))
            )
        );
        this.zoneUnlocks[this.currentMapKey] = nextUnlockedZone;
        this.maxZoneUnlocked = nextUnlockedZone;
        if (this.lifetimeStats) this.lifetimeStats.highestZone = Math.max(this.lifetimeStats.highestZone || 1, nextUnlockedZone);
    }

    createDefaultMapMastery() {
        return Object.fromEntries(
            Object.keys(MAPS).map(mapKey => [mapKey, { defeats: 0, milestones: 0 }])
        );
    }

    createDefaultEquipment() {
        // Fresh wizards begin unequipped. Starter gear is intentionally placed in
        // inventory so the player chooses the initial loadout manually.
        return Object.fromEntries(
            ['head', 'weapon', 'chest', 'ring', 'relic', 'boots'].map(slot => [slot, null])
        );
    }

    createDefaultInventory(excludedIds = new Set()) {
        const inventory = Array(this.getInventoryCapacity()).fill(null);
        // Keep the complete starter set available in inventory rather than
        // auto-equipping it during a new game or progress reset.
        CHARACTER_ITEMS
            .filter(item => !excludedIds.has(item.id))
            .forEach((item, index) => {
                if (index < inventory.length) inventory[index] = item.id;
            });
        return inventory;
    }

    getInventoryExpansionCount() {
        return Math.max(
            0,
            Math.min(
                INVENTORY_EXPANSIONS.length,
                Math.floor(Number(this.inventoryExpansionCount) || 0)
            )
        );
    }

    getInventoryCapacity() {
        return INVENTORY_SIZE + this.getInventoryExpansionCount() * INVENTORY_EXPANSION_SLOT_COUNT;
    }

    getInventoryExpansionCostBalance(costId) {
        if (['Gold', 'Mana', 'Rubies'].includes(costId)) {
            return Math.max(0, Math.floor(Number(this.wizard?.resources?.[costId]) || 0));
        }
        return this.getMaterialCount(costId);
    }

    formatInventoryExpansionCosts(costs = {}) {
        return Object.entries(costs)
            .map(([costId, amount]) => {
                const definition = this.getItemDefinition(costId);
                const label = definition?.kind === 'material' ? definition.name : costId;
                return `${Math.max(0, Math.floor(Number(amount) || 0)).toLocaleString()} ${label}`;
            })
            .join(' · ');
    }

    getInventoryExpansionState() {
        const count = this.getInventoryExpansionCount();
        const capacity = this.getInventoryCapacity();
        const next = INVENTORY_EXPANSIONS[count] || null;
        const costs = next?.costs || null;
        const missingCosts = costs
            ? Object.entries(costs)
                .filter(([costId, amount]) => this.getInventoryExpansionCostBalance(costId) < amount)
                .map(([costId, amount]) => {
                    const definition = this.getItemDefinition(costId);
                    const label = definition?.kind === 'material' ? definition.name : costId;
                    const missing = Math.max(0, Math.ceil(amount - this.getInventoryExpansionCostBalance(costId)));
                    return `${missing.toLocaleString()} ${label}`;
                })
            : [];
        return {
            count,
            capacity,
            used: this.inventory.filter(Boolean).length,
            next,
            nextCapacity: next ? capacity + next.slots : capacity,
            costs,
            costLabel: costs ? this.formatInventoryExpansionCosts(costs) : '',
            canAfford: Boolean(next && costs && missingCosts.length === 0),
            missingCosts,
            missingCostLabel: missingCosts.join(' · '),
            maxed: !next
        };
    }

    purchaseInventoryExpansion() {
        const state = this.getInventoryExpansionState();
        if (!state.next || !state.canAfford || !this.wizard) return false;

        Object.entries(state.costs).forEach(([costId, amount]) => {
            if (['Gold', 'Mana', 'Rubies'].includes(costId)) {
                this.wizard.resources[costId] -= amount;
            } else {
                this.materials[costId] = this.getMaterialCount(costId) - amount;
            }
        });
        this.inventoryExpansionCount = state.count + 1;
        this.inventory.push(...Array(state.next.slots).fill(null));
        this.addLog(`INVENTORY EXPANDED · ${state.next.name} · CAPACITY ${state.capacity} → ${state.nextCapacity}.`, 'system');
        this.triggerCelebration('INVENTORY EXPANDED', `${state.next.name} · ${state.nextCapacity} SLOTS AVAILABLE`, 'milestone');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        this.draw();
        return true;
    }

    createDefaultItemLevels() {
        return Object.fromEntries(
            CHARACTER_ITEMS.map(item => [item.id, Math.max(1, Math.floor(item.level || 1))])
        );
    }

    createDefaultItemEnhancementCounts() {
        return Object.fromEntries(CHARACTER_ITEMS.map(item => [item.id, 0]));
    }

    createDefaultItemEnhancementRolls() {
        return Object.fromEntries(CHARACTER_ITEMS.map(item => [item.id, []]));
    }

    createDefaultItemEnhancementCriticals() {
        return Object.fromEntries(CHARACTER_ITEMS.map(item => [item.id, []]));
    }

    createDefaultEquipmentJournal() {
        return {};
    }

    getEquipmentJournalMasteryRank(points = 0) {
        const safePoints = Math.max(0, Math.floor(Number(points) || 0));
        return EQUIPMENT_JOURNAL_MASTERY.ranks.reduce(
            (rank, milestone) => safePoints >= milestone.points ? rank + 1 : rank,
            0
        );
    }

    getEquipmentJournalRankBonuses(rank = 0) {
        const bonuses = Object.fromEntries(
            EQUIPMENT_STAT_ORDER.map(stat => [stat, 0])
        );
        EQUIPMENT_JOURNAL_MASTERY.ranks
            .slice(0, Math.max(0, Math.floor(Number(rank) || 0)))
            .forEach(milestone => Object.entries(milestone.bonuses || {}).forEach(([stat, value]) => {
                if (Object.prototype.hasOwnProperty.call(bonuses, stat)) bonuses[stat] += Number(value) || 0;
            }));
        return bonuses;
    }

    formatEquipmentJournalMasteryBonusSummary(bonuses = {}) {
        return EQUIPMENT_STAT_ORDER
            .filter(stat => Math.abs(Number(bonuses[stat]) || 0) > 0)
            .map(stat => `${EQUIPMENT_STAT_LABELS[stat] || stat.toUpperCase()} +${this.formatEquipmentStatValue(stat, bonuses[stat])}`)
            .join(' · ');
    }

    getEquipmentJournalMasteryState(discovery = {}) {
        const points = Math.max(0, Math.floor(Number(discovery?.masteryPoints) || 0));
        const maxRank = EQUIPMENT_JOURNAL_MASTERY.ranks.length;
        const rank = this.getEquipmentJournalMasteryRank(points);
        const currentMilestone = rank > 0 ? EQUIPMENT_JOURNAL_MASTERY.ranks[rank - 1] : null;
        const nextMilestone = EQUIPMENT_JOURNAL_MASTERY.ranks[rank] || null;
        const previousPoints = currentMilestone?.points || 0;
        const progress = nextMilestone
            ? Math.max(0, Math.min(1, (points - previousPoints) / Math.max(1, nextMilestone.points - previousPoints)))
            : 1;
        const currentBonuses = this.getEquipmentJournalRankBonuses(rank);
        return {
            points,
            rank,
            maxRank,
            rankName: currentMilestone?.name || 'Unstarted',
            nextMilestone,
            progress,
            currentBonuses,
            currentBonusSummary: this.formatEquipmentJournalMasteryBonusSummary(currentBonuses),
            nextBonusSummary: nextMilestone
                ? this.formatEquipmentJournalMasteryBonusSummary(nextMilestone.bonuses)
                : ''
        };
    }

    getEquipmentJournalMasteryTotals() {
        const totals = {
            points: 0,
            ranks: 0,
            maxRanks: 0,
            bonuses: Object.fromEntries(EQUIPMENT_STAT_ORDER.map(stat => [stat, 0]))
        };
        this.getEquipmentJournalEntries().forEach(({ discovery }) => {
            const mastery = this.getEquipmentJournalMasteryState(discovery);
            totals.points += mastery.points;
            totals.ranks += mastery.rank;
            totals.maxRanks += mastery.maxRank;
            Object.entries(mastery.currentBonuses).forEach(([stat, value]) => {
                totals.bonuses[stat] += value;
            });
        });
        return totals;
    }

    getEquipmentJournalMasteryBonuses() {
        return this.getEquipmentJournalMasteryTotals().bonuses;
    }

    getSalvageCurrency() {
        return Math.max(0, Math.floor(Number(this.salvageCurrency) || 0));
    }

    formatSalvageReward(amount) {
        return `+${Math.max(0, Math.floor(Number(amount) || 0))} ${SALVAGE_CURRENCY.name}`;
    }

    createDefaultConsumableStacks() {
        return {};
    }

    createDefaultDiscoveredRecipeIds() {
        return [];
    }

    createDefaultMaterials() {
        return Object.fromEntries(
            FUTURE_DROP_ITEMS
                .filter(item => item.kind === 'material')
                .map(item => [item.id, 0])
        );
    }

    createDefaultUpgradeCounts() {
        return {
            atk: 0,
            hp: 0,
            regen: 0,
            spd: 0,
            crit: 0,
            critDamage: 0,
            res: 0
        };
    }

    getUpgradeAttunementBonuses() {
        const bonuses = Object.fromEntries(EQUIPMENT_STAT_ORDER.map(stat => [stat, 0]));
        Object.entries(UPGRADE_ATTUNEMENT).forEach(([upgradeKey, definition]) => {
            const rank = Math.max(0, Math.min(
                Math.ceil(definition.maxBonus / Math.max(0.0001, definition.perRank)),
                Math.floor(Number(this.upgradeCounts?.[upgradeKey]) || 0)
            ));
            bonuses[definition.stat] = Math.min(definition.maxBonus, rank * definition.perRank);
        });
        return bonuses;
    }

    createDefaultLifetimeStats() {
        return {
            defeats: 0,
            eliteDefeats: 0,
            bossDefeats: 0,
            bossDefeatsByMonster: {},
            xp: 0,
            damage: 0,
            loot: 0,
            materials: 0,
            crafts: 0,
            upgrades: 0,
            zonesCleared: 0,
            wavesCleared: 0,
            highestZone: 1,
            mapDefeats: Object.fromEntries(Object.keys(MAPS).map(mapKey => [mapKey, 0])),
            resources: { Gold: 0, Mana: 0, Rubies: 0 }
        };
    }

    createDefaultAchievementRanks() {
        return Object.fromEntries(ACHIEVEMENTS.map(achievement => [achievement.id, 0]));
    }

    createDefaultDisplayedAchievementBadges() {
        return [];
    }

    createDefaultTabUnlocks() {
        return {
            character: [],
            materials: [],
            upgrades: [],
            achievements: [],
            discovery: [],
            maps: [],
            settings: []
        };
    }

    getTabUnlocks(tabId = null) {
        const defaults = this.createDefaultTabUnlocks();
        const source = this.tabUnlocks && typeof this.tabUnlocks === 'object'
            ? this.tabUnlocks
            : defaults;
        const tabs = tabId && Object.prototype.hasOwnProperty.call(defaults, tabId)
            ? [tabId]
            : Object.keys(defaults);
        const result = {};
        tabs.forEach(tab => {
            result[tab] = Array.isArray(source[tab])
                ? source[tab].filter(notice => notice && typeof notice.id === 'string')
                : [];
        });
        return tabId && tabs.length === 1 ? result[tabId] : result;
    }

    hasUnreadTabUnlocks(tabId) {
        return this.getTabUnlocks(tabId).some(notice => notice.tabRead !== true);
    }

    isTabUnlockNew(tabId, unlockId) {
        return this.getTabUnlocks(tabId).some(notice => notice.id === unlockId && notice.acknowledged !== true);
    }

    addTabUnlock(tabId, unlockId, label = '') {
        const defaults = this.createDefaultTabUnlocks();
        if (!Object.prototype.hasOwnProperty.call(defaults, tabId) || typeof unlockId !== 'string' || !unlockId) return false;
        if (tabId === 'character' && unlockId === `hero-title:${this.getHeroTitle(1)}`) return false;
        if (!Array.isArray(this.tabUnlocks[tabId])) this.tabUnlocks[tabId] = [];
        if (this.tabUnlocks[tabId].some(notice => notice.id === unlockId)) return false;
        this.tabUnlocks[tabId].push({
            id: unlockId,
            label: String(label || unlockId),
            tabRead: false,
            acknowledged: false,
            unlockedAt: Date.now()
        });
        window.dispatchEvent(new CustomEvent('robstradomus-tab-unlocks-changed'));
        return true;
    }

    markTabUnlocksViewed(tabId) {
        const notices = this.getTabUnlocks(tabId);
        const unread = notices.filter(notice => notice.tabRead !== true);
        if (unread.length === 0) return false;
        unread.forEach(notice => { notice.tabRead = true; });
        this.saveProgress();
        window.dispatchEvent(new CustomEvent('robstradomus-tab-unlocks-changed'));
        return true;
    }

    acknowledgeTabUnlock(tabId, unlockId) {
        const notice = this.getTabUnlocks(tabId).find(entry => entry.id === unlockId);
        if (!notice) return false;
        const wasPending = notice.acknowledged !== true || notice.tabRead !== true;
        if (!wasPending) return false;
        notice.acknowledged = true;
        notice.tabRead = true;
        this.saveProgress();
        window.dispatchEvent(new CustomEvent('robstradomus-tab-unlocks-changed'));
        return true;
    }

    getAchievementMetricValue(metric) {
        const lifetime = this.lifetimeStats || this.createDefaultLifetimeStats();
        if (metric === 'level') return Math.max(1, Math.floor(this.wizard?.level || 1));
        if (metric.startsWith('resource:')) return Number(lifetime.resources?.[metric.slice(9)]) || 0;
        if (metric.startsWith('map:')) return Number(lifetime.mapDefeats?.[metric.slice(4)]) || 0;
        if (metric.startsWith('zone:')) return this.getMaxZoneUnlocked(metric.slice(5));
        return Number(lifetime[metric]) || 0;
    }

    getAchievementStates() {
        return ACHIEVEMENTS.map(achievement => {
            const thresholds = achievement.thresholds || [];
            const value = this.getAchievementMetricValue(achievement.metric);
            const tier = thresholds.reduce((count, threshold) => value >= threshold ? count + 1 : count, 0);
            const previousThreshold = tier > 0 ? thresholds[tier - 1] : 0;
            const nextThreshold = thresholds[tier] ?? thresholds[thresholds.length - 1] ?? 1;
            const progress = tier >= thresholds.length
                ? 1
                : Math.max(0, Math.min(1, (value - previousThreshold) / Math.max(1, nextThreshold - previousThreshold)));
            const finalReward = achievement.finalReward || null;
            return {
                ...achievement,
                finalReward,
                finalRewardSummary: this.getAchievementFinalRewardSummary(finalReward),
                value,
                tier,
                maxTier: thresholds.length,
                tierName: tier > 0 ? ACHIEVEMENT_TIER_NAMES[tier - 1] : 'Locked',
                nextThreshold,
                previousThreshold,
                progress,
                complete: tier >= thresholds.length
            };
        });
    }

    getTotalAchievementTiers() {
        return this.getAchievementStates().reduce((total, state) => total + state.tier, 0);
    }

    getTitleSlotCount() {
        const totalTiers = this.getTotalAchievementTiers();
        return 3 + TITLE_SLOT_UNLOCKS.filter(unlock => totalTiers >= unlock.requiredTiers).length;
    }

    getTitleSlotUnlockStates() {
        const totalTiers = this.getTotalAchievementTiers();
        const activeSlots = this.getTitleSlotCount();
        return TITLE_SLOT_UNLOCKS.map(unlock => ({
            ...unlock,
            totalTiers,
            unlocked: totalTiers >= unlock.requiredTiers,
            activeSlots
        }));
    }

    formatTitleBonusValue(stat, value) {
        const numericValue = Number(value) || 0;
        if (stat === 'crit' || stat === 'resourceYield') return `${Math.round(numericValue * 100)}%`;
        if (stat === 'critDamage') return `${numericValue.toFixed(2)}×`;
        return numericValue.toFixed(stat === 'speed' || stat === 'regenHp' ? 2 : 0);
    }

    getAchievementFinalRewardSummary(reward = null) {
        return Object.entries(reward?.bonuses || {})
            .filter(([stat, value]) => EQUIPMENT_STAT_ORDER.includes(stat) && Math.abs(Number(value) || 0) > 0)
            .map(([stat, value]) => `+${this.formatTitleBonusValue(stat, value)} ${TITLE_BONUS_STAT_LABELS[stat] || stat.toUpperCase()}`)
            .join(' · ');
    }

    getAchievementFinalRewardBonuses() {
        const bonuses = Object.fromEntries(EQUIPMENT_STAT_ORDER.map(stat => [stat, 0]));
        this.getAchievementStates()
            .filter(state => state.complete)
            .forEach(state => Object.entries(state.finalReward?.bonuses || {}).forEach(([stat, value]) => {
                if (Object.prototype.hasOwnProperty.call(bonuses, stat)) bonuses[stat] += Number(value) || 0;
            }));
        return bonuses;
    }

    getTitleBonusSummary(title) {
        return Object.entries(title?.bonuses || {})
            .map(([stat, value]) => `+${this.formatTitleBonusValue(stat, value)} ${TITLE_BONUS_STAT_LABELS[stat] || stat.toUpperCase()}`)
            .join(' · ');
    }

    getAchievementTitleStates() {
        const achievementStates = new Map(this.getAchievementStates().map(state => [state.id, state]));
        const equippedTitles = Array.isArray(this.equippedAchievementTitles) ? this.equippedAchievementTitles : [];
        return ACHIEVEMENT_TITLES.map(title => {
            const achievement = achievementStates.get(title.achievementId);
            const equippedSlot = equippedTitles.indexOf(title.id);
            return {
                ...title,
                achievementName: achievement?.name || title.achievementId,
                achievementTierName: ACHIEVEMENT_TIER_NAMES[(title.requiredTier || 1) - 1] || `Tier ${title.requiredTier || 1}`,
                unlocked: Boolean(achievement && achievement.tier >= title.requiredTier),
                equipped: equippedSlot >= 0,
                equippedSlot,
                bonusSummary: this.getTitleBonusSummary(title)
            };
        });
    }

    getAchievementTitleBonuses() {
        const bonuses = { maxHp: 0, atk: 0, speed: 0, regenHp: 0, crit: 0, critDamage: 0, resourceYield: 0 };
        this.getAchievementTitleStates()
            .filter(title => title.equipped && title.unlocked)
            .forEach(title => Object.entries(title.bonuses || {}).forEach(([stat, value]) => {
                if (Object.prototype.hasOwnProperty.call(bonuses, stat)) bonuses[stat] += Number(value) || 0;
            }));
        return bonuses;
    }

    getEquippedAchievementTitles() {
        return this.getAchievementTitleStates().filter(title => title.equipped && title.unlocked);
    }

    getAchievementBadgeStates() {
        const achievementStates = new Map(this.getAchievementStates().map(state => [state.id, state]));
        return ACHIEVEMENT_BADGES.map(badge => {
            const achievement = achievementStates.get(badge.achievementId);
            return {
                ...badge,
                achievementName: achievement?.name || badge.achievementId,
                achievementTierName: ACHIEVEMENT_TIER_NAMES[(badge.requiredTier || 1) - 1] || `Tier ${badge.requiredTier || 1}`,
                unlocked: Boolean(achievement && achievement.tier >= badge.requiredTier),
                displayed: this.displayedAchievementBadges.includes(badge.id)
            };
        });
    }

    getEquippedAchievementTitle() {
        return this.getAchievementTitleStates().find(title => title.equipped && title.unlocked) || null;
    }

    getDisplayedAchievementBadges() {
        const states = this.getAchievementBadgeStates();
        return states.filter(badge => badge.displayed && badge.unlocked);
    }

    getAchievementHonors() {
        const equippedTitles = this.getEquippedAchievementTitles();
        return {
            equippedTitle: equippedTitles[0] || null,
            equippedTitles,
            displayedBadges: this.getDisplayedAchievementBadges(),
            titleStates: this.getAchievementTitleStates(),
            badgeStates: this.getAchievementBadgeStates(),
            titleSlotCount: this.getTitleSlotCount(),
            titleSlotUnlocks: this.getTitleSlotUnlockStates(),
            titleBonuses: this.getAchievementTitleBonuses(),
            badgeLimit: ACHIEVEMENT_BADGE_DISPLAY_LIMIT
        };
    }

    setAchievementTitle(titleId = null, slotIndex = 0) {
        if (titleId === null) {
            this.equippedAchievementTitles = [];
        } else {
            const title = this.getAchievementTitleStates().find(entry => entry.id === titleId && entry.unlocked);
            const slotCount = this.getTitleSlotCount();
            const safeSlot = Math.max(0, Math.min(slotCount - 1, Math.floor(Number(slotIndex) || 0)));
            if (!title) return false;
            const nextTitles = [...(this.equippedAchievementTitles || [])].filter(id => id !== titleId);
            nextTitles[safeSlot] = titleId;
            this.equippedAchievementTitles = nextTitles.filter(Boolean).slice(0, slotCount);
        }
        this.updateWizardEquipmentStats();
        this.saveProgress();
        this.notifyAchievementsChanged();
        this.updateUI();
        return true;
    }

    toggleAchievementTitle(titleId) {
        const title = this.getAchievementTitleStates().find(entry => entry.id === titleId && entry.unlocked);
        if (!title) return false;
        const equippedTitles = [...(this.equippedAchievementTitles || [])];
        const equippedIndex = equippedTitles.indexOf(titleId);
        if (equippedIndex >= 0) {
            equippedTitles.splice(equippedIndex, 1);
        } else {
            if (equippedTitles.length >= this.getTitleSlotCount()) return false;
            equippedTitles.push(titleId);
        }
        this.equippedAchievementTitles = equippedTitles;
        this.updateWizardEquipmentStats();
        this.saveProgress();
        this.notifyAchievementsChanged();
        this.updateUI();
        return true;
    }

    toggleAchievementBadge(badgeId) {
        const badge = this.getAchievementBadgeStates().find(entry => entry.id === badgeId);
        if (!badge || !badge.unlocked) return false;
        const displayed = new Set(this.displayedAchievementBadges);
        if (displayed.has(badgeId)) {
            displayed.delete(badgeId);
        } else {
            if (displayed.size >= ACHIEVEMENT_BADGE_DISPLAY_LIMIT) return false;
            displayed.add(badgeId);
        }
        this.displayedAchievementBadges = [...displayed];
        this.saveProgress();
        this.notifyAchievementsChanged();
        this.updateUI();
        return true;
    }

    checkAchievementUnlocks() {
        const states = this.getAchievementStates();
        const previousTotalTiers = Object.values(this.achievementRanks || {})
            .reduce((total, rank) => total + Math.max(0, Math.floor(Number(rank) || 0)), 0);
        let changed = false;
        states.forEach(state => {
            const knownTier = Math.max(0, Math.floor(Number(this.achievementRanks?.[state.id]) || 0));
            if (state.tier <= knownTier) return;
            for (let tier = knownTier; tier < state.tier; tier++) {
                const tierNumber = tier + 1;
                const tierName = ACHIEVEMENT_TIER_NAMES[tier] || `Tier ${tierNumber}`;
                this.addLog(`ACHIEVEMENT · ${state.name} ${tierName} tier reached.`, 'defeat');
                this.addTabUnlock('achievements', `achievement:${state.id}:${tierNumber}`, `${state.name} · ${tierName}`);
                ACHIEVEMENT_TITLES
                    .filter(title => title.achievementId === state.id && title.requiredTier === tierNumber)
                    .forEach(title => this.addTabUnlock('achievements', `title:${title.id}`, title.name));
                ACHIEVEMENT_BADGES
                    .filter(badge => badge.achievementId === state.id && badge.requiredTier === tierNumber)
                    .forEach(badge => this.addTabUnlock('achievements', `badge:${badge.id}`, badge.name));
                if (tierNumber === state.maxTier && state.finalReward) {
                    this.addTabUnlock('achievements', `final-reward:${state.id}`, state.finalReward.name);
                    this.addLog(`ACHIEVEMENT COMPLETE · ${state.name} · ${state.finalReward.name} · ${state.finalRewardSummary}.`, 'defeat');
                }
            }
            this.achievementRanks[state.id] = state.tier;
            changed = true;
        });
        if (changed) {
            this.updateWizardEquipmentStats();
            const highest = states.reduce((total, state) => total + state.tier, 0);
            TITLE_SLOT_UNLOCKS
                .filter(unlock => previousTotalTiers < unlock.requiredTiers && highest >= unlock.requiredTiers)
                .forEach(unlock => this.addTabUnlock('achievements', `title-slot:${unlock.slots}`, unlock.name));
            this.triggerCelebration('ACHIEVEMENT ADVANCED', `${highest} TIERS CLAIMED`, 'milestone');
        }
        // Only rebuild the achievement panel when a tier actually advances.
        // Combat HUD refreshes and in-between progress checks must not replace
        // the element currently under the pointer or keyboard focus.
        if (changed) this.notifyAchievementsChanged();
        this.checkRecipeDiscoveries(true);
        return changed;
    }

    notifyAchievementsChanged() {
        window.dispatchEvent(new CustomEvent('robstradomus-achievements-changed'));
    }

    getRecipeConditionLabel(condition) {
        if (!condition || typeof condition !== 'object') return 'Follow an unknown arcane lead';
        if (condition.type === 'map') {
            return `Reach the ${MAPS[condition.map]?.name || 'associated map'}`;
        }
        if (condition.type === 'zone') {
            const mapName = MAPS[condition.map]?.name || 'associated map';
            const minZone = Math.max(1, Math.floor(Number(condition.minZone || condition.zone) || 1));
            return `Reach Zone ${minZone} in the ${mapName}`;
        }
        if (condition.type === 'monster-drop') {
            const mapName = MAPS[condition.map]?.name || 'associated map';
            const minZone = Math.max(1, Math.floor(Number(condition.minZone) || 1));
            const maxZoneValue = Number(condition.maxZone);
            const hasMaxZone = Number.isFinite(maxZoneValue) && maxZoneValue >= minZone;
            const zoneLabel = hasMaxZone ? `Zones ${minZone}–${Math.floor(maxZoneValue)}` : `Zone ${minZone}+`;
            const chance = Math.max(0, Math.min(1, Number(condition.chance) || 0));
            const chanceLabel = chance > 0 ? ` · ${Number((chance * 100).toFixed(2))}% base chance` : '';
            return `Defeat monsters in ${mapName} ${zoneLabel}${chanceLabel}`;
        }
        if (condition.type === 'materials') {
            const materialText = Object.entries(condition.materials || {})
                .map(([itemId, amount]) => `${amount} ${this.getItemDefinition(itemId)?.name || itemId}`)
                .join(' and ');
            return `Gather ${materialText || 'the required materials'}`;
        }
        if (condition.type === 'boss') {
            return `Defeat the ${condition.monster || 'associated boss'}`;
        }
        if (condition.type === 'achievement') {
            const achievement = ACHIEVEMENTS.find(entry => entry.id === condition.achievementId);
            const tierIndex = Math.max(0, (Number(condition.tier) || 1) - 1);
            const tierName = ACHIEVEMENT_TIER_NAMES[tierIndex] || `Tier ${tierIndex + 1}`;
            return `Reach ${tierName} ${achievement?.name || 'the associated achievement'}`;
        }
        return 'Follow an unknown arcane lead';
    }

    isRecipeConditionMet(condition, context = null) {
        if (!condition || typeof condition !== 'object') return false;
        if (condition.type === 'map') return this.currentMapKey === condition.map;
        if (condition.type === 'zone') {
            const minZone = Math.max(1, Math.floor(Number(condition.minZone || condition.zone) || 1));
            // Legacy zone conditions remain supported for older consumable
            // formulas. Current regional preparation formulas use monster-drop instead.
            return this.currentMapKey === condition.map
                && this.getMaxZoneUnlocked(condition.map) >= minZone;
        }
        if (condition.type === 'monster-drop') {
            const mapKey = context?.mapKey || this.currentMapKey;
            const zoneNumber = Math.max(1, Math.floor(Number(context?.zoneNumber ?? this.zoneNumber) || 1));
            const minZone = Math.max(1, Math.floor(Number(condition.minZone) || 1));
            const maxZoneValue = Number(condition.maxZone);
            const maxZone = Number.isFinite(maxZoneValue) && maxZoneValue >= minZone
                ? Math.floor(maxZoneValue)
                : Number.POSITIVE_INFINITY;
            return Boolean(context?.monster)
                && mapKey === condition.map
                && zoneNumber >= minZone
                && zoneNumber <= maxZone;
        }
        if (condition.type === 'materials') {
            return Object.entries(condition.materials || {})
                .every(([itemId, amount]) => this.getMaterialCount(itemId) >= Math.max(1, Math.floor(Number(amount) || 0)));
        }
        if (condition.type === 'boss') {
            return (this.lifetimeStats?.bossDefeatsByMonster?.[condition.monster] || 0) > 0;
        }
        if (condition.type === 'achievement') {
            const achievement = this.getAchievementStates().find(entry => entry.id === condition.achievementId);
            return Boolean(achievement && achievement.tier >= Math.max(1, Math.floor(Number(condition.tier) || 1)));
        }
        return false;
    }

    getCraftingRecipeState(recipeId, context = null) {
        const recipe = CRAFTING_RECIPES.find(entry => entry.id === recipeId) || null;
        if (!recipe) return null;
        const conditions = recipe.discovery?.conditions || [];
        const matchedCondition = conditions.find(condition => this.isRecipeConditionMet(condition, context)) || null;
        const discovered = Array.isArray(this.discoveredRecipeIds)
            && this.discoveredRecipeIds.includes(recipe.id);
        return {
            ...recipe,
            discovered,
            conditionMet: Boolean(matchedCondition),
            matchedCondition,
            unlockHint: conditions.map(condition => this.getRecipeConditionLabel(condition)).join(' or '),
            matchedLabel: matchedCondition ? this.getRecipeConditionLabel(matchedCondition) : ''
        };
    }

    getDiscoveredRecipeCount() {
        return CRAFTING_RECIPES.filter(recipe => this.discoveredRecipeIds?.includes(recipe.id)).length;
    }

    getRecipeDiscoveryChance(condition, monster) {
        if (!condition || condition.type !== 'monster-drop' || !monster) return 0;
        const rawChance = monster.isBoss
            ? (condition.bossChance ?? condition.eliteChance ?? condition.chance)
            : monster.isElite
                ? (condition.eliteChance ?? condition.chance)
                : condition.chance;
        return Math.max(0, Math.min(1, Number(rawChance) || 0));
    }

    checkRecipeDiscoveries(announce = true, context = null) {
        const discovered = Array.isArray(this.discoveredRecipeIds) ? this.discoveredRecipeIds : [];
        const newlyDiscovered = [];
        CRAFTING_RECIPES.forEach(recipe => {
            if (discovered.includes(recipe.id)) return;
            const conditions = recipe.discovery?.conditions || [];
            const monsterDropCondition = conditions.find(condition => condition.type === 'monster-drop') || null;
            const state = this.getCraftingRecipeState(recipe.id, context);
            const standardConditionMet = conditions.some(condition => condition.type !== 'monster-drop' && this.isRecipeConditionMet(condition, context));
            const monsterDropEligible = Boolean(
                monsterDropCondition
                && this.isRecipeConditionMet(monsterDropCondition, context)
                && Math.random() < this.getRecipeDiscoveryChance(monsterDropCondition, context?.monster)
            );
            if (!standardConditionMet && !monsterDropEligible) return;
            discovered.push(recipe.id);
            newlyDiscovered.push(recipe);
            const outputName = this.getItemDefinition(recipe.output)?.name || recipe.output;
            this.addTabUnlock('materials', `recipe:${recipe.id}`, outputName);
            const discoveryLabel = monsterDropEligible
                ? `${state?.matchedLabel || this.getRecipeConditionLabel(monsterDropCondition)} · monster drop`
                : state?.matchedLabel;
            this.addLog(`FORMULA DISCOVERED · ${outputName} · ${discoveryLabel || 'ARCANE LEAD FOLLOWED'}.`, 'system');
        });
        this.discoveredRecipeIds = [...new Set(discovered)];
        if (newlyDiscovered.length === 0) return [];

        if (announce) {
            newlyDiscovered.forEach(recipe => {
                const output = this.getItemDefinition(recipe.output);
                const state = this.getCraftingRecipeState(recipe.id, context);
                this.triggerCelebration(
                    'RECIPE DISCOVERED',
                    `${output?.name || recipe.output} · ${state?.matchedLabel || 'ARCANE LEAD FOLLOWED'}`,
                    'recipe-discovery'
                );
                this.showRecipeDiscoveryToast(recipe, state);
            });
        }
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return newlyDiscovered;
    }

    showRecipeDiscoveryToast(recipe, state = this.getCraftingRecipeState(recipe?.id)) {
        const toast = document.getElementById('recipe-discovery-toast');
        const output = this.getItemDefinition(recipe?.output);
        if (!toast || !recipe || !output) return;
        toast.innerHTML = `
            <span class="recipe-discovery-kicker">✧ ARCANE FORMULA DISCOVERED</span>
            <strong>${output.name}</strong>
            <span class="recipe-discovery-headline">${recipe.discovery?.headline || 'A new preparation joins the grimoire.'}</span>
            <small>${recipe.discovery?.explanation || `The ingredients are now known: ${recipe.discovery?.ingredientHint || 'study the materials panel.'}`}</small>
            <em>${recipe.discovery?.ingredientHint || state?.unlockHint || 'The ingredients await your next expedition.'}</em>
        `;
        clearTimeout(this.recipeDiscoveryToastTimeout);
        toast.classList.remove('visible');
        void toast.offsetWidth;
        toast.classList.add('visible');
        this.recipeDiscoveryToastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 5600);
    }

    getItemDefinition(itemId) {
        return [...CHARACTER_ITEMS, ...FUTURE_DROP_ITEMS, ...CONSUMABLE_ITEMS]
            .find(item => item.id === itemId) || null;
    }

    getItem(itemId) {
        const ownedInstance = this.itemInstances?.[itemId];
        const definitionId = ownedInstance?.baseId || itemId;
        const definition = this.getItemDefinition(definitionId);
        return definition ? { ...definition, id: itemId } : null;
    }

    isOwnedItemId(itemId) {
        if (typeof itemId !== 'string') return false;
        const directDefinition = this.getItemDefinition(itemId);
        if (directDefinition?.kind === 'equipment') {
            return CHARACTER_ITEMS.some(item => item.id === itemId) || FUTURE_DROP_ITEMS.some(item => item.id === itemId);
        }

        const instance = this.itemInstances?.[itemId];
        const instanceDefinition = this.getItemDefinition(instance?.baseId);
        return Boolean(
            instance
            && instanceDefinition?.kind === 'equipment'
            && FUTURE_DROP_ITEMS.some(item => item.id === instanceDefinition.id)
        );
    }

    getRarityData(rarity) {
        return RARITIES.find(entry => entry.name === rarity) || RARITIES[0];
    }

    getEquipmentDisplayName(item, rarity = item?.rarity) {
        if (item?.kind !== 'equipment') return item?.name || '';
        const prefix = GEAR_RARITY_NAME_PREFIXES[rarity] || '';
        const baseName = String(item.name || 'Arcane Gear').replace(/^Apprentice |^Verdant |^Runebound |^Astral |^Sovereign /, '');
        return prefix ? `${prefix} ${baseName}` : baseName;
    }

    getEquipmentRarityImage(item, rarity = item?.rarity) {
        // Regional signature gear keeps its generated silhouette at every rarity;
        // the generic slot ladder remains the fallback for legacy and starter gear.
        return (item?.distinctArt && item?.image)
            || GEAR_RARITY_ART[item?.slot]?.[rarity]
            || item?.rarityImages?.[rarity]
            || item?.image
            || null;
    }

    getItemLevel(itemId) {
        const item = this.getItem(itemId);
        if (!item) return 1;
        const instanceLevel = this.itemInstances?.[itemId]?.level;
        if (Number.isInteger(instanceLevel) && instanceLevel >= 1) return instanceLevel;
        const savedLevel = this.itemLevels?.[item.baseId || item.id];
        return Number.isInteger(savedLevel) && savedLevel >= 1
            ? savedLevel
            : Math.max(1, Math.floor(item.level || 1));
    }

    getItemEnhancementCount(itemId) {
        const item = this.getItem(itemId);
        if (!item || item.kind !== 'equipment') return 0;
        const maxEnhancements = GEAR_ENHANCEMENT_BALANCE.maxEnhancements;
        const instanceCount = this.itemInstances?.[itemId]?.enhancementCount;
        if (Number.isInteger(instanceCount) && instanceCount >= 0) {
            return Math.min(maxEnhancements, instanceCount);
        }
        const savedCount = this.itemEnhancementCounts?.[item.baseId || item.id];
        return Number.isInteger(savedCount) && savedCount >= 0
            ? Math.min(maxEnhancements, savedCount)
            : 0;
    }

    getItemEnhancementRolls(itemId) {
        const item = this.getItem(itemId);
        if (!item || item.kind !== 'equipment') return [];
        const maxEnhancements = GEAR_ENHANCEMENT_BALANCE.maxEnhancements;
        const minRoll = GEAR_ENHANCEMENT_BALANCE.enhancementRollMin;
        const maxRoll = GEAR_ENHANCEMENT_BALANCE.enhancementCriticalRollMax;
        const instance = this.itemInstances?.[itemId];
        const baseId = item.baseId || item.id;
        const source = Array.isArray(instance?.enhancementRolls)
            ? instance.enhancementRolls
            : Array.isArray(this.itemEnhancementRolls?.[baseId])
                ? this.itemEnhancementRolls[baseId]
                : [];
        const count = this.getItemEnhancementCount(itemId);
        const rolls = source
            .slice(0, Math.min(maxEnhancements, count))
            .map(roll => Math.max(minRoll, Math.min(maxRoll, Number(roll) || minRoll)));
        while (rolls.length < count) rolls.push(minRoll + Math.random() * (GEAR_ENHANCEMENT_BALANCE.enhancementRollMax - minRoll));
        if (instance) {
            instance.enhancementRolls = rolls;
        } else {
            if (!this.itemEnhancementRolls || typeof this.itemEnhancementRolls !== 'object') {
                this.itemEnhancementRolls = this.createDefaultItemEnhancementRolls();
            }
            this.itemEnhancementRolls[baseId] = rolls;
        }
        return rolls;
    }

    getItemEnhancementCriticals(itemId) {
        const item = this.getItem(itemId);
        if (!item || item.kind !== 'equipment') return [];
        const maxEnhancements = GEAR_ENHANCEMENT_BALANCE.maxEnhancements;
        const instance = this.itemInstances?.[itemId];
        const baseId = item.baseId || item.id;
        const source = Array.isArray(instance?.enhancementCriticals)
            ? instance.enhancementCriticals
            : Array.isArray(this.itemEnhancementCriticals?.[baseId])
                ? this.itemEnhancementCriticals[baseId]
                : [];
        const count = this.getItemEnhancementCount(itemId);
        const criticals = source
            .slice(0, Math.min(maxEnhancements, count))
            .map(Boolean);
        while (criticals.length < count) criticals.push(false);
        if (instance) {
            instance.enhancementCriticals = criticals;
        } else {
            if (!this.itemEnhancementCriticals || typeof this.itemEnhancementCriticals !== 'object') {
                this.itemEnhancementCriticals = this.createDefaultItemEnhancementCriticals();
            }
            this.itemEnhancementCriticals[baseId] = criticals;
        }
        return criticals;
    }

    getGearEnhancementBonus(count = 0, enhancementRolls = null) {
        const safeCount = Math.max(0, Math.min(
            GEAR_ENHANCEMENT_BALANCE.maxEnhancements,
            Math.floor(Number(count) || 0)
        ));
        const rolls = Array.isArray(enhancementRolls)
            ? enhancementRolls.slice(0, safeCount)
            : [];
        if (rolls.length === 0 && safeCount > 0) {
            return safeCount * ((GEAR_ENHANCEMENT_BALANCE.enhancementRollMin + GEAR_ENHANCEMENT_BALANCE.enhancementRollMax) / 2);
        }
        return rolls.reduce((total, roll) => total + Math.max(
            GEAR_ENHANCEMENT_BALANCE.enhancementRollMin,
            Math.min(GEAR_ENHANCEMENT_BALANCE.enhancementRollMax, Number(roll) || 0)
        ), 0);
    }

    getGearEnhancementBonusForItem(itemId) {
        const count = this.getItemEnhancementCount(itemId);
        return this.getGearEnhancementBonus(count, this.getItemEnhancementRolls(itemId));
    }

    formatEnhancementRollPercent(roll = 0) {
        return `${(Math.max(0, Number(roll) || 0) * 100).toFixed(1)}%`;
    }

    applyGearEnhancementBonus(itemId, bonuses = {}) {
        const bonusMultiplier = 1 + this.getGearEnhancementBonusForItem(itemId);
        return Object.fromEntries(
            Object.entries(bonuses).map(([stat, value]) => [
                stat,
                this.roundEquipmentStatValue(stat, (Number(value) || 0) * bonusMultiplier)
            ])
        );
    }

    getGearEnhancementState(itemId) {
        const item = this.getItemInstance(itemId);
        if (item?.kind !== 'equipment') return null;

        const enhancementCount = this.getItemEnhancementCount(itemId);
        const enhancementRolls = this.getItemEnhancementRolls(itemId);
        const maxEnhancements = GEAR_ENHANCEMENT_BALANCE.maxEnhancements;
        const rarityMultiplier = GEAR_ENHANCEMENT_BALANCE.rarityMultipliers[item.rarity]
            || this.getRarityData(item.rarity).multiplier;
        const cost = Math.max(1, Math.ceil(
            GEAR_ENHANCEMENT_BALANCE.baseCost
            * rarityMultiplier
            * Math.pow(GEAR_ENHANCEMENT_BALANCE.enhancementMultiplier, enhancementCount)
        ));
        const maxed = enhancementCount >= maxEnhancements;
        const balance = this.getSalvageCurrency();
        return {
            item,
            level: Math.max(1, Math.floor(Number(item.level) || 1)),
            enhancementCount,
            enhancementRolls,
            nextEnhancement: Math.min(maxEnhancements, enhancementCount + 1),
            bonusPercent: Math.round(this.getGearEnhancementBonus(enhancementCount, enhancementRolls) * 100),
            lastRollPercent: enhancementCount > 0 ? Math.round(enhancementRolls[enhancementCount - 1] * 1000) / 10 : 0,
            nextRollMinPercent: Math.round(GEAR_ENHANCEMENT_BALANCE.enhancementRollMin * 100),
            nextRollMaxPercent: Math.round(GEAR_ENHANCEMENT_BALANCE.enhancementRollMax * 100),
            criticalRollMinPercent: Math.round(GEAR_ENHANCEMENT_BALANCE.enhancementCriticalRollMin * 100),
            criticalRollMaxPercent: Math.round(GEAR_ENHANCEMENT_BALANCE.enhancementCriticalRollMax * 100),
            criticalChancePercent: Math.round(GEAR_ENHANCEMENT_BALANCE.enhancementCriticalChance * 100),
            enhancementCriticals: this.getItemEnhancementCriticals(itemId),
            lastRollCritical: enhancementCount > 0 ? Boolean(this.getItemEnhancementCriticals(itemId)[enhancementCount - 1]) : false,
            cost: maxed ? 0 : cost,
            maxEnhancements,
            maxed,
            canAfford: !maxed && balance >= cost,
            balance,
            currency: SALVAGE_CURRENCY
        };
    }

    getItemPowerMultiplier(item, level = this.getItemLevel(item.id), rarity = item.rarity) {
        const rarityMultiplier = this.getRarityData(rarity).multiplier;
        const levelMultiplier = 1 + Math.max(0, level - 1) * 0.12;
        return rarityMultiplier * levelMultiplier;
    }

    getEquipmentStatCount(rarity) {
        return Math.min(
            EQUIPMENT_STAT_ORDER.length,
            this.getRarityIndex(rarity) + 1
        );
    }

    getEquipmentStatProgression(rarity) {
        const rarityIndex = this.getRarityIndex(rarity);
        const slots = this.getEquipmentStatCount(rarity);
        const maxSlots = this.getEquipmentStatCount(RARITIES[RARITIES.length - 1]?.name);
        return {
            rarityIndex,
            slots,
            maxSlots
        };
    }

    getEquipmentStatKeys(item) {
        if (item?.kind !== 'equipment') return [];
        const bonusKeys = Object.keys(item.bonuses || {});
        const orderedKeys = EQUIPMENT_STAT_ORDER.filter(stat => bonusKeys.includes(stat));
        const additionalKeys = bonusKeys.filter(stat => !orderedKeys.includes(stat));
        return [...orderedKeys, ...additionalKeys];
    }

    formatEquipmentStatValue(stat, value) {
        const numericValue = Number(value) || 0;
        if (stat === 'crit') return `${Math.round(numericValue * 100)}%`;
        if (stat === 'critDamage') return `${numericValue.toFixed(2)}×`;
        return numericValue.toFixed(stat === 'speed' || stat === 'regenHp' ? 1 : 0);
    }

    formatEquipmentStatSummary(item) {
        return this.getEquipmentStatKeys(item)
            .map(stat => `${EQUIPMENT_STAT_LABELS[stat] || stat.toUpperCase()} +${this.formatEquipmentStatValue(stat, item.bonuses?.[stat])}`)
            .join(' · ');
    }

    getEquipmentStatValue(item, stat) {
        const definedValue = item?.bonuses?.[stat];
        return Number.isFinite(definedValue)
            ? definedValue
            : EQUIPMENT_STAT_DEFAULTS[stat] || 0;
    }

    roundEquipmentStatValue(stat, value) {
        const precision = stat === 'maxHp' || stat === 'atk'
            ? 0
            : stat === 'crit'
                ? 3
                : 2;
        const factor = 10 ** precision;
        return Math.round(value * factor) / factor;
    }

    getEquipmentSlotSpecialization(itemOrSlot = null) {
        const slot = typeof itemOrSlot === 'string' ? itemOrSlot : itemOrSlot?.slot;
        return EQUIPMENT_SLOT_SPECIALIZATIONS[slot] || null;
    }

    getEquipmentStatRollRange(stat, level = 1, rarity = 'Common', itemOrSlot = null) {
        const definition = EQUIPMENT_STAT_ROLL_RANGES[stat];
        if (!definition) return null;

        const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
        const levelSteps = safeLevel - 1;
        const rarityMultiplier = this.getRarityData(rarity).multiplier;
        const specialization = this.getEquipmentSlotSpecialization(itemOrSlot);
        const specializationMultiplier = specialization?.primaryStat === stat
            ? Math.max(1, Number(specialization.rollMultiplier) || 1)
            : 1;
        return {
            min: this.roundEquipmentStatValue(
                stat,
                (definition.min + definition.minPerLevel * levelSteps) * rarityMultiplier * specializationMultiplier
            ),
            max: this.roundEquipmentStatValue(
                stat,
                (definition.max + definition.maxPerLevel * levelSteps) * rarityMultiplier * specializationMultiplier
            )
        };
    }

    getRolledEquipmentBonuses(item, level, rarity, statKeys, statRolls = {}) {
        if (item?.kind !== 'equipment') return {};
        return Object.fromEntries(
            statKeys
                .filter(stat => Object.prototype.hasOwnProperty.call(EQUIPMENT_STAT_ROLL_RANGES, stat))
                .map(stat => {
                    const range = this.getEquipmentStatRollRange(stat, level, rarity, item);
                    const roll = Math.max(0, Math.min(1, Number.isFinite(statRolls[stat]) ? statRolls[stat] : Math.random()));
                    const value = range.min + (range.max - range.min) * roll;
                    return [stat, this.roundEquipmentStatValue(stat, value)];
                })
        );
    }

    getEquipmentRollQuality(item) {
        if (item?.kind !== 'equipment' || !item.statRolls || typeof item.statRolls !== 'object') {
            return {
                score: null,
                average: 0,
                best: 0,
                highRolls: 0,
                rollCount: 0,
                exceptional: false
            };
        }

        const rolls = Object.values(item.statRolls)
            .filter(value => Number.isFinite(value))
            .map(value => Math.max(0, Math.min(1, value)));
        if (rolls.length === 0) {
            return {
                score: null,
                average: 0,
                best: 0,
                highRolls: 0,
                rollCount: 0,
                exceptional: false
            };
        }

        const average = rolls.reduce((total, value) => total + value, 0) / rolls.length;
        const best = Math.max(...rolls);
        return {
            score: Math.round(average * 100),
            average,
            best,
            highRolls: rolls.filter(value => value >= EXCEPTIONAL_GEAR.averageRollThreshold).length,
            rollCount: rolls.length,
            exceptional: average >= EXCEPTIONAL_GEAR.averageRollThreshold
                && best >= EXCEPTIONAL_GEAR.topRollThreshold
        };
    }

    rollEquipmentStatKeys(item, rarity) {
        if (item?.kind !== 'equipment') return Object.keys(item?.bonuses || {});

        const statCount = this.getEquipmentStatCount(rarity);
        const specialization = this.getEquipmentSlotSpecialization(item);
        const availableStats = [...new Set([
            specialization?.primaryStat,
            ...(Array.isArray(item.statPool) && item.statPool.length > 0
                ? item.statPool
                : EQUIPMENT_STAT_ORDER)
        ])].filter(stat => Object.prototype.hasOwnProperty.call(EQUIPMENT_STAT_DEFAULTS, stat));
        const primaryStat = specialization?.primaryStat && availableStats.includes(specialization.primaryStat)
            ? specialization.primaryStat
            : null;
        const shuffledStats = availableStats.filter(stat => stat !== primaryStat);
        for (let index = shuffledStats.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [shuffledStats[index], shuffledStats[randomIndex]] = [shuffledStats[randomIndex], shuffledStats[index]];
        }
        return [
            ...(primaryStat ? [primaryStat] : []),
            ...shuffledStats.slice(0, Math.max(0, statCount - (primaryStat ? 1 : 0)))
        ];
    }

    getScaledItemBonuses(item, level = this.getItemLevel(item.id), rarity = item.rarity, statKeys = null) {
        const multiplier = this.getItemPowerMultiplier(item, level, rarity);
        const entries = Array.isArray(statKeys)
            ? statKeys.map(stat => [stat, this.getEquipmentStatValue(item, stat)])
            : Object.entries(item.bonuses || {});
        return Object.fromEntries(
            entries
                .filter(([, value]) => Number.isFinite(value))
                .map(([stat, value]) => {
                    const scaledValue = value * multiplier;
                    return [stat, Math.round(scaledValue * 100) / 100];
                })
        );
    }

    getEquipmentJournalEntries() {
        return FUTURE_DROP_ITEMS
            .filter(item => item.kind === 'equipment')
            .map(item => {
                const discovery = this.equipmentJournal?.[item.id] || null;
                return {
                    item: discovery
                        ? {
                            ...item,
                            name: this.getEquipmentDisplayName(item, discovery.highestRarity),
                            image: this.getEquipmentRarityImage(item, discovery.highestRarity)
                        }
                        : item,
                    discovery
                };
            })
            .filter(entry => entry.discovery);
    }

    getEquipmentSourceLabel(mapKey, item) {
        return MAPS[mapKey]?.name || item?.dropFrom || 'Unknown route';
    }

    recordEquipmentDiscovery(item, instance, monster = null, mapKey = this.currentMapKey, announce = true) {
        if (item?.kind !== 'equipment' || !instance || !item.id) return null;

        const rarity = this.getRarityData(instance.rarity).name;
        const displayName = this.getEquipmentDisplayName(item, rarity);
        const rarityIndex = this.getRarityIndex(rarity);
        const rollQuality = this.getEquipmentRollQuality({
            ...item,
            statRolls: instance.statRolls
        });
        const score = Number.isFinite(instance.exceptionalScore)
            ? Math.max(0, Math.min(100, Math.floor(instance.exceptionalScore)))
            : rollQuality.score;
        const acquiredAt = Number.isFinite(instance.acquiredAt)
            ? Math.max(0, Math.floor(instance.acquiredAt))
            : Date.now();
        const sourceMonster = monster?.type || 'Legacy record';
        const sourceMap = this.getEquipmentSourceLabel(mapKey, item);
        const existing = this.equipmentJournal?.[item.id] || null;
        const previousRarityIndex = existing
            ? (Number.isInteger(existing.highestRarityIndex)
                ? existing.highestRarityIndex
                : this.getRarityIndex(existing.highestRarity))
            : -1;
        const previousScore = Number.isFinite(existing?.strongestRollQuality)
            ? existing.strongestRollQuality
            : null;
        const previousMasteryPoints = existing
            ? (Number.isFinite(existing.masteryPoints)
                ? Math.max(0, Math.floor(existing.masteryPoints))
                : EQUIPMENT_JOURNAL_MASTERY.firstDiscoveryPoints)
            : 0;
        const previousMasteryRank = existing
            ? this.getEquipmentJournalMasteryRank(previousMasteryPoints)
            : 0;
        const next = existing
            ? { ...existing }
            : {
                baseId: item.id,
                discoveredAt: acquiredAt,
                firstFoundAt: acquiredAt,
                highestRarity: rarity,
                highestRarityIndex: rarityIndex,
                strongestRollQuality: score,
                strongestRollAverage: rollQuality.average,
                sourceMonster,
                sourceMap,
                acquiredAt,
                strongestRollSourceMonster: sourceMonster,
                strongestRollSourceMap: sourceMap,
                strongestRollAcquiredAt: acquiredAt,
                masteryPoints: EQUIPMENT_JOURNAL_MASTERY.firstDiscoveryPoints,
                masteryRank: this.getEquipmentJournalMasteryRank(EQUIPMENT_JOURNAL_MASTERY.firstDiscoveryPoints)
            };

        let changed = !existing;
        const isHigherRarity = rarityIndex > previousRarityIndex;
        const isStrongerRoll = Number.isFinite(score)
            && (previousScore === null || score > previousScore);
        const isSameRarityWithStrongerRoll = rarityIndex === previousRarityIndex && isStrongerRoll;

        if (isHigherRarity || isSameRarityWithStrongerRoll) {
            next.highestRarity = rarity;
            next.highestRarityIndex = rarityIndex;
            next.sourceMonster = sourceMonster;
            next.sourceMap = sourceMap;
            next.acquiredAt = acquiredAt;
            changed = true;
        }

        if (isStrongerRoll) {
            next.strongestRollQuality = score;
            next.strongestRollAverage = rollQuality.average;
            next.strongestRollSourceMonster = sourceMonster;
            next.strongestRollSourceMap = sourceMap;
            next.strongestRollAcquiredAt = acquiredAt;
            changed = true;
        }

        const masteryPointsEarned = existing
            ? (isHigherRarity
                ? (rarityIndex - previousRarityIndex) * EQUIPMENT_JOURNAL_MASTERY.rarityImprovementPoints
                : 0)
                + (isStrongerRoll
                    ? Math.max(
                        EQUIPMENT_JOURNAL_MASTERY.rollImprovementPoints,
                        previousScore === null ? EQUIPMENT_JOURNAL_MASTERY.rollImprovementPoints : Math.ceil((score - previousScore) / 10)
                    )
                    : 0)
            : EQUIPMENT_JOURNAL_MASTERY.firstDiscoveryPoints;
        const nextMasteryPoints = Math.max(
            previousMasteryPoints,
            Math.min(999, previousMasteryPoints + Math.max(0, masteryPointsEarned))
        );
        const nextMasteryRank = this.getEquipmentJournalMasteryRank(nextMasteryPoints);
        const masteryChanged = nextMasteryPoints !== previousMasteryPoints;
        next.masteryPoints = nextMasteryPoints;
        next.masteryRank = nextMasteryRank;
        changed = changed || masteryChanged;

        if (!this.equipmentJournal || typeof this.equipmentJournal !== 'object') {
            this.equipmentJournal = this.createDefaultEquipmentJournal();
        }
        this.equipmentJournal[item.id] = next;
        if (!existing && announce) {
            this.addTabUnlock('discovery', `equipment:${item.id}`, displayName);
        }

        if (nextMasteryRank > previousMasteryRank) {
            this.updateWizardEquipmentStats();
            if (announce) {
                const mastery = this.getEquipmentJournalMasteryState(next);
                this.addLog(`JOURNAL MASTERY · ${displayName} reached ${mastery.rankName} · ${mastery.currentBonusSummary}.`, 'system');
                this.triggerCelebration('JOURNAL MASTERY', `${displayName} · ${mastery.rankName} · ${mastery.currentBonusSummary}`, 'milestone');
            }
        }

        if (announce && changed) {
            if (!existing) {
                this.addLog(`JOURNAL DISCOVERY · ${displayName} · ${rarity === 'Common' ? 'NORMAL' : rarity} quality recorded.`, 'system');
            } else if (isHigherRarity || isSameRarityWithStrongerRoll) {
                this.addLog(`JOURNAL UPDATED · ${displayName} · ${rarity === 'Common' ? 'NORMAL' : rarity}${Number.isFinite(score) ? ` · ${score}% strongest roll` : ''}.`, 'system');
            }
            this.notifyEquipmentJournalChanged();
        }
        return next;
    }

    notifyEquipmentJournalChanged() {
        window.dispatchEvent(new CustomEvent('robstradomus-equipment-journal-changed'));
    }

    getItemInstance(itemId) {
        const item = this.getItem(itemId);
        if (!item) return null;
        const ownedInstance = this.itemInstances?.[itemId];
        const baseId = ownedInstance?.baseId || item.baseId || item.id;
        const rarity = ownedInstance?.rarity || item.rarity;
        const level = this.getItemLevel(itemId);
        const rollQuality = this.getEquipmentRollQuality(ownedInstance
            ? { ...item, statRolls: ownedInstance.statRolls }
            : item);
        const exceptionalScore = Number.isFinite(ownedInstance?.exceptionalScore)
            ? Math.max(0, Math.min(100, Math.floor(ownedInstance.exceptionalScore)))
            : rollQuality.score;
        const normalizedBonuses = ownedInstance?.statRolls
            && typeof ownedInstance.statRolls === 'object'
            ? this.getRolledEquipmentBonuses(
                item,
                level,
                rarity,
                Object.keys(ownedInstance.statRolls),
                ownedInstance.statRolls
            )
            : null;
        const baseBonuses = normalizedBonuses
            || (ownedInstance
                ? this.getScaledItemBonuses(
                    item,
                    level,
                    rarity,
                    Object.keys(ownedInstance.bonuses || {})
                )
                : this.getScaledItemBonuses(item, level, rarity));
        return {
            ...item,
            id: itemId,
            baseId,
            name: item.kind === 'equipment' ? this.getEquipmentDisplayName(item, rarity) : item.name,
            rarity,
            level,
            acquiredAt: Number.isFinite(ownedInstance?.acquiredAt)
                ? Math.max(0, Math.floor(ownedInstance.acquiredAt))
                : null,
            exceptional: ownedInstance?.exceptional === true || rollQuality.exceptional,
            exceptionalScore,
            enhancementCount: this.getItemEnhancementCount(itemId),
            enhancementRolls: item.kind === 'equipment' ? this.getItemEnhancementRolls(itemId) : [],
            enhancementCriticals: item.kind === 'equipment' ? this.getItemEnhancementCriticals(itemId) : [],
            image: item.kind === 'equipment'
                ? this.getEquipmentRarityImage(item, rarity)
                : ownedInstance?.image || item.image || null,
            bonuses: this.applyGearEnhancementBonus(itemId, baseBonuses)
        };
    }

    getWeaponSpellProfile() {
        const weapon = this.getItemInstance(this.equipment?.weapon);
        const profile = weapon ? WEAPON_SPELLS[weapon.baseId || weapon.id] : null;
        if (profile) {
            return {
                ...profile,
                weaponId: weapon.baseId || weapon.id,
                weaponName: weapon.name,
                colors: { ...profile.colors }
            };
        }

        // Unknown future weapons still get a distinct, readable spell using
        // their rarity color until a bespoke profile is added to constants.js.
        if (weapon) {
            const rarityColor = this.getRarityData(weapon.rarity).color;
            return {
                ...DEFAULT_WEAPON_SPELL,
                id: `${weapon.baseId || weapon.id}-bolt`,
                weaponId: weapon.baseId || weapon.id,
                weaponName: weapon.name,
                colors: {
                    ...DEFAULT_WEAPON_SPELL.colors,
                    primary: rarityColor,
                    glow: rarityColor
                }
            };
        }

        return {
            ...DEFAULT_WEAPON_SPELL,
            colors: { ...DEFAULT_WEAPON_SPELL.colors }
        };
    }

    enhanceGear(itemId) {
        const state = this.getGearEnhancementState(itemId);
        if (!state || state.maxed || !state.canAfford) return false;

        const item = state.item;
        const definition = this.getItem(itemId);
        const instance = this.itemInstances?.[itemId];
        const nextEnhancement = state.enhancementCount + 1;
        const critical = Math.random() < GEAR_ENHANCEMENT_BALANCE.enhancementCriticalChance;
        const rollMin = critical
            ? GEAR_ENHANCEMENT_BALANCE.enhancementCriticalRollMin
            : GEAR_ENHANCEMENT_BALANCE.enhancementRollMin;
        const rollMax = critical
            ? GEAR_ENHANCEMENT_BALANCE.enhancementCriticalRollMax
            : GEAR_ENHANCEMENT_BALANCE.enhancementRollMax;
        const roll = rollMin + Math.random() * (rollMax - rollMin);
        this.salvageCurrency = Math.max(0, this.getSalvageCurrency() - state.cost);
        const enhancementRolls = [...state.enhancementRolls, roll];
        const enhancementCriticals = [...state.enhancementCriticals, critical];
        if (instance) {
            instance.enhancementCount = nextEnhancement;
            instance.enhancementRolls = enhancementRolls;
            instance.enhancementCriticals = enhancementCriticals;
            const baseBonuses = instance.statRolls && typeof instance.statRolls === 'object'
                ? this.getRolledEquipmentBonuses(
                    definition,
                    instance.level,
                    instance.rarity,
                    Object.keys(instance.statRolls),
                    instance.statRolls
                )
                : this.getScaledItemBonuses(
                    definition,
                    instance.level,
                    instance.rarity,
                    Object.keys(instance.bonuses || {})
                );
            instance.bonuses = this.applyGearEnhancementBonus(itemId, baseBonuses);
        } else {
            const baseId = item.baseId || item.id;
            this.itemEnhancementCounts[baseId] = nextEnhancement;
            this.itemEnhancementRolls[baseId] = enhancementRolls;
            this.itemEnhancementCriticals[baseId] = enhancementCriticals;
        }

        const totalBonusPercent = Math.round(this.getGearEnhancementBonus(nextEnhancement, enhancementRolls) * 100);
        const rollPercent = this.formatEnhancementRollPercent(roll);
        const criticalLabel = critical ? ' · ✦ CRITICAL HIT' : '';
        this.updateWizardEquipmentStats();
        this.addLog(`ENHANCED${critical ? ' · CRITICAL HIT' : ''} · ${item.name} · LAST ROLL +${rollPercent} · TOTAL ITEM BONUS +${totalBonusPercent}% · -${state.cost} ${SALVAGE_CURRENCY.name}.`, 'system');
        this.triggerCelebration(critical ? 'CRITICAL ENHANCEMENT' : 'GEAR ENHANCED', `${item.name} · +${rollPercent} ROLL${criticalLabel} · TOTAL +${totalBonusPercent}% · ${this.getSalvageCurrency()} ${SALVAGE_CURRENCY.shortName} REMAINING`, 'milestone');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return true;
    }

    useGearRollbackConsumable(consumableId, itemId) {
        const consumable = this.getItemDefinition(consumableId);
        const target = this.getItemInstance(itemId);
        const inventoryIndex = this.getInventoryIndex(consumableId);
        const stackCount = this.getConsumableCount(consumableId);
        if (consumable?.kind !== 'consumable'
            || consumable.gearAction !== 'rollback-enhancement'
            || inventoryIndex < 0
            || stackCount <= 0
            || target?.kind !== 'equipment'
            || this.getItemEnhancementCount(itemId) <= 0) return false;

        const previousState = this.getGearEnhancementState(itemId);
        const previousRoll = previousState?.enhancementRolls?.at(-1) || GEAR_ENHANCEMENT_BALANCE.enhancementRollMin;
        const nextRolls = previousState.enhancementRolls.slice(0, -1);
        const nextCriticals = previousState.enhancementCriticals.slice(0, -1);
        const nextCount = Math.max(0, previousState.enhancementCount - 1);
        const instance = this.itemInstances?.[itemId];
        if (instance) {
            instance.enhancementCount = nextCount;
            instance.enhancementRolls = nextRolls;
            instance.enhancementCriticals = nextCriticals;
        } else {
            const baseId = target.baseId || target.id;
            this.itemEnhancementCounts[baseId] = nextCount;
            this.itemEnhancementRolls[baseId] = nextRolls;
            this.itemEnhancementCriticals[baseId] = nextCriticals;
        }

        if (stackCount <= 1) {
            this.inventory[inventoryIndex] = null;
            delete this.consumableStacks[consumableId];
        } else {
            this.consumableStacks[consumableId] = stackCount - 1;
        }
        const totalBonusPercent = Math.round(this.getGearEnhancementBonus(nextCount, nextRolls) * 100);
        this.updateWizardEquipmentStats();
        this.addLog(`REVERSED · ${target.name} · REMOVED LAST ROLL +${this.formatEnhancementRollPercent(previousRoll)} · TOTAL ITEM BONUS +${totalBonusPercent}% · -1 ${consumable.name}.`, 'system');
        this.triggerCelebration('ENHANCEMENT REVERSED', `${target.name} · REMOVED +${this.formatEnhancementRollPercent(previousRoll)} ROLL · ${this.getConsumableCount(consumableId)} SEAL${this.getConsumableCount(consumableId) === 1 ? '' : 'S'} REMAIN`, 'salvage');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return true;
    }

    // Keep the older method name as a compatibility bridge for external callers;
    // each requested upgrade now buys one enhancement bonus rank.
    upgradeItemLevel(itemId, amount = 1) {
        const levels = Math.max(1, Math.floor(Number(amount) || 0));
        let upgraded = false;
        for (let index = 0; index < levels; index++) {
            if (!this.enhanceGear(itemId)) break;
            upgraded = true;
        }
        return upgraded;
    }

    getLocationItem(location) {
        if (!location || typeof location !== 'object') return null;
        if (location.type === 'inventory' && Number.isInteger(location.index)) {
            return this.getItemInstance(this.inventory[location.index]);
        }
        if (location.type === 'equipment' && typeof location.slot === 'string') {
            return this.getItemInstance(this.equipment[location.slot]);
        }
        return null;
    }

    getFirstEmptyInventorySlot() {
        return this.inventory.findIndex(itemId => !itemId);
    }

    getConsumableCount(itemId) {
        const definition = this.getItemDefinition(itemId);
        if (definition?.kind !== 'consumable') return 0;
        const count = this.consumableStacks?.[definition.id];
        return Number.isInteger(count) && count > 0 ? count : 0;
    }

    getTotalConsumableCount() {
        return CONSUMABLE_ITEMS.reduce(
            (total, item) => total + this.getConsumableCount(item.id),
            0
        );
    }

    getConsumableLoadoutUpgradeCount() {
        return Math.max(
            0,
            Math.min(
                CONSUMABLE_LOADOUT_UPGRADES.length,
                Math.floor(Number(this.consumableLoadoutUpgradeCount) || 0)
            )
        );
    }

    getConsumableLoadoutSlots() {
        return Math.min(
            CONSUMABLE_LOADOUT_MAX_SLOTS,
            CONSUMABLE_LOADOUT_INITIAL_SLOTS + this.getConsumableLoadoutUpgradeCount()
        );
    }

    formatConsumableLoadoutCosts(costs = {}) {
        return Object.entries(costs)
            .map(([costId, amount]) => {
                const definition = this.getItemDefinition(costId);
                const label = definition?.kind === 'material' ? definition.name : costId;
                return `${Math.max(0, Math.floor(Number(amount) || 0)).toLocaleString()} ${label}`;
            })
            .join(' · ');
    }

    getConsumableLoadoutCostBalance(costId) {
        if (['Gold', 'Mana', 'Rubies'].includes(costId)) {
            return Math.max(0, Math.floor(Number(this.wizard?.resources?.[costId]) || 0));
        }
        return this.getMaterialCount(costId);
    }

    getConsumableLoadoutUpgradeState() {
        const count = this.getConsumableLoadoutUpgradeCount();
        const slots = this.getConsumableLoadoutSlots();
        const next = CONSUMABLE_LOADOUT_UPGRADES[count] || null;
        const costs = next?.costs || null;
        const missingCosts = costs
            ? Object.entries(costs)
                .filter(([costId, amount]) => this.getConsumableLoadoutCostBalance(costId) < amount)
                .map(([costId, amount]) => {
                    const definition = this.getItemDefinition(costId);
                    const label = definition?.kind === 'material' ? definition.name : costId;
                    const missing = Math.max(0, Math.ceil(amount - this.getConsumableLoadoutCostBalance(costId)));
                    return `${missing.toLocaleString()} ${label}`;
                })
            : [];
        return {
            count,
            slots,
            maxSlots: CONSUMABLE_LOADOUT_MAX_SLOTS,
            next,
            nextSlots: next?.slots || slots,
            costs,
            costLabel: costs ? this.formatConsumableLoadoutCosts(costs) : '',
            missingCosts,
            missingCostLabel: missingCosts.join(' · '),
            canAfford: Boolean(next && costs && missingCosts.length === 0),
            maxed: !next
        };
    }

    getConsumableLoadoutState() {
        const equipped = (Array.isArray(this.equippedConsumables) ? this.equippedConsumables : [])
            .slice(0, this.getConsumableLoadoutSlots())
            .map(itemId => {
                const definition = this.getItemDefinition(itemId);
                if (definition?.kind !== 'consumable' || definition.gearAction || !(definition.duration > 0)) return null;
                return {
                    ...definition,
                    stackCount: this.getConsumableCount(definition.id),
                    active: Math.max(0, Number(this.activeConsumableEffects?.[definition.id]?.remaining) || 0),
                    autoUse: this.consumableAutoUse?.[definition.id] === true
                };
            })
            .filter(Boolean);
        return {
            slots: this.getConsumableLoadoutSlots(),
            maxSlots: CONSUMABLE_LOADOUT_MAX_SLOTS,
            equipped,
            equippedIds: equipped.map(item => item.id),
            highestTier: equipped.reduce((highest, item) => Math.max(highest, this.getRarityIndex(item.rarity)), -1),
            upgrade: this.getConsumableLoadoutUpgradeState()
        };
    }

    getConsumableEquipability(itemId, options = {}) {
        const definition = this.getItemDefinition(itemId);
        const requireStock = options.requireStock !== false;
        if (definition?.kind !== 'consumable' || definition.gearAction || !(definition.duration > 0)) {
            return { canEquip: false, reason: 'Only timed combat preparations can be equipped.' };
        }
        if (requireStock && this.getConsumableCount(definition.id) <= 0) {
            return { canEquip: false, reason: 'Craft or collect this preparation first.' };
        }
        const equippedIds = Array.isArray(this.equippedConsumables) ? this.equippedConsumables : [];
        if (equippedIds.includes(definition.id)) {
            return { canEquip: false, reason: 'This preparation is already equipped.' };
        }
        if (equippedIds.length >= this.getConsumableLoadoutSlots()) {
            return { canEquip: false, reason: 'Upgrade the loadout to unlock another equipped spot.' };
        }
        const highestTier = equippedIds.reduce((highest, equippedId) => {
            const equipped = this.getItemDefinition(equippedId);
            return Math.max(highest, this.getRarityIndex(equipped?.rarity));
        }, -1);
        const itemTier = this.getRarityIndex(definition.rarity);
        if (highestTier >= 0 && itemTier < highestTier) {
            return { canEquip: false, reason: 'A lower-tier preparation cannot join this loadout.' };
        }
        return { canEquip: true, reason: 'Ready to equip.' };
    }

    isConsumableEquipped(itemId) {
        return Array.isArray(this.equippedConsumables) && this.equippedConsumables.includes(itemId);
    }

    equipConsumable(itemId) {
        const state = this.getConsumableEquipability(itemId);
        if (!state.canEquip) return false;
        this.equippedConsumables = [...(this.equippedConsumables || []), itemId];
        if (!this.consumableAutoUse || typeof this.consumableAutoUse !== 'object') this.consumableAutoUse = {};
        this.consumableAutoUse[itemId] = false;
        const item = this.getItemDefinition(itemId);
        this.addLog(`LOADOUT · ${item.name} equipped as preparation ${this.equippedConsumables.length}.`, 'system');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return true;
    }

    unequipConsumable(itemId) {
        if (!this.isConsumableEquipped(itemId)) return false;
        this.equippedConsumables = this.equippedConsumables.filter(id => id !== itemId);
        delete this.consumableAutoUse[itemId];
        const item = this.getItemDefinition(itemId);
        this.addLog(`LOADOUT · ${item?.name || itemId} removed from the consumable rack.`, 'system');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return true;
    }

    setConsumableAutoUse(itemId, enabled) {
        if (!this.isConsumableEquipped(itemId)) return false;
        if (!this.consumableAutoUse || typeof this.consumableAutoUse !== 'object') this.consumableAutoUse = {};
        this.consumableAutoUse[itemId] = Boolean(enabled);
        const item = this.getItemDefinition(itemId);
        this.addLog(`AUTO-USE · ${item?.name || itemId} · ${enabled ? 'ARMED' : 'OFF'}.`, 'system');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return true;
    }

    purchaseConsumableLoadoutUpgrade() {
        const state = this.getConsumableLoadoutUpgradeState();
        if (!state.next || !state.canAfford || !this.wizard) return false;
        Object.entries(state.costs).forEach(([costId, amount]) => {
            if (['Gold', 'Mana', 'Rubies'].includes(costId)) {
                this.wizard.resources[costId] -= amount;
            } else {
                this.materials[costId] = this.getMaterialCount(costId) - amount;
            }
        });
        this.consumableLoadoutUpgradeCount = state.count + 1;
        this.addLog(`CONSUMABLE RACK UPGRADED · ${state.next.name} · ${state.next.slots} PREPARATION SLOTS.`, 'system');
        this.triggerCelebration('ARCANA RACK UPGRADED', `${state.next.name} · ${state.next.slots} PREPARATION SLOTS`, 'milestone');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return true;
    }

    hasInventorySpaceForItem(itemId) {
        const item = this.getItem(itemId);
        if (!item) return false;
        if (item.kind === 'consumable' && this.getInventoryIndex(item.id) >= 0) return true;
        return this.getFirstEmptyInventorySlot() >= 0;
    }

    addItemToInventory(itemId, preferredIndex = -1, quantity = 1) {
        const item = this.getItem(itemId);
        const amount = Math.floor(Number(quantity));
        if (!item || amount <= 0) return false;

        let targetIndex = item.kind === 'consumable' ? this.getInventoryIndex(item.id) : -1;
        if (targetIndex < 0) {
            targetIndex = Number.isInteger(preferredIndex)
                && preferredIndex >= 0
                && preferredIndex < this.inventory.length
                && !this.inventory[preferredIndex]
                ? preferredIndex
                : this.getFirstEmptyInventorySlot();
        }
        if (targetIndex < 0) return false;

        this.inventory[targetIndex] = item.id;
        if (item.kind === 'consumable') {
            this.consumableStacks[item.id] = this.getConsumableCount(item.id) + amount;
        }
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        this.addLog(`${item.name}${item.kind === 'consumable' ? ` ×${amount}` : ''} added to inventory.`);
        return true;
    }

    getInventoryIndex(itemId) {
        return this.inventory.findIndex(candidateId => candidateId === itemId);
    }

    getEquipmentSlotForItem(itemId) {
        return Object.entries(this.equipment)
            .find(([, equippedId]) => equippedId === itemId)?.[0] || null;
    }

    getSalvageValueForItem(item) {
        if (item?.kind !== 'equipment') return null;

        const definition = this.getItemDefinition(item.baseId || item.id);
        if (definition?.kind !== 'equipment') return null;

        // Every equipment item is salvageable, including a unique generated
        // drop. Keep a small fallback value for legacy or future definitions
        // that do not yet declare a material salvage table.
        const baseValue = Object.entries(definition.salvage || {})
            .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
            .reduce((total, [, amount]) => total + Math.max(1, Math.floor(amount)), 0);
        const normalizedBaseValue = Math.max(1, baseValue);
        const rarityMultiplier = this.getRarityData(item.rarity).multiplier;
        const levelMultiplier = 1 + Math.max(0, item.level - 1) * 0.1;
        const dust = Math.max(1, Math.floor(normalizedBaseValue * 10 * rarityMultiplier * levelMultiplier));
        return { [SALVAGE_CURRENCY.id]: dust };
    }

    getSalvageEntry(itemId) {
        if (typeof itemId !== 'string') return null;

        const inventoryIndex = this.inventory.indexOf(itemId);
        if (inventoryIndex < 0 || this.getEquipmentSlotForItem(itemId)) return null;

        const item = this.getItemInstance(itemId);
        const salvage = this.getSalvageValueForItem(item);
        if (!salvage) return null;

        return {
            item,
            itemId,
            inventoryIndex,
            salvage
        };
    }

    getSalvageValue(itemId) {
        return this.getSalvageEntry(itemId)?.salvage || null;
    }

    canSalvage(itemId) {
        return Boolean(this.getSalvageEntry(itemId));
    }

    getSalvageableInventoryEntries(maxRarity = RARITIES[0]?.name) {
        const maxRarityIndex = this.getRarityIndex(maxRarity);
        return this.inventory
            .map((itemId, inventoryIndex) => {
                const entry = this.getSalvageEntry(itemId);
                return entry ? { ...entry, inventoryIndex } : null;
            })
            .filter(entry => entry && this.getRarityIndex(entry.item.rarity) <= maxRarityIndex);
    }

    getSalvageableItemsByRarity(maxRarity = RARITIES[0]?.name) {
        return this.getSalvageableInventoryEntries(maxRarity).map(entry => entry.item);
    }

    applySalvageRewards(rewards = {}) {
        Object.entries(rewards).forEach(([currencyId, amount]) => {
            const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
            if (currencyId === SALVAGE_CURRENCY.id && safeAmount > 0) {
                this.salvageCurrency = this.getSalvageCurrency() + safeAmount;
            }
        });
    }

    setAutoSalvageNonExceptional(enabled) {
        const nextValue = Boolean(enabled);
        if (this.autoSalvageNonExceptional === nextValue) return false;
        this.autoSalvageNonExceptional = nextValue;
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return true;
    }

    salvageAllByRarity(maxRarity = RARITIES[0]?.name) {
        // Snapshot complete inventory entries once. This keeps preview and
        // execution aligned and avoids looking up a removed instance by ID.
        const entries = this.getSalvageableInventoryEntries(maxRarity);
        if (entries.length === 0) return { count: 0, rewards: {} };

        const rewards = {};
        const salvagedNames = [];
        entries.forEach(({ item, itemId, inventoryIndex, salvage }) => {
            if (this.inventory[inventoryIndex] !== itemId) return;

            this.inventory[inventoryIndex] = null;
            delete this.itemInstances[itemId];
            salvagedNames.push(item.name);
            Object.entries(salvage).forEach(([currencyId, amount]) => {
                rewards[currencyId] = (rewards[currencyId] || 0) + amount;
            });
        });

        if (salvagedNames.length === 0) return { count: 0, rewards: {} };
        this.applySalvageRewards(rewards);
        this.checkRecipeDiscoveries(true);

        const rewardSummary = Object.entries(rewards)
            .map(([currencyId, amount]) => currencyId === SALVAGE_CURRENCY.id
                ? this.formatSalvageReward(amount)
                : `+${amount} ${this.getItemDefinition(currencyId)?.name || currencyId}`)
            .join(' · ');
        const rarityLabel = this.getRarityData(maxRarity).displayName || maxRarity;
        this.addLog(`SALVAGED ALL · ${salvagedNames.length} ${rarityLabel} or lower gear · ${rewardSummary}`, 'defeat');
        this.triggerCelebration('ARCANE SALVAGE', `${salvagedNames.length} gear pieces · ${rewardSummary}`, 'salvage');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        this.draw();
        return { count: salvagedNames.length, rewards };
    }

    salvageItem(itemId) {
        const entry = this.getSalvageEntry(itemId);
        if (!entry) return false;

        this.inventory[entry.inventoryIndex] = null;
        delete this.itemInstances[entry.itemId];
        this.applySalvageRewards(entry.salvage);
        this.checkRecipeDiscoveries(true);

        const rewardSummary = Object.entries(entry.salvage)
            .map(([currencyId, amount]) => currencyId === SALVAGE_CURRENCY.id
                ? this.formatSalvageReward(amount)
                : `+${amount} ${this.getItemDefinition(currencyId)?.name || currencyId}`)
            .join(' · ');
        this.addLog(`SALVAGED · ${entry.item.name} · ${rewardSummary}`, 'defeat');
        this.triggerCelebration('ARCANE SALVAGE', `${entry.item.name} · ${rewardSummary}`, 'salvage');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        this.draw();
        return true;
    }

    moveItem(source, destination) {
        const sourceItem = this.getLocationItem(source);
        if (!sourceItem || !destination || source === destination) return false;

        if (source.type === 'inventory' && destination.type === 'inventory') {
            if (!Number.isInteger(destination.index)
                || source.index < 0 || source.index >= this.inventory.length
                || destination.index < 0 || destination.index >= this.inventory.length) {
                return false;
            }
            [this.inventory[source.index], this.inventory[destination.index]] =
                [this.inventory[destination.index], this.inventory[source.index]];
        } else if (source.type === 'inventory' && destination.type === 'equipment') {
            if (sourceItem.slot !== destination.slot || !Object.prototype.hasOwnProperty.call(this.equipment, destination.slot)) {
                return false;
            }
            const displacedItemId = this.equipment[destination.slot];
            this.equipment[destination.slot] = sourceItem.id;
            this.inventory[source.index] = displacedItemId || null;
        } else if (source.type === 'equipment' && destination.type === 'inventory') {
            if (!Number.isInteger(destination.index)
                || destination.index < 0 || destination.index >= this.inventory.length) {
                return false;
            }
            const displacedItemId = this.inventory[destination.index];
            if (displacedItemId) {
                const displacedItem = this.getItem(displacedItemId);
                if (!displacedItem || displacedItem.slot !== source.slot) return false;
            }
            this.inventory[destination.index] = sourceItem.id;
            this.equipment[source.slot] = displacedItemId || null;
        } else {
            return false;
        }

        this.updateWizardEquipmentStats();
        if (destination.type === 'equipment') {
            this.addLog(`${sourceItem.name} equipped.`);
        } else if (source.type === 'equipment') {
            this.addLog(`${sourceItem.name} moved to inventory.`);
        }
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        this.draw();
        return true;
    }

    unequipItem(slot, preferredIndex = -1) {
        if (!Object.prototype.hasOwnProperty.call(this.equipment, slot) || !this.equipment[slot]) {
            return false;
        }

        const targetIndex = Number.isInteger(preferredIndex)
            && preferredIndex >= 0
            && preferredIndex < this.inventory.length
            && !this.inventory[preferredIndex]
            ? preferredIndex
            : this.getFirstEmptyInventorySlot();
        if (targetIndex < 0) return false;

        return this.moveItem(
            { type: 'equipment', slot },
            { type: 'inventory', index: targetIndex }
        );
    }

    toggleEquipment(itemId) {
        const item = this.getItem(itemId);
        if (!item) return false;

        const equippedSlot = this.getEquipmentSlotForItem(itemId);
        if (equippedSlot) return this.unequipItem(equippedSlot);

        const inventoryIndex = this.getInventoryIndex(itemId);
        if (inventoryIndex < 0) return false;
        return this.moveItem(
            { type: 'inventory', index: inventoryIndex },
            { type: 'equipment', slot: item.slot }
        );
    }

    equipUpgrade(itemId) {
        const item = this.getItemInstance(itemId);
        if (item?.kind !== 'equipment'
            || !Object.prototype.hasOwnProperty.call(this.equipment, item.slot)
            || this.getEquipmentSlotForItem(itemId)
            || this.getInventoryIndex(itemId) < 0) {
            return false;
        }

        // Moving directly from inventory to the matching slot atomically swaps
        // the old gear into the selected item's original inventory slot.
        return this.moveItem(
            { type: 'inventory', index: this.getInventoryIndex(itemId) },
            { type: 'equipment', slot: item.slot }
        );
    }

    getEquipmentBonuses() {
        const bonuses = { maxHp: 0, atk: 0, speed: 0, regenHp: 0, crit: 0, critDamage: 0 };
        for (const itemId of Object.values(this.equipment)) {
            const item = this.getItemInstance(itemId);
            if (!item) continue;
            bonuses.maxHp += item.bonuses.maxHp || 0;
            bonuses.atk += item.bonuses.atk || 0;
            bonuses.speed += item.bonuses.speed || 0;
            bonuses.regenHp += item.bonuses.regenHp || 0;
            bonuses.crit += item.bonuses.crit || 0;
            bonuses.critDamage += item.bonuses.critDamage || 0;
        }
        return bonuses;
    }

    getTemporaryBonusStats() {
        const bonuses = { maxHp: 0, atk: 0, speed: 0, regenHp: 0, crit: 0, critDamage: 0 };
        for (const [effectId, effect] of Object.entries(this.activeConsumableEffects || {})) {
            if (!Number.isFinite(effect?.remaining) || effect.remaining <= 0) continue;
            const definition = CONSUMABLE_ITEMS.find(item => item.id === effectId);
            if (!definition) continue;
            for (const stat of Object.keys(bonuses)) {
                bonuses[stat] += Number(definition.bonuses?.[stat]) || 0;
            }
        }
        return bonuses;
    }

    getActiveConsumableEffects() {
        return Object.entries(this.activeConsumableEffects || {})
            .map(([effectId, effect]) => ({
                definition: CONSUMABLE_ITEMS.find(item => item.id === effectId),
                remaining: Math.max(0, effect?.remaining || 0)
            }))
            .filter(effect => effect.definition && effect.remaining > 0);
    }

    updateWizardEquipmentStats() {
        if (!this.wizard) return;
        const gearBonuses = this.getEquipmentBonuses();
        const temporaryBonuses = this.getTemporaryBonusStats();
        this.wizard.equipmentStats = Object.fromEntries(
            Object.keys(gearBonuses).map(stat => [stat, gearBonuses[stat] + temporaryBonuses[stat]])
        );
        const titleBonuses = this.getAchievementTitleBonuses();
        this.wizard.titleStats = Object.fromEntries(
            Object.keys(gearBonuses).map(stat => [stat, titleBonuses[stat] || 0])
        );
        const journalBonuses = this.getEquipmentJournalMasteryBonuses();
        this.wizard.journalStats = Object.fromEntries(
            Object.keys(gearBonuses).map(stat => [stat, journalBonuses[stat] || 0])
        );
        const achievementBonuses = this.getAchievementFinalRewardBonuses();
        this.wizard.achievementStats = Object.fromEntries(
            Object.keys(gearBonuses).map(stat => [stat, achievementBonuses[stat] || 0])
        );
        this.wizard.upgradeMultipliers = this.getUpgradeAttunementBonuses();
        const weaponSpell = this.getWeaponSpellProfile();
        const baseSpriteGearSlots = new Set(['head', 'weapon', 'chest', 'boots']);
        this.wizard.setEquipmentVisuals(Object.fromEntries(
            Object.entries(this.equipment).map(([slot, itemId]) => {
                const item = this.getItemInstance(itemId);
                const isStarterGear = CHARACTER_ITEMS.some(starter => starter.id === (item?.baseId || item?.id));
                // The base wizard sprite already depicts the starter hat, robe,
                // boots, and staff. Do not composite those same starter pieces a
                // second time; rings and relics remain separate accessories.
                if (isStarterGear && baseSpriteGearSlots.has(slot)) return [slot, null];
                if (item?.kind !== 'equipment' || !item.image) return [slot, null];
                return [slot, {
                    image: this.images[item.image] || null,
                    rarity: item.rarity,
                    color: this.getRarityData(item.rarity).color,
                    spell: slot === 'weapon' ? weaponSpell : null
                }];
            })
        ));
        const maxHp = this.wizard.getEffectiveStats().maxHp;
        this.wizard.hp = Math.min(this.wizard.hp, maxHp);
    }

    updateTemporaryEffects(dt) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        const expiredEffects = [];
        for (const [effectId, effect] of Object.entries(this.activeConsumableEffects || {})) {
            if (!Number.isFinite(effect?.remaining)) {
                delete this.activeConsumableEffects[effectId];
                continue;
            }
            effect.remaining -= dt;
            if (effect.remaining <= 0) {
                delete this.activeConsumableEffects[effectId];
                expiredEffects.push(effectId);
            }
        }
        if (expiredEffects.length === 0) return;
        this.updateWizardEquipmentStats();
        expiredEffects.forEach(effectId => {
            const definition = CONSUMABLE_ITEMS.find(item => item.id === effectId);
            if (definition) this.addLog(`${definition.name} expired.`, 'system');
            if (this.isConsumableEquipped(effectId)
                && this.consumableAutoUse?.[effectId] === true
                && this.getConsumableCount(effectId) > 0) {
                this.useConsumable(effectId, { automatic: true });
            }
        });
        this.saveProgress();
        this.notifyInventoryChanged();
    }

    notifyInventoryChanged() {
        window.dispatchEvent(new CustomEvent('robstradomus-inventory-changed'));
    }

    getRarityIndex(rarity) {
        const index = RARITIES.findIndex(entry => entry.name === rarity);
        return index >= 0 ? index : 0;
    }

    getLootProgressionScore(
        zoneNumber = this.zoneNumber,
        waveNumber = this.waveNumber,
        mapKey = this.currentMapKey
    ) {
        const safeZone = Math.max(1, Math.floor(Number(zoneNumber) || 1));
        const safeWave = Math.max(1, Math.floor(Number(waveNumber) || 1));
        const mapDepth = Math.max(0, Object.keys(MAPS).indexOf(mapKey));
        return (safeZone - 1) * WAVE_PATTERNS.length + safeWave + mapDepth;
    }

    getMaxLootRarityIndex(
        zoneNumber = this.zoneNumber,
        waveNumber = this.waveNumber,
        mapKey = this.currentMapKey
    ) {
        const progressionScore = this.getLootProgressionScore(zoneNumber, waveNumber, mapKey);
        return RARITIES.reduce((highestIndex, rarity, index) =>
            progressionScore >= (rarity.unlockScore ?? 0) ? index : highestIndex, 0);
    }

    getUnlockedLootRarityIndex() {
        const permanentIndex = Number.isInteger(this.maxLootRarityUnlocked)
            ? this.maxLootRarityUnlocked
            : 0;
        const activeIndex = Math.max(0, Math.min(
            RARITIES.length - 1,
            this.getMaxLootRarityIndex()
        ));

        // A rarity can be permanently discovered, but it is only available as
        // a drop while the active map, zone, and wave support that difficulty.
        // This prevents late-game loot from leaking into easier farming routes.
        if (activeIndex > permanentIndex) this.maxLootRarityUnlocked = activeIndex;
        return activeIndex;
    }

    getLootProgression() {
        const score = this.getLootProgressionScore();
        const maxIndex = this.getUnlockedLootRarityIndex();
        const current = RARITIES[maxIndex] || RARITIES[0];
        const next = RARITIES[maxIndex + 1] || null;
        return {
            score,
            maxIndex,
            current,
            next,
            pointsToNext: next ? Math.max(0, next.unlockScore - score) : 0
        };
    }

    announceLootRarityUnlock(previousIndex = this.maxLootRarityUnlocked, celebrate = true) {
        const currentIndex = this.getMaxLootRarityIndex();
        const safePreviousIndex = Number.isInteger(previousIndex) ? previousIndex : 0;
        if (currentIndex <= safePreviousIndex) return;

        this.maxLootRarityUnlocked = currentIndex;
        for (let index = safePreviousIndex + 1; index <= currentIndex; index++) {
            const rarity = RARITIES[index];
            this.addLog(`RARITY UNLOCKED · ${rarity.displayName || rarity.name} quality drops can now appear.`, 'defeat');
        }

        if (celebrate) {
            const rarity = RARITIES[currentIndex];
            this.triggerCelebration(
                `${rarity.displayName || rarity.name} LOOT UNLOCKED`,
                `HIGHER QUALITY DROPS CAN NOW APPEAR · DEPTH ${this.getLootProgressionScore()}`,
                'milestone'
            );
        }
    }

    promoteLootRarity(baseRarity, monster) {
        const maxIndex = this.getUnlockedLootRarityIndex();
        const availableRarities = RARITIES.slice(0, maxIndex + 1);
        if (availableRarities.length <= 1) return RARITIES[0].name;

        // Rarity is a weighted roll across every tier that has been unlocked.
        // The item's authored rarity is only a soft preference now; it is never
        // a minimum. This keeps Normal/Common and earlier tiers in the pool after
        // Uncommon, Rare, Epic, or Legendary becomes available.
        const baseIndex = Math.min(this.getRarityIndex(baseRarity), maxIndex);
        const threatBonus = monster?.isBoss
            ? 0.12
            : monster?.isElite
                ? 0.06
                : 0;
        const zoneStep = Math.max(1, Math.floor(Number(LOOT_RARITY_DEPTH_BALANCE.zoneStep) || 5));
        const handoffZones = Math.max(
            zoneStep,
            Math.floor(Number(LOOT_RARITY_DEPTH_BALANCE.handoffZones) || zoneStep * 2)
        );
        const handoffBands = Math.max(1, Math.ceil(handoffZones / zoneStep));
        const currentZone = Math.max(1, Math.floor(Number(this.zoneNumber) || 1));
        const currentZoneBand = Math.floor(currentZone / zoneStep);
        const baseWeightExponent = Math.max(
            0.05,
            Math.min(1, Number(LOOT_RARITY_DEPTH_BALANCE.baseWeightExponent) || 0.35)
        );
        const focusSharpness = Math.max(
            0.1,
            Number(LOOT_RARITY_DEPTH_BALANCE.focusSharpness) || 0.75
        );

        // Quality focus moves one tier at a time. A tier begins its handoff when
        // it unlocks, then takes two five-zone bands to become the leading tier.
        // This creates the intended progression: Normal leads first, Uncommon
        // takes over next, Rare follows and eventually leads, and so on.
        let qualityFocus = 0;
        for (let index = 1; index <= maxIndex; index++) {
            const unlockScore = Math.max(0, Number(RARITIES[index].unlockScore) || 0);
            const unlockZone = Math.max(
                1,
                Math.ceil((unlockScore - 1) / Math.max(1, WAVE_PATTERNS.length))
            );
            const unlockBand = Math.floor(unlockZone / zoneStep);
            const handoffProgress = Math.max(
                0,
                Math.min(1, (currentZoneBand - unlockBand) / handoffBands)
            );
            qualityFocus += handoffProgress;
        }

        const weights = availableRarities.map((rarity, index) => {
            const authoredTierBias = index === baseIndex ? 1.1 : 1;
            const threatTierBias = 1 + index * threatBonus;
            // Compress the authored weights so Common does not permanently
            // dominate, then center a smooth distribution on the current focus.
            // Lower tiers naturally lose share as the focus moves upward, while
            // every unlocked tier remains possible.
            const authoredWeight = Math.pow(
                Math.max(0.001, Number(rarity.dropWeight) || 1),
                baseWeightExponent
            );
            const distanceFromFocus = index - qualityFocus;
            const focusWeight = Math.exp(-focusSharpness * distanceFromFocus * distanceFromFocus);
            return Math.max(
                0.001,
                authoredWeight
                * focusWeight
                * authoredTierBias
                * threatTierBias
            );
        });
        const totalWeight = weights.reduce((total, weight) => total + weight, 0);
        let roll = Math.random() * totalWeight;
        for (let index = 0; index < weights.length; index++) {
            roll -= weights[index];
            if (roll < 0) return availableRarities[index].name;
        }
        return availableRarities[availableRarities.length - 1].name;
    }

    getEquipmentDropLevel() {
        // Zone depth is the item-level floor. This makes a Normal drop from
        // Zone 10 meaningfully stronger than a Normal drop from Zone 1 while
        // keeping the number easy to understand in the item card and tooltip.
        // The floor now reaches the temporary Zone 200 endgame cap so deep
        // farming can continue improving gear instead of flattening at Zone 100.
        return Math.max(
            1,
            Math.min(
                ENDGAME_BALANCE.maxZone,
                Math.floor(Number(this.zoneNumber) || 1)
            )
        );
    }

    createLootInstance(item, rarity = item.rarity) {
        const safeRarity = this.getRarityData(rarity).name;
        const acquiredAt = Date.now();
        const instanceId = `${item.id}~${acquiredAt.toString(36)}~${Math.random().toString(36).slice(2, 8)}`;
        const isEquipment = item.kind === 'equipment';
        const level = isEquipment ? this.getEquipmentDropLevel() : 1;
        const statKeys = isEquipment
            ? this.rollEquipmentStatKeys(item, safeRarity)
            : null;
        const statRolls = isEquipment
            ? Object.fromEntries(statKeys.map(stat => [stat, Math.random()]))
            : null;
        const rollQuality = isEquipment
            ? this.getEquipmentRollQuality({ ...item, statRolls })
            : null;
        const instance = {
            baseId: item.id,
            rarity: safeRarity,
            level,
            enhancementCount: 0,
            enhancementRolls: [],
            acquiredAt,
            image: item.image || null,
            bonuses: isEquipment
                ? this.getRolledEquipmentBonuses(item, level, safeRarity, statKeys, statRolls)
                : this.getScaledItemBonuses(item, level, safeRarity, statKeys),
            ...(isEquipment
                ? {
                    exceptional: Boolean(rollQuality?.exceptional),
                    exceptionalScore: rollQuality?.score ?? null
                }
                : {})
        };
        if (isEquipment) instance.statRolls = statRolls;
        this.itemInstances[instanceId] = instance;
        return instanceId;
    }

    getLootCandidates(monster, mapKey = this.currentMapKey) {
        return FUTURE_DROP_ITEMS.filter(item => {
            const mapMatches = (item.dropMaps || []).includes(mapKey);
            const monsterMatches = (item.dropMonsters || []).includes(monster.type);

            // Equipment routes are biome-specific. Explicit map assignments are
            // authoritative so a gear piece cannot leak through a matching
            // monster name in another route.
            if (item.kind === 'equipment' && item.dropMaps?.length > 0) {
                return mapMatches;
            }

            return monsterMatches || mapMatches;
        });
    }

    getLootDropChance(item, monster, mapKey = this.currentMapKey) {
        const isEquipment = item?.kind === 'equipment';
        const baseChance = monster.isBoss
            ? (item.bossDropChance ?? item.eliteDropChance ?? item.dropChance ?? 0)
            : monster.isElite
                ? (item.eliteDropChance ?? item.dropChance ?? 0)
                : (item.dropChance ?? 0);
        const adjustedBaseChance = isEquipment ? (baseChance || 0) * 0.75 : (baseChance || 0);

        // Equipment gets only a small depth increase so repeated farming does
        // not turn into an inventory flood. Materials retain their established
        // map and boss bonuses, while equipment uses explicit low-rate fields.
        // The extra multiplier keeps gear aspirational as zones and waves scale,
        // without slowing the material economy or other progression rewards.
        const zoneBonus = isEquipment
            ? Math.min(0.035, Math.max(0, this.zoneNumber - 1) * 0.003) * 0.75
            : Math.min(0.22, Math.max(0, this.zoneNumber - 1) * 0.025);
        const waveBonus = isEquipment
            ? Math.max(0, this.waveNumber - 1) * 0.006 * 0.75
            : Math.max(0, this.waveNumber - 1) * 0.04;
        const mapBonus = Math.max(0, Number(MAPS[mapKey]?.lootChanceBonus) || 0);
        const adjustedMapBonus = isEquipment ? mapBonus * 0.25 : mapBonus;
        const bossBonus = !isEquipment && monster.isBoss ? BOSS_WAVE_BALANCE.lootChanceBonus : 0;
        const cap = isEquipment ? 0.14 : 0.85;
        return Math.min(cap, Math.max(0, adjustedBaseChance + zoneBonus + waveBonus + adjustedMapBonus + bossBonus));
    }

    recordLootDrop(item, rarity, quantity, instance = null) {
        if (!item || !Number.isFinite(quantity) || quantity <= 0) return;
        const equipmentStats = item.kind === 'equipment' && instance
            ? this.getEquipmentStatKeys(instance).map(stat => ({
                stat,
                value: instance.bonuses?.[stat],
                range: this.getEquipmentStatRollRange(stat, instance.level, instance.rarity, item)
            }))
            : [];
        const progression = item.kind === 'equipment'
            ? this.getEquipmentStatProgression(rarity)
            : null;
        this.session.recentLoot.unshift({
            name: instance?.name || item.name,
            rarity,
            quantity: Math.floor(quantity),
            icon: item.icon || '◆',
            equipment: item.kind === 'equipment'
                ? {
                    level: instance.level,
                    slots: progression.slots,
                    rolledCount: equipmentStats.length,
                    exceptional: instance.exceptional === true,
                    exceptionalScore: instance.exceptionalScore,
                    stats: equipmentStats
                }
                : null
        });
        this.session.recentLoot = this.session.recentLoot.slice(0, 5);
    }

    rollLootDrop(monster, mapKey = this.currentMapKey) {
        const candidates = this.getLootCandidates(monster, mapKey);
        if (candidates.length === 0) return null;

        const eligible = candidates.filter(item => Math.random() < this.getLootDropChance(item, monster, mapKey));
        if (eligible.length === 0) return null;
        const item = eligible[Math.floor(Math.random() * eligible.length)];
        const rarity = this.promoteLootRarity(item.rarity, monster);

        // Materials live in the dedicated material wallet and should never be
        // lost because the equipment bag is full.
        if (item.kind === 'material') {
            const zoneQuantityBonus = Math.floor(Math.max(0, this.zoneNumber - 1) / ENDGAME_BALANCE.materialZoneQuantityStep);
            const quantityMultiplier = monster.isBoss
                ? ENDGAME_BALANCE.materialBossMultiplier
                : monster.isElite
                    ? ENDGAME_BALANCE.materialEliteMultiplier
                    : 1;
            const quantity = Math.max(1, (1 + zoneQuantityBonus) * quantityMultiplier);
            const previousTotal = this.getMaterialCount(item.id);
            if (previousTotal === 0) {
                this.addTabUnlock('materials', `material:${item.id}`, item.name);
            }
            this.materials[item.id] = previousTotal + quantity;
            const currentTotal = this.getMaterialCount(item.id);
            this.session.lootDrops += quantity;
            this.lifetimeStats.loot += quantity;
            this.lifetimeStats.materials += quantity;
            this.recordLootDrop(item, rarity, quantity);
            this.addLog(`LOOT · ${item.name} ×${quantity}${rarity !== item.rarity ? ` · ${rarity} quality` : ''}`, 'defeat');
            const newlyDiscoveredRecipes = this.checkRecipeDiscoveries(true);
            const newlyDiscoveredRecipeIds = new Set(newlyDiscoveredRecipes.map(recipe => recipe.id));
            const recipeProgress = CRAFTING_RECIPES
                .filter(recipe => Object.prototype.hasOwnProperty.call(recipe.materials || {}, item.id))
                .map(recipe => {
                    const discovery = this.getCraftingRecipeState(recipe.id);
                    if (!discovery?.discovered) return null;
                    const required = Math.max(1, Math.floor(Number(recipe.materials[item.id]) || 0));
                    const output = this.getItemDefinition(recipe.output);
                    return {
                        id: recipe.id,
                        name: output?.name || recipe.output,
                        current: Math.min(currentTotal, required),
                        required,
                        advances: previousTotal < required,
                        newlyDiscovered: newlyDiscoveredRecipeIds.has(recipe.id),
                        ready: this.canCraft(recipe)
                    };
                })
                .filter(Boolean);
            const mapData = MAPS[mapKey] || MAPS[this.currentMapKey] || {};
            window.dispatchEvent(new CustomEvent('robstradomus-material-pickup', {
                detail: {
                    itemId: item.id,
                    name: item.name,
                    icon: item.icon || '◆',
                    image: item.image || null,
                    quantity,
                    total: currentTotal,
                    mapKey,
                    mapName: mapData.name || 'Current Route',
                    mapAccent: mapData.celebrationColor || mapData.color || '#75b8ff',
                    recipes: recipeProgress
                }
            }));
            this.notifyInventoryChanged();
            return { item, rarity, quantity };
        }

        const targetIndex = this.getFirstEmptyInventorySlot();
        const autoSalvage = this.autoSalvageNonExceptional === true && item.kind === 'equipment';
        if (targetIndex < 0 && !autoSalvage) {
            const displayName = this.getEquipmentDisplayName(item, rarity);
            this.addLog(`LOOT LOST · ${displayName} dropped, but your inventory is full.`, 'enemy');
            return { item, rarity, quantity: 0, lost: true };
        }

        const instanceId = this.createLootInstance(item, rarity);
        const rawInstance = this.itemInstances?.[instanceId];
        const instance = this.getItemInstance(instanceId);
        this.recordEquipmentDiscovery(item, rawInstance, monster, mapKey);
        this.session.lootDrops += 1;
        this.lifetimeStats.loot += 1;
        this.recordLootDrop(item, rarity, 1, instance);

        if (autoSalvage && !instance.exceptional) {
            const salvage = this.getSalvageValueForItem(instance);
            delete this.itemInstances[instanceId];
            this.applySalvageRewards(salvage);
            const rewardSummary = Object.entries(salvage || {})
                .map(([currencyId, amount]) => currencyId === SALVAGE_CURRENCY.id
                    ? this.formatSalvageReward(amount)
                    : `+${amount} ${this.getItemDefinition(currencyId)?.name || currencyId}`)
                .join(' · ');
            this.addLog(`AUTO-SALVAGED · ${instance.name} · ${rewardSummary}`, 'defeat');
            this.notifyInventoryChanged();
            return { item, rarity, quantity: 1, autoSalvaged: true };
        }

        this.inventory[targetIndex] = instanceId;
        this.addTabUnlock('character', instanceId, instance.name);
        const progression = this.getEquipmentStatProgression(rarity);
        const statSummary = this.formatEquipmentStatSummary(instance) || 'No rolled stats';
        const exceptionalLabel = instance.exceptional
            ? `✦ EXCEPTIONAL FIND · ${instance.name} · ${instance.exceptionalScore}% ROLL QUALITY.`
            : null;
        this.addLog(exceptionalLabel
            || `LOOT · ${rarity.toUpperCase()} ${instance.name} · ${progression.slots} stat slot${progression.slots === 1 ? '' : 's'} · ${statSummary}.`, 'defeat');
        if (instance.exceptional) {
            this.triggerCelebration(
                'EXCEPTIONAL FIND',
                `${instance.name} · ${instance.exceptionalScore}% ROLL QUALITY · KEEP THIS`,
                'exceptional'
            );
        }
        this.notifyInventoryChanged();
        return { item, rarity, quantity: 1, instanceId };
    }

    getMaterialCount(itemId) {
        return Math.max(0, Math.floor(this.materials?.[itemId] || 0));
    }

    canCraft(recipe) {
        if (!recipe || !this.getCraftingRecipeState(recipe.id)?.discovered) return false;
        return this.hasInventorySpaceForItem(recipe.output)
            && Object.entries(recipe.materials || {}).every(([itemId, amount]) => this.getMaterialCount(itemId) >= amount);
    }

    craftItem(recipeId) {
        const recipe = CRAFTING_RECIPES.find(entry => entry.id === recipeId);
        const item = recipe ? this.getItemDefinition(recipe.output) : null;
        if (!recipe || !item || !['consumable', 'equipment'].includes(item.kind) || !this.canCraft(recipe)) return false;

        const inventoryIndex = item.kind === 'consumable' ? this.getInventoryIndex(item.id) : -1;
        const targetIndex = inventoryIndex >= 0 ? inventoryIndex : this.getFirstEmptyInventorySlot();
        if (targetIndex < 0) return false;

        for (const [itemId, amount] of Object.entries(recipe.materials || {})) {
            this.materials[itemId] = this.getMaterialCount(itemId) - amount;
        }

        let craftedItemId = item.id;
        let craftedItem = item;
        if (item.kind === 'equipment') {
            // Equipment outputs become real unique instances so they participate
            // in the same equip, journal, enhancement, and salvage paths as drops.
            craftedItemId = this.createLootInstance(item, recipe.rarity || item.rarity);
            const rawInstance = this.itemInstances?.[craftedItemId];
            craftedItem = this.getItemInstance(craftedItemId) || item;
            this.inventory[targetIndex] = craftedItemId;
            const recipeMap = recipe.discovery?.conditions?.find(condition => condition.type === 'zone')?.map
                || this.currentMapKey;
            this.recordEquipmentDiscovery(item, rawInstance, null, recipeMap);
            this.addTabUnlock('character', craftedItemId, craftedItem.name);
        } else {
            this.inventory[targetIndex] = item.id;
            this.consumableStacks[item.id] = this.getConsumableCount(item.id) + 1;
        }

        this.lifetimeStats.crafts += 1;
        this.checkAchievementUnlocks();
        const craftedLabel = item.kind === 'equipment'
            ? `${craftedItem.name} · ${this.formatEquipmentStatSummary(craftedItem) || 'rolled gear'}`
            : `${item.name} ×1`;
        this.addLog(`CRAFTED · ${recipe.rarity.toUpperCase()} ${craftedLabel} added to inventory.`, 'defeat');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return true;
    }

    useConsumable(itemId, options = {}) {
        const inventoryIndex = this.getInventoryIndex(itemId);
        const item = inventoryIndex >= 0 ? this.getItemInstance(itemId) : null;
        const effectId = item?.baseId || item?.id;
        const definition = CONSUMABLE_ITEMS.find(entry => entry.id === effectId);
        const stackCount = definition ? this.getConsumableCount(definition.id) : 0;
        if (inventoryIndex < 0 || !definition || definition.gearAction || stackCount <= 0) return false;

        if (stackCount <= 1) {
            this.inventory[inventoryIndex] = null;
            delete this.consumableStacks[definition.id];
        } else {
            this.consumableStacks[definition.id] = stackCount - 1;
        }
        this.activeConsumableEffects[definition.id] = {
            remaining: definition.duration
        };
        this.updateWizardEquipmentStats();
        this.addLog(`${options.automatic ? 'AUTO-USED' : 'USED'} · ${definition.name} · ${definition.effectLabel} for ${definition.duration}s.`, 'system');
        this.saveProgress();
        this.notifyInventoryChanged();
        this.updateUI();
        return true;
    }

    getMasteryMilestoneCount(mapKey, defeats) {
        const milestones = MAPS[mapKey].masteryMilestones;
        let count = 0;
        while (count < milestones.length && defeats >= milestones[count]) count++;

        if (milestones.length > 0 && count === milestones.length) {
            const last = milestones[milestones.length - 1];
            const previous = milestones[milestones.length - 2] ?? 0;
            const step = Math.max(1, last - previous);
            count += Math.floor((defeats - last) / step);
        }

        return count;
    }

    getNextMasteryMilestone(mapKey, defeats) {
        const milestones = MAPS[mapKey].masteryMilestones;
        const count = this.getMasteryMilestoneCount(mapKey, defeats);
        if (count < milestones.length) return milestones[count];

        const last = milestones[milestones.length - 1];
        const previous = milestones[milestones.length - 2] ?? 0;
        const step = Math.max(1, last - previous);
        return last + step * (count - milestones.length + 1);
    }

    getMapMasteryBonus(mapKey) {
        const mastery = this.mapMastery[mapKey];
        return mastery.milestones * MAPS[mapKey].masteryBonusPerMilestone;
    }

    updateMapMasteryUI() {
        for (const [mapKey, mapData] of Object.entries(MAPS)) {
            const mastery = this.mapMastery[mapKey];
            const element = document.getElementById(`mastery-${mapKey}`);
            if (!mastery || !element) continue;

            const nextMilestone = this.getNextMasteryMilestone(mapKey, mastery.defeats);
            const rewardPercent = Math.round(mapData.masteryBonusPerMilestone * 100);
            const currentBonus = Math.round(this.getMapMasteryBonus(mapKey) * 100);
            element.textContent = `Mastery ${mastery.milestones} · ${mastery.defeats} defeats\nNext: ${nextMilestone} defeats (+${rewardPercent}%)\nBonus: +${currentBonus}%`;
        }
    }

    getSaveStorageKey(slot = this.saveSlot) {
        const normalizedSlot = Math.max(1, Math.min(SAVE_SLOT_COUNT, Math.floor(Number(slot) || 1)));
        return `${SAVE_SLOT_KEY_PREFIX}${normalizedSlot}`;
    }

    getSaveSlotInfo(slot) {
        const normalizedSlot = Math.max(1, Math.min(SAVE_SLOT_COUNT, Math.floor(Number(slot) || 1)));
        let rawSave = null;
        try {
            rawSave = localStorage.getItem(this.getSaveStorageKey(normalizedSlot));
            // Only explicit save-slot data can populate a slot. The old shared
            // fallback key must not leak legacy progress into a fresh game.
            if (!rawSave) return { slot: normalizedSlot, exists: false };
            const saveData = JSON.parse(rawSave);
            return {
                slot: normalizedSlot,
                exists: true,
                level: Number.isInteger(saveData?.wizard?.level) ? saveData.wizard.level : 1,
                mapName: MAPS[saveData?.currentMapKey]?.name || 'Unknown map',
                savedAt: Number.isFinite(saveData?.savedAt) ? saveData.savedAt : 0
            };
        } catch (error) {
            return { slot: normalizedSlot, exists: false };
        }
    }

    getSaveSlots() {
        return Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => this.getSaveSlotInfo(index + 1));
    }

    saveProgress() {
        if (!this.wizard || this.preventSaving) return false;

        const saveData = {
            version: SAVE_VERSION,
            savedAt: Date.now(),
            currentMapKey: this.currentMapKey,
            zoneNumber: Math.max(
                1,
                Math.min(ENDGAME_BALANCE.maxZone, Math.floor(Number(this.zoneNumber) || 1))
            ),
            autoAdvanceZones: this.autoAdvanceZones,
            autoAdvanceSuspendedByDefeat: this.autoAdvanceSuspendedByDefeat,
            zoneDeathsInCurrentZone: this.zoneDeathsInCurrentZone,
            maxZoneUnlocked: Math.max(
                1,
                Math.min(ENDGAME_BALANCE.maxZone, Math.floor(Number(this.maxZoneUnlocked) || 1))
            ),
            maxLootRarityUnlocked: this.maxLootRarityUnlocked,
            inventoryExpansionCount: this.getInventoryExpansionCount(),
            autoSalvageNonExceptional: this.autoSalvageNonExceptional === true,
            discoveredRecipeIds: [...(this.discoveredRecipeIds || [])],
            zoneUnlocks: Object.fromEntries(
                Object.keys(MAPS).map(mapKey => [
                    mapKey,
                    Math.max(
                        1,
                        Math.min(ENDGAME_BALANCE.maxZone, Math.floor(Number(this.zoneUnlocks?.[mapKey]) || 1))
                    )
                ])
            ),
            mapMastery: Object.fromEntries(
                Object.entries(this.mapMastery).map(([mapKey, mastery]) => [mapKey, { defeats: mastery.defeats }])
            ),
            wizard: {
                level: this.wizard.level,
                xp: this.wizard.xp,
                resources: { ...this.wizard.resources },
                stats: {
                    maxHp: this.wizard.stats.maxHp,
                    atk: this.wizard.stats.atk,
                    speed: this.wizard.stats.speed,
                    regenHp: this.wizard.stats.regenHp,
                    crit: this.wizard.stats.crit,
                    critDamage: this.wizard.stats.critDamage
                },
                resBonus: this.wizard.resBonus
            },
            equipment: { ...this.equipment },
            inventory: [...this.inventory],
            consumableStacks: { ...this.consumableStacks },
            consumableLoadoutUpgradeCount: this.getConsumableLoadoutUpgradeCount(),
            equippedConsumables: [...(this.equippedConsumables || [])],
            consumableAutoUse: { ...(this.consumableAutoUse || {}) },
            itemLevels: { ...this.itemLevels },
            itemEnhancementCounts: { ...this.itemEnhancementCounts },
            itemEnhancementRolls: Object.fromEntries(
                Object.entries(this.itemEnhancementRolls || {}).map(([itemId, rolls]) => [
                    itemId,
                    Array.isArray(rolls) ? rolls.slice(0, GEAR_ENHANCEMENT_BALANCE.maxEnhancements) : []
                ])
            ),
            itemEnhancementCriticals: Object.fromEntries(
                Object.entries(this.itemEnhancementCriticals || {}).map(([itemId, criticals]) => [
                    itemId,
                    Array.isArray(criticals) ? criticals.slice(0, GEAR_ENHANCEMENT_BALANCE.maxEnhancements).map(Boolean) : []
                ])
            ),
            itemInstances: { ...this.itemInstances },
            equipmentJournal: { ...this.equipmentJournal },
            materials: { ...this.materials },
            salvageCurrency: this.getSalvageCurrency(),
            upgradeCounts: { ...this.upgradeCounts },
            activeConsumableEffects: Object.fromEntries(
                Object.entries(this.activeConsumableEffects || {})
                    .filter(([effectId, effect]) => CONSUMABLE_ITEMS.some(item => item.id === effectId)
                        && Number.isFinite(effect?.remaining)
                        && effect.remaining > 0)
                    .map(([effectId, effect]) => [effectId, { remaining: Math.min(3600, effect.remaining) }])
            ),
            lifetimeStats: this.lifetimeStats,
            achievementRanks: { ...this.achievementRanks },
            equippedAchievementTitles: [...(this.equippedAchievementTitles || [])],
            // Preserve the legacy field for older builds that may inspect a save.
            equippedAchievementTitle: this.equippedAchievementTitles?.[0] || null,
            displayedAchievementBadges: [...this.displayedAchievementBadges],
            tabUnlocks: this.getTabUnlocks()
        };

        try {
            localStorage.setItem(this.getSaveStorageKey(), JSON.stringify(saveData));
            window.dispatchEvent(new CustomEvent('robstradomus-save-changed'));
            return true;
        } catch (error) {
            console.warn('Unable to save Robstradomus progress.', error);
            return false;
        }
    }

    restoreProgress() {
        let saveData;
        try {
            const rawSave = localStorage.getItem(this.getSaveStorageKey());
            // New players start from clean defaults unless this slot has its own
            // explicit save. Do not restore the retired generic save key.
            if (!rawSave) return false;
            saveData = JSON.parse(rawSave);
        } catch (error) {
            console.warn('Unable to read Robstradomus progress.', error);
            return false;
        }

        const savedWizard = saveData?.wizard;
        const isValidNumber = value => Number.isFinite(value) && value >= 0;
        const savedRegenHp = Number.isFinite(savedWizard?.stats?.regenHp) ? savedWizard.stats.regenHp : 2;
        const savedCrit = Number.isFinite(savedWizard?.stats?.crit) ? savedWizard.stats.crit : 0.05;
        const savedCritDamage = Number.isFinite(savedWizard?.stats?.critDamage) ? savedWizard.stats.critDamage : 1.6;
        const hasValidResources = savedWizard?.resources && ['Gold', 'Mana', 'Rubies']
            .every(resource => isValidNumber(savedWizard.resources[resource]));
        const hasValidStats = savedWizard?.stats
            && isValidNumber(savedWizard.stats.maxHp)
            && isValidNumber(savedWizard.stats.atk)
            && isValidNumber(savedWizard.stats.speed)
            && savedRegenHp >= 0
            && savedRegenHp <= 100
            && savedCrit >= 0.05
            && savedCrit <= 1
            && savedCritDamage >= 1.6
            && savedCritDamage <= 3;
        const isValidSave = (saveData?.version === SAVE_VERSION || saveData?.version === 20 || saveData?.version === 19 || saveData?.version === 18 || saveData?.version === 17 || saveData?.version === 16 || saveData?.version === 15 || saveData?.version === 14 || saveData?.version === 13 || saveData?.version === 12 || saveData?.version === 11 || saveData?.version === 10 || saveData?.version === 9 || saveData?.version === 8 || saveData?.version === 7 || saveData?.version === 6 || saveData?.version === 5 || saveData?.version === 4 || saveData?.version === 3 || saveData?.version === 2 || saveData?.version === 1)
            && Object.prototype.hasOwnProperty.call(MAPS, saveData.currentMapKey)
            && Number.isInteger(savedWizard?.level)
            && savedWizard.level >= 1
            && isValidNumber(savedWizard.xp)
            && hasValidResources
            && hasValidStats
            && isValidNumber(savedWizard.resBonus);

        if (!isValidSave) {
            console.warn('Ignoring invalid Robstradomus progress save.');
            return false;
        }

        this.currentMapKey = saveData.currentMapKey;
        this.autoAdvanceZones = saveData.autoAdvanceZones !== false;
        this.autoAdvanceSuspendedByDefeat = this.autoAdvanceZones
            ? false
            : saveData.autoAdvanceSuspendedByDefeat === true;
        this.zoneDeathsInCurrentZone = Number.isInteger(saveData.zoneDeathsInCurrentZone)
            ? Math.max(0, Math.min(ZONE_DEATH_RETREAT_THRESHOLD, saveData.zoneDeathsInCurrentZone))
            : 0;
        const savedZone = Math.min(
            ENDGAME_BALANCE.maxZone,
            Number.isInteger(saveData.zoneNumber) && saveData.zoneNumber >= 1
                ? saveData.zoneNumber
                : 1
        );
        this.zoneUnlocks = this.createDefaultZoneUnlocks();
        if (saveData.zoneUnlocks && typeof saveData.zoneUnlocks === 'object') {
            for (const mapKey of Object.keys(MAPS)) {
                const savedUnlockedZone = saveData.zoneUnlocks[mapKey];
                if (Number.isInteger(savedUnlockedZone) && savedUnlockedZone >= 1) {
                    this.zoneUnlocks[mapKey] = Math.min(ENDGAME_BALANCE.maxZone, savedUnlockedZone);
                }
            }
        }
        const savedMaxZone = Math.min(
            ENDGAME_BALANCE.maxZone,
            Number.isInteger(saveData.maxZoneUnlocked) && saveData.maxZoneUnlocked >= 1
                ? saveData.maxZoneUnlocked
                : savedZone
        );
        this.zoneUnlocks[this.currentMapKey] = Math.max(
            this.getMaxZoneUnlocked(this.currentMapKey),
            savedMaxZone,
            savedZone
        );
        this.maxZoneUnlocked = this.getMaxZoneUnlocked(this.currentMapKey);
        this.zoneNumber = Math.min(savedZone, this.maxZoneUnlocked);
        const savedMaxLootRarity = Number.isInteger(saveData.maxLootRarityUnlocked)
            ? Math.max(0, Math.min(RARITIES.length - 1, saveData.maxLootRarityUnlocked))
            : 0;
        this.maxLootRarityUnlocked = Math.max(savedMaxLootRarity, this.getMaxLootRarityIndex());
        this.autoSalvageNonExceptional = saveData.autoSalvageNonExceptional === true;
        // Legacy saves from the retired 24-slot inventory did not have an
        // expansion count. They now migrate to the compact 12-slot baseline
        // instead of silently granting three permanent expansions. Valid items
        // are compacted below so gear stored near the end of the old array is
        // retained whenever the new capacity has room.
        const savedExpansionCount = saveData.inventoryExpansionCount;
        this.inventoryExpansionCount = Number.isInteger(savedExpansionCount)
            ? Math.max(0, Math.min(INVENTORY_EXPANSIONS.length, savedExpansionCount))
            : 0;
        const savedConsumableLoadoutUpgradeCount = saveData.consumableLoadoutUpgradeCount;
        this.consumableLoadoutUpgradeCount = Number.isInteger(savedConsumableLoadoutUpgradeCount)
            ? Math.max(0, Math.min(CONSUMABLE_LOADOUT_UPGRADES.length, savedConsumableLoadoutUpgradeCount))
            : 0;
        this.equippedConsumables = [];
        this.consumableAutoUse = {};
        this.wizard.level = savedWizard.level;
        this.wizard.xp = savedWizard.xp;
        this.wizard.resources = {
            Gold: savedWizard.resources.Gold,
            Mana: savedWizard.resources.Mana,
            Rubies: savedWizard.resources.Rubies
        };
        this.wizard.stats.maxHp = savedWizard.stats.maxHp;
        this.wizard.stats.atk = savedWizard.stats.atk;
        this.wizard.stats.speed = savedWizard.stats.speed;
        this.wizard.stats.regenHp = savedRegenHp;
        this.wizard.stats.crit = savedCrit;
        this.wizard.stats.critDamage = savedCritDamage;
        this.wizard.resBonus = savedWizard.resBonus;

        // New saves track upgrade ranks directly. Older saves are reconstructed
        // using the pre-rebalance increments so their next costs remain stable.
        this.upgradeCounts = this.createDefaultUpgradeCounts();
        const savedUpgradeCounts = saveData.upgradeCounts;
        const hasUpgradeCounts = savedUpgradeCounts
            && Object.keys(this.upgradeCounts).every(key => Number.isInteger(savedUpgradeCounts[key]) && savedUpgradeCounts[key] >= 0);
        if (hasUpgradeCounts) {
            this.upgradeCounts = Object.fromEntries(
                Object.keys(this.upgradeCounts).map(key => [key, savedUpgradeCounts[key]])
            );
        } else {
            this.upgradeCounts = {
                atk: Math.max(0, Math.round((this.wizard.stats.atk - 10) / 5)),
                hp: Math.max(0, Math.round((this.wizard.stats.maxHp - 100) / 20)),
                regen: Math.max(0, Math.round((this.wizard.stats.regenHp - 2) / 0.5)),
                spd: Math.max(0, Math.round((this.wizard.stats.speed - 3.5) / 0.5)),
                crit: Math.max(0, Math.round((this.wizard.stats.crit - 0.05) / 0.05)),
                critDamage: Math.max(0, Math.round((this.wizard.stats.critDamage - 1.6) / 0.1)),
                res: Math.max(0, Math.round((this.wizard.resBonus - 1) / 0.2))
            };
        }

        // Level bonuses are derived from the saved level, so older saves gain
        // the new progression automatically without a migration step.
        this.syncWizardLevelStats();
        this.wizard.hp = this.wizard.getEffectiveStats().maxHp;

        this.itemLevels = this.createDefaultItemLevels();
        if (saveData.itemLevels && typeof saveData.itemLevels === 'object') {
            for (const item of CHARACTER_ITEMS) {
                const savedLevel = saveData.itemLevels[item.id];
                if (Number.isInteger(savedLevel) && savedLevel >= 1) {
                    const savedEnhancements = Number.isInteger(saveData.itemEnhancementCounts?.[item.id])
                        ? Math.max(0, saveData.itemEnhancementCounts[item.id])
                        : 0;
                    const baseLevel = saveData.version < SAVE_VERSION
                        ? Math.max(1, savedLevel - savedEnhancements)
                        : savedLevel;
                    this.itemLevels[item.id] = Math.min(GEAR_ENHANCEMENT_BALANCE.maxItemLevel, baseLevel);
                }
            }
        }
        this.itemEnhancementCounts = this.createDefaultItemEnhancementCounts();
        if (saveData.itemEnhancementCounts && typeof saveData.itemEnhancementCounts === 'object') {
            for (const item of CHARACTER_ITEMS) {
                const savedCount = saveData.itemEnhancementCounts[item.id];
                if (Number.isInteger(savedCount) && savedCount >= 0) {
                    this.itemEnhancementCounts[item.id] = Math.min(GEAR_ENHANCEMENT_BALANCE.maxEnhancements, savedCount);
                }
            }
        }
        this.itemEnhancementRolls = this.createDefaultItemEnhancementRolls();
        if (saveData.itemEnhancementRolls && typeof saveData.itemEnhancementRolls === 'object') {
            for (const item of CHARACTER_ITEMS) {
                const savedRolls = saveData.itemEnhancementRolls[item.id];
                if (!Array.isArray(savedRolls)) continue;
                this.itemEnhancementRolls[item.id] = savedRolls
                    .slice(0, GEAR_ENHANCEMENT_BALANCE.maxEnhancements)
                    .filter(roll => Number.isFinite(roll))
                    .map(roll => Math.max(
                        GEAR_ENHANCEMENT_BALANCE.enhancementRollMin,
                        Math.min(GEAR_ENHANCEMENT_BALANCE.enhancementCriticalRollMax, roll)
                    ));
            }
        }
        this.itemEnhancementCriticals = this.createDefaultItemEnhancementCriticals();
        if (saveData.itemEnhancementCriticals && typeof saveData.itemEnhancementCriticals === 'object') {
            for (const item of CHARACTER_ITEMS) {
                const savedCriticals = saveData.itemEnhancementCriticals[item.id];
                if (!Array.isArray(savedCriticals)) continue;
                this.itemEnhancementCriticals[item.id] = savedCriticals
                    .slice(0, GEAR_ENHANCEMENT_BALANCE.maxEnhancements)
                    .map(Boolean);
            }
        }

        this.itemInstances = {};
        if (saveData.itemInstances && typeof saveData.itemInstances === 'object') {
            Object.entries(saveData.itemInstances).slice(0, 200).forEach(([instanceId, savedInstance]) => {
                if (typeof instanceId !== 'string' || instanceId.length < 3 || instanceId.length > 160) return;
                const definition = this.getItemDefinition(savedInstance?.baseId);
                const rarity = this.getRarityData(savedInstance?.rarity).name;
                const savedEnhancementCount = Number.isInteger(savedInstance?.enhancementCount)
                    ? Math.max(0, savedInstance.enhancementCount)
                    : 0;
                const savedLevel = savedInstance?.level;
                const level = Number.isInteger(savedLevel)
                    ? saveData.version < SAVE_VERSION
                        ? Math.max(1, savedLevel - savedEnhancementCount)
                        : savedLevel
                    : savedLevel;
                const bonuses = savedInstance?.bonuses;
                const statRolls = savedInstance?.statRolls;
                const enhancementRolls = Array.isArray(savedInstance?.enhancementRolls)
                    ? savedInstance.enhancementRolls
                        .slice(0, GEAR_ENHANCEMENT_BALANCE.maxEnhancements)
                        .filter(roll => Number.isFinite(roll))
                        .map(roll => Math.max(
                            GEAR_ENHANCEMENT_BALANCE.enhancementRollMin,
                            Math.min(GEAR_ENHANCEMENT_BALANCE.enhancementCriticalRollMax, roll)
                        ))
                    : [];
                const enhancementCriticals = Array.isArray(savedInstance?.enhancementCriticals)
                    ? savedInstance.enhancementCriticals
                        .slice(0, GEAR_ENHANCEMENT_BALANCE.maxEnhancements)
                        .map(Boolean)
                    : [];
                const hasValidStatRolls = statRolls === undefined
                    || (statRolls
                        && typeof statRolls === 'object'
                        && !Array.isArray(statRolls)
                        && Object.entries(statRolls).length <= EQUIPMENT_STAT_ORDER.length
                        && Object.entries(statRolls).every(([stat, roll]) =>
                            Object.prototype.hasOwnProperty.call(EQUIPMENT_STAT_ROLL_RANGES, stat)
                            && Number.isFinite(roll)
                            && roll >= 0
                            && roll <= 1));
                if (definition?.kind !== 'equipment'
                    || !FUTURE_DROP_ITEMS.some(item => item.id === definition.id)
                    || !Number.isInteger(level)
                    || level < 1
                    || level > GEAR_ENHANCEMENT_BALANCE.maxItemLevel
                    || !bonuses
                    || Object.values(bonuses).some(value => !Number.isFinite(value) || value < 0)
                    || !hasValidStatRolls) return;
                this.itemInstances[instanceId] = {
                    baseId: definition.id,
                    rarity,
                    level,
                    enhancementCount: Math.min(
                        GEAR_ENHANCEMENT_BALANCE.maxEnhancements,
                        savedEnhancementCount
                    ),
                    enhancementRolls,
                    enhancementCriticals,
                    acquiredAt: Number.isFinite(savedInstance.acquiredAt)
                        ? Math.max(0, Math.floor(savedInstance.acquiredAt))
                        : null,
                    image: typeof savedInstance.image === 'string' ? savedInstance.image : definition.image,
                    bonuses: Object.fromEntries(Object.entries(bonuses).slice(0, 8)),
                    exceptional: savedInstance.exceptional === true,
                    exceptionalScore: Number.isFinite(savedInstance.exceptionalScore)
                        ? Math.max(0, Math.min(100, Math.floor(savedInstance.exceptionalScore)))
                        : null
                };
                if (statRolls !== undefined) {
                    this.itemInstances[instanceId].statRolls = Object.fromEntries(Object.entries(statRolls).slice(0, 8));
                }
            });
        }

        this.equipmentJournal = this.createDefaultEquipmentJournal();
        if (saveData.equipmentJournal && typeof saveData.equipmentJournal === 'object') {
            FUTURE_DROP_ITEMS
                .filter(item => item.kind === 'equipment')
                .forEach(item => {
                    const savedDiscovery = saveData.equipmentJournal[item.id];
                    if (!savedDiscovery || typeof savedDiscovery !== 'object') return;
                    const highestRarity = this.getRarityData(savedDiscovery.highestRarity).name;
                    const highestRarityIndex = Number.isInteger(savedDiscovery.highestRarityIndex)
                        ? Math.max(0, Math.min(RARITIES.length - 1, savedDiscovery.highestRarityIndex))
                        : this.getRarityIndex(highestRarity);
                    const acquiredAt = Number.isFinite(savedDiscovery.acquiredAt)
                        ? Math.max(0, Math.floor(savedDiscovery.acquiredAt))
                        : 0;
                    this.equipmentJournal[item.id] = {
                        baseId: item.id,
                        discoveredAt: Number.isFinite(savedDiscovery.discoveredAt)
                            ? Math.max(0, Math.floor(savedDiscovery.discoveredAt))
                            : acquiredAt,
                        firstFoundAt: Number.isFinite(savedDiscovery.firstFoundAt)
                            ? Math.max(0, Math.floor(savedDiscovery.firstFoundAt))
                            : acquiredAt,
                        highestRarity,
                        highestRarityIndex,
                        strongestRollQuality: Number.isFinite(savedDiscovery.strongestRollQuality)
                            ? Math.max(0, Math.min(100, Math.floor(savedDiscovery.strongestRollQuality)))
                            : null,
                        strongestRollAverage: Number.isFinite(savedDiscovery.strongestRollAverage)
                            ? Math.max(0, Math.min(1, savedDiscovery.strongestRollAverage))
                            : 0,
                        sourceMonster: typeof savedDiscovery.sourceMonster === 'string'
                            ? savedDiscovery.sourceMonster.slice(0, 100)
                            : 'Unknown source',
                        sourceMap: typeof savedDiscovery.sourceMap === 'string'
                            ? savedDiscovery.sourceMap.slice(0, 100)
                            : this.getEquipmentSourceLabel(null, item),
                        acquiredAt,
                        strongestRollSourceMonster: typeof savedDiscovery.strongestRollSourceMonster === 'string'
                            ? savedDiscovery.strongestRollSourceMonster.slice(0, 100)
                            : 'Unknown source',
                        strongestRollSourceMap: typeof savedDiscovery.strongestRollSourceMap === 'string'
                            ? savedDiscovery.strongestRollSourceMap.slice(0, 100)
                            : this.getEquipmentSourceLabel(null, item),
                        strongestRollAcquiredAt: Number.isFinite(savedDiscovery.strongestRollAcquiredAt)
                            ? Math.max(0, Math.floor(savedDiscovery.strongestRollAcquiredAt))
                            : acquiredAt,
                        masteryPoints: Number.isFinite(savedDiscovery.masteryPoints)
                            ? Math.max(0, Math.min(999, Math.floor(savedDiscovery.masteryPoints)))
                            : EQUIPMENT_JOURNAL_MASTERY.firstDiscoveryPoints,
                        masteryRank: this.getEquipmentJournalMasteryRank(
                            Number.isFinite(savedDiscovery.masteryPoints)
                                ? Math.max(0, Math.min(999, Math.floor(savedDiscovery.masteryPoints)))
                                : EQUIPMENT_JOURNAL_MASTERY.firstDiscoveryPoints
                        )
                    };
                });
        }
        // Version 15 and earlier saves have the equipment instances but no journal.
        // Replaying those owned instances creates a useful legacy entry without
        // inventing a monster source that the old save never recorded.
        Object.values(this.itemInstances || {}).forEach(savedInstance => {
            const item = this.getItemDefinition(savedInstance?.baseId);
            if (item?.kind === 'equipment' && !this.equipmentJournal[item.id]) {
                this.recordEquipmentDiscovery(item, savedInstance, null, null, false);
            }
        });

        this.materials = this.createDefaultMaterials();
        this.salvageCurrency = Number.isInteger(saveData.salvageCurrency)
            ? Math.max(0, Math.min(1000000000, saveData.salvageCurrency))
            : 0;
        this.activeConsumableEffects = {};
        if (saveData.activeConsumableEffects && typeof saveData.activeConsumableEffects === 'object') {
            for (const definition of CONSUMABLE_ITEMS) {
                const remaining = saveData.activeConsumableEffects[definition.id]?.remaining;
                if (Number.isFinite(remaining) && remaining > 0 && remaining <= 3600) {
                    this.activeConsumableEffects[definition.id] = { remaining };
                }
            }
        }
        if (saveData.materials && typeof saveData.materials === 'object') {
            for (const item of FUTURE_DROP_ITEMS.filter(entry => entry.kind === 'material')) {
                const amount = saveData.materials[item.id];
                if (Number.isInteger(amount) && amount >= 0 && amount <= 1000000000) {
                    this.materials[item.id] = amount;
                }
            }
        }

        this.equipment = this.createDefaultEquipment();
        if (saveData.equipment && typeof saveData.equipment === 'object') {
            for (const slot of Object.keys(this.equipment)) {
                const itemId = saveData.equipment[slot];
                const item = this.isOwnedItemId(itemId) ? this.getItem(itemId) : null;
                if (item?.kind === 'equipment' && item.slot === slot) this.equipment[slot] = itemId;
            }
        }
        const equippedIds = new Set(Object.values(this.equipment).filter(Boolean));
        this.consumableStacks = this.createDefaultConsumableStacks();
        const savedConsumableStacks = {};
        if (saveData.consumableStacks && typeof saveData.consumableStacks === 'object') {
            for (const definition of CONSUMABLE_ITEMS) {
                const savedCount = saveData.consumableStacks[definition.id];
                if (Number.isInteger(savedCount) && savedCount > 0 && savedCount <= 1000000000) {
                    savedConsumableStacks[definition.id] = savedCount;
                }
            }
        }

        const legacyConsumableCounts = {};
        const savedInventory = Array.isArray(saveData.inventory) ? saveData.inventory : [];
        const inventoryCapacity = this.getInventoryCapacity();
        const inventorySource = savedInventory.length > inventoryCapacity
            ? savedInventory.filter(itemId => {
                const item = this.getItem(itemId);
                return item?.kind === 'consumable'
                    || (item?.kind === 'equipment' && this.isOwnedItemId(itemId));
            }).slice(0, inventoryCapacity)
            : savedInventory.slice(0, inventoryCapacity);
        inventorySource.forEach(itemId => {
            const item = this.getItem(itemId);
            if (item?.kind === 'consumable') {
                legacyConsumableCounts[item.id] = (legacyConsumableCounts[item.id] || 0) + 1;
            }
        });

        this.inventory = this.createDefaultInventory(equippedIds);
        if (Array.isArray(saveData.inventory)) {
            this.inventory = Array(inventoryCapacity).fill(null);
            const seenItemIds = new Set(equippedIds);
            const seenConsumableIds = new Set();
            inventorySource.forEach((itemId, index) => {
                const directItem = this.getItem(itemId);
                const item = directItem?.kind === 'consumable'
                    ? directItem
                    : this.isOwnedItemId(itemId) ? directItem : null;
                if (!item || !['equipment', 'consumable'].includes(item.kind)) return;
                if (item.kind === 'equipment' && seenItemIds.has(item.id)) return;
                if (item.kind === 'consumable' && seenConsumableIds.has(item.id)) return;

                this.inventory[index] = item.id;
                if (item.kind === 'equipment') {
                    seenItemIds.add(item.id);
                } else {
                    const savedCount = savedConsumableStacks[item.id] || 0;
                    this.consumableStacks[item.id] = Math.max(1, savedCount, legacyConsumableCounts[item.id] || 0);
                    seenConsumableIds.add(item.id);
                }
            });
        }
        // Version 17 and earlier saves predate the Relic slot and its starter
        // item. Add that one new starter only when there is open space; never
        // resurrect starter gear a returning player intentionally salvaged.
        if (Number(saveData.version) < SAVE_VERSION) {
            const starterRelic = CHARACTER_ITEMS.find(item => item.id === 'starfall-reliquary');
            const alreadyOwned = this.inventory.includes(starterRelic?.id)
                || Object.values(this.equipment).includes(starterRelic?.id);
            const openIndex = this.getFirstEmptyInventorySlot();
            if (starterRelic && !alreadyOwned && openIndex >= 0) this.inventory[openIndex] = starterRelic.id;
        }
        const savedAutoUse = saveData.consumableAutoUse && typeof saveData.consumableAutoUse === 'object'
            ? saveData.consumableAutoUse
            : {};
        const savedLoadout = Array.isArray(saveData.equippedConsumables)
            ? [...new Set(saveData.equippedConsumables)]
            : [];
        savedLoadout.slice(0, this.getConsumableLoadoutSlots()).forEach(itemId => {
            // A saved rack entry remains valid even after its last stack was
            // consumed. Stock is required for a fresh equip, not for restoring
            // the persistent preparation choice.
            const equipability = this.getConsumableEquipability(itemId, { requireStock: false });
            if (!equipability.canEquip) return;
            this.equippedConsumables.push(itemId);
            this.consumableAutoUse[itemId] = savedAutoUse[itemId] === true;
        });
        [...this.inventory, ...Object.values(this.equipment)]
            .filter(Boolean)
            .forEach(itemId => {
                const item = this.getItem(itemId);
                if (item?.kind === 'equipment' && this.getItemEnhancementCount(itemId) > 0) {
                    this.getItemEnhancementRolls(itemId);
                }
            });
        this.updateWizardEquipmentStats();

        this.mapMastery = this.createDefaultMapMastery();
        if (saveData.mapMastery && typeof saveData.mapMastery === 'object') {
            for (const mapKey of Object.keys(MAPS)) {
                const savedMastery = saveData.mapMastery[mapKey];
                if (!Number.isInteger(savedMastery?.defeats) || savedMastery.defeats < 0) continue;
                this.mapMastery[mapKey].defeats = savedMastery.defeats;
                this.mapMastery[mapKey].milestones = this.getMasteryMilestoneCount(mapKey, savedMastery.defeats);
            }
        }

        this.lifetimeStats = this.createDefaultLifetimeStats();
        const savedLifetime = saveData.lifetimeStats;
        if (savedLifetime && typeof savedLifetime === 'object') {
            for (const key of ['defeats', 'eliteDefeats', 'bossDefeats', 'xp', 'damage', 'loot', 'materials', 'crafts', 'upgrades', 'zonesCleared', 'wavesCleared', 'highestZone']) {
                if (Number.isFinite(savedLifetime[key]) && savedLifetime[key] >= 0) {
                    this.lifetimeStats[key] = savedLifetime[key];
                }
            }
            for (const mapKey of Object.keys(MAPS)) {
                if (Number.isFinite(savedLifetime.mapDefeats?.[mapKey]) && savedLifetime.mapDefeats[mapKey] >= 0) {
                    this.lifetimeStats.mapDefeats[mapKey] = savedLifetime.mapDefeats[mapKey];
                }
            }
            for (const resource of Object.keys(this.lifetimeStats.resources)) {
                if (Number.isFinite(savedLifetime.resources?.[resource]) && savedLifetime.resources[resource] >= 0) {
                    this.lifetimeStats.resources[resource] = savedLifetime.resources[resource];
                }
            }
        } else {
            this.lifetimeStats.defeats = Object.values(this.mapMastery).reduce((total, mastery) => total + mastery.defeats, 0);
            for (const mapKey of Object.keys(MAPS)) {
                this.lifetimeStats.mapDefeats[mapKey] = this.mapMastery[mapKey].defeats;
            }
        }
        this.lifetimeStats.highestZone = Math.min(
            ENDGAME_BALANCE.maxZone,
            Math.max(
                1,
                this.lifetimeStats.highestZone,
                ...Object.values(this.zoneUnlocks)
            )
        );
        if (saveData.lifetimeStats?.bossDefeatsByMonster && typeof saveData.lifetimeStats.bossDefeatsByMonster === 'object') {
            this.lifetimeStats.bossDefeatsByMonster = Object.fromEntries(
                Object.entries(saveData.lifetimeStats.bossDefeatsByMonster)
                    .filter(([monster, count]) => typeof monster === 'string' && Number.isFinite(count) && count >= 0)
                    .map(([monster, count]) => [monster, Math.floor(count)])
            );
        }
        this.achievementRanks = this.createDefaultAchievementRanks();
        if (saveData.achievementRanks && typeof saveData.achievementRanks === 'object') {
            for (const achievement of ACHIEVEMENTS) {
                const rank = saveData.achievementRanks[achievement.id];
                if (Number.isInteger(rank) && rank >= 0) {
                    this.achievementRanks[achievement.id] = Math.min(achievement.thresholds.length, rank);
                }
            }
        } else {
            this.getAchievementStates().forEach(state => {
                this.achievementRanks[state.id] = state.tier;
            });
        }

        const validTitleIds = new Set(
            this.getAchievementTitleStates().filter(title => title.unlocked).map(title => title.id)
        );
        const savedTitleIds = Array.isArray(saveData.equippedAchievementTitles)
            ? saveData.equippedAchievementTitles
            : typeof saveData.equippedAchievementTitle === 'string'
                ? [saveData.equippedAchievementTitle]
                : [];
        this.equippedAchievementTitles = [...new Set(savedTitleIds.filter(titleId => validTitleIds.has(titleId)))]
            .slice(0, this.getTitleSlotCount());
        const validBadgeIds = new Set(
            this.getAchievementBadgeStates().filter(badge => badge.unlocked).map(badge => badge.id)
        );
        this.displayedAchievementBadges = Array.isArray(saveData.displayedAchievementBadges)
            ? [...new Set(saveData.displayedAchievementBadges.filter(badgeId => validBadgeIds.has(badgeId)))].slice(0, ACHIEVEMENT_BADGE_DISPLAY_LIMIT)
            : this.createDefaultDisplayedAchievementBadges();
        let repairedTabUnlocks = false;
        this.tabUnlocks = this.createDefaultTabUnlocks();
        if (saveData.tabUnlocks && typeof saveData.tabUnlocks === 'object') {
            Object.keys(this.tabUnlocks).forEach(tabId => {
                const savedNotices = Array.isArray(saveData.tabUnlocks[tabId])
                    ? saveData.tabUnlocks[tabId]
                    : [];
                const initialHeroTitleNoticeId = `hero-title:${this.getHeroTitle(1)}`;
                this.tabUnlocks[tabId] = savedNotices
                    .filter(notice => notice && typeof notice.id === 'string' && notice.id.length <= 180)
                    .slice(-200)
                    .map(notice => {
                        const isInitialHeroTitle = tabId === 'character' && notice.id === initialHeroTitleNoticeId;
                        if (isInitialHeroTitle && (notice.tabRead !== true || notice.acknowledged !== true)) repairedTabUnlocks = true;
                        return {
                            id: notice.id,
                            label: typeof notice.label === 'string' ? notice.label.slice(0, 120) : notice.id,
                            tabRead: isInitialHeroTitle || notice.tabRead === true,
                            acknowledged: isInitialHeroTitle || notice.acknowledged === true,
                            unlockedAt: Number.isFinite(notice.unlockedAt) ? Math.max(0, Math.floor(notice.unlockedAt)) : 0
                        };
                    });
            });
        }
        const validRecipeIds = new Set(CRAFTING_RECIPES.map(recipe => recipe.id));
        this.discoveredRecipeIds = Array.isArray(saveData.discoveredRecipeIds)
            ? [...new Set(saveData.discoveredRecipeIds.filter(recipeId => validRecipeIds.has(recipeId)))]
            : this.createDefaultDiscoveredRecipeIds();
        this.updateWizardEquipmentStats();
        this.checkRecipeDiscoveries(false);
        this.notifyEquipmentJournalChanged();

        this.hasRestoredProgress = true;
        if (!localStorage.getItem(this.getSaveStorageKey()) || saveData.version !== SAVE_VERSION || repairedTabUnlocks) this.saveProgress();
        return true;
    }

    resetForSaveSlot() {
        if (this.respawnTimeout) {
            clearTimeout(this.respawnTimeout);
            this.respawnTimeout = null;
        }
        this.running = false;
        this.deathRecovery.active = false;
        this.deathRecovery.remaining = 0;
        this.audio.ambient.pause();
        this.currentMapKey = 'grass';
        this.zoneNumber = 1;
        this.waveNumber = 1;
        this.autoAdvanceZones = true;
        this.autoAdvanceSuspendedByDefeat = false;
        this.zoneDeathsInCurrentZone = 0;
        this.zoneUnlocks = this.createDefaultZoneUnlocks();
        this.maxZoneUnlocked = 1;
        this.maxLootRarityUnlocked = 0;
        this.inventoryExpansionCount = 0;
        this.autoSalvageNonExceptional = false;
        this.mapMastery = this.createDefaultMapMastery();
        this.equipment = this.createDefaultEquipment();
        this.inventory = this.createDefaultInventory();
        this.consumableStacks = this.createDefaultConsumableStacks();
        this.consumableLoadoutUpgradeCount = 0;
        this.equippedConsumables = [];
        this.consumableAutoUse = {};
        this.discoveredRecipeIds = this.createDefaultDiscoveredRecipeIds();
        this.itemLevels = this.createDefaultItemLevels();
        this.itemEnhancementCounts = this.createDefaultItemEnhancementCounts();
        this.itemEnhancementRolls = this.createDefaultItemEnhancementRolls();
        this.itemEnhancementCriticals = this.createDefaultItemEnhancementCriticals();
        this.itemInstances = {};
        this.equipmentJournal = this.createDefaultEquipmentJournal();
        this.materials = this.createDefaultMaterials();
        this.salvageCurrency = 0;
        this.upgradeCounts = this.createDefaultUpgradeCounts();
        this.upgradeReadySignature = '';
        this.lifetimeStats = this.createDefaultLifetimeStats();
        this.achievementRanks = this.createDefaultAchievementRanks();
        this.equippedAchievementTitles = [];
        this.displayedAchievementBadges = this.createDefaultDisplayedAchievementBadges();
        this.tabUnlocks = this.createDefaultTabUnlocks();
        this.activeConsumableEffects = {};
        this.wizard = new Wizard(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, {
            maxHp: 110,
            atk: 12,
            speed: 3.6,
            regenHp: 2.4,
            crit: 0.06,
            critDamage: 1.65
        }, ASSETS.WIZARD);
        this.wizard.onSpriteLoad = () => {
            if (!this.running) this.draw();
        };
        this.monsters = [];
        this.vfx = [];
        this.logs = [];
        this.session = {
            active: false,
            paused: false,
            hasRun: false,
            elapsed: 0,
            defeats: 0,
            zoneDefeats: 0,
            xpEarned: 0,
            damageDealt: 0,
            resources: { Gold: 0, Mana: 0, Rubies: 0 },
            lootDrops: 0,
            recentLoot: [],
        };
        const logContainer = document.getElementById('log-container');
        if (logContainer) logContainer.replaceChildren();
        this.hasRestoredProgress = false;
        this.notifyEquipmentJournalChanged();
    }

    saveToSlot(slot) {
        const normalizedSlot = Math.max(1, Math.min(SAVE_SLOT_COUNT, Math.floor(Number(slot) || 1)));
        this.saveSlot = normalizedSlot;
        this.preventSaving = false;
        return this.saveProgress();
    }

    deleteSaveSlot(slot) {
        const normalizedSlot = Math.max(1, Math.min(SAVE_SLOT_COUNT, Math.floor(Number(slot) || 1)));
        const wasActiveSlot = this.saveSlot === normalizedSlot;

        try {
            localStorage.removeItem(this.getSaveStorageKey(normalizedSlot));
        } catch (error) {
            console.warn(`Unable to delete Robstradomus save slot ${normalizedSlot}.`, error);
            return false;
        }

        // A deleted active slot must not keep farming and recreate itself on the
        // next autosave. Return it to a clean, unsaved wizard instead.
        if (wasActiveSlot) {
            this.preventSaving = true;
            this.resetForSaveSlot();
            this.spawnMonsters();
            this.updateUI();
            this.notifyInventoryChanged();
            this.draw();
        }

        window.dispatchEvent(new CustomEvent('robstradomus-save-changed'));
        this.showSaveToast(`Slot ${normalizedSlot} deleted`);
        return true;
    }

    resetProgress() {
        if (this.respawnTimeout) {
            clearTimeout(this.respawnTimeout);
            this.respawnTimeout = null;
        }

        try {
            localStorage.removeItem(SAVE_KEY);
            for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot++) {
                localStorage.removeItem(this.getSaveStorageKey(slot));
            }
        } catch (error) {
            console.warn('Unable to clear Robstradomus progress saves.', error);
            return false;
        }

        this.saveSlot = 1;
        this.preventSaving = true;
        this.resetForSaveSlot();
        this.spawnMonsters();
        this.updateUI();
        this.draw();
        window.dispatchEvent(new CustomEvent('robstradomus-save-changed'));
        this.showSaveToast('Progress reset · Ready for a fresh game');
        return true;
    }

    loadSaveSlot(slot) {
        const normalizedSlot = Math.max(1, Math.min(SAVE_SLOT_COUNT, Math.floor(Number(slot) || 1)));
        const slotInfo = this.getSaveSlotInfo(normalizedSlot);
        if (!slotInfo.exists) return false;
        this.saveSlot = normalizedSlot;
        this.preventSaving = false;
        this.resetForSaveSlot();
        const restored = this.restoreProgress();
        this.spawnMonsters();
        this.updateUI();
        this.notifyInventoryChanged();
        this.draw();
        if (restored) this.showSaveToast(`Slot ${normalizedSlot} loaded · Level ${this.wizard.level}`);
        return restored;
    }

    startNewSaveSlot(slot) {
        const normalizedSlot = Math.max(1, Math.min(SAVE_SLOT_COUNT, Math.floor(Number(slot) || 1)));
        if (this.getSaveSlotInfo(normalizedSlot).exists) return false;

        this.saveSlot = normalizedSlot;
        this.preventSaving = false;
        this.resetForSaveSlot();
        this.spawnMonsters();
        this.updateUI();
        this.notifyInventoryChanged();
        this.draw();
        return true;
    }

    showSaveToast(message) {
        const toast = document.getElementById('save-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('visible');
        window.setTimeout(() => toast.classList.remove('visible'), 3200);
    }

    showRestoreConfirmation() {
        if (!this.hasRestoredProgress) return;
        const toast = document.getElementById('save-toast');
        if (!toast) return;
        toast.textContent = `Progress restored · Slot ${this.saveSlot} · Level ${this.wizard.level}`;
        toast.classList.add('visible');
        window.setTimeout(() => toast.classList.remove('visible'), 3200);
    }

    getZoneDifficultyMultiplier() {
        const zoneSteps = Math.max(0, Math.min(
            ENDGAME_BALANCE.maxZone - 1,
            Math.floor(Number(this.zoneNumber) || 1) - 1
        ));
        // The first zones are intentionally quick. The steeper late curve keeps
        // deep gear, Attunement, and enhancement from flattening the Dungeon
        // before the Zone 200 endgame target.
        return 1 + ENDGAME_BALANCE.zoneDifficultyBase
            * Math.pow(zoneSteps, ENDGAME_BALANCE.zoneDifficultyExponent);
    }

    getZoneRewardMultiplier() {
        const zoneSteps = Math.max(0, Math.min(
            ENDGAME_BALANCE.maxZone - 1,
            Math.floor(Number(this.zoneNumber) || 1) - 1
        ));
        // Rewards grow slower than danger so pushing deeper is worthwhile, but
        // upgrades, route rotation, gear, and preparations are still required.
        return 1 + ENDGAME_BALANCE.zoneRewardBase
            * Math.pow(zoneSteps, ENDGAME_BALANCE.zoneRewardExponent);
    }

    isBossWave(zoneNumber = this.zoneNumber, waveNumber = this.waveNumber) {
        const safeZone = Math.max(1, Math.floor(Number(zoneNumber) || 1));
        const safeWave = Math.max(1, Math.floor(Number(waveNumber) || 1));
        return safeZone >= BOSS_WAVE_BALANCE.firstZone
            && safeZone % BOSS_WAVE_BALANCE.zoneInterval === 0
            && safeWave === WAVE_PATTERNS.length;
    }

    getWaveProfile(waveNumber = this.waveNumber) {
        const index = Math.max(1, Math.min(WAVE_PATTERNS.length, Math.floor(Number(waveNumber) || 1))) - 1;
        return WAVE_PATTERNS[index] || WAVE_PATTERNS[0];
    }

    getDangerMultiplier(waveNumber = this.waveNumber) {
        const waveProfile = this.getWaveProfile(waveNumber);
        return this.getZoneDifficultyMultiplier() * (waveProfile.dangerMultiplier || 1);
    }

    getRewardMultiplier(waveNumber = this.waveNumber) {
        const waveProfile = this.getWaveProfile(waveNumber);
        return this.getZoneRewardMultiplier() * (waveProfile.rewardMultiplier || 1);
    }

    getRewardBonusPercent(waveNumber = this.waveNumber) {
        return Math.round((this.getRewardMultiplier(waveNumber) - 1) * 100);
    }

    getHeroLevelBonuses(level = this.wizard?.level ?? 1) {
        const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
        const levelCount = Math.max(0, safeLevel - 1);
        return Object.fromEntries(
            Object.entries(HERO_XP_BALANCE.statGainsPerLevel || {})
                .map(([stat, gain]) => [
                    stat,
                    Math.round((Number(gain) || 0) * levelCount * 1000) / 1000
                ])
        );
    }

    syncWizardLevelStats() {
        if (!this.wizard) return;
        this.wizard.levelStats = this.getHeroLevelBonuses(this.wizard.level);
    }

    getHeroTitle(level = this.wizard?.level ?? 1) {
        const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
        const milestones = HERO_XP_BALANCE.milestoneTitles || [];
        let title = 'Initiate';
        for (const milestone of milestones) {
            if (safeLevel >= milestone.level) title = milestone.name;
        }

        // After the named endgame ranks, every 100 levels still grants a new
        // title without requiring an unbounded constants table.
        if (safeLevel >= 500) {
            title = `Ascendant Archon · Rank ${Math.floor(safeLevel / 100) - 4}`;
        }
        return title;
    }

    getDisplayTitle(level = this.wizard?.level ?? 1) {
        return this.getEquippedAchievementTitle()?.name || this.getHeroTitle(level);
    }

    getHeroLevelBonusSummary(fromLevel, toLevel) {
        const fromBonuses = this.getHeroLevelBonuses(fromLevel);
        const toBonuses = this.getHeroLevelBonuses(toLevel);
        const labels = {
            maxHp: ['HP', 0],
            atk: ['ATK', 1],
            speed: ['SPD', 2],
            regenHp: ['REGEN', 2],
            crit: ['CRIT', 1],
            critDamage: ['CRIT DMG', 2]
        };
        return Object.entries(labels)
            .map(([stat, [label, precision]]) => {
                const gain = (toBonuses[stat] || 0) - (fromBonuses[stat] || 0);
                if (gain <= 0) return null;
                const displayGain = stat === 'crit'
                    ? `${(gain * 100).toFixed(precision)}%`
                    : `${gain.toFixed(precision)}${stat === 'critDamage' ? '×' : ''}`;
                return `+${displayGain} ${label}`;
            })
            .filter(Boolean)
            .join(' · ');
    }

    getHeroXpThreshold(level = this.wizard?.level ?? 1) {
        const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
        return Math.max(
            HERO_XP_BALANCE.baseLevelXp,
            Math.round(HERO_XP_BALANCE.baseLevelXp * Math.pow(safeLevel, HERO_XP_BALANCE.levelCurveExponent))
        );
    }

    getMonsterXpReward(monster, mapData = MAPS[this.currentMapKey]) {
        if (!mapData) return 1;
        const rewardScale = Math.pow(
            Math.max(1, this.getRewardMultiplier()),
            HERO_XP_BALANCE.rewardScalingExponent
        );
        const eliteScale = monster?.isBoss
            ? BOSS_WAVE_BALANCE.xpMultiplier
            : monster?.isElite
                ? HERO_XP_BALANCE.eliteMultiplier
                : 1;
        return Math.max(1, Math.round(
            HERO_XP_BALANCE.baseMonsterXp
            * (mapData.difficulty || 1)
            * rewardScale
            * eliteScale
        ));
    }

    getMapResourceYieldMultiplier(mapKey = this.currentMapKey) {
        return Math.max(1, Number(MAPS[mapKey]?.resourceYieldMultiplier) || 1);
    }

    getMapFarmPerk(mapKey = this.currentMapKey) {
        const mapData = MAPS[mapKey];
        return mapData?.farmPerk || `${mapData?.resource || 'Resource'} farming`;
    }

    getMapCelebrationColor(mapKey = this.currentMapKey) {
        return MAPS[mapKey]?.celebrationColor || '#ffd76a';
    }

    triggerCelebration(title, subtitle = '', kind = 'milestone') {
        this.playAudio('celebration');
        const isSalvage = kind === 'salvage';
        const isExceptional = kind === 'exceptional';
        const isRecipeDiscovery = kind === 'recipe-discovery';
        const intensity = kind === 'zone-unlock'
            ? 1.2
            : isRecipeDiscovery
                ? 1.12
                : kind === 'zone-advance'
                    ? 1.05
                    : isExceptional
                        ? 1.16
                        : 1;
        const originX = Math.max(150, Math.min(DESIGN_WIDTH - 150, this.wizard?.x ?? DESIGN_WIDTH / 2));
        const originY = Math.max(150, Math.min(DESIGN_HEIGHT - 140, this.wizard?.y ?? DESIGN_HEIGHT / 2));
        const sparkCount = isSalvage ? 26 : Math.round(18 * intensity);
        const ringCount = isSalvage || isExceptional || isRecipeDiscovery || kind === 'zone-unlock' ? 3 : 2;
        const rings = Array.from({ length: ringCount }, (_, index) => ({
            delay: index * (isSalvage ? 0.08 : 0.11),
            duration: isSalvage ? 0.7 + index * 0.07 : 0.82 + index * 0.08,
            maxRadius: (isSalvage ? 58 : 72 + index * 34) * intensity,
            width: index === 0 ? 3 : 2
        }));
        const sparks = Array.from({ length: sparkCount }, () => {
            const angle = Math.random() * Math.PI * 2;
            const speed = isSalvage ? 45 + Math.random() * 105 : 75 + Math.random() * 125;
            const life = isSalvage ? 0.5 + Math.random() * 0.42 : 0.62 + Math.random() * 0.5;
            return {
                x: originX,
                y: originY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - (isSalvage ? 58 : 22),
                size: isSalvage ? 2 + Math.random() * 3.5 : 2 + Math.random() * 3,
                life,
                maxLife: life
            };
        });

        this.vfx.push({
            kind: 'celebration',
            x: originX,
            y: originY,
            color: isSalvage ? '#d38cff' : isExceptional ? '#ff5fd2' : isRecipeDiscovery ? '#78c8ff' : this.getMapCelebrationColor(),
            title,
            subtitle,
            rings,
            sparks,
            forge: isSalvage,
            life: isSalvage ? 1.3 : isExceptional ? 1.85 : isRecipeDiscovery ? 1.7 : 1.5,
            maxLife: isSalvage ? 1.3 : isExceptional ? 1.85 : isRecipeDiscovery ? 1.7 : 1.5
        });
    }

    getWaveMonsterCount() {
        if (this.isBossWave()) return 1;
        const mapData = MAPS[this.currentMapKey];
        const baseCount = 5 + Math.floor(mapData.difficulty * 2);
        return Math.max(3, Math.round(baseCount * this.getWaveProfile().densityMultiplier));
    }

    scaleMonsterStats(variant, waveProfile = this.getWaveProfile(), isElite = false, isBoss = false) {
        const zoneSteps = Math.max(0, this.zoneNumber - 1);
        const zonePressure = this.getZoneDifficultyMultiplier();
        const waveMultiplier = zonePressure * (waveProfile.statMultiplier || 1);
        const eliteMultiplier = isElite ? 1.35 : 1;
        // Health and attack use separate late-game exponents. This makes a new
        // Zone 150–200 gear set valuable without allowing the wizard to erase
        // regular waves before monster damage can matter.
        const healthMultiplier = Math.pow(waveMultiplier, ENDGAME_BALANCE.monsterHealthExponent) * eliteMultiplier;
        const attackMultiplier = Math.pow(waveMultiplier, ENDGAME_BALANCE.monsterAttackExponent) * eliteMultiplier;
        // Tempo stays bounded so late-game danger comes from meaningful health
        // and damage checks rather than monsters becoming unreadable blurs.
        const tempoMultiplier = 1 + Math.min(0.45, zoneSteps * 0.00225);
        const eliteTempoMultiplier = isElite ? 1.08 : 1;
        const bossSpeedMultiplier = isBoss ? BOSS_WAVE_BALANCE.speedMultiplier : 1;
        const bossAttackIntervalMultiplier = isBoss ? BOSS_WAVE_BALANCE.attackIntervalMultiplier : 1;
        return {
            ...variant,
            isElite,
            isBoss,
            maxHp: Math.max(1, Math.ceil(
                (variant.maxHp || 1) * healthMultiplier * (isBoss ? BOSS_WAVE_BALANCE.hpMultiplier : 1)
            )),
            atk: Math.max(1, Math.ceil(
                (variant.atk || 1) * attackMultiplier * (isBoss ? BOSS_WAVE_BALANCE.atkMultiplier : 1)
            )),
            shield: Math.max(0, Math.ceil(
                (variant.shield || 0) * healthMultiplier * (isBoss ? BOSS_WAVE_BALANCE.shieldMultiplier : 1)
            )),
            speed: Math.max(0.1, (variant.speed || 1) * tempoMultiplier * eliteTempoMultiplier * bossSpeedMultiplier),
            attackInterval: Math.max(
                0.35,
                (variant.attackInterval || 1) * bossAttackIntervalMultiplier / (tempoMultiplier * eliteTempoMultiplier)
            )
        };
    }

    getBossMonsterVariant(waveProfile = this.getWaveProfile()) {
        const roster = MAPS[this.currentMapKey].monsterRoster || [];
        const variant = roster[Math.floor(Math.random() * roster.length)] || {};
        return this.scaleMonsterStats(variant, waveProfile, true, true);
    }

    getCurrentMonsterStats() {
        const roster = MAPS[this.currentMapKey].monsterRoster;
        return this.scaleMonsterStats(roster?.[0] || {});
    }

    getRandomMonsterVariant(waveProfile = this.getWaveProfile(), forceElite = false, excludedNames = new Set()) {
        const roster = MAPS[this.currentMapKey].monsterRoster || [];
        if (roster.length === 0) return this.getCurrentMonsterStats();
        if (forceElite) {
            const eliteVariant = roster[Math.floor(Math.random() * roster.length)];
            return this.scaleMonsterStats(eliteVariant, waveProfile, true);
        }

        const availableRoster = roster.filter(variant => !excludedNames.has(variant.name));
        const candidates = availableRoster.length > 0 ? availableRoster : roster;
        const totalWeight = candidates.reduce((total, variant) => {
            const index = roster.indexOf(variant);
            const baseWeight = Math.max(0, variant.spawnWeight || 0);
            const isBaseVariant = index === 0;
            const bias = waveProfile.toughVariantBias || 0;
            const adjustedWeight = isBaseVariant
                ? baseWeight * Math.max(0.2, 1 - bias)
                : baseWeight * (1 + bias * (1 + index / Math.max(1, roster.length - 1)));
            return total + adjustedWeight;
        }, 0);
        let roll = Math.random() * (totalWeight || candidates.length);
        for (const variant of candidates) {
            const index = roster.indexOf(variant);
            const baseWeight = Math.max(0, variant.spawnWeight || 0);
            const isBaseVariant = index === 0;
            const bias = waveProfile.toughVariantBias || 0;
            const adjustedWeight = totalWeight
                ? (isBaseVariant
                    ? baseWeight * Math.max(0.2, 1 - bias)
                    : baseWeight * (1 + bias * (1 + index / Math.max(1, roster.length - 1))))
                : 1;
            roll -= adjustedWeight;
            if (roll <= 0) return this.scaleMonsterStats(variant, waveProfile);
        }
        return this.scaleMonsterStats(candidates[candidates.length - 1], waveProfile);
    }

    getMonsterGroupVariants(count, waveProfile = this.getWaveProfile(), forceElite = false) {
        const variants = [];
        const usedNames = new Set();
        for (let index = 0; index < count; index++) {
            const isGuaranteedElite = forceElite && index === count - 1;
            const variant = this.getRandomMonsterVariant(
                waveProfile,
                isGuaranteedElite,
                isGuaranteedElite ? new Set() : usedNames
            );
            variants.push(variant);
            if (!isGuaranteedElite) usedNames.add(variant.name);
        }
        return variants;
    }

    spawnMonsters() {
        this.monsters = [];
        const mapData = MAPS[this.currentMapKey];
        const waveProfile = this.getWaveProfile();
        const bossWave = this.isBossWave();
        const count = this.getWaveMonsterCount();
        const eliteWave = !bossWave
            && this.waveNumber === WAVE_PATTERNS.length
            && mapData.monsterRoster?.length > 1;
        const groupVariants = bossWave
            ? [this.getBossMonsterVariant(waveProfile)]
            : this.getMonsterGroupVariants(count, waveProfile, eliteWave);
        
        for (let i = 0; i < count; i++) {
            const margin = 200;
            const rx = margin + Math.random() * (DESIGN_WIDTH - margin * 2);
            const ry = margin + Math.random() * (DESIGN_HEIGHT - margin * 2);
            const variant = groupVariants[i];
            
            const monster = new Monster(
                rx,
                ry,
                variant,
                variant.isBoss
                    ? (BOSS_MONSTER_SPRITES[variant.name] || MONSTER_SPRITES[variant.name] || mapData.monsterSprite)
                    : variant.isElite
                        ? (ELITE_MONSTER_SPRITES[variant.name] || MONSTER_SPRITES[variant.name] || mapData.monsterSprite)
                        : (MONSTER_SPRITES[variant.name] || mapData.monsterSprite),
                variant.name || mapData.monster,
                variant.trait || ''
            );
            monster.onSpriteLoad = () => {
                if (!this.running) this.draw();
            };
            this.monsters.push(monster);
        }

        const bossMonster = this.monsters.find(monster => monster.isBoss);
        if (this.session.active && bossMonster) {
            this.addLog(`BOSS WAVE: ${bossMonster.type} has emerged from the ${mapData.name.toLowerCase()}!`, 'enemy');
        }

        const eliteMonsters = this.monsters.filter(monster => monster.isElite && !monster.isBoss);
        if (this.session.active && eliteMonsters.length > 0) {
            const eliteNames = eliteMonsters.map(monster => monster.type).join(', ');
            this.addLog(`ELITE ENGAGED: Fighting Elite ${eliteNames}!`, 'enemy');
        }
    }

    setMap(key) {
        if (this.currentMapKey === key) return;
        const previousLootRarityIndex = this.getUnlockedLootRarityIndex();
        this.currentMapKey = key;
        this.zoneNumber = 1;
        this.waveNumber = 1;
        this.checkRecipeDiscoveries(true);
        this.session.zoneDefeats = 0;
        this.zoneDeathsInCurrentZone = 0;
        this.maxZoneUnlocked = this.getMaxZoneUnlocked(key);
        this.addLog(`Traveling to ${MAPS[key].name} · ${this.getMapFarmPerk(key)} · ${MAPS[key].farmReason}`);
        this.announceLootRarityUnlock(previousLootRarityIndex, false);
        this.spawnMonsters();
        
        this.saveProgress();
        this.updateUI();
    }

    setAutoAdvanceZones(enabled) {
        this.autoAdvanceZones = Boolean(enabled);
        if (this.autoAdvanceZones) this.autoAdvanceSuspendedByDefeat = false;
        this.saveProgress();
        this.updateUI();
    }

    retreatAfterRepeatedZoneDeaths() {
        this.autoAdvanceZones = false;
        this.autoAdvanceSuspendedByDefeat = true;
        const failedZone = this.zoneNumber;

        if (this.respawnTimeout) {
            clearTimeout(this.respawnTimeout);
            this.respawnTimeout = null;
        }

        if (failedZone > 1) {
            this.zoneNumber = failedZone - 1;
            this.waveNumber = 1;
            this.session.zoneDefeats = 0;
            this.zoneDeathsInCurrentZone = 0;
            this.spawnMonsters();
            this.addLog(`Two defeats in Zone ${failedZone} · retreated to Zone ${this.zoneNumber}. Automatic progression paused; check Auto-advance zones to resume.`, 'enemy');
        } else {
            this.addLog('Two defeats in Zone 1 · automatic progression paused. Check Auto-advance zones to resume.', 'enemy');
        }

        this.saveProgress();
        this.updateUI();
    }

    setZone(zoneNumber) {
        const requestedZone = Math.max(1, Math.floor(Number(zoneNumber) || 1));
        const maxZoneUnlocked = this.getMaxZoneUnlocked();
        this.maxZoneUnlocked = maxZoneUnlocked;
        if (requestedZone > maxZoneUnlocked || requestedZone === this.zoneNumber) return false;

        if (this.respawnTimeout) {
            clearTimeout(this.respawnTimeout);
            this.respawnTimeout = null;
        }

        const previousLootRarityIndex = this.getUnlockedLootRarityIndex();
        const previousZone = this.zoneNumber;
        this.zoneNumber = requestedZone;
        this.waveNumber = 1;
        this.session.zoneDefeats = 0;
        this.zoneDeathsInCurrentZone = 0;
        this.spawnMonsters();
        this.addLog(requestedZone > previousZone
            ? `Zone ${requestedZone} selected · expedition reset to Wave 1.`
            : `Zone ${requestedZone} selected · difficulty reduced · Wave 1.`);
        this.announceLootRarityUnlock(previousLootRarityIndex, false);
        this.saveProgress();
        this.updateUI();
        return true;
    }

    getLogCategory(tone = '') {
        if (tone === 'enemy') return 'enemy';
        if (tone === 'defeat') return 'defeat';
        if (tone === 'combat' || tone === 'crit') return 'combat';
        return 'system';
    }

    renderLog() {
        const container = document.getElementById('log-container');
        if (!container) return;

        const fragment = document.createDocumentFragment();
        for (const logEntry of this.logs) {
            const entryData = typeof logEntry === 'string'
                ? { msg: logEntry, tone: '' }
                : logEntry;
            const category = this.getLogCategory(entryData.tone);
            if (!this.logFilters[category]) continue;

            const entry = document.createElement('div');
            entry.className = `log-entry${entryData.tone ? ` log-${entryData.tone}` : ''}`;
            entry.dataset.logCategory = category;
            entry.textContent = `> ${entryData.msg}`;
            fragment.appendChild(entry);
        }

        container.replaceChildren(fragment);
        container.scrollTop = container.scrollHeight;
    }

    setLogFilter(category, enabled) {
        if (!Object.prototype.hasOwnProperty.call(this.logFilters, category)) return;
        this.logFilters[category] = Boolean(enabled);
        this.renderLog();
    }

    setAllLogFilters(enabled) {
        for (const category of Object.keys(this.logFilters)) {
            this.logFilters[category] = Boolean(enabled);
        }
        this.renderLog();
    }

    addLog(msg, tone = '') {
        this.logs.push({ msg, tone });
        if (this.logs.length > MAX_LOG_ENTRIES) {
            this.logs.splice(0, this.logs.length - MAX_LOG_ENTRIES);
        }
        this.renderLog();
    }

    update(time) {
        if (!this.running) return;
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;
        this.session.elapsed += dt;
        this.uiAccumulator += dt;
        this.updateTemporaryEffects(dt);
        this.saveAccumulator += dt;
        if (this.saveAccumulator >= 4) {
            this.saveAccumulator = 0;
            this.saveProgress();
        }

        const wasRecovering = this.deathRecovery.active;
        if (wasRecovering) {
            this.updateDeathRecovery(dt);
            this.wizard.updateVisuals(dt);
        }

        if (!wasRecovering) {
            this.wizard.update(dt);
        
        // Wizard AI
        let nearest = null;
        let minDist = Infinity;
        
        for (const m of this.monsters) {
            if (m.isDead) continue;
            const dx = m.x - this.wizard.x;
            const dy = m.y - this.wizard.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearest = m;
            }
        }

        if (nearest) {
            if (minDist > 100) {
                this.wizard.moveTowards(nearest.x, nearest.y, dt);
            } else {
                // Attack
                if (this.wizard.attackTimer <= 0) {
                    this.wizardAttack(nearest);
                }
            }
        } else {
            // Each zone escalates through three recognizable waves before the expedition advances.
            if (this.monsters.every(m => m.isDead) && !this.respawnTimeout) {
                const clearedZone = this.zoneNumber;
                const clearedWave = this.waveNumber;
                const finalWave = clearedWave >= WAVE_PATTERNS.length;
                this.lifetimeStats.wavesCleared += 1;
                if (finalWave) this.lifetimeStats.zonesCleared += 1;
                this.checkAchievementUnlocks();
                if (finalWave) {
                    const previousLootRarityIndex = this.getUnlockedLootRarityIndex();
                    const previousMaxZone = this.getMaxZoneUnlocked();
                    const atEndgame = clearedZone >= ENDGAME_BALANCE.maxZone;
                    const nextZone = Math.min(ENDGAME_BALANCE.maxZone, this.zoneNumber + 1);
                    if (!atEndgame) this.setMaxZoneUnlocked(nextZone);
                    // The zone unlock is now recorded, so reveal any regional
                    // formula tied to this depth immediately on the clear.
                    this.checkRecipeDiscoveries(true);
                    const newlyUnlocked = nextZone > previousMaxZone;
                    if (newlyUnlocked) {
                        this.addTabUnlock('maps', `zone:${this.currentMapKey}:${nextZone}`, `Zone ${nextZone}`);
                    }
                    // A completed zone clears the death streak; only deaths before
                    // the next final-wave clear should trigger an automatic retreat.
                    this.zoneDeathsInCurrentZone = 0;

                    if (this.autoAdvanceZones && !atEndgame) {
                        this.zoneNumber = nextZone;
                        this.waveNumber = 1;
                        this.session.zoneDefeats = 0;
                        this.addLog(`Zone ${clearedZone} cleared · advancing to Zone ${this.zoneNumber}, Wave 1.`, 'defeat');
                        this.triggerCelebration(
                            newlyUnlocked ? `ZONE ${this.zoneNumber} UNLOCKED` : `ZONE ${this.zoneNumber} ADVANCE`,
                            newlyUnlocked
                                ? `EXPEDITION ADVANCING · ${MAPS[this.currentMapKey].name.toUpperCase()} · WAVE 1`
                                : 'EXPEDITION ADVANCING · WAVE 1',
                            newlyUnlocked ? 'zone-unlock' : 'zone-advance'
                        );
                    } else {
                        this.waveNumber = 1;
                        this.session.zoneDefeats = 0;
                        const endgameText = atEndgame
                            ? `ZONE ${ENDGAME_BALANCE.maxZone} ENDGAME REACHED · FARMING WAVE 1 AGAIN.`
                            : newlyUnlocked
                                ? `Zone ${clearedZone} cleared · Zone ${nextZone} unlocked · holding in Zone ${clearedZone}, Wave 1.`
                                : `Zone ${clearedZone} cleared · holding in Zone ${clearedZone}, restarting Wave 1.`;
                        this.addLog(endgameText, 'defeat');
                        this.triggerCelebration(
                            atEndgame ? `ZONE ${ENDGAME_BALANCE.maxZone} ENDGAME` : `ZONE ${clearedZone} CLEARED`,
                            atEndgame
                                ? 'CURRENT ENDGAME CAP · FARM FOR GEAR, MASTERY, AND EXCEPTIONAL ROLLS'
                                : newlyUnlocked ? `ZONE ${nextZone} UNLOCKED · HOLDING POSITION` : 'HOLDING POSITION · WAVE 1',
                            atEndgame ? 'zone-unlock' : newlyUnlocked ? 'zone-unlock' : 'wave-clear'
                        );
                    }
                    this.announceLootRarityUnlock(previousLootRarityIndex);
                } else {
                    const previousLootRarityIndex = this.getUnlockedLootRarityIndex();
                    this.waveNumber += 1;
                    const nextWave = this.getWaveProfile();
                    const nextDanger = this.getDangerMultiplier();
                    const nextRewardBonus = this.getRewardBonusPercent();
                    this.addLog(`Wave ${clearedWave} cleared · ${nextWave.name} incoming · ${nextWave.summary} · Danger ${nextDanger.toFixed(2)}× · rewards +${nextRewardBonus}%.`, 'defeat');
                    this.triggerCelebration(
                        `WAVE ${clearedWave} CLEARED`,
                        `${nextWave.name.toUpperCase()} INCOMING`,
                        'wave-clear'
                    );
                    this.announceLootRarityUnlock(previousLootRarityIndex);
                }
                this.saveProgress();
                this.updateUI();
                this.respawnTimeout = setTimeout(() => {
                    this.respawnTimeout = null;
                    if (this.session.active) this.spawnMonsters();
                }, 2000);
            }
        }

        for (const m of this.monsters) {
            const updateResult = m.update(dt, this.wizard);
            const events = Array.isArray(updateResult)
                ? updateResult
                : updateResult
                    ? [updateResult]
                    : [];
            for (const event of events) {
                if (event.type === 'attack') {
                    this.handleMonsterAttack(m, event);
                } else {
                    this.handleMonsterSignature(m, event);
                }
            }
        }
        }

        // VFX update
        this.vfx = this.vfx.filter(v => {
            v.life -= dt;

            if (v.kind === 'celebration') {
                for (const spark of v.sparks) {
                    if (spark.life <= 0) continue;
                    spark.life -= dt;
                    spark.x += spark.vx * dt;
                    spark.y += spark.vy * dt;
                    spark.vy += 120 * dt;
                    spark.vx *= Math.pow(0.12, dt);
                }
                return v.life > 0;
            }

            if (v.kind === 'monster-attack' || v.kind === 'crit-burst' || v.kind === 'weapon-impact') {
                for (const particle of v.particles || []) {
                    if (particle.life <= 0) continue;
                    particle.life -= dt;
                    particle.x += particle.vx * dt;
                    particle.y += particle.vy * dt;
                    particle.vx *= Math.pow(v.kind === 'weapon-impact' ? 0.3 : 0.08, dt);
                    particle.vy = particle.vy * Math.pow(v.kind === 'weapon-impact' ? 0.3 : 0.12, dt)
                        + (v.kind === 'weapon-impact' ? 12 : 38) * dt;
                    particle.rotation += dt * 6;
                }
                return v.life > 0;
            }

            if (v.kind === 'weapon-projectile') {
                v.x += (v.vx || 0) * dt;
                v.y += (v.vy || 0) * dt;
                v.trail = (v.trail || [])
                    .map(point => ({ ...point, life: point.life - dt }))
                    .filter(point => point.life > 0)
                    .slice(0, 12);
                v.trail.unshift({ x: v.x, y: v.y, life: 0.24, maxLife: 0.24 });
                return v.life > 0;
            }

            v.x += (v.vx || 0) * dt;
            v.y += (v.vy || 0) * dt;

            if (v.kind === 'damage') {
                v.vy = (v.vy || 0) - 18 * dt;
                v.vx = (v.vx || 0) * 0.92;
            }

            return v.life > 0;
        });

        const wizardStats = this.wizard.getEffectiveStats();
        if (this.deathRecovery.active) {
            const recoveryRate = wizardStats.maxHp / this.deathRecovery.duration;
            this.wizard.hp = Math.min(wizardStats.maxHp, this.wizard.hp + recoveryRate * dt);
        } else if (this.wizard.hp < wizardStats.maxHp) {
            // Normal health regeneration resumes after the defeat recovery ends.
            this.wizard.hp = Math.min(wizardStats.maxHp, this.wizard.hp + wizardStats.regenHp * dt);
        }

        if (this.wizard.isDead && !this.deathRecovery.active) {
            this.beginDeathRecovery();
        }

        // Keep combat animation independent from DOM work. The HUD only needs a
        // handful of live values, so refreshing the full panel at about 5 Hz is
        // enough and avoids forcing layout during the animation loop.
        if (this.uiAccumulator >= 0.2) {
            this.uiAccumulator = 0;
            this.updateUI();
        }
        this.draw();
        requestAnimationFrame((t) => this.update(t));
    }

    beginDeathRecovery() {
        this.deathRecovery.active = true;
        this.deathRecovery.duration = 5;
        this.deathRecovery.remaining = this.deathRecovery.duration;
        this.wizard.setRecoveryVisual(true);
        this.wizard.isDead = false;
        this.wizard.hp = 0;
        this.wizard.attackTimer = 0;
        this.wizard.x = DESIGN_WIDTH / 2;
        this.wizard.y = DESIGN_HEIGHT / 2;
        this.zoneDeathsInCurrentZone = Math.min(
            ZONE_DEATH_RETREAT_THRESHOLD,
            this.zoneDeathsInCurrentZone + 1
        );
        this.addLog('Robstradomus was defeated · recovery lockout engaged for 5 seconds.', 'enemy');
        if (this.zoneDeathsInCurrentZone >= ZONE_DEATH_RETREAT_THRESHOLD) {
            this.retreatAfterRepeatedZoneDeaths();
        }
        this.saveProgress();
    }

    updateDeathRecovery(dt) {
        if (!this.deathRecovery.active) return;
        this.deathRecovery.remaining = Math.max(0, this.deathRecovery.remaining - dt);
        if (this.deathRecovery.remaining > 0) return;

        this.deathRecovery.active = false;
        this.deathRecovery.remaining = 0;
        this.wizard.setRecoveryVisual(false);
        this.wizard.hp = this.wizard.getEffectiveStats().maxHp;
        this.wizard.isDead = false;
        this.wizard.attackTimer = 0;
        this.addLog('Recovery complete · Robstradomus returns to the fight.', 'defeat');
        this.saveProgress();
    }

    spawnMonsterAttackVfx(monster, style = 'slash', attack = {}) {
        const originX = Number.isFinite(attack.originX) ? attack.originX : monster.x;
        const originY = Number.isFinite(attack.originY) ? attack.originY : monster.y;
        const targetX = Number.isFinite(attack.targetX) ? attack.targetX : this.wizard.x;
        const targetY = Number.isFinite(attack.targetY) ? attack.targetY : this.wizard.y;
        const angle = Math.atan2(targetY - originY, targetX - originX);
        const colors = {
            nature: ['#8ee28e', '#d9ff9a'],
            sprout: ['#72e6a1', '#d9ff9a'],
            thorn: ['#d68b55', '#ffe0a1'],
            guard: ['#78c8ff', '#e7f6ff'],
            lunge: ['#f2c879', '#fff0bb'],
            'shield-bash': ['#b9d7e8', '#ffffff'],
            quake: ['#d69a62', '#ffe0a1'],
            breath: ['#ff6b45', '#ffd05a'],
            meteor: ['#d7a6ff', '#ffb84d'],
            void: ['#a988ff', '#e5d7ff'],
            slash: ['#ff9a8a', '#fff1bd']
        }[style] || ['#ff9a8a', '#fff1bd'];
        const life = style === 'meteor' || attack.signature
            ? 0.72
            : style === 'quake' || style === 'guard'
                ? 0.58
                : 0.48;
        const particles = Array.from({ length: style === 'breath' || style === 'meteor' || style === 'thorn' ? 12 : 7 }, () => {
            const spread = (Math.random() - 0.5) * (style === 'breath' ? 0.72 : 1.2);
            const particleAngle = angle + spread;
            const distance = 18 + Math.random() * 46;
            const speed = 36 + Math.random() * 86;
            return {
                x: originX + Math.cos(particleAngle) * distance,
                y: originY + Math.sin(particleAngle) * distance,
                vx: Math.cos(particleAngle) * speed,
                vy: Math.sin(particleAngle) * speed,
                size: 2 + Math.random() * 3,
                life: life * (0.55 + Math.random() * 0.45),
                maxLife: life,
                rotation: Math.random() * Math.PI
            };
        });
        this.vfx.push({
            kind: 'monster-attack',
            style,
            x: targetX,
            y: targetY,
            originX,
            originY,
            targetX,
            targetY,
            angle,
            color: colors[0],
            accent: colors[1],
            signature: Boolean(attack.signature),
            life,
            maxLife: life,
            particles
        });
    }

    applyMonsterDamage(monster, damage, absorbed, phrase = '') {
        const roundedDamage = Math.max(0, Math.round(damage || 0));
        const roundedAbsorbed = Math.max(0, Math.round(absorbed || 0));
        this.wizard.hitFlash = 0.18;
        this.wizard.hitPulse = 0.18;
        this.playAudio('hit');

        if (roundedDamage > 0) {
            this.vfx.push({
                kind: 'damage',
                x: this.wizard.x + (Math.random() - 0.5) * 10,
                y: this.wizard.y - 46,
                vx: (Math.random() - 0.5) * 16,
                vy: -24,
                life: 0.78,
                maxLife: 0.78,
                amount: roundedDamage,
                crit: false,
                fromMonster: true
            });
            this.addLog(
                phrase
                    ? `${monster.type}: ${phrase} · ${roundedDamage} damage.`
                    : `${monster.type} hit Robstradomus for ${roundedDamage}.`,
                'enemy'
            );
        } else if (roundedAbsorbed > 0) {
            this.addLog(
                phrase
                    ? `${monster.type}: ${phrase} · ward held (${roundedAbsorbed} absorbed).`
                    : `${monster.type} attack was held by the ward (${roundedAbsorbed} absorbed).`,
                'enemy'
            );
        }

        if (roundedAbsorbed > 0) {
            this.vfx.push({
                kind: 'shield-impact',
                x: this.wizard.x,
                y: this.wizard.y,
                life: 0.34,
                maxLife: 0.34,
                broken: this.wizard.lastShieldBroken
            });
        }
    }

    handleMonsterSignature(monster, event) {
        const signature = event.signature || monster.signature;
        if (!signature) return;

        const isStart = event.type === 'signature-start';
        const duration = isStart
            ? Math.max(0.42, signature.castTime || signature.duration || 0.55)
            : 0.55;
        this.vfx.push({
            kind: 'signature-telegraph',
            x: monster.x,
            y: monster.y,
            color: this.getMapCelebrationColor(),
            label: signature.name.toUpperCase(),
            subtitle: signature.log,
            life: duration,
            maxLife: duration
        });

        if (isStart) {
            this.addLog(`${monster.type}: ${signature.log}`, 'enemy');
            return;
        }

        if (event.damage > 0 || event.absorbed > 0) {
            this.spawnMonsterAttackVfx(monster, monster.getAttackStyle(signature), {
                signature: true,
                originX: monster.x,
                originY: monster.y,
                targetX: this.wizard.x,
                targetY: this.wizard.y
            });
            this.applyMonsterDamage(monster, event.damage, event.absorbed, signature.impactLog || signature.log);
        } else if (event.shieldRestored > 0) {
            this.addLog(`${monster.type}: ${signature.impactLog || signature.log}`, 'enemy');
        } else if (event.guardActivated) {
            this.addLog(`${monster.type}: ${signature.impactLog || signature.log}`, 'enemy');
        }
    }

    handleMonsterAttack(monster, attackResult) {
        const attackPhrase = attackResult.signature?.impactLog || attackResult.attackName || '';
        this.spawnMonsterAttackVfx(monster, attackResult.style || monster.getAttackStyle(), attackResult);
        this.applyMonsterDamage(monster, attackResult.damage, attackResult.absorbed, attackPhrase);
    }

    spawnCriticalHitVfx(target) {
        const life = 0.82;
        const particles = Array.from({ length: 20 }, (_, index) => {
            const angle = index / 20 * Math.PI * 2 + Math.random() * 0.18;
            const speed = 70 + Math.random() * 150;
            return {
                x: target.x,
                y: target.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 4,
                life: life * (0.65 + Math.random() * 0.35),
                maxLife: life,
                rotation: angle
            };
        });
        this.vfx.push({
            kind: 'crit-burst',
            x: target.x,
            y: target.y,
            life,
            maxLife: life,
            particles
        });
    }

    spawnWeaponImpactVfx(target, spell, isCrit = false) {
        const life = isCrit ? 0.78 : 0.62;
        const particleCount = spell.impactShape === 'dragon-burst' ? 18 : 14;
        const particles = Array.from({ length: particleCount }, (_, index) => {
            const angle = index / particleCount * Math.PI * 2 + Math.random() * 0.24;
            const speed = 54 + Math.random() * (isCrit ? 105 : 78);
            return {
                x: target.x,
                y: target.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * (isCrit ? 4 : 3),
                life: life * (0.55 + Math.random() * 0.45),
                maxLife: life,
                rotation: angle
            };
        });
        this.vfx.push({
            kind: 'weapon-impact',
            x: target.x,
            y: target.y,
            spell: {
                ...spell,
                colors: { ...spell.colors }
            },
            isCrit,
            life,
            maxLife: life,
            particles
        });
    }

    drawWeaponProjectileVfx(v, lifeRatio) {
        const ctx = this.ctx;
        const colors = v.spell.colors;
        const angle = Number.isFinite(v.angle) ? v.angle : 0;
        const trail = v.trail || [];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const glowEnabled = this.vfx.length <= 7;
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = glowEnabled ? 18 : 0;

        for (let index = trail.length - 1; index >= 0; index--) {
            const point = trail[index];
            const trailRatio = Math.max(0, point.life / point.maxLife);
            const length = 12 + trailRatio * 20;
            ctx.globalAlpha = lifeRatio * trailRatio * 0.7;
            ctx.strokeStyle = index % 2 === 0 ? colors.primary : colors.secondary;
            ctx.lineWidth = 2 + trailRatio * 4;
            ctx.beginPath();
            ctx.moveTo(point.x - Math.cos(angle) * length, point.y - Math.sin(angle) * length);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
        }

        ctx.translate(v.x, v.y);
        ctx.rotate(angle);
        ctx.globalAlpha = lifeRatio;
        ctx.fillStyle = colors.primary;
        ctx.strokeStyle = colors.secondary;
        ctx.lineWidth = 2;

        if (v.spell.projectileShape === 'ember-bolt') {
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(-8, -7);
            ctx.lineTo(-14, 0);
            ctx.lineTo(-8, 7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = colors.core;
            ctx.beginPath();
            ctx.ellipse(1, 0, 9, 3.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = colors.secondary;
            ctx.beginPath();
            ctx.arc(-12, -5, 2.5, 0, Math.PI * 2);
            ctx.arc(-16, 4, 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (v.spell.projectileShape === 'dragon-comet') {
            ctx.beginPath();
            ctx.moveTo(19, 0);
            ctx.lineTo(5, -8);
            ctx.lineTo(-11, -5);
            ctx.lineTo(-15, 0);
            ctx.lineTo(-11, 5);
            ctx.lineTo(5, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = colors.core;
            ctx.beginPath();
            ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colors.secondary;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(-3, 0, 11, -0.95, 0.95);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(17, 0);
            ctx.lineTo(0, -9);
            ctx.lineTo(-17, 0);
            ctx.lineTo(0, 9);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = colors.core;
            ctx.beginPath();
            ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawWeaponImpactVfx(v, lifeRatio, progress) {
        const ctx = this.ctx;
        const colors = v.spell.colors;
        const radius = 18 + progress * (v.isCrit ? 62 : 48);
        ctx.save();
        const glowEnabled = this.vfx.length <= 7;
        ctx.globalCompositeOperation = glowEnabled ? 'lighter' : 'source-over';
        ctx.globalAlpha = lifeRatio;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = glowEnabled ? (v.isCrit ? 26 : 18) : 0;
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = v.isCrit ? 4 : 3;
        ctx.beginPath();
        ctx.arc(v.x, v.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = lifeRatio * 0.72;
        ctx.strokeStyle = colors.secondary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(v.x, v.y, radius * 0.58, -progress * 4, Math.PI * 2 - progress * 4);
        ctx.stroke();

        if (v.spell.impactShape === 'ember-burst') {
            ctx.fillStyle = colors.primary;
            for (let ember = 0; ember < 8; ember++) {
                const emberAngle = ember / 8 * Math.PI * 2 + progress * 0.45;
                const emberRadius = 15 + progress * 28;
                const emberX = v.x + Math.cos(emberAngle) * emberRadius;
                const emberY = v.y + Math.sin(emberAngle) * emberRadius;
                ctx.save();
                ctx.translate(emberX, emberY);
                ctx.rotate(emberAngle);
                ctx.beginPath();
                ctx.moveTo(7, 0);
                ctx.lineTo(-4, -3);
                ctx.lineTo(-2, 3);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            ctx.fillStyle = colors.core;
            ctx.beginPath();
            ctx.arc(v.x, v.y, 7 + (1 - lifeRatio) * 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (v.spell.impactShape === 'dragon-burst') {
            ctx.strokeStyle = colors.secondary;
            ctx.lineWidth = 3;
            for (let arc = 0; arc < 5; arc++) {
                const arcAngle = arc / 5 * Math.PI * 2 + progress * 0.8;
                ctx.beginPath();
                ctx.arc(v.x, v.y, 22 + progress * 22, arcAngle, arcAngle + 0.72);
                ctx.stroke();
            }
            ctx.fillStyle = colors.core;
            ctx.beginPath();
            ctx.moveTo(v.x, v.y - 10);
            ctx.lineTo(v.x + 10, v.y);
            ctx.lineTo(v.x, v.y + 10);
            ctx.lineTo(v.x - 10, v.y);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = colors.core;
            ctx.beginPath();
            ctx.arc(v.x, v.y, 7, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const particle of v.particles || []) {
            if (particle.life <= 0) continue;
            ctx.globalAlpha = lifeRatio * Math.max(0, particle.life / particle.maxLife);
            ctx.fillStyle = particle.rotation % 2 > 1 ? colors.secondary : colors.primary;
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            ctx.fillRect(-particle.size * 1.6, -particle.size / 2, particle.size * 3.2, particle.size);
            ctx.restore();
        }
        ctx.restore();
    }

    wizardAttack(target) {
        const effectiveStats = this.wizard.getEffectiveStats();
        this.wizard.attackTimer = Math.max(
            0.38,
            ENDGAME_BALANCE.wizardAttackInterval
                - Math.max(0, effectiveStats.speed - 3.6) * ENDGAME_BALANCE.wizardSpeedAttackReduction
        );
        this.wizard.attackMotion = 0.26;
        this.wizard.attackDirection = target.x >= this.wizard.x ? 1 : -1;
        // Keep the base sprite and all composited gear facing the active target,
        // even when the wizard was already within attack range and did not move.
        this.wizard.direction = this.wizard.attackDirection;
        this.playAudio('attack');
        const isCrit = Math.random() < effectiveStats.crit;
        this.wizard.triggerCastPulse(isCrit ? 0.42 : 0.28);
        const spell = this.getWeaponSpellProfile();
        const angle = Math.atan2(target.y - this.wizard.y, target.x - this.wizard.x);
        const projectileDuration = 0.3;

        // Every weapon owns a silhouette, palette, trail language, and impact burst.
        // Match the visual flight time to the damage callback so the hit never
        // lands before the projectile visibly reaches its target.
        this.vfx.push({
            kind: 'weapon-projectile',
            x: this.wizard.x,
            y: this.wizard.y,
            vx: (target.x - this.wizard.x) / projectileDuration,
            vy: (target.y - this.wizard.y) / projectileDuration,
            angle,
            spell,
            life: projectileDuration,
            maxLife: projectileDuration,
            trail: [],
            isCrit
        });

        setTimeout(() => { 
            if (!this.session.active || this.session.paused || this.deathRecovery.active || this.wizard.isDead || target.isDead) return;

            const baseDamage = effectiveStats.atk;
            const damage = Math.max(1, Math.round(baseDamage * (isCrit ? effectiveStats.critDamage : 1)));
            const dead = target.takeDamage(damage);
            const damageDealt = Math.max(0, Math.round(target.lastDamageTaken));
            const shieldAbsorbed = Math.max(0, Math.round(target.lastShieldAbsorbed));
            this.session.damageDealt += damageDealt;
            this.lifetimeStats.damage += damageDealt;
            target.hitFlash = 0.18;
            target.hitPulse = 0.18;
            this.playAudio('hit');
            this.spawnWeaponImpactVfx(target, spell, isCrit);

            this.vfx.push({
                kind: 'target-emphasis',
                x: target.x,
                y: target.y,
                life: 0.34,
                maxLife: 0.34,
                crit: isCrit
            });
            if (isCrit) this.spawnCriticalHitVfx(target);
            if (damageDealt > 0) {
                this.vfx.push({
                    kind: 'damage',
                    x: target.x + (Math.random() - 0.5) * 10,
                    y: target.y - 46,
                    vx: (Math.random() - 0.5) * 16,
                    vy: -28,
                    life: 0.78,
                    maxLife: 0.78,
                    amount: damageDealt,
                    crit: isCrit
                });
            }
            if (shieldAbsorbed > 0) {
                this.vfx.push({
                    kind: 'shield-impact',
                    x: target.x,
                    y: target.y,
                    life: 0.34,
                    maxLife: 0.34,
                    broken: target.lastShieldBroken
                });
            }
            this.addLog(`${isCrit ? 'CRIT' : 'Hit'} ${target.type} for ${damageDealt}${shieldAbsorbed > 0 ? ` · ward absorbed ${shieldAbsorbed}` : ''}${target.lastShieldBroken ? ' · ward broken' : ''}.`, isCrit ? 'crit' : 'combat');

            if (!dead) {
                const signatureEvent = target.onHit?.(damageDealt);
                if (signatureEvent) this.handleMonsterSignature(target, signatureEvent);
            }

            if (dead) {
                this.vfx.push({
                    kind: 'defeat',
                    x: target.x,
                    y: target.y,
                    vx: 0,
                    vy: -8,
                    life: 0.72,
                    maxLife: 0.72
                });

                const mapKey = this.currentMapKey;
                const mapData = MAPS[mapKey];
                const mastery = this.mapMastery[mapKey];
                const previousMilestones = mastery.milestones;
                mastery.defeats += 1;
                mastery.milestones = this.getMasteryMilestoneCount(mapKey, mastery.defeats);
                this.lifetimeStats.defeats += 1;
                this.lifetimeStats.mapDefeats[mapKey] = (this.lifetimeStats.mapDefeats[mapKey] || 0) + 1;
                if (target.isElite) this.lifetimeStats.eliteDefeats += 1;
                if (target.isBoss) {
                    this.lifetimeStats.bossDefeats += 1;
                    this.lifetimeStats.bossDefeatsByMonster[target.type] = (this.lifetimeStats.bossDefeatsByMonster[target.type] || 0) + 1;
                }

                const eliteRewardMultiplier = target.isBoss
                    ? BOSS_WAVE_BALANCE.rewardMultiplier
                    : target.isElite
                        ? 2
                        : 1;
                const rewardMultiplier = this.getRewardMultiplier() * eliteRewardMultiplier;
                const heroXpGain = this.getMonsterXpReward(target, mapData);
                const resGain = Math.max(1, Math.round(
                    ENDGAME_BALANCE.earlyResourceDrop
                    * Math.pow(Math.max(1, mapData.difficulty || 1), ENDGAME_BALANCE.resourceDifficultyExponent)
                    * this.wizard.resBonus
                    * (1 + this.getAchievementTitleBonuses().resourceYield)
                    * this.getMapResourceYieldMultiplier(mapKey)
                    * (1 + this.getMapMasteryBonus(mapKey))
                    * rewardMultiplier
                ));

                // Monster XP is hero progression only; it is never a spendable upgrade currency.
                this.wizard.xp += heroXpGain;
                this.wizard.resources[mapData.resource] += resGain;
                this.lifetimeStats.xp += heroXpGain;
                this.lifetimeStats.resources[mapData.resource] += resGain;
                this.session.defeats += 1;
                this.session.zoneDefeats += 1;
                this.session.xpEarned += heroXpGain;
                this.session.resources[mapData.resource] += resGain;
                const defeatLabel = target.isBoss
                    ? 'BOSS DEFEATED'
                    : target.isElite
                        ? 'ELITE DEFEATED'
                        : 'Defeated';
                const bountyLabel = target.isBoss
                    ? ` · boss bounty ×${BOSS_WAVE_BALANCE.rewardMultiplier}`
                    : target.isElite
                        ? ' · elite bounty ×2'
                        : '';
                this.addLog(`${defeatLabel} ${target.type} · +${heroXpGain} HERO XP · +${resGain} ${mapData.resource}${bountyLabel}`, 'defeat');
                this.rollLootDrop(target, mapKey);

                if (this.session.zoneDefeats === DEFEAT_ADVISORY_THRESHOLD) {
                    const advisory = this.getZoneDefeatAdvisory();
                    this.addLog(advisory?.title || 'Repeated defeats detected · review your farming difficulty.', 'enemy');
                }

                let milestoneTitle = target.isBoss ? 'BOSS DEFEATED' : '';
                let milestoneSubtitle = target.isBoss
                    ? `${target.type.toUpperCase()} · BOUNTY CLAIMED`
                    : '';
                if (mastery.milestones > previousMilestones) {
                    const bonusPercent = Math.round(this.getMapMasteryBonus(mapKey) * 100);
                    for (let milestone = previousMilestones + 1; milestone <= mastery.milestones; milestone++) {
                        this.addTabUnlock('maps', `mastery:${mapKey}:${milestone}`, `${mapData.name} Mastery ${milestone}`);
                    }
                    this.addLog(`${mapData.name} mastery milestone! Farming bonus is now +${bonusPercent}%.`);
                    milestoneTitle = `${mapData.name.toUpperCase()} MASTERY`;
                    milestoneSubtitle = `FARMING BONUS · +${bonusPercent}%`;
                }

                const previousLevel = this.wizard.level;
                const previousTitle = this.getHeroTitle(previousLevel);
                let levelsGained = 0;
                while (this.wizard.xp >= this.getHeroXpThreshold(this.wizard.level)) {
                    const previousMaxHp = this.wizard.getEffectiveStats().maxHp;
                    this.wizard.level++;
                    this.syncWizardLevelStats();
                    const nextMaxHp = this.wizard.getEffectiveStats().maxHp;
                    // Restore the health represented by the new max-HP gains.
                    this.wizard.hp = Math.min(nextMaxHp, this.wizard.hp + nextMaxHp - previousMaxHp);
                    levelsGained++;
                }
                if (levelsGained > 0) {
                    const currentTitle = this.getHeroTitle(this.wizard.level);
                    const levelGainSummary = this.getHeroLevelBonusSummary(previousLevel, this.wizard.level);
                    this.addLog(`LEVEL UP! Now Level ${this.wizard.level}${levelGainSummary ? ` · ${levelGainSummary}` : ''}`);
                    milestoneTitle = milestoneTitle
                        ? `LEVEL ${this.wizard.level} · MASTERY`
                        : `LEVEL ${this.wizard.level}`;
                    milestoneSubtitle = milestoneTitle.includes('MASTERY')
                        ? milestoneSubtitle
                        : 'POWER AWAKENS';

                    if (currentTitle !== previousTitle) {
                        this.addTabUnlock('character', `hero-title:${currentTitle}`, currentTitle);
                        this.addLog(`TITLE UNLOCKED · ${currentTitle} · Level ${this.wizard.level}`, 'defeat');
                        milestoneTitle = `${currentTitle.toUpperCase()} UNLOCKED`;
                        milestoneSubtitle = `LEVEL ${this.wizard.level} · NEW RANK AWAKENED`;
                    }
                }
                if (milestoneTitle) {
                    this.triggerCelebration(milestoneTitle, milestoneSubtitle, 'milestone');
                }
                this.checkAchievementUnlocks();
                this.checkRecipeDiscoveries(true, {
                    monster: target,
                    mapKey,
                    zoneNumber: this.zoneNumber
                });
                this.saveProgress();
            }
        }, 300);
    }

    playAudio(key) {
        const sfx = this.audio[key];
        if (sfx) {
            this.applyAudioVolumes();
            sfx.currentTime = 0;
            sfx.play().catch(() => {});
        }
    }

    init() {
        this.wizard = new Wizard(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, {
            maxHp: 110,
            atk: 12,
            speed: 3.6,
            regenHp: 2.4,
            crit: 0.06,
            critDamage: 1.65
        }, ASSETS.WIZARD);
        
        this.restoreProgress();
        this.updateWizardEquipmentStats();
        this.spawnMonsters();
        this.updateUI();
        this.draw();
        this.showRestoreConfirmation();
    }

    draw() {
        // Draw a pre-rendered map surface first. Copying one stable bitmap is
        // cheaper than asking Canvas to fill a 1920×1080 pattern every frame.
        const mapData = MAPS[this.currentMapKey];
        const tilePath = mapData.tile;
        const tileImg = this.images[tilePath];
        let backgroundSurface = this.backgroundSurfaceCache.get(tilePath);
        if (!backgroundSurface && tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
            const backgroundCanvas = document.createElement('canvas');
            backgroundCanvas.width = this.canvas.width;
            backgroundCanvas.height = this.canvas.height;
            const backgroundCtx = backgroundCanvas.getContext('2d');
            backgroundCtx.fillStyle = mapData.color;
            backgroundCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
            const pattern = backgroundCtx.createPattern(tileImg, 'repeat');
            if (pattern) {
                backgroundCtx.fillStyle = pattern;
                backgroundCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
            }
            backgroundSurface = backgroundCanvas;
            this.backgroundSurfaceCache.set(tilePath, backgroundSurface);
        }
        if (backgroundSurface) {
            this.ctx.drawImage(backgroundSurface, 0, 0);
        } else {
            this.ctx.fillStyle = mapData.color;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Draw Monsters
        for (const m of this.monsters) m.draw(this.ctx);
        
        // Draw Wizard
        this.wizard.draw(this.ctx);

        if (this.deathRecovery.active) {
            const recoveryProgress = 1 - this.deathRecovery.remaining / this.deathRecovery.duration;
            const recoveryRadius = 62 + Math.sin(recoveryProgress * Math.PI * 8) * 5;
            const recoveryX = this.wizard.x;
            const recoveryY = this.wizard.y;
            this.ctx.save();
            this.ctx.globalAlpha = 0.9;
            this.ctx.strokeStyle = '#78c8ff';
            this.ctx.shadowColor = '#78c8ff';
            this.ctx.shadowBlur = 18;
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.arc(recoveryX, recoveryY, recoveryRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * recoveryProgress);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = 'rgba(8, 12, 24, 0.86)';
            this.ctx.fillRect(DESIGN_WIDTH / 2 - 190, DESIGN_HEIGHT / 2 + 92, 380, 58);
            this.ctx.strokeStyle = 'rgba(120, 200, 255, 0.75)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(DESIGN_WIDTH / 2 - 190, DESIGN_HEIGHT / 2 + 92, 380, 58);
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.font = '800 15px Orbitron, Inter, sans-serif';
            this.ctx.fillStyle = '#78c8ff';
            this.ctx.fillText('DEFEATED · RECOVERING', DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 + 110);
            this.ctx.font = '700 10px Orbitron, Inter, sans-serif';
            this.ctx.fillStyle = '#f7e7bd';
            this.ctx.fillText(`HP RESTORING · ${Math.ceil(this.deathRecovery.remaining)}S`, DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 + 130);
            this.ctx.restore();
        }

        // Draw VFX and combat feedback above the battlefield entities.
        for (const v of this.vfx) {
            const lifeRatio = Math.max(0, Math.min(1, v.life / (v.maxLife || 1)));
            const progress = 1 - lifeRatio;

            if (v.kind === 'weapon-projectile') {
                this.drawWeaponProjectileVfx(v, lifeRatio);
                continue;
            }

            if (v.kind === 'weapon-impact') {
                this.drawWeaponImpactVfx(v, lifeRatio, progress);
                continue;
            }

            if (v.kind === 'monster-attack') {
                const impactProgress = Math.min(1, progress * 1.3);
                const impactAlpha = lifeRatio * (v.signature ? 1 : 0.86);
                const distance = Math.hypot(v.targetX - v.originX, v.targetY - v.originY);
                const travel = Math.min(1, progress * 1.35);
                const travelX = v.originX + Math.cos(v.angle) * distance * travel;
                const travelY = v.originY + Math.sin(v.angle) * distance * travel;
                this.ctx.save();
                this.ctx.globalAlpha = impactAlpha;
                this.ctx.strokeStyle = v.color;
                this.ctx.fillStyle = v.color;
                this.ctx.shadowColor = v.color;
                this.ctx.shadowBlur = this.vfx.length <= 7 ? (v.signature ? 18 : 10) : 0;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';

                if (v.style === 'breath') {
                    const coneDistance = distance * (0.42 + travel * 0.58);
                    const coneWidth = 12 + impactProgress * 42;
                    const tipX = v.originX + Math.cos(v.angle) * coneDistance;
                    const tipY = v.originY + Math.sin(v.angle) * coneDistance;
                    this.ctx.globalAlpha = impactAlpha * 0.42;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.originX, v.originY);
                    this.ctx.lineTo(tipX + Math.cos(v.angle + Math.PI / 2) * coneWidth, tipY + Math.sin(v.angle + Math.PI / 2) * coneWidth);
                    this.ctx.lineTo(tipX + Math.cos(v.angle - Math.PI / 2) * coneWidth, tipY + Math.sin(v.angle - Math.PI / 2) * coneWidth);
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.globalAlpha = impactAlpha;
                    this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.originX, v.originY);
                    this.ctx.lineTo(tipX + Math.cos(v.angle + Math.PI / 2) * coneWidth, tipY + Math.sin(v.angle + Math.PI / 2) * coneWidth);
                    this.ctx.moveTo(v.originX, v.originY);
                    this.ctx.lineTo(tipX + Math.cos(v.angle - Math.PI / 2) * coneWidth, tipY + Math.sin(v.angle - Math.PI / 2) * coneWidth);
                    this.ctx.stroke();
                } else if (v.style === 'meteor') {
                    const meteorY = v.targetY - 170 + impactProgress * 170;
                    this.ctx.strokeStyle = v.accent;
                    this.ctx.lineWidth = 7;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.targetX + 42, meteorY - 48);
                    this.ctx.lineTo(v.targetX, meteorY);
                    this.ctx.stroke();
                    this.ctx.fillStyle = v.accent;
                    this.ctx.beginPath();
                    this.ctx.arc(v.targetX, meteorY, 13 + impactProgress * 10, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.globalAlpha = impactAlpha * 0.7;
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.ellipse(v.targetX, v.targetY, 18 + impactProgress * 62, 8 + impactProgress * 25, 0, 0, Math.PI * 2);
                    this.ctx.stroke();
                } else if (v.style === 'quake') {
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 4;
                    for (let ring = 0; ring < 2; ring++) {
                        this.ctx.globalAlpha = impactAlpha * (0.9 - ring * 0.22);
                        this.ctx.beginPath();
                        this.ctx.ellipse(v.targetX, v.targetY + 16, 18 + impactProgress * (58 + ring * 22), 9 + impactProgress * (17 + ring * 7), 0, 0, Math.PI * 2);
                        this.ctx.stroke();
                    }
                    this.ctx.globalAlpha = impactAlpha;
                    this.ctx.lineWidth = 3;
                    for (let crack = 0; crack < 6; crack++) {
                        const crackAngle = crack / 6 * Math.PI * 2;
                        const start = 12 + impactProgress * 8;
                        const end = 28 + impactProgress * 38;
                        this.ctx.beginPath();
                        this.ctx.moveTo(v.targetX + Math.cos(crackAngle) * start, v.targetY + Math.sin(crackAngle) * start);
                        this.ctx.lineTo(v.targetX + Math.cos(crackAngle + 0.12) * (end * 0.58), v.targetY + Math.sin(crackAngle + 0.12) * (end * 0.58));
                        this.ctx.lineTo(v.targetX + Math.cos(crackAngle - 0.08) * end, v.targetY + Math.sin(crackAngle - 0.08) * end);
                        this.ctx.stroke();
                    }
                } else if (v.style === 'shield-bash') {
                    this.ctx.globalAlpha = impactAlpha * 0.68;
                    this.ctx.fillStyle = v.color;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.originX, v.originY);
                    this.ctx.lineTo(v.targetX + Math.cos(v.angle + 0.4) * 28, v.targetY + Math.sin(v.angle + 0.4) * 28);
                    this.ctx.lineTo(v.targetX + Math.cos(v.angle - 0.4) * 28, v.targetY + Math.sin(v.angle - 0.4) * 28);
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.globalAlpha = impactAlpha;
                    this.ctx.strokeStyle = v.accent;
                    this.ctx.lineWidth = 5;
                    this.ctx.beginPath();
                    this.ctx.arc(v.targetX, v.targetY, 18 + impactProgress * 32, v.angle - 0.95, v.angle + 0.95);
                    this.ctx.stroke();
                } else if (v.style === 'lunge') {
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.originX, v.originY);
                    this.ctx.lineTo(travelX, travelY);
                    this.ctx.stroke();
                    this.ctx.globalAlpha = impactAlpha * 0.9;
                    this.ctx.strokeStyle = v.accent;
                    this.ctx.lineWidth = 3;
                    for (let slash = 0; slash < 3; slash++) {
                        const offset = (slash - 1) * 12;
                        this.ctx.beginPath();
                        this.ctx.arc(v.targetX + Math.cos(v.angle + Math.PI / 2) * offset, v.targetY + Math.sin(v.angle + Math.PI / 2) * offset, 20 + impactProgress * 9, v.angle - 0.8, v.angle + 0.55);
                        this.ctx.stroke();
                    }
                } else if (v.style === 'sprout') {
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 3;
                    this.ctx.setLineDash([5, 8]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.originX, v.originY);
                    this.ctx.lineTo(travelX, travelY);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                    this.ctx.fillStyle = v.accent;
                    for (let pod = 0; pod < 5; pod++) {
                        const podProgress = Math.max(0, Math.min(1, travel + (pod - 2) * 0.08));
                        const podX = v.originX + Math.cos(v.angle) * distance * podProgress;
                        const podY = v.originY + Math.sin(v.angle) * distance * podProgress;
                        this.ctx.globalAlpha = impactAlpha * (0.5 + podProgress * 0.5);
                        this.ctx.beginPath();
                        this.ctx.arc(podX, podY, 4 + impactProgress * 2, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    this.ctx.globalAlpha = impactAlpha;
                    this.ctx.strokeStyle = v.accent;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.arc(v.targetX, v.targetY, 13 + impactProgress * 18, -0.8, 1.9);
                    this.ctx.stroke();
                } else if (v.style === 'thorn') {
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.originX, v.originY);
                    for (let step = 1; step <= 6; step++) {
                        const stepProgress = Math.min(travel, step / 6);
                        const stepX = v.originX + Math.cos(v.angle) * distance * stepProgress;
                        const stepY = v.originY + Math.sin(v.angle) * distance * stepProgress;
                        const offset = (step % 2 ? 1 : -1) * 7;
                        this.ctx.lineTo(stepX + Math.cos(v.angle + Math.PI / 2) * offset, stepY + Math.sin(v.angle + Math.PI / 2) * offset);
                    }
                    this.ctx.stroke();
                    this.ctx.globalAlpha = impactAlpha * 0.9;
                    this.ctx.fillStyle = v.accent;
                    for (let thorn = 0; thorn < 6; thorn++) {
                        const thornAngle = thorn / 6 * Math.PI * 2 + progress * 0.5;
                        const thornRadius = 18 + impactProgress * 16;
                        const thornX = v.targetX + Math.cos(thornAngle) * thornRadius;
                        const thornY = v.targetY + Math.sin(thornAngle) * thornRadius;
                        this.ctx.beginPath();
                        this.ctx.moveTo(thornX, thornY);
                        this.ctx.lineTo(thornX + Math.cos(thornAngle - 0.45) * 11, thornY + Math.sin(thornAngle - 0.45) * 11);
                        this.ctx.lineTo(thornX + Math.cos(thornAngle + 0.45) * 11, thornY + Math.sin(thornAngle + 0.45) * 11);
                        this.ctx.closePath();
                        this.ctx.fill();
                    }
                } else if (v.style === 'guard') {
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 4;
                    this.ctx.globalAlpha = impactAlpha * 0.72;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.originX, v.originY);
                    this.ctx.lineTo(travelX, travelY);
                    this.ctx.stroke();
                    this.ctx.globalAlpha = impactAlpha;
                    this.ctx.lineWidth = 3;
                    for (let ring = 0; ring < 2; ring++) {
                        this.ctx.beginPath();
                        this.ctx.arc(v.targetX, v.targetY, 18 + ring * 12 + impactProgress * 30, ring ? 0.3 : -1.2, ring ? 2.8 : 1.7);
                        this.ctx.stroke();
                    }
                    this.ctx.fillStyle = v.accent;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.targetX, v.targetY - 13 - impactProgress * 8);
                    this.ctx.lineTo(v.targetX + 13 + impactProgress * 8, v.targetY);
                    this.ctx.lineTo(v.targetX, v.targetY + 13 + impactProgress * 8);
                    this.ctx.lineTo(v.targetX - 13 - impactProgress * 8, v.targetY);
                    this.ctx.closePath();
                    this.ctx.stroke();
                } else if (v.style === 'nature') {
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.originX, v.originY);
                    this.ctx.lineTo(travelX, travelY);
                    this.ctx.stroke();
                    this.ctx.globalAlpha = impactAlpha * 0.76;
                    this.ctx.fillStyle = v.accent;
                    for (let bud = 0; bud < 5; bud++) {
                        const budAngle = bud / 5 * Math.PI * 2;
                        this.ctx.beginPath();
                        this.ctx.arc(v.targetX + Math.cos(budAngle) * (12 + impactProgress * 18), v.targetY + Math.sin(budAngle) * (12 + impactProgress * 18), 5 + impactProgress * 4, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                } else if (v.style === 'void') {
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 4;
                    this.ctx.setLineDash([8, 5]);
                    this.ctx.beginPath();
                    this.ctx.arc(v.targetX, v.targetY, 20 + impactProgress * 42, -progress * 8, Math.PI * 2 - progress * 8);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                } else {
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 5;
                    for (let slash = 0; slash < 2; slash++) {
                        const slashAngle = v.angle + (slash ? 0.46 : -0.46);
                        this.ctx.beginPath();
                        this.ctx.moveTo(v.targetX - Math.cos(slashAngle) * 25, v.targetY - Math.sin(slashAngle) * 25);
                        this.ctx.lineTo(v.targetX + Math.cos(slashAngle) * 25, v.targetY + Math.sin(slashAngle) * 25);
                        this.ctx.stroke();
                    }
                }

                for (const particle of v.particles || []) {
                    if (particle.life <= 0) continue;
                    this.ctx.globalAlpha = impactAlpha * Math.max(0, particle.life / particle.maxLife);
                    this.ctx.fillStyle = particle.rotation % 2 > 1 ? v.accent : v.color;
                    this.ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
                }
                this.ctx.restore();
                continue;
            }

            if (v.kind === 'crit-burst') {
                const burstAlpha = lifeRatio;
                const radius = 18 + progress * 72;
                this.ctx.save();
                this.ctx.globalAlpha = burstAlpha;
                this.ctx.strokeStyle = '#ffd76a';
                this.ctx.fillStyle = '#fff1bd';
                this.ctx.shadowColor = '#ffb84d';
                this.ctx.shadowBlur = 22;
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(v.x, v.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.globalAlpha = burstAlpha * 0.85;
                this.ctx.lineWidth = 3;
                for (let ray = 0; ray < 10; ray++) {
                    const rayAngle = ray / 10 * Math.PI * 2 + progress * 0.4;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.x + Math.cos(rayAngle) * 20, v.y + Math.sin(rayAngle) * 20);
                    this.ctx.lineTo(v.x + Math.cos(rayAngle) * (radius + 22), v.y + Math.sin(rayAngle) * (radius + 22));
                    this.ctx.stroke();
                }
                this.ctx.shadowBlur = 0;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.font = '900 18px Orbitron, Inter, sans-serif';
                this.ctx.lineWidth = 5;
                this.ctx.strokeStyle = 'rgba(18, 10, 24, 0.92)';
                this.ctx.strokeText('CRITICAL!', v.x, v.y - 66 - progress * 18);
                this.ctx.fillStyle = '#ffd76a';
                this.ctx.fillText('CRITICAL!', v.x, v.y - 66 - progress * 18);
                for (const particle of v.particles || []) {
                    if (particle.life <= 0) continue;
                    this.ctx.globalAlpha = burstAlpha * Math.max(0, particle.life / particle.maxLife);
                    this.ctx.fillStyle = '#fff1bd';
                    this.ctx.save();
                    this.ctx.translate(particle.x, particle.y);
                    this.ctx.rotate(particle.rotation);
                    this.ctx.fillRect(-particle.size * 1.6, -particle.size / 2, particle.size * 3.2, particle.size);
                    this.ctx.restore();
                }
                this.ctx.restore();
                continue;
            }

            if (v.kind === 'shield-impact') {
                const color = v.broken ? '#ffb84d' : '#78c8ff';
                const radius = 26 + progress * 24;
                this.ctx.save();
                this.ctx.globalAlpha = lifeRatio;
                this.ctx.strokeStyle = color;
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = 12;
                this.ctx.lineWidth = v.broken ? 4 : 3;
                this.ctx.beginPath();
                this.ctx.arc(v.x, v.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                if (v.broken) {
                    this.ctx.globalAlpha = lifeRatio * 0.85;
                    for (let ray = 0; ray < 6; ray++) {
                        const angle = ray / 6 * Math.PI * 2;
                        this.ctx.beginPath();
                        this.ctx.moveTo(v.x + Math.cos(angle) * radius, v.y + Math.sin(angle) * radius);
                        this.ctx.lineTo(v.x + Math.cos(angle) * (radius + 12), v.y + Math.sin(angle) * (radius + 12));
                        this.ctx.stroke();
                    }
                }
                this.ctx.restore();
                continue;
            }

            if (v.kind === 'target-emphasis') {
                const color = v.crit ? '#ffd76a' : '#fff1bd';
                const radius = 28 + progress * 18;
                this.ctx.save();
                this.ctx.globalAlpha = lifeRatio;
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = v.crit ? 4 : 2;
                this.ctx.beginPath();
                this.ctx.arc(v.x, v.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.globalAlpha = lifeRatio * 0.8;
                this.ctx.beginPath();
                this.ctx.arc(v.x, v.y, radius + 7, -0.7, 0.7);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.arc(v.x, v.y, radius + 7, Math.PI - 0.7, Math.PI + 0.7);
                this.ctx.stroke();
                this.ctx.restore();
                continue;
            }

            if (v.kind === 'signature-telegraph') {
                const pulse = 1 + Math.sin(progress * Math.PI * 5) * 0.08;
                const radius = 32 + progress * 14;
                this.ctx.save();
                this.ctx.globalAlpha = Math.min(1, lifeRatio * 1.15);
                this.ctx.strokeStyle = v.color;
                this.ctx.fillStyle = v.color;
                this.ctx.shadowColor = v.color;
                this.ctx.shadowBlur = 13;
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(v.x, v.y, radius * pulse, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.globalAlpha = lifeRatio * 0.72;
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([7, 5]);
                this.ctx.beginPath();
                this.ctx.arc(v.x, v.y, radius + 10, -progress * Math.PI, Math.PI * 2 - progress * Math.PI);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                this.ctx.globalAlpha = lifeRatio;
                this.ctx.beginPath();
                this.ctx.moveTo(v.x, v.y - radius - 8);
                this.ctx.lineTo(v.x + 7, v.y - radius);
                this.ctx.lineTo(v.x, v.y - radius + 8);
                this.ctx.lineTo(v.x - 7, v.y - radius);
                this.ctx.closePath();
                this.ctx.fill();

                this.ctx.shadowBlur = 0;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.font = '800 10px Orbitron, Inter, sans-serif';
                this.ctx.lineWidth = 3;
                this.ctx.strokeStyle = 'rgba(18, 10, 24, 0.88)';
                this.ctx.strokeText(v.label, v.x, v.y - radius - 23);
                this.ctx.fillStyle = v.color;
                this.ctx.fillText(v.label, v.x, v.y - radius - 23);
                this.ctx.restore();
                continue;
            }

            if (v.kind === 'celebration') {
                const elapsed = (v.maxLife || 1) - v.life;
                this.ctx.save();
                this.ctx.lineCap = 'round';
                this.ctx.shadowColor = v.color;
                this.ctx.shadowBlur = 12;

                if (v.forge) {
                    const forgeProgress = Math.max(0, Math.min(1, elapsed / 0.72));
                    const forgePulse = 1 + Math.sin(forgeProgress * Math.PI * 3) * 0.08;
                    this.ctx.globalAlpha = (1 - Math.min(1, forgeProgress * 0.8)) * lifeRatio * 0.55;
                    this.ctx.fillStyle = v.color;
                    this.ctx.beginPath();
                    this.ctx.arc(v.x, v.y, (24 + forgeProgress * 22) * forgePulse, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.globalAlpha = lifeRatio * 0.9;
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.arc(v.x, v.y, 19 + forgeProgress * 17, -0.7, Math.PI * 1.3);
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.x - 10, v.y);
                    this.ctx.lineTo(v.x, v.y - 10);
                    this.ctx.lineTo(v.x + 10, v.y);
                    this.ctx.lineTo(v.x, v.y + 10);
                    this.ctx.closePath();
                    this.ctx.stroke();
                }

                for (const ring of v.rings) {
                    if (elapsed < ring.delay) continue;
                    const ringProgress = Math.max(0, Math.min(1, (elapsed - ring.delay) / ring.duration));
                    const ringAlpha = (1 - ringProgress) * lifeRatio * 0.82;
                    this.ctx.globalAlpha = ringAlpha;
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = ring.width;
                    this.ctx.beginPath();
                    this.ctx.arc(v.x, v.y, 22 + ring.maxRadius * ringProgress, 0, Math.PI * 2);
                    this.ctx.stroke();
                    this.ctx.globalAlpha = ringAlpha * 0.7;
                    this.ctx.beginPath();
                    this.ctx.arc(v.x, v.y, 28 + ring.maxRadius * ringProgress, -0.85, 0.45);
                    this.ctx.stroke();
                }

                this.ctx.shadowBlur = 10;
                for (const spark of v.sparks) {
                    if (spark.life <= 0) continue;
                    const sparkAlpha = Math.max(0, Math.min(1, spark.life / spark.maxLife)) * lifeRatio;
                    this.ctx.globalAlpha = sparkAlpha;
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = spark.size;
                    this.ctx.beginPath();
                    this.ctx.moveTo(spark.x - spark.vx * 0.035, spark.y - spark.vy * 0.035);
                    this.ctx.lineTo(spark.x, spark.y);
                    this.ctx.stroke();
                }

                const titleFadeIn = Math.min(1, elapsed / 0.14);
                const titleFadeOut = Math.min(1, v.life / 0.26);
                const titleAlpha = Math.min(titleFadeIn, titleFadeOut);
                if (titleAlpha > 0) {
                    const labelY = Math.max(44, v.y - 104 - Math.min(16, elapsed * 12));
                    this.ctx.shadowBlur = 0;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.font = '800 15px Orbitron, Inter, sans-serif';
                    const titleWidth = this.ctx.measureText(v.title).width;
                    this.ctx.font = '700 9px Orbitron, Inter, sans-serif';
                    const subtitleWidth = v.subtitle ? this.ctx.measureText(v.subtitle).width : 0;
                    const boxWidth = Math.min(360, Math.max(titleWidth, subtitleWidth) + 28);
                    this.ctx.globalAlpha = titleAlpha * 0.88;
                    this.ctx.fillStyle = 'rgba(12, 8, 18, 0.78)';
                    this.ctx.fillRect(v.x - boxWidth / 2, labelY - 17, boxWidth, v.subtitle ? 34 : 23);
                    this.ctx.strokeStyle = v.color;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(v.x - boxWidth / 2, labelY - 17, boxWidth, v.subtitle ? 34 : 23);
                    this.ctx.globalAlpha = titleAlpha;
                    this.ctx.font = '800 15px Orbitron, Inter, sans-serif';
                    this.ctx.fillStyle = v.color;
                    this.ctx.fillText(v.title, v.x, labelY - (v.subtitle ? 6 : 0));
                    if (v.subtitle) {
                        this.ctx.font = '700 9px Orbitron, Inter, sans-serif';
                        this.ctx.fillStyle = '#f7e7bd';
                        this.ctx.fillText(v.subtitle, v.x, labelY + 9);
                    }
                }
                this.ctx.restore();
                continue;
            }

            if (v.kind === 'damage') {
                this.ctx.save();
                this.ctx.globalAlpha = lifeRatio;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.font = `${v.crit ? '800 28px' : '700 21px'} Orbitron, Inter, sans-serif`;
                this.ctx.lineWidth = v.crit ? 6 : 4;
                this.ctx.strokeStyle = 'rgba(18, 10, 24, 0.88)';
                this.ctx.strokeText(`-${v.amount}`, v.x, v.y);
                this.ctx.fillStyle = v.fromMonster ? '#ff8d80' : (v.crit ? '#ffd76a' : '#fff1bd');
                this.ctx.fillText(`-${v.amount}`, v.x, v.y);
                if (v.crit) {
                    this.ctx.font = '700 10px Orbitron, Inter, sans-serif';
                    this.ctx.fillStyle = '#ffb84d';
                    this.ctx.fillText('CRIT', v.x, v.y - 22);
                }
                this.ctx.restore();
                continue;
            }

            if (v.kind === 'defeat') {
                const radius = 20 + progress * 54;
                this.ctx.save();
                this.ctx.globalAlpha = lifeRatio;
                this.ctx.strokeStyle = '#ffb84d';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(v.x, v.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.globalAlpha = lifeRatio * 0.9;
                for (let ray = 0; ray < 8; ray++) {
                    const angle = ray / 8 * Math.PI * 2;
                    const inner = radius * 0.65;
                    const outer = radius + 12;
                    this.ctx.beginPath();
                    this.ctx.moveTo(v.x + Math.cos(angle) * inner, v.y + Math.sin(angle) * inner);
                    this.ctx.lineTo(v.x + Math.cos(angle) * outer, v.y + Math.sin(angle) * outer);
                    this.ctx.stroke();
                }
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.font = '800 16px Orbitron, Inter, sans-serif';
                this.ctx.lineWidth = 4;
                this.ctx.strokeStyle = 'rgba(18, 10, 24, 0.9)';
                this.ctx.strokeText('DEFEATED', v.x, v.y - 58 - progress * 14);
                this.ctx.fillStyle = '#ffd76a';
                this.ctx.fillText('DEFEATED', v.x, v.y - 58 - progress * 14);
                this.ctx.restore();
            }
        }
    }

    updateCombatMetricsUI() {
        const elapsed = this.session.elapsed > 0 ? this.session.elapsed : 0;
        const perSecond = amount => elapsed > 0 ? amount / elapsed : 0;
        const setRate = (id, amount, label) => {
            const element = document.getElementById(id);
            if (!element) return;
            const value = perSecond(amount).toFixed(2);
            element.textContent = value;
            const metric = element.closest('.combat-metric');
            if (metric) {
                metric.dataset.tooltip = `${label}: ${value} per second this run.`;
                metric.setAttribute('aria-label', `${label}: ${value} per second this run`);
            }
        };

        setRate('combat-xp-rate', this.session.xpEarned, 'Hero XP');
        setRate('combat-dps-rate', this.session.damageDealt, 'Damage');
        setRate('combat-gold-rate', this.session.resources.Gold, 'Gold');
        setRate('combat-mana-rate', this.session.resources.Mana, 'Mana');
        setRate('combat-rubies-rate', this.session.resources.Rubies, 'Rubies');
        const lootCount = document.getElementById('combat-loot-count');
        if (lootCount) {
            lootCount.textContent = String(this.session.lootDrops);
            const metric = lootCount.closest('.combat-metric');
            if (metric) {
                metric.dataset.tooltip = `${this.session.lootDrops} loot drop${this.session.lootDrops === 1 ? '' : 's'} found this run.`;
                metric.setAttribute('aria-label', `${this.session.lootDrops} loot drop${this.session.lootDrops === 1 ? '' : 's'} found this run`);
            }
        }
        const lootSessionCount = document.getElementById('loot-session-count');
        if (lootSessionCount) lootSessionCount.textContent = `RUN ${this.session.lootDrops} DROPS`;
        const progression = this.getLootProgression();
        const lootRarityStatus = document.getElementById('loot-rarity-status');
        if (lootRarityStatus) {
            const currentLabel = progression.current.displayName || progression.current.name;
            lootRarityStatus.textContent = progression.next
                ? `${currentLabel.toUpperCase()} · NEXT ${progression.next.name.toUpperCase()}`
                : `${currentLabel.toUpperCase()} · ALL UNLOCKED`;
            lootRarityStatus.title = progression.next
                ? `Normal/Common quality is always available. ${progression.next.name} quality unlocks at expedition depth ${progression.next.unlockScore}; ${progression.pointsToNext} depth step${progression.pointsToNext === 1 ? '' : 's'} remaining.`
                : 'Every loot rarity is unlocked.';
        }

        const rarityTrack = document.getElementById('loot-rarity-track');
        if (rarityTrack) {
            rarityTrack.replaceChildren();
            RARITIES.forEach((rarity, index) => {
                const tier = document.createElement('div');
                const isUnlocked = index <= progression.maxIndex;
                const isCurrent = index === progression.maxIndex;
                const label = rarity.displayName || rarity.name;
                tier.className = `loot-rarity-tier rarity-${rarity.name.toLowerCase()}${isUnlocked ? ' unlocked' : ''}${isCurrent ? ' current' : ''}`;
                tier.title = isUnlocked
                    ? `${label} quality drops are available.`
                    : `${label} quality unlocks at expedition depth ${rarity.unlockScore}.`;
                tier.setAttribute('aria-label', isUnlocked
                    ? `${label} quality unlocked${isCurrent ? ' and currently active' : ''}`
                    : `${label} quality locked until expedition depth ${rarity.unlockScore}`);
                tier.innerHTML = `<span class="tier-name">${label}</span><small>${isCurrent ? 'ACTIVE' : isUnlocked ? 'UNLOCKED' : `DEPTH ${rarity.unlockScore}`}</small>`;
                rarityTrack.appendChild(tier);
            });
        }

        const recentLoot = document.getElementById('recent-loot');
        if (recentLoot) {
            recentLoot.replaceChildren();
            if (this.session.recentLoot.length === 0) {
                recentLoot.textContent = 'No drops yet · Normal quality starts the journey; deeper expeditions unlock higher tiers.';
            } else {
                this.session.recentLoot.forEach(drop => {
                    const entry = document.createElement('span');
                    entry.className = `recent-loot-entry${drop.equipment?.exceptional ? ' exceptional' : ''}`;
                    if (drop.equipment?.exceptional) {
                        entry.title = 'Exceptional roll quality.';
                    }
                    const rarityLabel = (drop.rarity === 'Common' ? 'NORMAL' : drop.rarity || 'NORMAL').toUpperCase();
                    let message = `${drop.equipment?.exceptional ? '✦ EXCEPTIONAL FIND · ' : ''}${drop.icon} ${rarityLabel} ${drop.name}${drop.quantity > 1 ? ` ×${drop.quantity}` : ''}`;
                    if (drop.equipment) {
                        const stats = (drop.equipment.stats || [])
                            .map(({ stat, value }) => `${EQUIPMENT_STAT_LABELS[stat] || stat.toUpperCase()} +${this.formatEquipmentStatValue(stat, value)}`)
                            .join(' · ');
                        message += ` · LV ${drop.equipment.level} · ${drop.equipment.rolledCount}/${drop.equipment.slots} SLOTS · ${stats || 'NO ROLLED STATS'}`;
                            if (drop.equipment.exceptional) message += ` · ${drop.equipment.exceptionalScore}% ROLL`;
                    }
                    entry.textContent = message;
                    recentLoot.appendChild(entry);
                });
            }
        }

    }

    getUpgradeStates() {
        if (!this.wizard) return [];

        const getUpgradeCosts = (key, upgradeCount) => {
            const definition = UPGRADE_COSTS[key];
            return Object.fromEntries(
                Object.entries(definition?.costs || {}).map(([resource, baseCost]) => [
                    resource,
                    Math.round(baseCost + upgradeCount * (definition.step?.[resource] || 0))
                ])
            );
        };
        const formatUpgradeCosts = costs => Object.entries(costs || {})
            .map(([resource, amount]) => `${amount.toLocaleString()} ${resource}`)
            .join(' · ');
        const formatUpgradeSteps = steps => Object.entries(steps || {})
            .map(([resource, amount]) => `+${amount.toLocaleString()} ${resource}`)
            .join(' · ');
        const formatUpgradeResourceLabel = costs => Object.keys(costs || {}).join(' + ');
        const upgradeDefinitions = [
            { key: 'atk', id: 'upg-atk', label: 'Attack Power', effect: '+4 ATK' },
            { key: 'hp', id: 'upg-hp', label: 'Max Health', effect: '+25 HP' },
            { key: 'regen', id: 'upg-regen', label: 'HP Regeneration', effect: '+0.4 / sec' },
            { key: 'spd', id: 'upg-spd', label: 'Movement Speed', effect: '+0.35' },
            { key: 'crit', id: 'upg-crit', label: 'Critical Chance', effect: '+3%' },
            { key: 'critDamage', id: 'upg-crit-damage', label: 'Critical Damage', effect: '+0.08×' },
            { key: 'res', id: 'upg-res', label: 'Resource Bonus', effect: '+15% yield' }
        ];

        this.upgradeCounts = this.upgradeCounts || this.createDefaultUpgradeCounts();
        return upgradeDefinitions.map(definition => {
            const rank = Math.max(0, Math.floor(Number(this.upgradeCounts[definition.key]) || 0));
            const attunement = UPGRADE_ATTUNEMENT[definition.key] || null;
            const nextAttunement = attunement
                ? Math.min(attunement.maxBonus, (rank + 1) * attunement.perRank)
                : 0;
            const currentAttunement = attunement
                ? Math.min(attunement.maxBonus, rank * attunement.perRank)
                : 0;
            const effect = attunement
                ? `${definition.effect} · +${(nextAttunement * 100).toFixed(1)}% ${attunement.label}`
                : definition.effect;
            const costs = getUpgradeCosts(definition.key, rank);
            const steps = UPGRADE_COSTS[definition.key]?.step || {};
            const resources = Object.keys(costs);
            const maxed = definition.key === 'crit'
                ? this.wizard.stats.crit >= 1
                : definition.key === 'critDamage'
                    ? this.wizard.stats.critDamage >= 3
                    : false;
            const affordable = !maxed && Object.entries(costs).every(([resource, cost]) =>
                (this.wizard.resources?.[resource] || 0) >= cost
            );
            const missing = Object.entries(costs)
                .map(([resource, cost]) => {
                    const balance = this.wizard.resources?.[resource] || 0;
                    return balance < cost ? `${Math.ceil(cost - balance).toLocaleString()} more ${resource}` : null;
                })
                .filter(Boolean);
            const progress = maxed || Object.keys(costs).length === 0
                ? 1
                : Math.max(0, Math.min(1, ...Object.entries(costs).map(([resource, cost]) =>
                    (this.wizard.resources?.[resource] || 0) / Math.max(1, cost)
                )));
            return {
                ...definition,
                effect,
                rank,
                costs,
                steps,
                currentAttunement,
                nextAttunement,
                attunementLabel: attunement?.label || '',
                resource: formatUpgradeResourceLabel(costs),
                primaryResource: resources[0],
                costLabel: formatUpgradeCosts(costs),
                stepLabel: formatUpgradeSteps(steps),
                missingLabel: missing.join(' · '),
                progress,
                maxed,
                affordable
            };
        });
    }

    getUpgradeGuidance(states = this.getUpgradeStates()) {
        const activeResource = MAPS[this.currentMapKey]?.resource || 'Gold';
        const candidates = states.filter(state => !state.maxed && Object.prototype.hasOwnProperty.call(state.costs, activeResource));
        const sortByProgress = (first, second) => {
            const singleCurrencyBias = (Object.keys(second.costs).length === 1 ? 1 : 0)
                - (Object.keys(first.costs).length === 1 ? 1 : 0);
            return singleCurrencyBias || second.progress - first.progress || first.rank - second.rank;
        };
        const readyStates = candidates.filter(state => state.affordable).sort(sortByProgress);
        const nextState = [...candidates].sort(sortByProgress)[0] || states.find(state => !state.maxed) || null;
        const recommended = readyStates[0] || nextState;
        const resourcePerDefeat = Math.max(1, Math.round(
            ENDGAME_BALANCE.earlyResourceDrop
            * Math.pow(Math.max(1, MAPS[this.currentMapKey]?.difficulty || 1), ENDGAME_BALANCE.resourceDifficultyExponent)
            * (this.wizard?.resBonus || 1)
            * (1 + (this.getAchievementTitleBonuses().resourceYield || 0))
            * this.getMapResourceYieldMultiplier(this.currentMapKey)
            * (1 + this.getMapMasteryBonus(this.currentMapKey))
            * this.getRewardMultiplier()
        ));
        const cycleDefeats = Math.max(1, this.getWaveMonsterCount());
        const shortfall = recommended && Object.keys(recommended.costs).length === 1
            ? Math.max(0, recommended.costs[activeResource] - (this.wizard?.resources?.[activeResource] || 0))
            : 0;
        return {
            activeResource,
            candidates,
            hasActiveRouteCandidate: candidates.length > 0,
            readyStates,
            readyCount: readyStates.length,
            recommended,
            resourcePerDefeat,
            cycleDefeats,
            defeatsNeeded: shortfall > 0 ? Math.ceil(shortfall / resourcePerDefeat) : 0,
            cyclesNeeded: shortfall > 0 ? Math.ceil(shortfall / resourcePerDefeat / cycleDefeats) : 0
        };
    }

    updateUI() {
        this.updateMonsterInfoUI();
        this.updateMapMasteryUI();
        const zoneElement = document.getElementById('combat-zone');
        const waveIndicator = document.getElementById('wave-indicator');
        const waveEscalation = document.getElementById('wave-escalation');
        const previousZoneButton = document.getElementById('zone-prev');
        const nextZoneButton = document.getElementById('zone-next');
        const autoAdvanceZonesToggle = document.getElementById('auto-advance-zones');
        const waveProfile = this.getWaveProfile();
        if (zoneElement) {
            zoneElement.textContent = `ZONE ${this.zoneNumber}`;
            zoneElement.dataset.tooltip = `Zone ${this.zoneNumber} · difficulty ${this.getZoneDifficultyMultiplier().toFixed(2)}× · clear this zone to unlock the next one.`;
            zoneElement.setAttribute('aria-label', `Zone ${this.zoneNumber}`);
        }
        if (autoAdvanceZonesToggle) {
            autoAdvanceZonesToggle.checked = this.autoAdvanceZones;
            autoAdvanceZonesToggle.dataset.tooltip = this.autoAdvanceSuspendedByDefeat
                ? 'Safety pause after repeated wizard defeats. Check this box to resume automatic zone advancement.'
                : this.autoAdvanceZones
                    ? 'Automatically move to the next unlocked zone after clearing the final wave'
                    : 'Stay in the current zone after clearing the final wave';
        }
        const bossWave = this.isBossWave();
        if (waveIndicator) {
            waveIndicator.textContent = bossWave
                ? `BOSS WAVE · ${this.waveNumber} / ${WAVE_PATTERNS.length}`
                : `WAVE ${this.waveNumber} / ${WAVE_PATTERNS.length}`;
            waveIndicator.dataset.tooltip = bossWave
                ? `Milestone boss wave · one ${MAPS[this.currentMapKey].name} roster monster will be empowered.`
                : `Wave ${this.waveNumber} of ${WAVE_PATTERNS.length} in Zone ${this.zoneNumber}.`;
            waveIndicator.classList.toggle('boss-wave', bossWave);
        }
        if (waveEscalation) {
            const activeBoss = this.monsters.some(monster => !monster.isDead && monster.isBoss);
            const activeElite = this.monsters.some(monster => !monster.isDead && monster.isElite && !monster.isBoss);
            waveEscalation.classList.toggle('boss-wave', bossWave);
            waveEscalation.textContent = bossWave
                ? `BOSS WAVE · ${activeBoss ? 'FIGHTING BOSS' : 'BOSS INCOMING'}`
                : `${waveProfile.name} · ${this.getWaveMonsterCount()} HOSTILES${activeElite ? ' · FIGHTING ELITE' : ''}`;
            waveEscalation.dataset.tooltip = bossWave
                ? `Zone ${this.zoneNumber} milestone · one random ${MAPS[this.currentMapKey].name} roster monster becomes a giant boss.`
                : activeElite
                    ? `${waveProfile.summary} · An elite monster is engaged.`
                    : waveProfile.summary;
        }
        const zoneAdvisory = document.getElementById('zone-advisory');
        if (zoneAdvisory) {
            const advisory = this.getZoneDefeatAdvisory();
            zoneAdvisory.hidden = !advisory;
            zoneAdvisory.textContent = advisory?.text || '';
            zoneAdvisory.dataset.tooltip = advisory?.title || '';
        }
        const dangerMultiplier = document.getElementById('danger-multiplier');
        if (dangerMultiplier) {
            dangerMultiplier.textContent = `DANGER ${this.getDangerMultiplier().toFixed(2)}× · REWARDS +${this.getRewardBonusPercent()}%`;
            dangerMultiplier.dataset.tooltip = 'Danger reflects zone depth and wave pressure. Rewards scale with the active expedition pressure.';
        }
        if (previousZoneButton) {
            previousZoneButton.disabled = this.zoneNumber <= 1;
            previousZoneButton.dataset.tooltip = `Lower difficulty to Zone ${Math.max(1, this.zoneNumber - 1)}`;
            previousZoneButton.setAttribute('aria-label', `Lower difficulty to Zone ${Math.max(1, this.zoneNumber - 1)}`);
        }
        if (nextZoneButton) {
            const nextZone = this.zoneNumber + 1;
            const canAdvance = this.zoneNumber < this.maxZoneUnlocked && this.zoneNumber < ENDGAME_BALANCE.maxZone;
            const atEndgame = this.zoneNumber >= ENDGAME_BALANCE.maxZone;
            nextZoneButton.disabled = !canAdvance;
            nextZoneButton.dataset.tooltip = canAdvance
                ? `Increase difficulty to Zone ${nextZone}`
                : atEndgame
                    ? `Zone ${ENDGAME_BALANCE.maxZone} is the current endgame cap`
                    : `Zone ${nextZone} locked · clear Zone ${this.maxZoneUnlocked} to unlock it`;
            nextZoneButton.setAttribute('aria-label', canAdvance
                ? `Increase difficulty to Zone ${nextZone}`
                : atEndgame
                    ? `Zone ${ENDGAME_BALANCE.maxZone} is the current endgame cap`
                    : `Zone ${nextZone} locked. Clear Zone ${this.maxZoneUnlocked} to unlock it`);
        }
        
        const effectiveStats = this.wizard.getEffectiveStats();
        const setCombatStat = (id, value, label, detail) => {
            const element = document.getElementById(id);
            if (!element) return;
            element.textContent = value;
            const card = element.closest('.player-stat');
            if (card) {
                card.dataset.tooltip = `${label}: ${detail}`;
                card.setAttribute('aria-label', `${label}: ${detail}`);
            }
        };
        setCombatStat(
            'stat-hp',
            `${Math.ceil(this.wizard.hp)} / ${Math.floor(effectiveStats.maxHp)}`,
            'Health',
            `${Math.ceil(this.wizard.hp)} current out of ${Math.floor(effectiveStats.maxHp)} maximum`
        );
        setCombatStat('stat-atk', Math.floor(effectiveStats.atk), 'Attack', 'Damage dealt by each normal spell hit');
        setCombatStat('stat-spd', effectiveStats.speed.toFixed(1), 'Movement speed', 'How quickly Robstradomus closes distance to enemies');
        const displayedRegen = this.deathRecovery.active
            ? effectiveStats.maxHp / this.deathRecovery.duration
            : effectiveStats.regenHp;
        setCombatStat(
            'stat-regen',
            `${displayedRegen.toFixed(1)}/s`,
            'Health regeneration',
            this.deathRecovery.active
                ? `${displayedRegen.toFixed(1)} HP per second during defeat recovery; combat is locked`
                : `${displayedRegen.toFixed(1)} HP restored per second during combat`
        );
        setCombatStat(
            'stat-crit',
            `${Math.round(effectiveStats.crit * 100)}%`,
            'Critical chance',
            `${Math.round(effectiveStats.crit * 100)}% chance for a critical spell hit`
        );
        setCombatStat(
            'stat-crit-damage',
            `${effectiveStats.critDamage.toFixed(1)}×`,
            'Critical damage',
            `Critical hits deal ${effectiveStats.critDamage.toFixed(1)} times normal damage`
        );

        const characterLevel = document.getElementById('character-level');
        const characterTitle = document.getElementById('character-title');
        const characterHp = document.getElementById('character-stat-hp');
        const characterAtk = document.getElementById('character-stat-atk');
        const characterSpeed = document.getElementById('character-stat-spd');
        const characterRegen = document.getElementById('character-stat-regen');
        const characterCrit = document.getElementById('character-stat-crit');
        const characterCritDamage = document.getElementById('character-stat-crit-damage');
        const equipmentSummary = document.getElementById('equipment-bonus-summary');
        if (characterLevel) characterLevel.textContent = `LEVEL ${this.wizard.level}`;
        if (characterTitle) characterTitle.textContent = this.getDisplayTitle(this.wizard.level);
        if (characterHp) characterHp.textContent = Math.floor(effectiveStats.maxHp);
        if (characterAtk) characterAtk.textContent = Math.floor(effectiveStats.atk);
        if (characterSpeed) characterSpeed.textContent = effectiveStats.speed.toFixed(1);
        if (characterRegen) characterRegen.textContent = `${displayedRegen.toFixed(1)}/s`;
        if (characterCrit) characterCrit.textContent = `${Math.round(effectiveStats.crit * 100)}%`;
        if (characterCritDamage) characterCritDamage.textContent = `${effectiveStats.critDamage.toFixed(1)}×`;
        if (equipmentSummary) {
            const bonuses = this.getEquipmentBonuses();
            equipmentSummary.textContent = `Gear bonus: +${bonuses.maxHp} HP · +${bonuses.atk} ATK · +${bonuses.speed.toFixed(1)} SPD · +${Math.round(bonuses.crit * 100)}% CRIT · +${bonuses.critDamage.toFixed(1)}× CRIT DMG`;
        }

        const combatBuffs = document.getElementById('combat-buffs');
        const combatBuffsList = document.getElementById('combat-buffs-list');
        if (combatBuffs && combatBuffsList) {
            const activeEffects = this.getActiveConsumableEffects();
            combatBuffs.hidden = activeEffects.length === 0;
            combatBuffsList.replaceChildren();
            activeEffects.forEach(({ definition, remaining }) => {
                const buff = document.createElement('div');
                const seconds = Math.ceil(remaining);
                buff.className = `combat-buff rarity-${definition.rarity.toLowerCase()}`;
                buff.setAttribute('aria-label', `${definition.name} active: ${definition.effectLabel}, ${seconds} seconds remaining`);
                buff.dataset.tooltip = `${definition.name} active · ${definition.effectLabel} · ${seconds}s remaining`;

                const icon = document.createElement('span');
                icon.className = 'combat-buff-icon';
                icon.setAttribute('aria-hidden', 'true');
                icon.textContent = definition.icon || '✧';

                const copy = document.createElement('span');
                copy.className = 'combat-buff-copy';
                const name = document.createElement('strong');
                name.textContent = definition.name;
                const effect = document.createElement('small');
                effect.textContent = definition.effectLabel;
                copy.append(name, effect);

                const time = document.createElement('b');
                time.className = 'combat-buff-time';
                time.textContent = `${seconds}s`;
                buff.append(icon, copy, time);
                combatBuffsList.appendChild(buff);
            });
        }

        const activeMapResource = MAPS[this.currentMapKey]?.resource;
        document.querySelectorAll('[data-upgrade-resource]').forEach(walletEntry => {
            const resource = walletEntry.dataset.upgradeResource;
            const amount = walletEntry.querySelector('strong');
            const sourceMap = Object.values(MAPS).find(map => map.resource === resource);
            const balance = Number(this.wizard.resources?.[resource]) || 0;
            if (amount) amount.textContent = balance.toLocaleString();
            walletEntry.classList.toggle('active', resource === activeMapResource);
            walletEntry.title = `${balance.toLocaleString()} ${resource} from ${sourceMap?.name || 'map'}${resource === activeMapResource ? ' · Active map currency' : ''}`;
        });

        // Hero XP is never spent on upgrades. Each permanent upgrade is funded
        // by one or more map currencies. The shared state helper also powers the
        // ready glow on the Upgrades tab.
        const upgradeStates = this.getUpgradeStates();
        const upgradeGuidance = this.getUpgradeGuidance(upgradeStates);
        const upgradeReadySignature = upgradeGuidance.readyStates
            .map(state => `${state.key}:${state.rank}`)
            .join('|');
        if (upgradeReadySignature !== this.upgradeReadySignature) {
            const previousReadySignature = this.upgradeReadySignature;
            this.upgradeReadySignature = upgradeReadySignature;
            window.dispatchEvent(new CustomEvent('robstradomus-upgrades-changed', {
                detail: { readyCount: upgradeGuidance.readyCount }
            }));
            if (this.session.active && upgradeReadySignature && upgradeReadySignature !== previousReadySignature) {
                this.addLog(`UPGRADE READY · ${upgradeGuidance.recommended?.label || 'Combat power'} · open the Upgrades panel to claim the next power spike.`, 'system');
            }
        }
        upgradeStates.forEach(state => {
            this.setUpgradeBtn(
                state.id,
                state.costs,
                state.steps,
                state.affordable,
                state.rank,
                state.effect,
                state.maxed
            );
        });

        const milestoneText = document.getElementById('upgrade-milestone-text');
        if (milestoneText) {
            const mapData = MAPS[this.currentMapKey];
            const activeResource = mapData.resource;
            const farmableStates = upgradeStates.filter(state =>
                Object.prototype.hasOwnProperty.call(state.costs, activeResource) && !state.maxed
            );
            const resourcePerDefeat = Math.max(1, Math.round(
                ENDGAME_BALANCE.earlyResourceDrop
                * Math.pow(Math.max(1, mapData.difficulty || 1), ENDGAME_BALANCE.resourceDifficultyExponent)
                * this.wizard.resBonus
                * this.getMapResourceYieldMultiplier(this.currentMapKey)
                * (1 + this.getMapMasteryBonus(this.currentMapKey))
                * this.getRewardMultiplier()
            ));
            const cycleDefeats = Math.max(1, this.getWaveMonsterCount());
            const nextState = farmableStates
                .map(state => ({
                    ...state,
                    shortfall: Math.max(0, state.costs[activeResource] - (this.wizard.resources[activeResource] || 0))
                }))
                .sort((first, second) => first.shortfall - second.shortfall)[0];

            if (!nextState) {
                milestoneText.textContent = `All ${activeResource} upgrades are capped. Change maps to work toward another currency milestone.`;
            } else if (Object.keys(nextState.costs).length > 1) {
                milestoneText.textContent = `Next: ${nextState.label} Rank ${nextState.rank + 1} · ${nextState.effect} · ${nextState.costLabel} · rotate all three biomes to complete this convergence upgrade.`;
            } else {
                const defeatsNeeded = Math.ceil(nextState.shortfall / resourcePerDefeat);
                const cyclesNeeded = Math.ceil(defeatsNeeded / cycleDefeats);
                const cycleLabel = cyclesNeeded === 0
                    ? 'READY NOW'
                    : `about ${cyclesNeeded} farming cycle${cyclesNeeded === 1 ? '' : 's'}`;
                milestoneText.textContent = `One cycle ≈ ${cycleDefeats} current-wave defeats · Next: ${nextState.label} Rank ${nextState.rank + 1} · ${nextState.effect} · ${cycleLabel} (${defeatsNeeded} defeats) on ${mapData.name}.`;
            }
        }

        this.updateCombatMetricsUI();
    }

    updateMonsterInfoUI() {
        const mapData = MAPS[this.currentMapKey];
        const livingMonsters = this.monsters.filter(monster => !monster.isDead);
        const activeMonster = livingMonsters.reduce((nearest, monster) => {
            if (!this.wizard) return nearest || monster;
            const nearestDistance = nearest
                ? Math.hypot(nearest.x - this.wizard.x, nearest.y - this.wizard.y)
                : Infinity;
            const monsterDistance = Math.hypot(monster.x - this.wizard.x, monster.y - this.wizard.y);
            return monsterDistance < nearestDistance ? monster : nearest;
        }, null);
        const monsterStats = activeMonster?.getEffectiveStats() || this.getCurrentMonsterStats();
        const mapName = document.getElementById('combat-map-name');
        const playerLabel = document.getElementById('player-label');
        const playerLevel = document.getElementById('player-level');
        const playerTitle = document.getElementById('player-title');
        const monsterName = document.getElementById('monster-name');
        const monsterHp = document.getElementById('monster-stat-hp');
        const monsterAtk = document.getElementById('monster-stat-atk');
        const monsterShield = document.getElementById('monster-stat-shield');
        const monsterEliteStatus = document.getElementById('monster-elite-status');
        const heroTitle = this.getDisplayTitle(this.wizard.level);
        if (playerLevel) playerLevel.textContent = `· LV ${this.wizard.level}`;
        if (playerTitle) playerTitle.textContent = `· ${heroTitle}`;
        if (playerLabel) {
            const nextLevelXp = this.getHeroXpThreshold(this.wizard.level);
            const levelGrowth = this.getHeroLevelBonusSummary(1, this.wizard.level);
            playerLabel.dataset.tooltip = `${heroTitle} · Level ${this.wizard.level} · ${this.wizard.xp.toLocaleString()} / ${nextLevelXp.toLocaleString()} HERO XP to next level${levelGrowth ? ` · Level growth: ${levelGrowth}` : ''}`;
        }
        if (mapName) {
            mapName.textContent = mapData.name;
            mapName.dataset.tooltip = `${mapData.name} · ${this.getMapFarmPerk()}. ${mapData.farmReason || ''}`;
            mapName.setAttribute('aria-label', `${mapData.name} · ${this.getMapFarmPerk()}`);
        }
        if (monsterName) {
            const type = activeMonster?.type || monsterStats.name || mapData.monster;
            const combatPrefix = activeMonster?.isBoss
                ? 'BOSS '
                : activeMonster?.isElite
                    ? 'ELITE '
                    : '';
            const roleText = activeMonster?.trait || monsterStats.trait || 'Unknown combat role';
            monsterName.textContent = `${combatPrefix}${type}`;
            monsterName.dataset.tooltip = activeMonster?.isBoss
                ? `${type} · Boss encounter. ${roleText}.`
                : `${type} · ${roleText}.`;
            monsterName.setAttribute('aria-label', `${combatPrefix}${type} · ${roleText}`);
        }
        if (monsterEliteStatus) {
            const fightingBoss = Boolean(activeMonster?.isBoss);
            const fightingElite = Boolean(activeMonster?.isElite && !fightingBoss);
            monsterEliteStatus.hidden = !fightingBoss && !fightingElite;
            monsterEliteStatus.classList.toggle('boss-status', fightingBoss);
            monsterEliteStatus.textContent = fightingBoss
                ? 'FIGHTING BOSS'
                : fightingElite
                    ? 'FIGHTING ELITE'
                    : '';
            monsterEliteStatus.dataset.tooltip = fightingBoss
                ? 'This enemy has boss-level health, damage, ward, and rewards.'
                : fightingElite
                    ? 'This enemy is an empowered elite variant with improved combat stats.'
                    : '';
        }
        if (monsterHp) {
            const hpText = activeMonster
                ? `${Math.ceil(activeMonster.hp)} / ${Math.floor(monsterStats.maxHp)}`
                : monsterStats.maxHp;
            monsterHp.textContent = hpText;
            const card = monsterHp.closest('.monster-stat');
            if (card) {
                card.dataset.tooltip = `Enemy health: ${hpText}${activeMonster ? ' current / maximum' : ''}.`;
                card.setAttribute('aria-label', `Enemy health: ${hpText}`);
            }
        }
        if (monsterAtk) {
            monsterAtk.textContent = Math.floor(monsterStats.atk);
            const card = monsterAtk.closest('.monster-stat');
            if (card) {
                card.dataset.tooltip = `Enemy attack: ${Math.floor(monsterStats.atk)} damage per normal hit.`;
                card.setAttribute('aria-label', `Enemy attack: ${Math.floor(monsterStats.atk)} damage per normal hit`);
            }
        }
        if (monsterShield) {
            const shieldText = activeMonster
                ? `${Math.ceil(activeMonster.shield)} / ${Math.floor(monsterStats.shield)}`
                : monsterStats.shield;
            monsterShield.textContent = shieldText;
            const absorption = Math.round((monsterStats.shieldAbsorption || 0) * 100);
            const shieldDetail = monsterStats.shield > 0
                ? `Ward absorbs about ${absorption}% of each hit while active, then recharges after ${monsterStats.shieldRechargeDelay.toFixed(1)}s without being hit.`
                : 'This monster has no ward.';
            const card = monsterShield.closest('.monster-stat');
            if (card) {
                card.dataset.tooltip = `Enemy ward / shield: ${shieldText}. ${shieldDetail}`;
                card.setAttribute('aria-label', `Enemy ward or shield: ${shieldText}. ${shieldDetail}`);
            }
        }
    }

    setUpgradeBtn(id, costs, steps, affordable, rank = 0, effect = '', maxed = false) {
        const btn = document.getElementById(id);
        if (!btn) return;
        const safeCosts = costs && typeof costs === 'object' ? costs : {};
        const safeSteps = steps && typeof steps === 'object' ? steps : {};
        const formatCosts = values => Object.entries(values)
            .map(([resource, amount]) => `${amount.toLocaleString()} ${resource}`)
            .join(' · ');
        const formatBalances = values => Object.entries(values)
            .map(([resource, amount]) => `${(Number(this.wizard?.resources?.[resource]) || 0).toLocaleString()} ${resource}`)
            .join(' · ');
        const missingLabel = Object.entries(safeCosts)
            .map(([resource, amount]) => {
                const balance = Number(this.wizard?.resources?.[resource]) || 0;
                return balance < amount ? `${(amount - balance).toLocaleString()} more ${resource}` : null;
            })
            .filter(Boolean)
            .join(' · ');
        const costLabel = formatCosts(safeCosts);
        const stepLabel = formatCosts(safeSteps);
        const resourceLabel = Object.keys(safeCosts).join(' + ');

        const rankElement = btn.querySelector('.upgrade-rank');
        const effectElement = btn.querySelector('.upgrade-effect');
        const costValueElement = btn.querySelector('.cost-value') || btn.querySelector('.cost');
        const costGrowthElement = btn.querySelector('.cost-growth');
        if (rankElement) rankElement.textContent = `Rank ${rank}`;
        if (effectElement) effectElement.textContent = maxed ? 'Maximum reached' : `Next ${effect}`;
        if (costValueElement) costValueElement.textContent = maxed ? 'MAXED' : `Cost: ${costLabel}`;
        if (costGrowthElement) costGrowthElement.textContent = maxed
            ? 'Upgrade cap reached'
            : `${stepLabel} / rank`;

        btn.dataset.upgradeName = btn.querySelector('.upgrade-name')?.textContent?.trim() || id;
        btn.dataset.upgradeRank = String(rank);
        btn.dataset.upgradeEffect = maxed ? 'Maximum reached' : effect;
        btn.dataset.upgradeCost = String(Object.values(safeCosts)[0] || 0);
        btn.dataset.upgradeResource = resourceLabel;
        btn.dataset.upgradeCostLabel = costLabel;
        btn.dataset.upgradeCostStepLabel = stepLabel;
        btn.dataset.upgradeBalanceLabel = formatBalances(safeCosts);
        btn.dataset.upgradeMissingLabel = missingLabel;
        btn.dataset.upgradeMaxed = String(maxed);
        btn.dataset.upgradeAffordable = String(affordable);
        btn.classList.toggle('upgrade-maxed', maxed);
        btn.classList.toggle('upgrade-ready', affordable && !maxed);
        btn.removeAttribute('title');
        btn.setAttribute('aria-disabled', String(maxed || !affordable));
        btn.disabled = maxed || !affordable;
        btn.onclick = () => this.buyUpgrade(id, safeCosts);
    }

    buyUpgrade(id, costs) {
        if (!costs || typeof costs !== 'object') return;
        const requirements = Object.entries(costs)
            .filter(([resource, amount]) => Object.prototype.hasOwnProperty.call(this.wizard.resources, resource)
                && Number.isFinite(amount)
                && amount > 0);
        if (requirements.length !== Object.keys(costs).length) return;
        if (!requirements.every(([resource, amount]) => this.wizard.resources[resource] >= amount)) return;
        requirements.forEach(([resource, amount]) => {
            this.wizard.resources[resource] -= amount;
        });

        if (id === 'upg-atk') this.wizard.stats.atk += 4;
        if (id === 'upg-hp') {
            this.wizard.stats.maxHp += 25;
            this.wizard.hp += 25;
        }
        if (id === 'upg-regen') this.wizard.stats.regenHp += 0.4;
        if (id === 'upg-spd') this.wizard.stats.speed += 0.35;
        if (id === 'upg-crit') this.wizard.stats.crit = Math.min(1, this.wizard.stats.crit + 0.03);
        if (id === 'upg-crit-damage') this.wizard.stats.critDamage = Math.min(3, this.wizard.stats.critDamage + 0.08);
        if (id === 'upg-res') this.wizard.resBonus += 0.15;

        const upgradeKey = {
            'upg-atk': 'atk',
            'upg-hp': 'hp',
            'upg-regen': 'regen',
            'upg-spd': 'spd',
            'upg-crit': 'crit',
            'upg-crit-damage': 'critDamage',
            'upg-res': 'res'
        }[id];
        if (upgradeKey) this.upgradeCounts[upgradeKey] = (this.upgradeCounts[upgradeKey] || 0) + 1;
        this.updateWizardEquipmentStats();
        this.lifetimeStats.upgrades += 1;
        this.checkAchievementUnlocks();

        this.addLog(id === 'upg-regen'
            ? `HP regeneration increased to ${this.wizard.stats.regenHp.toFixed(1)} per second.`
            : id === 'upg-crit'
                ? `Critical chance increased to ${Math.round(this.wizard.stats.crit * 100)}%.`
                : id === 'upg-crit-damage'
                    ? `Critical damage increased to ${this.wizard.stats.critDamage.toFixed(1)}×.`
                    : id === 'upg-res'
                        ? `Resource yield increased to +${Math.round((this.wizard.resBonus - 1) * 100)}%.`
                        : 'Upgrade purchased!');
        this.saveProgress();
        this.updateUI();
    }

    start() {
        if (this.respawnTimeout) {
            clearTimeout(this.respawnTimeout);
            this.respawnTimeout = null;
        }
        this.deathRecovery.active = false;
        this.deathRecovery.remaining = 0;
        this.wizard.setRecoveryVisual(false);

        this.session = {
            active: true,
            paused: false,
            hasRun: true,
            elapsed: 0,
            defeats: 0,
            zoneDefeats: 0,
            xpEarned: 0,
            damageDealt: 0,
            resources: { Gold: 0, Mana: 0, Rubies: 0 },
            lootDrops: 0,
            recentLoot: [],
        };
        this.running = true;
        this.preventSaving = false;
        this.vfx = [];
        this.wizard.hp = this.wizard.getEffectiveStats().maxHp;
        this.wizard.isDead = false;
        this.wizard.x = DESIGN_WIDTH / 2;
        this.wizard.y = DESIGN_HEIGHT / 2;
        this.wizard.attackTimer = 0;
        this.waveNumber = 1;
        this.spawnMonsters();
        this.checkRecipeDiscoveries(true);
        this.audio.ambient.currentTime = 0;
        this.audio.ambient.play().catch(() => {});
        this.lastTime = performance.now();
        this.saveAccumulator = 0;
        this.uiAccumulator = 0;
        this.saveProgress();
        requestAnimationFrame((t) => this.update(t));
        this.addLog(`Started a new run on ${MAPS[this.currentMapKey].name} · Zone ${this.zoneNumber}, Wave ${this.waveNumber}: ${this.getWaveProfile().name} · Danger ${this.getDangerMultiplier().toFixed(2)}× · rewards +${this.getRewardBonusPercent()}%.`);
        this.updateUI();
    }

    togglePause() {
        if (!this.session.active || this.deathRecovery.active) return;

        if (this.session.paused) {
            this.session.paused = false;
            this.running = true;
            this.lastTime = performance.now();
            this.audio.ambient.play().catch(() => {});
            requestAnimationFrame((t) => this.update(t));
            this.addLog('Farming resumed.');
        } else {
            this.session.paused = true;
            this.running = false;
            this.audio.ambient.pause();
            this.saveProgress();
            this.addLog('Farming paused.');
        }
        this.updateUI();
    }

    stopAndCollect() {
        if (!this.session.active) return;

        if (this.deathRecovery.active) {
            this.deathRecovery.active = false;
            this.deathRecovery.remaining = 0;
            this.wizard.setRecoveryVisual(false);
            this.wizard.hp = this.wizard.getEffectiveStats().maxHp;
            this.wizard.isDead = false;
        }
        this.running = false;
        this.session.active = false;
        this.session.paused = false;
        this.audio.ambient.pause();
        this.audio.ambient.currentTime = 0;
        this.vfx = [];

        if (this.respawnTimeout) {
            clearTimeout(this.respawnTimeout);
            this.respawnTimeout = null;
        }

        this.addLog(`Run collected: ${this.session.defeats} defeats, +${this.session.xpEarned} HERO XP.`);
        this.saveProgress();
        this.updateUI();
        this.draw();
    }
}
