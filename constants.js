export const ASSETS = {
    WIZARD: 'assets/robstradomus-wizard.webp',
    SLIME: 'assets/slime-monster.webp',
    SKELETON: 'assets/skeleton-warrior.webp',
    DRAGON: 'assets/dragon-boss.webp',
    SPROUT_SLIME: 'assets/sprout-slime.webp',
    BRAMBLE_SLIME: 'assets/bramble-slime.webp',
    MOSSBACK_GUARDIAN: 'assets/mossback-guardian.webp',
    DUST_SCUTTLER: 'assets/dust-scuttler.webp',
    BONE_SHIELDBEARER: 'assets/bone-shieldbearer.webp',
    SANDSTONE_WARDEN: 'assets/sandstone-warden.webp',
    CINDER_WHELP: 'assets/cinder-whelp.webp',
    OBSIDIAN_SHIELDBEARER: 'assets/obsidian-shieldbearer.webp',
    ANCIENT_DRAGON: 'assets/ancient-dragon.webp',
    TILE_GRASS: 'assets/grass-tile.webp',
    TILE_SAND: 'assets/sand-tile.webp',
    TILE_DUNGEON: 'assets/dungeon-tile.webp',
    VFX_BOLT: 'assets/magic-bolt-vfx.webp',
    MUSIC_AMBIENT: 'assets/audio/mystical-ambient-loop.mp3',
    SFX_ATTACK: 'assets/audio/magic-bolt-sfx.mp3',
    SFX_HIT: 'assets/audio/enemy-hit-sfx.mp3',
    SFX_CELEBRATION: 'assets/audio/whimsical-celebration-sfx.mp3'
};

export const MONSTER_SPRITES = {
    'Sprout Slime': ASSETS.SPROUT_SLIME,
    'Bramble Slime': ASSETS.BRAMBLE_SLIME,
    'Mossback Guardian': ASSETS.MOSSBACK_GUARDIAN,
    'Dust Scuttler': ASSETS.DUST_SCUTTLER,
    'Bone Shieldbearer': ASSETS.BONE_SHIELDBEARER,
    'Sandstone Warden': ASSETS.SANDSTONE_WARDEN,
    'Cinder Whelp': ASSETS.CINDER_WHELP,
    'Obsidian Shieldbearer': ASSETS.OBSIDIAN_SHIELDBEARER,
    'Ancient Dragon': ASSETS.ANCIENT_DRAGON
};

export const ELITE_MONSTER_SPRITES = {
    'Sprout Slime': 'assets/elite-sprout-slime.webp',
    'Bramble Slime': 'assets/elite-bramble-slime.webp',
    'Mossback Guardian': 'assets/elite-mossback-guardian.webp',
    'Dust Scuttler': 'assets/elite-dust-scuttler.webp',
    'Bone Shieldbearer': 'assets/elite-bone-shieldbearer.webp',
    'Sandstone Warden': 'assets/elite-sandstone-warden.webp',
    'Cinder Whelp': 'assets/elite-cinder-whelp.webp',
    'Obsidian Shieldbearer': 'assets/elite-obsidian-shieldbearer.webp',
    'Ancient Dragon': 'assets/elite-ancient-dragon.webp'
};

// Bosses use bespoke silhouettes so a milestone encounter reads instantly on
// the battlefield. The base monster name remains the stable identity used by
// loot tables and future boss-progression systems.
export const BOSS_MONSTER_SPRITES = {
    'Sprout Slime': 'assets/boss-sprout-slime.webp',
    'Bramble Slime': 'assets/boss-bramble-slime.webp',
    'Mossback Guardian': 'assets/boss-mossback-guardian.webp',
    'Dust Scuttler': 'assets/boss-dust-scuttler.webp',
    'Bone Shieldbearer': 'assets/boss-bone-shieldbearer.webp',
    'Sandstone Warden': 'assets/boss-sandstone-warden.webp',
    'Cinder Whelp': 'assets/boss-cinder-whelp.webp',
    'Obsidian Shieldbearer': 'assets/boss-obsidian-shieldbearer.webp',
    'Ancient Dragon': 'assets/boss-ancient-dragon.webp'
};

export const DEFAULT_WEAPON_SPELL = {
    id: 'arcane-bolt',
    projectileShape: 'arcane-bolt',
    impactShape: 'arcane-burst',
    colors: {
        core: '#fff1bd',
        primary: '#b98cff',
        secondary: '#75b8ff',
        glow: '#d7a6ff'
    }
};

// Weapon visuals stay data-driven so every future weapon drop can own a readable
// battlefield identity without changing the combat loop or Canvas renderer.
export const WEAPON_SPELLS = {
    'ember-staff': {
        id: 'ember-bolt',
        projectileShape: 'ember-bolt',
        impactShape: 'ember-burst',
        colors: {
            core: '#fff4c2',
            primary: '#ff7a21',
            secondary: '#ffd05a',
            glow: '#ff3d16'
        }
    },
    'dragonheart-focus': {
        id: 'dragonheart-comet',
        projectileShape: 'dragon-comet',
        impactShape: 'dragon-burst',
        colors: {
            core: '#fff1d0',
            primary: '#e34e2f',
            secondary: '#c17bff',
            glow: '#ff4f8a'
        }
    }
};

// Hero XP is reserved for level progression. Permanent upgrades use map
// currencies instead of consuming XP. Every upgrade is represented by a
// currency requirement map so future biomes can join a recipe without needing
// a new purchase system. Most upgrades stay biome-specialized; Resource Bonus
// is the first cross-biome sink and asks the player to rotate through all three
// current routes for each rank.
// The current balance target is a 200-zone expedition. Early ranks should land
// during the opening minutes, while the linear cost steps create a dependable
// long-term sink once zones and resource yield begin compounding.
export const UPGRADE_COSTS = {
    atk: { costs: { Gold: 30 }, step: { Gold: 40 } },
    hp: { costs: { Gold: 40 }, step: { Gold: 45 } },
    regen: { costs: { Mana: 45 }, step: { Mana: 55 } },
    spd: { costs: { Mana: 45 }, step: { Mana: 50 } },
    crit: { costs: { Rubies: 90 }, step: { Rubies: 140 } },
    critDamage: { costs: { Rubies: 120 }, step: { Rubies: 160 } },
    // Yield is intentionally a cross-biome lane. It accelerates future farming
    // but still requires rotating through Gold, Mana, and Ruby routes.
    res: {
        costs: { Gold: 90, Mana: 120, Rubies: 70 },
        step: { Gold: 85, Mana: 110, Rubies: 65 }
    }
};

// Permanent upgrades are the wizard's attunement layer. Their flat bonuses are
// guaranteed, while each rank also amplifies the matching total stat after gear,
// titles, journal mastery, and preparations are combined. This keeps upgrades
// valuable when a new drop replaces a flat-stat upgrade without making gear less
// exciting: better gear gives the attunement more to work with.
export const UPGRADE_ATTUNEMENT = {
    atk: { stat: 'atk', perRank: 0.012, maxBonus: 1.5, label: 'total ATK' },
    hp: { stat: 'maxHp', perRank: 0.012, maxBonus: 1.5, label: 'total HP' },
    regen: { stat: 'regenHp', perRank: 0.012, maxBonus: 1.5, label: 'total REGEN' },
    spd: { stat: 'speed', perRank: 0.01, maxBonus: 1.25, label: 'total SPD' },
    crit: { stat: 'crit', perRank: 0.01, maxBonus: 1.25, label: 'total CRIT' },
    critDamage: { stat: 'critDamage', perRank: 0.01, maxBonus: 1.25, label: 'total CRIT DMG' }
};

// Zone 200 is the current endgame target. The power curve is deliberately
// sub-exponential: the first 20 zones move quickly, then each later band asks
// for more gear, upgrades, recipes, mastery, and route rotation.
export const ENDGAME_BALANCE = {
    maxZone: 200,
    // Keep Zone 1 and the opening route familiar, then make later zones catch
    // up with Attunement, deep gear, and enhancement instead of letting player
    // power compound much faster than monster pressure.
    zoneDifficultyBase: 0.045,
    zoneDifficultyExponent: 1.27,
    zoneRewardBase: 0.055,
    zoneRewardExponent: 1.08,
    monsterHealthExponent: 1.1,
    monsterAttackExponent: 0.78,
    earlyResourceDrop: 4,
    resourceDifficultyExponent: 0.45,
    materialZoneQuantityStep: 50,
    materialEliteMultiplier: 2,
    materialBossMultiplier: 4,
    wizardAttackInterval: 0.82,
    wizardSpeedAttackReduction: 0.018
};

// Hero XP is cumulative. Rewards rise with expedition pressure, but the level
// curve grows faster so levels remain meaningful without racing the zone curve.
export const HERO_XP_BALANCE = {
    baseLevelXp: 110,
    levelCurveExponent: 1.5,
    baseMonsterXp: 5,
    rewardScalingExponent: 0.58,
    eliteMultiplier: 1.8,
    statGainsPerLevel: {
        maxHp: 8,
        atk: 0.75,
        speed: 0.035,
        regenHp: 0.07,
        crit: 0.0025,
        critDamage: 0.012
    },
    milestoneTitles: [
        { level: 10, name: 'Arcane Adept' },
        { level: 25, name: 'Spellbinder' },
        { level: 50, name: 'Archmage' },
        { level: 100, name: 'Grand Magus' },
        { level: 200, name: 'Eternal Grand Magus' },
        { level: 300, name: 'Astral Sovereign' },
        { level: 400, name: 'Void Archon' }
    ]
};

// Higher tiers join the loot pool instead of replacing Common gear. Scores map
// roughly to Grassland Zone 5 / 15 / 40 / 100, leaving the final half of the
// expedition for improving rolls, mastery, and finding truly rare Legendaries.
export const RARITIES = [
    { name: 'Common', displayName: 'Normal', multiplier: 1, color: '#b8b8b8', unlockScore: 0, dropWeight: 100 },
    { name: 'Uncommon', multiplier: 1.2, color: '#70d58b', unlockScore: 15, dropWeight: 20 },
    { name: 'Rare', multiplier: 1.45, color: '#75b8ff', unlockScore: 45, dropWeight: 5, },
    { name: 'Epic', multiplier: 1.75, color: '#d38cff', unlockScore: 120, dropWeight: 1 },
    { name: 'Legendary', multiplier: 2.15, color: '#ffb84d', unlockScore: 300, dropWeight: 0.12 }
];

// Every completed five-zone band advances the quality focus toward the next
// unlocked tier. The handoff is intentionally gradual: an older tier can lead
// first, the next tier follows, and then the newer tier becomes the most likely.
export const LOOT_RARITY_DEPTH_BALANCE = {
    zoneStep: 5,
    handoffZones: 10,
    baseWeightExponent: 0.35,
    focusSharpness: 0.75
};

// Salvage is a dedicated enhancement currency rather than a crafting material.
// Materials remain available for recipes; dismantled equipment becomes Arcane Dust.
export const SALVAGE_CURRENCY = {
    id: 'arcane-dust',
    name: 'Arcane Dust',
    shortName: 'DUST',
    icon: '✺',
    color: '#d38cff',
    description: 'Residual enchantment released when equipment is salvaged. Spend it to gamble on stronger gear rolls.'
};

// Each enhancement is its own persistent gamble. The roll is added to the
// item's existing combat stats and can later be removed by a crafted Reversal
// Seal. Costs still rise by rarity and rank so chasing a perfect item remains a
// meaningful Arcane Dust sink.
export const GEAR_ENHANCEMENT_BALANCE = {
    baseCost: 12,
    enhancementMultiplier: 1.35,
    enhancementRollMin: 0.01,
    enhancementRollMax: 0.10,
    enhancementCriticalChance: 0.05,
    enhancementCriticalRollMin: 0.08,
    enhancementCriticalRollMax: 0.15,
    maxEnhancements: 10,
    maxItemLevel: 200,
    rarityMultipliers: {
        Common: 1,
        Uncommon: 1.35,
        Rare: 1.8,
        Epic: 2.4,
        Legendary: 3.2
    }
};

// Exceptional gear is intentionally rare: a drop needs both an excellent
// average roll and at least one near-perfect affix so it feels like a keeper,
// not just another high-rarity item. The tighter gate is especially important
// for one-stat Normal gear, where the average is also the only roll.
export const EXCEPTIONAL_GEAR = {
    averageRollThreshold: 0.92,
    topRollThreshold: 0.985
};

// Every discovered equipment base has its own compact mastery track. Points are
// earned by recording the base and then improving its best rarity or roll, while
// the rank rewards are permanent save-slot bonuses rather than item bonuses.
export const EQUIPMENT_JOURNAL_MASTERY = {
    firstDiscoveryPoints: 1,
    rarityImprovementPoints: 2,
    rollImprovementPoints: 1,
    // The first five ranks stay familiar for existing records. These two
    // endgame ranks keep Discovery Insight relevant while the wizard hunts
    // exceptional Zone 100–200 gear instead of finishing the journal early.
    ranks: [
        { points: 1, name: 'Catalogued', bonuses: { maxHp: 4 } },
        { points: 3, name: 'Attuned', bonuses: { atk: 1 } },
        { points: 6, name: 'Refined', bonuses: { speed: 0.05 } },
        { points: 10, name: 'Masterwork', bonuses: { crit: 0.005 } },
        { points: 15, name: 'Signature', bonuses: { critDamage: 0.05 } },
        { points: 24, name: 'Ascendant', bonuses: { maxHp: 10 } },
        { points: 36, name: 'Sovereign', bonuses: { atk: 1 } }
    ]
};

export const ACHIEVEMENT_TIER_NAMES = ['Novice', 'Bronze', 'Silver', 'Gold', 'Mythic'];

// Achievements measure lifetime progress inside the active save slot. Milestones
// climb non-linearly so early tiers teach the loop while the final tiers remain
// long-term goals worthy of the strongest title bonuses.
export const ACHIEVEMENTS = [
    { id: 'defeats', icon: '⚔', name: 'Monster Hunter', description: 'Defeat monsters anywhere in the realms.', metric: 'defeats', thresholds: [50, 300, 1500, 7500, 40000], finalReward: { icon: '🛡', name: 'Hunter\'s Aegis', description: 'The codex hardens the wizard against every foe.', bonuses: { maxHp: 12 } } },
    { id: 'elite-defeats', icon: '✦', name: 'Elite Breaker', description: 'Bring down empowered elite enemies.', metric: 'eliteDefeats', thresholds: [5, 40, 250, 1500, 10000], finalReward: { icon: '⚡', name: 'Breaker\'s Edge', description: 'A permanent arcane edge sharpens every spell.', bonuses: { atk: 1 } } },
    { id: 'boss-defeats', icon: '♛', name: 'Boss Bane', description: 'Claim victory over milestone bosses.', metric: 'bossDefeats', thresholds: [3, 15, 60, 250, 1200], finalReward: { icon: '♛', name: 'Crown of Defiance', description: 'Boss victories leave a lasting critical imprint.', bonuses: { critDamage: 0.04 } } },
    { id: 'hero-xp', icon: '✧', name: 'Arcane Scholar', description: 'Earn Hero XP through relentless farming.', metric: 'xp', thresholds: [500, 7500, 75000, 1000000, 15000000], finalReward: { icon: '✧', name: 'Scholar\'s Resonance', description: 'The wizard\'s growing mastery quickens their casting rhythm.', bonuses: { speed: 0.05 } } },
    { id: 'gold', icon: '●', name: 'Gold Foundry', description: 'Farm Gold in the Grasslands.', metric: 'resource:Gold', thresholds: [500, 5000, 75000, 1000000, 15000000], finalReward: { icon: '●', name: 'Gilded Pulse', description: 'The foundry\'s rhythm strengthens the wizard\'s recovery.', bonuses: { regenHp: 0.15 } } },
    { id: 'mana', icon: '◇', name: 'Mana Wellspring', description: 'Draw Mana from the Desert.', metric: 'resource:Mana', thresholds: [500, 5000, 75000, 1000000, 15000000], finalReward: { icon: '◇', name: 'Wellspring Focus', description: 'Desert mana leaves a sharper spark in every spell.', bonuses: { crit: 0.01 } } },
    { id: 'rubies', icon: '◆', name: 'Ruby Magnate', description: 'Harvest Rubies from the Dungeon.', metric: 'resource:Rubies', thresholds: [500, 3000, 25000, 150000, 1500000], finalReward: { icon: '◆', name: 'Ruby Heart', description: 'Dungeon rubies anchor the wizard\'s destructive force.', bonuses: { critDamage: 0.03 } } },
    { id: 'loot', icon: '▣', name: 'Relic Seeker', description: 'Collect loot drops from defeated foes.', metric: 'loot', thresholds: [10, 100, 750, 5000, 30000], finalReward: { icon: '▣', name: 'Relic-Bound Might', description: 'Every recovered relic adds a little weight to the wizard\'s spells.', bonuses: { atk: 2 } } },
    { id: 'materials', icon: '⬢', name: 'Salvage Savant', description: 'Gather crafting materials from expedition drops.', metric: 'materials', thresholds: [50, 400, 2500, 15000, 100000], finalReward: { icon: '⬢', name: 'Savant\'s Tempo', description: 'Mastered salvage techniques make every motion more efficient.', bonuses: { speed: 0.05 } } },
    { id: 'crafts', icon: '⚗', name: 'Ritual Brewer', description: 'Craft arcane preparations and enhancement seals.', metric: 'crafts', thresholds: [5, 30, 150, 600, 2500], finalReward: { icon: '⚗', name: 'Brewer\'s Vitality', description: 'Repeated rituals leave a permanent restorative trace.', bonuses: { regenHp: 0.15 } } },
    { id: 'upgrades', icon: '⬡', name: 'Power Ascendant', description: 'Purchase permanent combat upgrades.', metric: 'upgrades', thresholds: [5, 30, 150, 600, 2500], finalReward: { icon: '⬡', name: 'Ascendant Core', description: 'The upgrade path crystallizes into lasting resilience.', bonuses: { maxHp: 8 } } },
    { id: 'damage', icon: '☄', name: 'Spellstorm', description: 'Deal damage with Robstradomus\' spells.', metric: 'damage', thresholds: [5000, 75000, 1000000, 15000000, 150000000], finalReward: { icon: '☄', name: 'Stormbrand', description: 'The final storm leaves a permanent mark on spellpower.', bonuses: { atk: 1 } } },
    { id: 'grass-mastery', icon: '♣', name: 'Grassland Keeper', description: 'Defeat monsters in the Grasslands.', metric: 'map:grass', thresholds: [100, 500, 2500, 12000, 50000], finalReward: { icon: '♣', name: 'Verdant Ward', description: 'The Grasslands lend the wizard a lasting living ward.', bonuses: { maxHp: 8 } } },
    { id: 'desert-mastery', icon: '☼', name: 'Dune Walker', description: 'Defeat monsters in the Desert.', metric: 'map:desert', thresholds: [75, 400, 2000, 10000, 40000], finalReward: { icon: '☼', name: 'Sunstride', description: 'Desert mastery leaves a permanent swiftness in the step.', bonuses: { speed: 0.05 } } },
    { id: 'dungeon-mastery', icon: '☠', name: 'Dungeon Delver', description: 'Defeat monsters in the Dungeon.', metric: 'map:dungeon', thresholds: [50, 300, 1500, 8000, 35000], finalReward: { icon: '☠', name: 'Deepstone Resolve', description: 'The deepest vaults temper the wizard\'s critical force.', bonuses: { critDamage: 0.04 } } },
    { id: 'expedition-depth', icon: '↟', name: 'Expedition Pioneer', description: 'Unlock deeper zones in any biome.', metric: 'highestZone', thresholds: [5, 20, 50, 100, 200], finalReward: { icon: '↟', name: 'Far Horizon', description: 'Reaching the Zone 200 expedition horizon permanently expands battle speed.', bonuses: { speed: 0.08 } } },
    { id: 'dungeon-depth', icon: '☠', name: 'Nightvault Descent', description: 'Push the Dungeon to its Zone 200 endgame.', metric: 'zone:dungeon', thresholds: [10, 35, 75, 140, 200], finalReward: { icon: '☠', name: 'Nightvault Sigil', description: 'The Zone 200 vault tempers the wizard with a lasting critical edge.', bonuses: { critDamage: 0.05 } } },
    { id: 'waves', icon: '≋', name: 'Wavebreaker', description: 'Clear combat waves.', metric: 'wavesCleared', thresholds: [12, 75, 400, 2000, 10000], finalReward: { icon: '≋', name: 'Tideheart', description: 'The rhythm of endless waves strengthens the wizard\'s renewal.', bonuses: { regenHp: 0.15 } } },
    { id: 'level', icon: '★', name: 'Grand Magus', description: 'Grow Robstradomus to higher levels.', metric: 'level', thresholds: [12, 30, 75, 150, 350], finalReward: { icon: '★', name: 'Magus\'s Keystone', description: 'The completed ascent anchors a permanent reserve of life.', bonuses: { maxHp: 12 } } }
];

// Three title slots are available immediately. The later slots are earned from
// total achievement tiers, giving long-term collectors more build flexibility.
export const TITLE_SLOT_UNLOCKS = [
    { slots: 4, requiredTiers: 18, name: 'Lesser Sigil Array' },
    { slots: 5, requiredTiers: 45, name: 'Greater Sigil Array' },
    { slots: 6, requiredTiers: 80, name: 'Sovereign Sigil Array' }
];

// Achievement titles are combat honors, not just nameplates. Their requirements
// and bonuses escalate together so the rarest titles create the strongest builds.
export const ACHIEVEMENT_TITLES = [
    { id: 'title-realm-walker', icon: '✧', name: 'Realm Walker', description: 'A wizard who has crossed every farming route.', achievementId: 'defeats', requiredTier: 2, rarity: 'Uncommon', bonuses: { maxHp: 20, speed: 0.15 } },
    { id: 'title-elite-breaker', icon: '✦', name: 'Elite Breaker', description: 'Your spells have shattered empowered foes.', achievementId: 'elite-defeats', requiredTier: 3, rarity: 'Rare', bonuses: { atk: 4, crit: 0.02 } },
    { id: 'title-boss-bane', icon: '♛', name: 'Boss Bane', description: 'Milestone monsters know your name.', achievementId: 'boss-defeats', requiredTier: 3, rarity: 'Epic', bonuses: { maxHp: 35, critDamage: 0.15 } },
    { id: 'title-relic-seeker', icon: '▣', name: 'Relic Seeker', description: 'A collector of arcane treasures and strange tools.', achievementId: 'loot', requiredTier: 4, rarity: 'Epic', bonuses: { atk: 6, resourceYield: 0.05 } },
    { id: 'title-master-of-waves', icon: '≋', name: 'Master of Waves', description: 'Every assault breaks against your growing momentum.', achievementId: 'waves', requiredTier: 4, rarity: 'Epic', bonuses: { speed: 0.25, regenHp: 0.5 } },
    { id: 'title-dungeon-crown', icon: '☠', name: 'Nightvault Crown', description: 'The Dungeon’s Zone 200 vaults bow to your persistence.', achievementId: 'dungeon-depth', requiredTier: 5, rarity: 'Legendary', bonuses: { maxHp: 150, crit: 0.05 } },
    { id: 'title-astral-sovereign', icon: '★', name: 'Astral Sovereign', description: 'Your mastery reaches beyond the known skies.', achievementId: 'level', requiredTier: 5, rarity: 'Legendary', bonuses: { maxHp: 80, critDamage: 0.28 } },
    { id: 'title-void-conqueror', icon: '✺', name: 'Zone 200 Conqueror', description: 'You have pushed the expedition to the current endgame horizon.', achievementId: 'expedition-depth', requiredTier: 5, rarity: 'Legendary', bonuses: { atk: 10, resourceYield: 0.08 } }
];

export const TITLE_BONUS_STAT_LABELS = {
    maxHp: 'HP',
    atk: 'ATK',
    speed: 'SPD',
    regenHp: 'REGEN',
    crit: 'CRIT',
    critDamage: 'CRIT DMG',
    resourceYield: 'RESOURCE YIELD'
};

export const ACHIEVEMENT_BADGES = [
    { id: 'badge-monster-hunter', icon: '⚔', name: 'Monster Hunter', description: 'A mark of relentless victories.', achievementId: 'defeats', requiredTier: 1 },
    { id: 'badge-elite-breaker', icon: '✦', name: 'Elite Breaker', description: 'Earned by defeating empowered enemies.', achievementId: 'elite-defeats', requiredTier: 1 },
    { id: 'badge-boss-bane', icon: '♛', name: 'Boss Bane', description: 'Reserved for proven boss slayers.', achievementId: 'boss-defeats', requiredTier: 1 },
    { id: 'badge-arcane-scholar', icon: '✧', name: 'Arcane Scholar', description: 'A lifetime of gathered Hero XP.', achievementId: 'hero-xp', requiredTier: 2 },
    { id: 'badge-gold-foundry', icon: '●', name: 'Gold Foundry', description: 'Forged through Grassland farming.', achievementId: 'gold', requiredTier: 2 },
    { id: 'badge-dune-walker', icon: '☼', name: 'Dune Walker', description: 'Proof of endurance in the Desert.', achievementId: 'desert-mastery', requiredTier: 2 },
    { id: 'badge-dungeon-delver', icon: '☠', name: 'Dungeon Delver', description: 'A sigil for surviving the deep.', achievementId: 'dungeon-mastery', requiredTier: 2 },
    { id: 'badge-wavebreaker', icon: '≋', name: 'Wavebreaker', description: 'A badge for clearing wave after wave.', achievementId: 'waves', requiredTier: 3 }
];

export const ACHIEVEMENT_BADGE_DISPLAY_LIMIT = 3;

// Equipment gains one rolled combat stat per rarity tier: Normal = 1,
// Uncommon = 2, Rare = 3, Epic = 4, and Legendary = 5.
export const EQUIPMENT_STAT_ORDER = ['maxHp', 'atk', 'speed', 'regenHp', 'crit', 'critDamage'];
export const EQUIPMENT_STAT_DEFAULTS = {
    maxHp: 24,
    atk: 4,
    speed: 0.2,
    regenHp: 1,
    crit: 0.03,
    critDamage: 0.15
};

// Every equipment slot has a defining combat identity. Its primary stat is
// guaranteed on dropped gear and rolls on a stronger range than secondary stats.
// The secondary pool still keeps room for interesting hybrid finds.
export const EQUIPMENT_SLOT_SPECIALIZATIONS = {
    head: {
        primaryStat: 'crit',
        label: 'Critical Focus',
        description: 'Head gear sharpens spell timing and favors Critical Chance.',
        rollMultiplier: 1.35
    },
    weapon: {
        primaryStat: 'atk',
        label: 'Spellpower',
        description: 'Weapons carry the wizard’s force and favor Attack.',
        rollMultiplier: 1.35
    },
    chest: {
        primaryStat: 'maxHp',
        label: 'Arcane Fortitude',
        description: 'Chest gear anchors the body and favors Maximum Health.',
        rollMultiplier: 1.35
    },
    ring: {
        primaryStat: 'critDamage',
        label: 'Lethal Precision',
        description: 'Rings focus finishing power and favor Critical Damage.',
        rollMultiplier: 1.35
    },
    relic: {
        primaryStat: 'regenHp',
        label: 'Mystic Resonance',
        description: 'Relics sustain the wizard through long expeditions and favor Health Regeneration.',
        rollMultiplier: 1.35
    },
    boots: {
        primaryStat: 'speed',
        label: 'Swiftstep',
        description: 'Boots keep the wizard moving and favor Speed.',
        rollMultiplier: 1.35
    }
};

// Dropped equipment rolls one or more stats from its pool. The level curves
// intentionally grow slowly so a Normal item from a deeper zone is better than
// an early copy without making rarity irrelevant. Rarity multipliers are applied
// after these level-based ranges are calculated in game.js.
export const EQUIPMENT_STAT_ROLL_RANGES = {
    maxHp: { min: 8, max: 20, minPerLevel: 1.2, maxPerLevel: 2.2 },
    atk: { min: 2, max: 4, minPerLevel: 0.2, maxPerLevel: 0.4 },
    speed: { min: 0.1, max: 0.25, minPerLevel: 0.01, maxPerLevel: 0.02 },
    regenHp: { min: 0.5, max: 1, minPerLevel: 0.05, maxPerLevel: 0.1 },
    crit: { min: 0.01, max: 0.03, minPerLevel: 0.0015, maxPerLevel: 0.003 },
    critDamage: { min: 0.08, max: 0.15, minPerLevel: 0.008, maxPerLevel: 0.016 }
};
export const EQUIPMENT_STAT_LABELS = {
    maxHp: 'HP',
    atk: 'ATK',
    speed: 'SPD',
    regenHp: 'REGEN',
    crit: 'CRIT',
    critDamage: 'CRIT DMG'
};

export const ITEM_ART = {
    astralHood: {
        common: 'assets/astral-hood-common.webp',
        legendary: 'assets/astral-hood-legendary.webp'
    },
    emberStaff: {
        common: 'assets/ember-staff-common.webp',
        legendary: 'assets/ember-staff-legendary.webp'
    },
    runicRobes: {
        common: 'assets/runic-robes-common.webp',
        legendary: 'assets/runic-robes-legendary.webp'
    },
    moonstoneRing: {
        common: 'assets/moonstone-ring-common.webp',
        legendary: 'assets/moonstone-ring-legendary.webp'
    },
    starfallReliquary: {
        common: 'assets/moonstone-ring-common.webp',
        legendary: 'assets/moonstone-ring-legendary.webp'
    },
    wandererBoots: {
        common: 'assets/wanderer-boots-common.webp',
        legendary: 'assets/wanderer-boots-legendary.webp'
    }
};

// Every equipment slot now has a complete visual ladder from Common to Legendary.
// These are selected at runtime by slot and rarity so existing item IDs and save
// data remain stable while owned gear still receives the new presentation.
export const GEAR_RARITY_ART = {
    head: {
        Common: 'assets/gear-head-common.webp',
        Uncommon: 'assets/gear-head-uncommon.webp',
        Rare: 'assets/gear-head-rare.webp',
        Epic: 'assets/gear-head-epic.webp',
        Legendary: 'assets/gear-head-legendary.webp'
    },
    weapon: {
        Common: 'assets/gear-weapon-common.webp',
        Uncommon: 'assets/gear-weapon-uncommon.webp',
        Rare: 'assets/gear-weapon-rare.webp',
        Epic: 'assets/gear-weapon-epic.webp',
        Legendary: 'assets/gear-weapon-legendary.webp'
    },
    chest: {
        Common: 'assets/gear-chest-common.webp',
        Uncommon: 'assets/gear-chest-uncommon.webp',
        Rare: 'assets/gear-chest-rare.webp',
        Epic: 'assets/gear-chest-epic.webp',
        Legendary: 'assets/gear-chest-legendary.webp'
    },
    ring: {
        Common: 'assets/gear-ring-common.webp',
        Uncommon: 'assets/gear-ring-uncommon.webp',
        Rare: 'assets/gear-ring-rare.webp',
        Epic: 'assets/gear-ring-epic.webp',
        Legendary: 'assets/gear-ring-legendary.webp'
    },
    relic: {
        Common: 'assets/gear-relic-common.webp',
        Uncommon: 'assets/gear-relic-uncommon.webp',
        Rare: 'assets/gear-relic-rare.webp',
        Epic: 'assets/gear-relic-epic.webp',
        Legendary: 'assets/gear-relic-legendary.webp'
    },
    boots: {
        Common: 'assets/gear-boots-common.webp',
        Uncommon: 'assets/gear-boots-uncommon.webp',
        Rare: 'assets/gear-boots-rare.webp',
        Epic: 'assets/gear-boots-epic.webp',
        Legendary: 'assets/gear-boots-legendary.webp'
    }
};

export const GEAR_RARITY_NAME_PREFIXES = {
    Common: 'Apprentice',
    Uncommon: 'Verdant',
    Rare: 'Runebound',
    Epic: 'Astral',
    Legendary: 'Sovereign'
};

export const CHARACTER_ITEMS = [
    {
        id: 'astral-hood',
        kind: 'equipment',
        name: 'Astral Hood',
        slot: 'head',
        icon: '◈',
        rarity: 'Common',
        rarityImages: { Common: ITEM_ART.astralHood.common, Legendary: ITEM_ART.astralHood.legendary },
        level: 1,
        description: 'A hood stitched with quiet starlight. Its focused weave sharpens critical spell timing.',
        bonuses: { crit: 0.03 },
        salvage: { 'sun-forged-ingot': 1 }
    },
    {
        id: 'ember-staff',
        kind: 'equipment',
        name: 'Ember Staff',
        slot: 'weapon',
        icon: '✦',
        rarity: 'Common',
        rarityImages: { Common: ITEM_ART.emberStaff.common, Legendary: ITEM_ART.emberStaff.legendary },
        level: 1,
        description: 'Its crystal remembers every spell cast.',
        bonuses: { atk: 4 },
        salvage: { 'mana-crystal': 1 }
    },
    {
        id: 'runic-robes',
        kind: 'equipment',
        name: 'Runic Robes',
        slot: 'chest',
        icon: '◇',
        rarity: 'Common',
        rarityImages: { Common: ITEM_ART.runicRobes.common, Legendary: ITEM_ART.runicRobes.legendary },
        level: 1,
        description: 'Protective runes line the violet silk.',
        bonuses: { maxHp: 30 },
        salvage: { 'void-sigil': 1 }
    },
    {
        id: 'moonstone-ring',
        kind: 'equipment',
        name: 'Moonstone Ring',
        slot: 'ring',
        icon: '✧',
        rarity: 'Common',
        rarityImages: { Common: ITEM_ART.moonstoneRing.common, Legendary: ITEM_ART.moonstoneRing.legendary },
        level: 1,
        description: 'A pale gem that turns a well-placed spell into a devastating finish.',
        bonuses: { critDamage: 0.15 },
        salvage: { 'mana-crystal': 1 }
    },
    {
        id: 'wanderer-boots',
        kind: 'equipment',
        name: 'Wanderer Boots',
        slot: 'boots',
        icon: '⌁',
        rarity: 'Common',
        rarityImages: { Common: ITEM_ART.wandererBoots.common, Legendary: ITEM_ART.wandererBoots.legendary },
        level: 1,
        description: 'Soft soles made for crossing dangerous ground.',
        bonuses: { speed: 0.25 },
        salvage: { 'sun-forged-ingot': 1 }
    },
    {
        id: 'starfall-reliquary',
        kind: 'equipment',
        name: 'Starfall Reliquary',
        slot: 'relic',
        icon: '✥',
        rarity: 'Common',
        rarityImages: { Common: ITEM_ART.starfallReliquary.common, Legendary: ITEM_ART.starfallReliquary.legendary },
        level: 1,
        description: 'A palm-sized reliquary that hums with a patient, restorative constellation.',
        bonuses: { regenHp: 0.75 },
        salvage: { 'void-sigil': 1 }
    }
];

// Dropped loot is separate from starter gear so every reward is a unique,
// salvageable instance. Equipment rates are intentionally low; normal monsters
// can find useful gear, while elite and boss versions get better but still rare
// chances through their separate drop-rate fields.
export const FUTURE_DROP_ITEMS = [
    {
        id: 'verdant-thread-cowl',
        name: 'Verdant Thread Cowl',
        kind: 'equipment',
        slot: 'head',
        icon: '◈',
        rarity: 'Common',
        image: 'assets/astral-hood-common.webp',
        dropFrom: 'Dungeon monsters',
        dropMaps: ['dungeon'],
        dropMonsters: ['Cinder Whelp', 'Obsidian Shieldbearer', 'Ancient Dragon'],
        dropChance: 0.012,
        eliteDropChance: 0.032,
        bossDropChance: 0.075,
        statPool: ['maxHp', 'regenHp', 'crit'],
        bonuses: { maxHp: 10, regenHp: 0.5 },
        salvage: { 'sun-forged-ingot': 1 },
        description: 'A living-fiber hood that carries the quiet resilience of the Grasslands.'
    },
    {
        id: 'dunescript-focus',
        name: 'Dunescript Focus',
        kind: 'equipment',
        slot: 'weapon',
        icon: '✦',
        rarity: 'Uncommon',
        image: 'assets/ember-staff-common.webp',
        dropFrom: 'Grasslands monsters',
        dropMaps: ['grass'],
        dropMonsters: ['Sprout Slime', 'Bramble Slime', 'Mossback Guardian'],
        dropChance: 0.009,
        eliteDropChance: 0.028,
        bossDropChance: 0.065,
        statPool: ['atk', 'crit', 'speed'],
        bonuses: { atk: 3, crit: 0.02 },
        salvage: { 'mana-crystal': 1 },
        description: 'A sand-carved focus that turns every surviving spark into sharper spellwork.'
    },
    {
        id: 'nightglass-mantle',
        name: 'Nightglass Mantle',
        kind: 'equipment',
        slot: 'chest',
        icon: '◇',
        rarity: 'Rare',
        image: 'assets/runic-robes-common.webp',
        dropFrom: 'Grasslands monsters',
        dropMaps: ['grass'],
        dropMonsters: ['Sprout Slime', 'Bramble Slime', 'Mossback Guardian'],
        dropChance: 0.006,
        eliteDropChance: 0.022,
        bossDropChance: 0.055,
        statPool: ['maxHp', 'critDamage', 'speed', 'regenHp'],
        bonuses: { maxHp: 24, critDamage: 0.08 },
        salvage: { 'void-sigil': 1 },
        description: 'A dark mantle polished from dungeon glass, light enough to move between heartbeats.'
    },
    {
        id: 'dragonheart-focus',
        name: 'Dragonheart Focus',
        kind: 'equipment',
        slot: 'weapon',
        icon: '✦',
        rarity: 'Legendary',
        image: 'assets/dragonheart-focus-future.webp',
        dropFrom: 'Grasslands monsters',
        dropMaps: ['grass'],
        dropMonsters: ['Sprout Slime', 'Bramble Slime', 'Mossback Guardian'],
        dropChance: 0.003,
        eliteDropChance: 0.012,
        bossDropChance: 0.04,
        statPool: ['atk', 'crit', 'critDamage', 'speed', 'maxHp'],
        bonuses: { atk: 14, crit: 0.04 },
        salvage: { 'dragon-scale': 3, 'void-sigil': 1 },
        description: 'A dragon claw wrapped around a still-burning heart.'
    },
    {
        id: 'sunforged-mantle',
        name: 'Sunforged Mantle',
        kind: 'equipment',
        slot: 'chest',
        icon: '◇',
        rarity: 'Epic',
        image: 'assets/sunforged-mantle-future.webp',
        dropFrom: 'Grasslands monsters',
        dropMaps: ['grass'],
        dropMonsters: ['Sprout Slime', 'Bramble Slime', 'Mossback Guardian'],
        dropChance: 0.004,
        eliteDropChance: 0.015,
        bossDropChance: 0.045,
        statPool: ['maxHp', 'regenHp', 'critDamage', 'crit'],
        bonuses: { maxHp: 80, regenHp: 1 },
        salvage: { 'sun-forged-ingot': 2, 'mana-crystal': 1 },
        description: 'A desert-forged mantle that keeps a fragment of noon trapped in its rune.'
    },
    {
        id: 'voidstep-boots',
        name: 'Voidstep Boots',
        kind: 'equipment',
        slot: 'boots',
        icon: '⌁',
        rarity: 'Epic',
        image: 'assets/voidstep-boots-future.webp',
        dropFrom: 'Dungeon monsters',
        dropMaps: ['dungeon'],
        dropMonsters: ['Cinder Whelp', 'Obsidian Shieldbearer', 'Ancient Dragon'],
        dropChance: 0.004,
        eliteDropChance: 0.015,
        bossDropChance: 0.045,
        statPool: ['speed', 'critDamage', 'crit', 'atk'],
        bonuses: { speed: 0.8, critDamage: 0.2 },
        salvage: { 'void-sigil': 2, 'dragon-scale': 1 },
        description: 'Boots that leave a fading starless footprint between steps.'
    },
    {
        id: 'eclipse-moonstone-band',
        name: 'Eclipse Moonstone Band',
        kind: 'equipment',
        slot: 'ring',
        icon: '✧',
        rarity: 'Epic',
        image: 'assets/moonstone-ring-common.webp',
        dropFrom: 'Desert monsters',
        dropMaps: ['desert'],
        dropMonsters: ['Dust Scuttler', 'Bone Shieldbearer', 'Sandstone Warden'],
        dropChance: 0.004,
        eliteDropChance: 0.015,
        bossDropChance: 0.045,
        statPool: ['critDamage', 'crit', 'atk', 'speed'],
        bonuses: { critDamage: 0.2, crit: 0.03 },
        salvage: { 'dragon-scale': 1, 'void-sigil': 1 },
        description: 'A moonstone ring eclipsed by dragonfire, made to turn critical spells into final blows.'
    },
    {
        id: 'dragon-dream-reliquary',
        name: 'Dragon-Dream Reliquary',
        kind: 'equipment',
        slot: 'relic',
        icon: '✥',
        rarity: 'Legendary',
        image: 'assets/moonstone-ring-legendary.webp',
        dropFrom: 'Desert monsters',
        dropMaps: ['desert'],
        dropMonsters: ['Dust Scuttler', 'Bone Shieldbearer', 'Sandstone Warden'],
        dropChance: 0.003,
        eliteDropChance: 0.012,
        bossDropChance: 0.04,
        statPool: ['regenHp', 'maxHp', 'crit', 'critDamage'],
        bonuses: { regenHp: 2.4, maxHp: 38 },
        salvage: { 'dragon-scale': 2, 'void-sigil': 1 },
        description: 'A dragon’s crystallized dream, restoring the wizard between brutal encounters.'
    },
    {
        id: 'mana-crystal',
        name: 'Mana Crystal',
        kind: 'material',
        icon: '◆',
        rarity: 'Rare',
        image: 'assets/mana-crystal-drop.webp',
        dropFrom: 'Desert expeditions',
        dropMaps: ['desert'],
        dropChance: 0.2,
        eliteDropChance: 0.45,
        description: 'A concentrated shard of spell energy.'
    },
    {
        id: 'dragon-scale',
        name: 'Ancient Dragon Scale',
        kind: 'material',
        icon: '⬢',
        rarity: 'Legendary',
        image: 'assets/ancient-dragon-scale.webp',
        dropFrom: 'Ancient Dragon',
        dropMonsters: ['Ancient Dragon'],
        dropChance: 0.16,
        eliteDropChance: 0.48,
        description: 'A heat-hardened scale fit for an endgame enchantment.'
    },
    {
        id: 'void-sigil',
        name: 'Void Sigil Fragment',
        kind: 'material',
        icon: '✧',
        rarity: 'Epic',
        image: 'assets/void-sigil-drop.webp',
        dropFrom: 'Dungeon expeditions',
        dropMaps: ['dungeon'],
        dropChance: 0.18,
        eliteDropChance: 0.42,
        description: 'A cracked rune fragment humming with distant stars.'
    },
    {
        id: 'sun-forged-ingot',
        name: 'Sun-Forged Ingot',
        kind: 'material',
        icon: '▣',
        rarity: 'Epic',
        image: 'assets/sun-forged-ingot-drop.webp',
        dropFrom: 'Desert guardians',
        dropMonsters: ['Sandstone Warden'],
        dropChance: 0.16,
        eliteDropChance: 0.4,
        description: 'A warm golden ingot waiting for a master smith.'
    },
    {
        id: 'briar-crown',
        name: 'Briarwake Crown',
        kind: 'equipment',
        slot: 'head',
        icon: '◈',
        rarity: 'Uncommon',
        image: 'assets/briar-crown-icon.webp',
        distinctArt: true,
        dropFrom: 'Grasslands · Briarwake Trail',
        dropMaps: ['grass'],
        dropMonsters: ['Bramble Slime', 'Mossback Guardian'],
        dropChance: 0.01,
        eliteDropChance: 0.03,
        bossDropChance: 0.07,
        statPool: ['crit', 'speed', 'regenHp', 'maxHp'],
        bonuses: { crit: 0.025, speed: 0.08 },
        salvage: { 'briarheart-resin': 1, 'moonleaf-thread': 1 },
        routeIdentity: 'Briarwake Trail',
        description: 'A living crown gathered where the Grasslands grow sharp. Its amber seed rewards patient spell timing.'
    },
    {
        id: 'meadowglass-grimoire',
        name: 'Meadowglass Grimoire',
        kind: 'equipment',
        slot: 'relic',
        icon: '✥',
        rarity: 'Rare',
        image: 'assets/meadowglass-grimoire-icon.webp',
        distinctArt: true,
        dropFrom: 'Grasslands · Moonleaf Crossing',
        dropMaps: ['grass'],
        dropMonsters: ['Sprout Slime', 'Mossback Guardian'],
        dropChance: 0.007,
        eliteDropChance: 0.024,
        bossDropChance: 0.06,
        statPool: ['regenHp', 'crit', 'speed', 'maxHp'],
        bonuses: { regenHp: 0.9, crit: 0.015 },
        salvage: { 'moonleaf-thread': 2, 'briarheart-resin': 1 },
        routeIdentity: 'Moonleaf Crossing',
        description: 'A leaf-clasped book of field magic that turns every quiet pause into renewed strength.'
    },
    {
        id: 'glasswind-scepter',
        name: 'Glasswind Scepter',
        kind: 'equipment',
        slot: 'weapon',
        icon: '✦',
        rarity: 'Rare',
        image: 'assets/glasswind-scepter-icon.webp',
        distinctArt: true,
        dropFrom: 'Desert · Glasswind Expanse',
        dropMaps: ['desert'],
        dropMonsters: ['Dust Scuttler', 'Sandstone Warden'],
        dropChance: 0.007,
        eliteDropChance: 0.024,
        bossDropChance: 0.06,
        statPool: ['atk', 'speed', 'crit', 'critDamage'],
        bonuses: { atk: 6, speed: 0.12 },
        salvage: { 'glasswind-shard': 2, 'warden-sunplate': 1 },
        routeIdentity: 'Glasswind Expanse',
        description: 'A wind vane of turquoise glass that catches the Desert’s fastest current and hurls it through a spell.'
    },
    {
        id: 'duneprowler-greaves',
        name: 'Duneprowler Greaves',
        kind: 'equipment',
        slot: 'boots',
        icon: '⌁',
        rarity: 'Epic',
        image: 'assets/duneprowler-greaves-icon.webp',
        distinctArt: true,
        dropFrom: 'Desert · Jackal Crown Road',
        dropMaps: ['desert'],
        dropMonsters: ['Dust Scuttler', 'Bone Shieldbearer'],
        dropChance: 0.0045,
        eliteDropChance: 0.017,
        bossDropChance: 0.05,
        statPool: ['speed', 'atk', 'crit', 'maxHp'],
        bonuses: { speed: 0.38, atk: 4 },
        salvage: { 'glasswind-shard': 2, 'warden-sunplate': 2 },
        routeIdentity: 'Jackal Crown Road',
        description: 'Hook-heeled greaves built for crossing moving dunes, with enough bite to outrun a shield wall.'
    },
    {
        id: 'ossuary-loop',
        name: 'Ossuary Loop',
        kind: 'equipment',
        slot: 'ring',
        icon: '✧',
        rarity: 'Epic',
        image: 'assets/ossuary-loop-icon.webp',
        distinctArt: true,
        dropFrom: 'Dungeon · Ossuary Meridian',
        dropMaps: ['dungeon'],
        dropMonsters: ['Obsidian Shieldbearer', 'Ancient Dragon'],
        dropChance: 0.0045,
        eliteDropChance: 0.017,
        bossDropChance: 0.05,
        statPool: ['critDamage', 'crit', 'regenHp', 'atk'],
        bonuses: { critDamage: 0.17, crit: 0.025 },
        salvage: { 'cinderbone': 2, 'starless-ash': 1 },
        routeIdentity: 'Ossuary Meridian',
        description: 'A bone-set void ring that remembers the final heartbeat of every spell it helps finish.'
    },
    {
        id: 'nightvault-carapace',
        name: 'Nightvault Carapace',
        kind: 'equipment',
        slot: 'chest',
        icon: '◇',
        rarity: 'Legendary',
        image: 'assets/nightvault-carapace-icon.webp',
        distinctArt: true,
        dropFrom: 'Dungeon · Nightvault Descent',
        dropMaps: ['dungeon'],
        dropMonsters: ['Cinder Whelp', 'Obsidian Shieldbearer', 'Ancient Dragon'],
        dropChance: 0.003,
        eliteDropChance: 0.012,
        bossDropChance: 0.04,
        statPool: ['maxHp', 'regenHp', 'critDamage', 'atk'],
        bonuses: { maxHp: 92, regenHp: 1.3 },
        salvage: { 'cinderbone': 3, 'starless-ash': 2 },
        routeIdentity: 'Nightvault Descent',
        description: 'Layered nightstone armor with a violet heart-cavity, tempered beneath the Dungeon’s oldest vault.'
    },
    {
        id: 'briarheart-resin',
        name: 'Briarheart Resin',
        kind: 'material',
        icon: '⬢',
        rarity: 'Uncommon',
        image: 'assets/briarheart-resin-icon.webp',
        dropFrom: 'Grasslands · Bramblewake thickets',
        dropMaps: ['grass'],
        dropMonsters: ['Bramble Slime', 'Mossback Guardian'],
        dropChance: 0.2,
        eliteDropChance: 0.46,
        description: 'Living amber threaded with thorns. Grassland crafters prize it for binding gear that refuses to break.',
        routeIdentity: 'Briarwake Trail'
    },
    {
        id: 'moonleaf-thread',
        name: 'Moonleaf Thread',
        kind: 'material',
        icon: '⌇',
        rarity: 'Rare',
        image: 'assets/moonleaf-thread-icon.webp',
        dropFrom: 'Grasslands · Moonleaf Crossing',
        dropMaps: ['grass'],
        dropMonsters: ['Sprout Slime', 'Mossback Guardian'],
        dropChance: 0.14,
        eliteDropChance: 0.38,
        description: 'Firefly-bright thread spun from nocturnal leaves, light enough to carry a ward without weighing it down.',
        routeIdentity: 'Moonleaf Crossing'
    },
    {
        id: 'glasswind-shard',
        name: 'Glasswind Shard',
        kind: 'material',
        icon: '◇',
        rarity: 'Rare',
        image: 'assets/glasswind-shard-icon.webp',
        dropFrom: 'Desert · Glasswind Expanse',
        dropMaps: ['desert'],
        dropMonsters: ['Dust Scuttler', 'Sandstone Warden'],
        dropChance: 0.2,
        eliteDropChance: 0.45,
        description: 'Turquoise desert glass cut thin by the storm. Its edge holds a charge long after the wind has passed.',
        routeIdentity: 'Glasswind Expanse'
    },
    {
        id: 'warden-sunplate',
        name: 'Warden Sunplate',
        kind: 'material',
        icon: '▣',
        rarity: 'Epic',
        image: 'assets/warden-sunplate-icon.webp',
        dropFrom: 'Desert · Jackal Crown Road',
        dropMaps: ['desert'],
        dropMonsters: ['Bone Shieldbearer', 'Sandstone Warden'],
        dropChance: 0.15,
        eliteDropChance: 0.4,
        description: 'An eye-engraved plate shed from an ancient guardian, still warm enough to temper a spellblade.',
        routeIdentity: 'Jackal Crown Road'
    },
    {
        id: 'cinderbone',
        name: 'Cinderbone Fragment',
        kind: 'material',
        icon: '╱',
        rarity: 'Epic',
        image: 'assets/cinderbone-icon.webp',
        dropFrom: 'Dungeon · Emberbone Galleries',
        dropMaps: ['dungeon'],
        dropMonsters: ['Cinder Whelp', 'Ancient Dragon'],
        dropChance: 0.16,
        eliteDropChance: 0.42,
        description: 'Charred dragon bone with ember seams. It keeps a small flame alive inside even the coldest forge.',
        routeIdentity: 'Emberbone Galleries'
    },
    {
        id: 'starless-ash',
        name: 'Starless Ash',
        kind: 'material',
        icon: '◌',
        rarity: 'Legendary',
        image: 'assets/starless-ash-icon.webp',
        dropFrom: 'Dungeon · Nightvault Descent',
        dropMaps: ['dungeon'],
        dropMonsters: ['Obsidian Shieldbearer', 'Ancient Dragon'],
        dropChance: 0.12,
        eliteDropChance: 0.36,
        description: 'Ash from a fire that burned without stars. Voidwrights use its silence to hide the strongest enchantments.',
        routeIdentity: 'Nightvault Descent'
    },
    // Legacy regional gear definitions remain for backward-compatible save loading.
    // Active regional recipes now produce temporary consumable preparations instead.
    {
        id: 'briarwake-ward',
        name: 'Briarwake Ward',
        kind: 'equipment',
        crafted: true,
        slot: 'head',
        icon: '◈',
        rarity: 'Uncommon',
        image: GEAR_RARITY_ART.head.Uncommon,
        statPool: ['crit', 'speed', 'maxHp', 'regenHp'],
        bonuses: { crit: 0.03, speed: 0.1 },
        salvage: { 'briarheart-resin': 2 },
        description: 'A thorn-laced circlet that turns the first Grassland harvest into a dependable critical ward.'
    },
    {
        id: 'moonleaf-vestments',
        name: 'Moonleaf Vestments',
        kind: 'equipment',
        crafted: true,
        slot: 'chest',
        icon: '◇',
        rarity: 'Rare',
        image: GEAR_RARITY_ART.chest.Rare,
        statPool: ['maxHp', 'regenHp', 'crit', 'speed'],
        bonuses: { maxHp: 32, regenHp: 1 },
        salvage: { 'moonleaf-thread': 2, 'briarheart-resin': 1 },
        description: 'Night-bloom thread woven into field robes, made for wizards who have mastered the Grasslands.'
    },
    {
        id: 'glasswind-orb',
        name: 'Glasswind Orb',
        kind: 'equipment',
        crafted: true,
        slot: 'relic',
        icon: '✥',
        rarity: 'Rare',
        image: GEAR_RARITY_ART.relic.Rare,
        statPool: ['regenHp', 'speed', 'crit', 'maxHp'],
        bonuses: { regenHp: 1.1, speed: 0.12 },
        salvage: { 'glasswind-shard': 2 },
        description: 'A stormglass reservoir that stores the Desert’s fastest currents between battles.'
    },
    {
        id: 'sunplate-spellblade',
        name: 'Sunplate Spellblade',
        kind: 'equipment',
        crafted: true,
        slot: 'weapon',
        icon: '✦',
        rarity: 'Epic',
        image: GEAR_RARITY_ART.weapon.Epic,
        statPool: ['atk', 'crit', 'speed', 'critDamage'],
        bonuses: { atk: 10, crit: 0.035 },
        salvage: { 'warden-sunplate': 2, 'glasswind-shard': 1 },
        description: 'A guardian plate folded around a glasswind edge. Only a deep Desert forge can keep it from cracking.'
    },
    {
        id: 'emberbone-treads',
        name: 'Emberbone Treads',
        kind: 'equipment',
        crafted: true,
        slot: 'boots',
        icon: '⌁',
        rarity: 'Epic',
        image: GEAR_RARITY_ART.boots.Epic,
        statPool: ['speed', 'atk', 'crit', 'maxHp'],
        bonuses: { speed: 0.48, atk: 5 },
        salvage: { 'cinderbone': 2 },
        description: 'Dragonbone soles with ember seams that let a Dungeon delver outrun the next shadow.'
    },
    {
        id: 'starless-ash-band',
        name: 'Starless Ash Band',
        kind: 'equipment',
        crafted: true,
        slot: 'ring',
        icon: '✧',
        rarity: 'Legendary',
        image: GEAR_RARITY_ART.ring.Legendary,
        statPool: ['critDamage', 'crit', 'atk', 'regenHp'],
        bonuses: { critDamage: 0.28, crit: 0.045 },
        salvage: { 'starless-ash': 2, 'cinderbone': 1 },
        description: 'A silent ring forged from the Dungeon’s last ember, reserved for a wizard who can command the Nightvault.'
    }
];

// Preparations are deliberately role-based rather than a straight line of bigger
// numbers. Early formulas cover one route-specific need; later tiers combine
// materials from multiple routes and are strong enough to justify saving them for
// elites, bosses, and deep-zone pushes. IDs stay stable so existing saves keep
// their discovered recipes, stacks, and active effects.
export const CONSUMABLE_ITEMS = [
    {
        id: 'arcane-focus',
        name: 'Arcane Focus',
        kind: 'consumable',
        icon: '✦',
        rarity: 'Rare',
        duration: 60,
        bonuses: { atk: 12, crit: 0.1 },
        effectLabel: '+12 ATK · +10% CRIT',
        description: 'A concentrated spell prism that turns careful timing into an early burst of reliable damage.'
    },
    {
        id: 'verdant-tonic',
        name: 'Verdant Tonic',
        kind: 'consumable',
        icon: '❈',
        rarity: 'Uncommon',
        duration: 50,
        bonuses: { regenHp: 5, speed: 0.4 },
        effectLabel: '+5 HP REGEN · +0.4 SPD',
        description: 'A bright green draught for keeping the wizard moving and mending through the first Grassland climb.'
    },
    {
        id: 'aegis-elixir',
        name: 'Aegis Elixir',
        kind: 'consumable',
        icon: '⬡',
        rarity: 'Legendary',
        duration: 120,
        bonuses: { maxHp: 280, critDamage: 0.55 },
        effectLabel: '+280 MAX HP · +0.55× CRIT DMG',
        description: 'A dragon-tempered ward that lets the wizard survive a boss opening and answer with a devastating finish.'
    },
    {
        id: 'briarwake-balm',
        name: 'Briarwake Balm',
        kind: 'consumable',
        icon: '❈',
        rarity: 'Rare',
        duration: 75,
        bonuses: { maxHp: 90, regenHp: 2.5 },
        effectLabel: '+90 MAX HP · +2.5 HP REGEN',
        description: 'A thorn-sweet endurance balm that binds a second route’s moonleaf into a lasting Grassland ward.'
    },
    {
        id: 'moonleaf-infusion',
        name: 'Moonleaf Infusion',
        kind: 'consumable',
        icon: '⌇',
        rarity: 'Epic',
        duration: 105,
        bonuses: { maxHp: 190, speed: 0.65 },
        effectLabel: '+190 MAX HP · +0.65 SPD',
        description: 'A deep-route infusion that makes the wizard both harder to break and quick enough to escape crowded waves.'
    },
    {
        id: 'glasswind-draught',
        name: 'Glasswind Draught',
        kind: 'consumable',
        icon: '◇',
        rarity: 'Epic',
        duration: 90,
        bonuses: { speed: 0.9, crit: 0.12 },
        effectLabel: '+0.9 SPD · +12% CRIT',
        description: 'A stormglass acceleration brew for high-tempo farming, turning movement into more chances to land a critical spell.'
    },
    {
        id: 'sunplate-aegis',
        name: 'Sunplate Aegis',
        kind: 'consumable',
        icon: '▣',
        rarity: 'Legendary',
        duration: 125,
        bonuses: { maxHp: 360, regenHp: 5 },
        effectLabel: '+360 MAX HP · +5 HP REGEN',
        description: 'A radiant guardian bulwark for pushing through attrition walls where raw endurance matters more than burst.'
    },
    {
        id: 'emberbone-surge',
        name: 'Emberbone Surge',
        kind: 'consumable',
        icon: '╱',
        rarity: 'Epic',
        duration: 95,
        bonuses: { atk: 28, critDamage: 0.28 },
        effectLabel: '+28 ATK · +0.28× CRIT DMG',
        description: 'A Dungeon battle rite that sacrifices finesse for heavy spell impact against shielded elites and bosses.'
    },
    {
        id: 'starless-ash-rite',
        name: 'Starless Ash Rite',
        kind: 'consumable',
        icon: '◌',
        rarity: 'Legendary',
        duration: 150,
        bonuses: { atk: 48, crit: 0.16, critDamage: 0.5 },
        effectLabel: '+48 ATK · +16% CRIT · +0.50× CRIT DMG',
        description: 'The endgame battle rite: a silent Nightvault constellation hidden inside ash from a fire without stars.'
    },
    {
        id: 'enhancement-reversal-seal',
        name: 'Enhancement Reversal Seal',
        kind: 'consumable',
        icon: '⟲',
        rarity: 'Epic',
        gearAction: 'rollback-enhancement',
        duration: 0,
        effectLabel: 'REMOVE THE LAST ENHANCEMENT ROLL',
        description: 'A costly unbinding sigil that removes one gear enhancement and its exact final roll. Use it to rescue a promising relic from a bad gamble.'
    }
];

export const CRAFTING_RECIPES = [
    {
        id: 'craft-arcane-focus',
        output: 'arcane-focus',
        rarity: 'Rare',
        tier: 2,
        tierLabel: 'Refined',
        materials: { 'mana-crystal': 3, 'sun-forged-ingot': 2 },
        discovery: {
            conditions: [{ type: 'zone', map: 'desert', minZone: 3 }],
            headline: 'The desert teaches the prism to listen.',
            explanation: 'The first Desert push reveals a focused burst formula. It is stronger than field tonics, but asks the wizard to bring Desert crystals to a Grassland forge.',
            ingredientHint: 'Reach Desert Zone 3, then gather 3 Mana Crystals and 2 Sun-Forged Ingots.'
        }
    },
    {
        id: 'craft-verdant-tonic',
        output: 'verdant-tonic',
        rarity: 'Uncommon',
        tier: 1,
        tierLabel: 'Fieldcraft',
        materials: { 'briarheart-resin': 6 },
        discovery: {
            conditions: [{ type: 'zone', map: 'grass', minZone: 2 }],
            headline: 'A green spark wakes in the recipe grimoire.',
            explanation: 'The first Grassland route reveals a dependable field tonic: modest, affordable, and built for learning the preparation system.',
            ingredientHint: 'Reach Grasslands Zone 2 and gather 6 Briarheart Resin.'
        }
    },
    {
        id: 'craft-briarwake-balm',
        output: 'briarwake-balm',
        rarity: 'Rare',
        tier: 2,
        tierLabel: 'Refined',
        materials: { 'briarheart-resin': 10, 'moonleaf-thread': 2 },
        discovery: {
            conditions: [{ type: 'zone', map: 'grass', minZone: 8 }],
            headline: 'The first thorn teaches the balm to hold.',
            explanation: 'Moonleaf thread turns a simple field tonic into a true endurance preparation, with health and regeneration for longer expeditions.',
            ingredientHint: 'Reach Grasslands Zone 8 and gather 10 Briarheart Resin with 2 Moonleaf Threads.'
        }
    },
    {
        id: 'craft-glasswind-draught',
        output: 'glasswind-draught',
        rarity: 'Epic',
        tier: 3,
        tierLabel: 'Masterwork',
        materials: { 'glasswind-shard': 14, 'mana-crystal': 4, 'warden-sunplate': 2 },
        discovery: {
            conditions: [{ type: 'zone', map: 'desert', minZone: 10 }],
            headline: 'A Desert shard catches the wizard’s breath.',
            explanation: 'The Glasswind formula is a high-tempo masterwork. It needs storm glass, concentrated mana, and guardian metal before it can survive the bottle.',
            ingredientHint: 'Reach Desert Zone 10 and gather 14 Glasswind Shards, 4 Mana Crystals, and 2 Warden Sunplates.'
        }
    },
    {
        id: 'craft-emberbone-surge',
        output: 'emberbone-surge',
        rarity: 'Epic',
        tier: 3,
        tierLabel: 'Masterwork',
        materials: { 'cinderbone': 12, 'dragon-scale': 1, 'void-sigil': 3 },
        discovery: {
            conditions: [{ type: 'zone', map: 'dungeon', minZone: 12 }],
            headline: 'Cinderbone leaves a path through the dark.',
            explanation: 'The opening Dungeon masterwork is a heavy-impact rite. Dragon scale and Void Sigils focus its force against fortified targets.',
            ingredientHint: 'Reach Dungeon Zone 12 and gather 12 Cinderbone Fragments, 1 Dragon Scale, and 3 Void Sigils.'
        }
    },
    {
        id: 'craft-moonleaf-infusion',
        output: 'moonleaf-infusion',
        rarity: 'Epic',
        tier: 3,
        tierLabel: 'Masterwork',
        materials: { 'moonleaf-thread': 14, 'briarheart-resin': 8, 'mana-crystal': 4 },
        discovery: {
            conditions: [{ type: 'zone', map: 'grass', minZone: 20 }],
            headline: 'Moonleaf thread reveals a deeper Grassland remedy.',
            explanation: 'At deeper Grassland pressure, Moonleaf becomes a mobility ward instead of another regeneration tonic: more body, more tempo, and a costly three-route weave.',
            ingredientHint: 'Reach Grasslands Zone 20, then gather 14 Moonleaf Threads, 8 Briarheart Resins, and 4 Mana Crystals.'
        }
    },
    {
        id: 'craft-sunplate-aegis',
        output: 'sunplate-aegis',
        rarity: 'Legendary',
        tier: 4,
        tierLabel: 'Legendary',
        materials: { 'warden-sunplate': 18, 'glasswind-shard': 10, 'sun-forged-ingot': 6, 'dragon-scale': 2 },
        discovery: {
            conditions: [{ type: 'zone', map: 'desert', minZone: 35 }],
            headline: 'The deep Desert turns a sunplate into a true bulwark.',
            explanation: 'Guardian metal finally becomes a legendary endurance preparation. Its four-route cost is meant for expedition walls, not routine farming.',
            ingredientHint: 'Reach Desert Zone 35 and gather 18 Warden Sunplates, 10 Glasswind Shards, 6 Sun-Forged Ingots, and 2 Dragon Scales.'
        }
    },
    {
        id: 'craft-aegis-elixir',
        output: 'aegis-elixir',
        rarity: 'Legendary',
        tier: 4,
        tierLabel: 'Legendary',
        materials: { 'dragon-scale': 4, 'sun-forged-ingot': 12, 'glasswind-shard': 8, 'warden-sunplate': 3 },
        discovery: {
            conditions: [{ type: 'zone', map: 'dungeon', minZone: 50 }],
            headline: 'The dragon’s ward becomes a bottle of light.',
            explanation: 'This legendary boss preparation pairs a large health reserve with critical finishing power. It demands both Desert guardian craft and Dungeon trophies.',
            ingredientHint: 'Reach Dungeon Zone 50, then gather 4 Dragon Scales, 12 Sun-Forged Ingots, 8 Glasswind Shards, and 3 Warden Sunplates.'
        }
    },
    {
        id: 'craft-enhancement-reversal-seal',
        output: 'enhancement-reversal-seal',
        rarity: 'Epic',
        tier: 4,
        tierLabel: 'Masterwork',
        materials: { 'dragon-scale': 2, 'void-sigil': 8, 'sun-forged-ingot': 5 },
        discovery: {
            conditions: [{ type: 'zone', map: 'dungeon', minZone: 60 }],
            headline: 'A costly seal learns to unmake a bad gamble.',
            explanation: 'This late-midgame rescue valve remains deliberately cross-route so failed enhancement rolls still have weight beside the new legendary preparations.',
            ingredientHint: 'Reach Dungeon Zone 60 and stockpile 2 Dragon Scales, 8 Void Sigils, and 5 Sun-Forged Ingots.'
        }
    },
    {
        id: 'craft-starless-ash-rite',
        output: 'starless-ash-rite',
        rarity: 'Legendary',
        tier: 5,
        tierLabel: 'Endgame',
        materials: { 'starless-ash': 20, 'cinderbone': 15, 'dragon-scale': 4, 'void-sigil': 10 },
        discovery: {
            conditions: [{ type: 'zone', map: 'dungeon', minZone: 100 }],
            headline: 'At Nightvault depth, even ash remembers a crown.',
            explanation: 'The endgame rite is the strongest temporary combat preparation in the grimoire. Four rare Dungeon materials make each craft a deliberate Zone 100–200 expedition decision.',
            ingredientHint: 'Reach Dungeon Zone 100, then gather 20 Starless Ash, 15 Cinderbone Fragments, 4 Dragon Scales, and 10 Void Sigils.'
        }
    }
];

export const WAVE_PATTERNS = [
    {
        name: 'Scouting Party',
        // Wave density rises deliberately so every regular wave adds more
        // bodies than the previous one across every map.
        densityMultiplier: 0.75,
        toughVariantBias: 0.05,
        statMultiplier: 1,
        dangerMultiplier: 1,
        rewardMultiplier: 1,
        summary: 'Light density · starting roster'
    },
    {
        name: 'Pressing Assault',
        densityMultiplier: 1.05,
        toughVariantBias: 0.2,
        statMultiplier: 1.08,
        dangerMultiplier: 1.15,
        rewardMultiplier: 1.15,
        summary: 'Mixed roster · tougher variants rising'
    },
    {
        name: 'Elite Breakthrough',
        densityMultiplier: 1.4,
        toughVariantBias: 0.42,
        statMultiplier: 1.18,
        dangerMultiplier: 1.4,
        rewardMultiplier: 1.55,
        summary: 'High density · elite variant guaranteed'
    }
];

export const BOSS_WAVE_BALANCE = {
    firstZone: 10,
    zoneInterval: 10,
    hpMultiplier: 8,
    atkMultiplier: 2.5,
    shieldMultiplier: 5,
    speedMultiplier: 0.8,
    attackIntervalMultiplier: 1.3,
    rewardMultiplier: 5,
    xpMultiplier: 4,
    lootChanceBonus: 0.2
};

export const MAPS = {
    grass: {
        name: 'Grasslands',
        resource: 'Gold',
        tile: ASSETS.TILE_GRASS,
        monster: 'slime',
        monsterSprite: ASSETS.SLIME,
        difficulty: 1,
        color: '#4a7c44',
        celebrationColor: '#8ee28e',
        resourceYieldMultiplier: 1,
        farmPerk: 'Gold Foundry · ATK + HP',
        farmReason: 'Gold funds Attack and Max Health; establish your damage route before pushing deeper.',
        routeContext: {
            objective: 'Stabilize the caster before the next Gold wall',
            detail: 'Target Head and Relic upgrades for critical timing and recovery, then chase Weapon power as the route deepens.',
            prioritySlots: ['head', 'relic', 'weapon', 'chest']
        },
        monsterRoster: [
            {
                name: 'Sprout Slime',
                trait: 'Fast swarm',
                signature: {
                    id: 'sprout-rush',
                    name: 'Verdant Rush',
                    log: 'Verdant rush!',
                    impactLog: 'Verdant rush strikes!',
                    cooldown: 6.5,
                    duration: 1.25,
                    speedMultiplier: 2.35,
                    damageMultiplier: 1.35
                },
                attackStyle: 'sprout',
                attackName: 'Spore flick',
                maxHp: 16,
                atk: 1,
                shield: 0,
                speed: 2.8,
                attackRange: 104,
                attackInterval: 0.85,
                spawnWeight: 4
            },
            {
                name: 'Bramble Slime',
                trait: 'Armored bruiser',
                signature: {
                    id: 'bramble-thorns',
                    name: 'Thorn Burst',
                    log: 'Thorn burst!',
                    cooldown: 2.8,
                    damageMultiplier: 0.35
                },
                attackStyle: 'thorn',
                attackName: 'Thorn swipe',
                maxHp: 27,
                atk: 2,
                shield: 8,
                shieldAbsorption: 0.6,
                shieldRechargeDelay: 2.8,
                shieldRechargeRate: 0.18,
                speed: 1.15,
                attackRange: 110,
                attackInterval: 1.2,
                spawnWeight: 2
            },
            {
                name: 'Mossback Guardian',
                trait: 'Slow guardian',
                signature: {
                    id: 'mossback-guard',
                    name: 'Guard Pulse',
                    log: 'Guard pulse!',
                    impactLog: 'Stone guard restored.',
                    cooldown: 7,
                    castTime: 0.45,
                    shieldMultiplier: 0.28
                },
                attackStyle: 'guard',
                attackName: 'Boulder slam',
                maxHp: 44,
                atk: 4,
                shield: 16,
                shieldAbsorption: 0.72,
                shieldRechargeDelay: 3,
                shieldRechargeRate: 0.16,
                speed: 0.65,
                attackRange: 118,
                attackInterval: 1.65,
                spawnWeight: 1
            }
        ],
        masteryMilestones: [25, 75, 150, 250, 400],
        masteryBonusPerMilestone: 0.05
    },
    desert: {
        name: 'Desert',
        resource: 'Mana',
        tile: ASSETS.TILE_SAND,
        monster: 'skeleton',
        monsterSprite: ASSETS.SKELETON,
        difficulty: 2.5,
        color: '#d4b483',
        celebrationColor: '#ffd27a',
        resourceYieldMultiplier: 1.45,
        farmPerk: 'Mana Wells · SUSTAIN + YIELD',
        farmReason: 'Mana funds Regeneration, Movement, and Resource Bonus—the sustain route for deeper zones.',
        routeContext: {
            objective: 'Raise tempo for the Mana climb',
            detail: 'Farm Weapon and Boots families when faster casts and movement are the bottleneck, then add Ring and Relic power for finishing speed.',
            prioritySlots: ['weapon', 'boots', 'ring', 'relic']
        },
        monsterRoster: [
            {
                name: 'Dust Scuttler',
                trait: 'Frenzied swarm',
                signature: {
                    id: 'dust-lunge',
                    name: 'Burrowing Lunge',
                    log: 'Burrowing lunge!',
                    impactLog: 'Burrowing lunge tears through!',
                    cooldown: 6.2,
                    duration: 0.85,
                    speedMultiplier: 4.5,
                    damageMultiplier: 1.55
                },
                attackStyle: 'lunge',
                attackName: 'Rending claws',
                maxHp: 38,
                atk: 4,
                shield: 0,
                speed: 3.1,
                attackRange: 104,
                attackInterval: 0.72,
                spawnWeight: 4
            },
            {
                name: 'Bone Shieldbearer',
                trait: 'Heavy shield-bearer',
                signature: {
                    id: 'bone-shield-bash',
                    name: 'Shield Bash',
                    log: 'Shield bash primed!',
                    impactLog: 'Shield bash lands!',
                    cooldown: 6,
                    damageMultiplier: 1.8
                },
                attackStyle: 'shield-bash',
                attackName: 'Bone cleave',
                maxHp: 70,
                atk: 5,
                shield: 24,
                shieldAbsorption: 0.62,
                shieldRechargeDelay: 3,
                shieldRechargeRate: 0.15,
                speed: 1.0,
                attackRange: 112,
                attackInterval: 1.15,
                spawnWeight: 2
            },
            {
                name: 'Sandstone Warden',
                trait: 'Powerful slow guardian',
                signature: {
                    id: 'sandstone-quake',
                    name: 'Sandstone Quake',
                    log: 'Quake incoming!',
                    impactLog: 'Quake hits!',
                    cooldown: 8.5,
                    castTime: 0.9,
                    damageMultiplier: 2.1
                },
                attackStyle: 'quake',
                attackName: 'Stone hammer',
                maxHp: 116,
                atk: 9,
                shield: 18,
                shieldAbsorption: 0.72,
                shieldRechargeDelay: 3.2,
                shieldRechargeRate: 0.14,
                speed: 0.55,
                attackRange: 122,
                attackInterval: 1.7,
                spawnWeight: 1
            }
        ],
        masteryMilestones: [20, 60, 125, 220, 350],
        masteryBonusPerMilestone: 0.05
    },
    dungeon: {
        name: 'Dungeon',
        resource: 'Rubies',
        tile: ASSETS.TILE_DUNGEON,
        monster: 'dragon',
        monsterSprite: ASSETS.DRAGON,
        difficulty: 6,
        color: '#2d2d2d',
        celebrationColor: '#d7a6ff',
        resourceYieldMultiplier: 1.7,
        lootChanceBonus: 0.06,
        farmPerk: 'Ruby Veins · CRIT SCALING',
        farmReason: 'Rubies fund Critical Chance and Critical Damage, the answer to fortified elites and bosses.',
        routeContext: {
            objective: 'Break fortified elites and bosses',
            detail: 'Prioritize Chest and Ring upgrades for survival and finishing power; Boots and Head drops matter when the vault starts outpacing your tempo.',
            prioritySlots: ['chest', 'ring', 'boots', 'head']
        },
        monsterRoster: [
            {
                name: 'Cinder Whelp',
                trait: 'Relentless skirmisher',
                signature: {
                    id: 'cinder-breath',
                    name: 'Cinder Breath',
                    log: 'Cinder breath!',
                    impactLog: 'Cinder breath hits!',
                    cooldown: 6.8,
                    castTime: 0.7,
                    damageMultiplier: 1.35
                },
                attackStyle: 'breath',
                attackName: 'Ember claw',
                maxHp: 92,
                atk: 10,
                shield: 8,
                shieldAbsorption: 0.58,
                shieldRechargeDelay: 3.4,
                shieldRechargeRate: 0.12,
                speed: 2.5,
                attackRange: 108,
                signatureRange: 360,
                attackInterval: 0.78,
                spawnWeight: 4
            },
            {
                name: 'Obsidian Shieldbearer',
                trait: 'Fortified shield-bearer',
                signature: {
                    id: 'obsidian-guard',
                    name: 'Void Guard',
                    log: 'Void guard!',
                    impactLog: 'Void guard raised!',
                    cooldown: 7.4,
                    castTime: 0.4,
                    damageReduction: 0.5
                },
                attackStyle: 'void',
                attackName: 'Void cleave',
                maxHp: 178,
                atk: 14,
                shield: 55,
                shieldAbsorption: 0.78,
                shieldRechargeDelay: 2.4,
                shieldRechargeRate: 0.2,
                speed: 0.9,
                attackRange: 116,
                attackInterval: 1.2,
                spawnWeight: 2
            },
            {
                name: 'Ancient Dragon',
                trait: 'Powerful slow guardian',
                signature: {
                    id: 'dragon-meteor',
                    name: 'Meteor Mark',
                    log: 'Meteor marked!',
                    impactLog: 'Meteor strike hits!',
                    cooldown: 10,
                    castTime: 1.15,
                    damageMultiplier: 2.4
                },
                attackStyle: 'meteor',
                attackName: 'Dragon claw',
                maxHp: 300,
                atk: 28,
                shield: 45,
                shieldAbsorption: 0.68,
                shieldRechargeDelay: 3.6,
                shieldRechargeRate: 0.12,
                speed: 0.45,
                attackRange: 130,
                signatureRange: 360,
                attackInterval: 1.85,
                spawnWeight: 1
            }
        ],
        masteryMilestones: [10, 35, 80, 150, 260],
        masteryBonusPerMilestone: 0.05
    }
};

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;
export const GRID_SIZE = 80;
export const TICK_RATE = 60;

// Inventory begins intentionally compact so every expansion is a meaningful
// permanent expedition reward. Each purchase adds several real slots and uses
// either a map currency or a crafting material from the long-run economy.
export const INVENTORY_SIZE = 12;
export const INVENTORY_EXPANSION_SLOT_COUNT = 4;
export const INVENTORY_EXPANSIONS = [
    {
        id: 'trail-satchel',
        name: 'Trail Satchel',
        slots: 4,
        costs: { Gold: 250 },
        description: 'A sturdy field satchel for longer Grasslands expeditions.'
    },
    {
        id: 'mana-woven-pack',
        name: 'Mana-Woven Pack',
        slots: 4,
        costs: { Mana: 500 },
        description: 'Desert spellcloth reinforces the pack without adding weight.'
    },
    {
        id: 'ruby-latched-case',
        name: 'Ruby-Latched Case',
        slots: 4,
        costs: { Rubies: 900 },
        description: 'A Dungeon-forged case keeps precious finds secure between runs.'
    },
    {
        id: 'salvager-frame',
        name: 'Salvager’s Frame',
        slots: 4,
        costs: { 'sun-forged-ingot': 4, 'mana-crystal': 2 },
        description: 'Rare materials turn the satchel into a disciplined salvage rig.'
    },
    {
        id: 'voidbound-archive',
        name: 'Voidbound Archive',
        slots: 4,
        costs: { 'void-sigil': 5, 'sun-forged-ingot': 2 },
        description: 'Void-scribed compartments preserve high-rarity equipment safely.'
    },
    {
        id: 'dragonhide-vault',
        name: 'Dragonhide Vault',
        slots: 4,
        costs: { 'dragon-scale': 3, 'void-sigil': 3 },
        description: 'The final expansion makes room for a lifetime of exceptional finds.'
    }
];

export const CONSUMABLE_LOADOUT_INITIAL_SLOTS = 1;
export const CONSUMABLE_LOADOUT_MAX_SLOTS = 3;
export const CONSUMABLE_LOADOUT_UPGRADES = [
    {
        id: 'second-vial-slot',
        name: 'Twin-Vial Harness',
        slots: 2,
        costs: { Gold: 500, Mana: 300 },
        description: 'A linked harness lets the wizard carry a second preparation into battle.'
    },
    {
        id: 'third-vial-slot',
        name: 'Triune Arcana Rack',
        slots: 3,
        costs: { Rubies: 900, 'moonleaf-thread': 4, 'glasswind-shard': 4 },
        description: 'A threefold arcane rack stabilizes a complete preparation rotation.'
    }
];

export const SAVE_KEY = 'robstradomus.progress.v1';
export const SAVE_SLOT_KEY_PREFIX = 'robstradomus.progress.slot.';
export const SAVE_SLOT_COUNT = 3;
export const SAVE_VERSION = 21;
export const AUDIO_SETTINGS_KEY = 'robstradomus.audio.v1';
export const AUDIO_SETTINGS_VERSION = 2;
