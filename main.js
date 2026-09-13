import './src/styles/fonts.css';
import './src/styles/game.css';
import { Game } from './game.js';
import {
    DESIGN_WIDTH,
    DESIGN_HEIGHT,
    MAPS,
    FUTURE_DROP_ITEMS,
    CONSUMABLE_ITEMS,
    CRAFTING_RECIPES,
    RARITIES,
    SALVAGE_CURRENCY,
    EQUIPMENT_STAT_LABELS,
    EQUIPMENT_SLOT_SPECIALIZATIONS,
    ACHIEVEMENT_TIER_NAMES,
    TITLE_BONUS_STAT_LABELS,
    SAVE_SLOT_COUNT
} from './constants.js';

window.addEventListener('load', () => {
    const canvas = document.getElementById('game-canvas');
    const container = document.getElementById('game-container');

    const syncSidePanelsPosition = () => {
        const topBar = document.getElementById('top-bar');
        const sidePanels = document.getElementById('side-panels');
        if (!topBar || !sidePanels || !container) return;

        const containerRect = container.getBoundingClientRect();
        const topBarRect = topBar.getBoundingClientRect();
        const gap = window.innerWidth <= 760 ? 14 : 18;
        sidePanels.style.top = `${Math.ceil(topBarRect.bottom - containerRect.top + gap)}px`;
    };

    function resize() {
        const scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
        canvas.width = DESIGN_WIDTH;
        canvas.height = DESIGN_HEIGHT;
        canvas.style.width = `${DESIGN_WIDTH * scale}px`;
        canvas.style.height = `${DESIGN_HEIGHT * scale}px`;

        // Center the canvas
        canvas.style.position = 'absolute';
        canvas.style.left = '50%';
        canvas.style.top = '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
        syncSidePanelsPosition();
    }

    window.addEventListener('resize', resize);
    resize();

    const game = new Game(canvas);
    const topBar = document.getElementById('top-bar');
    if (topBar && 'ResizeObserver' in window) {
        new ResizeObserver(syncSidePanelsPosition).observe(topBar);
    }
    syncSidePanelsPosition();

    // UI Wire-up
    document.getElementById('zone-prev').onclick = () => {
        game.setZone(game.zoneNumber - 1);
    };

    document.getElementById('zone-next').onclick = () => {
        game.setZone(game.zoneNumber + 1);
    };

    const autoAdvanceZonesToggle = document.getElementById('auto-advance-zones');
    if (autoAdvanceZonesToggle) {
        autoAdvanceZonesToggle.onchange = () => {
            game.setAutoAdvanceZones(autoAdvanceZonesToggle.checked);
        };
    }

    const bindMinimizeToggle = (buttonId, panelId, minimizedClass, label, parentId = null, parentClass = null) => {
        const button = document.getElementById(buttonId);
        const panel = document.getElementById(panelId);
        const parent = parentId ? document.getElementById(parentId) : null;
        if (!button || !panel) return;

        const updateToggle = minimized => {
            const action = minimized ? 'Expand' : 'Minimize';
            button.textContent = minimized ? '+' : '−';
            button.setAttribute('aria-expanded', String(!minimized));
            button.setAttribute('aria-label', `${action} ${label}`);
            if (parent && parentClass) parent.classList.toggle(parentClass, minimized);
        };

        button.onclick = () => {
            const minimized = panel.classList.toggle(minimizedClass);
            updateToggle(minimized);
            if (panelId === 'top-bar') requestAnimationFrame(syncSidePanelsPosition);
        };

        updateToggle(false);
    };

    bindMinimizeToggle('combat-toggle', 'top-bar', 'combat-minimized', 'combat status');
    bindMinimizeToggle('activity-toggle', 'activity-panel', 'activity-minimized', 'combat log');

    const logFilterInputs = [...document.querySelectorAll('[data-log-filter]')];
    const syncLogFilterInputs = () => {
        logFilterInputs.forEach(input => {
            const category = input.dataset.logFilter;
            input.checked = Boolean(game.logFilters[category]);
        });
    };

    logFilterInputs.forEach(input => {
        input.addEventListener('change', () => {
            game.setLogFilter(input.dataset.logFilter, input.checked);
        });
    });
    document.getElementById('log-filter-all')?.addEventListener('click', () => {
        game.setAllLogFilters(true);
        syncLogFilterInputs();
    });
    document.getElementById('log-filter-none')?.addEventListener('click', () => {
        game.setAllLogFilters(false);
        syncLogFilterInputs();
    });
    syncLogFilterInputs();

    const movablePanels = [
        {
            panel: document.getElementById('activity-panel'),
            handle: document.querySelector('[data-drag-handle="activity-panel"]')
        }
    ];
    let dragLayer = 5;

    const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

    movablePanels.forEach(({ panel, handle }) => {
        if (!panel || !handle) return;

        let offsetX = 0;
        let offsetY = 0;
        let dragState = null;

        const finishDrag = event => {
            if (!dragState || (event && event.pointerId !== dragState.pointerId)) return;
            dragState = null;
            panel.classList.remove('panel-dragging');
            handle.classList.remove('panel-dragging');
            if (event && handle.hasPointerCapture?.(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
        };

        handle.addEventListener('pointerdown', event => {
            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest('button, input, textarea, select, a')) return;
            if (event.button !== undefined && event.button !== 0) return;

            const rect = panel.getBoundingClientRect();
            dragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startLeft: rect.left,
                startTop: rect.top,
                baseLeft: rect.left - offsetX,
                baseTop: rect.top - offsetY
            };
            panel.style.zIndex = String(++dragLayer);
            panel.classList.add('panel-dragging');
            handle.classList.add('panel-dragging');
            handle.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });

        handle.addEventListener('pointermove', event => {
            if (!dragState || event.pointerId !== dragState.pointerId) return;

            const containerRect = container.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const margin = 8;
            const desiredLeft = dragState.startLeft + event.clientX - dragState.startX;
            const desiredTop = dragState.startTop + event.clientY - dragState.startY;
            const minimumLeft = containerRect.left + margin;
            const minimumTop = containerRect.top + margin;
            const maximumLeft = Math.max(minimumLeft, containerRect.right - panelRect.width - margin);
            const maximumTop = Math.max(minimumTop, containerRect.bottom - panelRect.height - margin);
            const nextLeft = clamp(desiredLeft, minimumLeft, maximumLeft);
            const nextTop = clamp(desiredTop, minimumTop, maximumTop);

            offsetX = nextLeft - dragState.baseLeft;
            offsetY = nextTop - dragState.baseTop;
            panel.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
            event.preventDefault();
        });

        handle.addEventListener('pointerup', finishDrag);
        handle.addEventListener('pointercancel', finishDrag);
        handle.addEventListener('lostpointercapture', finishDrag);
    });

    const mapBtns = document.querySelectorAll('.map-btn');
    const mapPickerModal = document.getElementById('map-picker-modal');
    const mapPickerTitle = document.getElementById('map-picker-title');
    const mapPickerSubtitle = document.querySelector('.map-picker-subtitle');
    const mapPickerOptions = document.getElementById('map-picker-options');
    const closeMapPickerButton = document.getElementById('close-map-picker');
    const cancelMapPickerButton = document.getElementById('cancel-map-picker');
    const confirmMapPickerButton = document.getElementById('confirm-map-picker');
    const resetProgressModal = document.getElementById('reset-progress-modal');
    const closeResetProgressButton = document.getElementById('close-reset-progress');
    const cancelResetProgressButton = document.getElementById('cancel-reset-progress');
    const confirmResetProgressButton = document.getElementById('confirm-reset-progress');
    const salvageConfirmModal = document.getElementById('salvage-confirm-modal');
    const closeSalvageConfirmButton = document.getElementById('close-salvage-confirm');
    const cancelSalvageConfirmButton = document.getElementById('cancel-salvage-confirm');
    const confirmSalvageButton = document.getElementById('confirm-salvage');
    const bulkSalvageRarity = document.getElementById('bulk-salvage-rarity');
    const bulkSalvageButton = document.getElementById('bulk-salvage-button');
    const bulkSalvageStatus = document.getElementById('bulk-salvage-status');
    const autoSalvageNonExceptionalToggle = document.getElementById('auto-salvage-non-exceptional');
    const autoSalvageStatus = document.getElementById('auto-salvage-status');
    let pendingMapKey = game.currentMapKey;
    let pendingSalvageId = null;
    let pendingSalvageRarity = null;

    const tabNotificationMeta = [
        { tabId: 'character', buttonId: 'character-tab', label: 'Character' },
        { tabId: 'materials', buttonId: 'materials-tab', label: 'Materials' },
        { tabId: 'upgrades', buttonId: 'upgrades-tab', label: 'Upgrades' },
        { tabId: 'achievements', buttonId: 'achievements-tab', label: 'Achievements' },
        { tabId: 'discovery', buttonId: 'discovery-tab', label: 'Discovery Journal' },
        { tabId: 'maps', buttonId: 'maps-tab', label: 'Choose Map' },
        { tabId: 'settings', buttonId: 'settings-tab', label: 'Settings' }
    ];

    const escapeNotificationText = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const materialPickupFeed = document.getElementById('material-pickup-feed');
    const materialPickupTimers = new WeakMap();
    const MATERIAL_PICKUP_STACK_LIMIT = 3;

    const getMaterialPickupRecipeText = detail => {
        const recipes = Array.isArray(detail?.recipes) ? detail.recipes : [];
        const newlyDiscovered = recipes.filter(recipe => recipe.newlyDiscovered);
        const advancing = recipes.filter(recipe => recipe.advances && !recipe.newlyDiscovered);
        const tracked = recipes.filter(recipe => !recipe.advances && !recipe.newlyDiscovered);
        if (newlyDiscovered.length > 0) {
            return `✧ FORMULA DISCOVERED · ${newlyDiscovered.map(recipe => recipe.name).join(' · ')}`;
        }
        if (advancing.length > 0) {
            return `✧ RECIPE ADVANCE · ${advancing.map(recipe => `${recipe.name} ${recipe.current}/${recipe.required}`).join(' · ')}`;
        }
        if (tracked.length > 0) {
            return `NO ADVANCE · ${tracked.map(recipe => `${recipe.name}${recipe.ready ? ' READY' : ` ${recipe.current}/${recipe.required}`}`).join(' · ')}`;
        }
        return 'NO DISCOVERED RECIPE PROGRESS';
    };

    const scheduleMaterialPickupRemoval = card => {
        window.clearTimeout(materialPickupTimers.get(card));
        const timer = window.setTimeout(() => {
            card.classList.add('leaving');
            window.setTimeout(() => card.remove(), 260);
        }, 5200);
        materialPickupTimers.set(card, timer);
    };

    const renderMaterialPickupCard = (card, detail) => {
        const safeQuantity = Math.max(0, Math.floor(Number(detail.quantity) || 0));
        const safeTotal = Math.max(0, Math.floor(Number(detail.total) || 0));
        card.style.setProperty('--pickup-accent', detail.mapAccent || '#75b8ff');
        card.querySelector('[data-pickup-map]').textContent = detail.mapName || 'Current Route';
        card.querySelector('[data-pickup-name]').textContent = detail.name || 'Unknown Material';
        card.querySelector('[data-pickup-quantity]').textContent = `+${safeQuantity}`;
        card.querySelector('[data-pickup-total]').textContent = `TOTAL ${safeTotal.toLocaleString()}`;
        card.querySelector('[data-pickup-recipe]').textContent = getMaterialPickupRecipeText(detail);
        card.setAttribute('aria-label', `${detail.name || 'Material'} gained ${safeQuantity}. Current total ${safeTotal}. ${getMaterialPickupRecipeText(detail)}`);
    };

    const showMaterialPickup = event => {
        if (!materialPickupFeed) return;
        const detail = event.detail || {};
        const itemId = String(detail.itemId || detail.name || 'material');
        const mapKey = String(detail.mapKey || 'route');
        let card = [...materialPickupFeed.children]
            .find(entry => entry.dataset.materialId === itemId && entry.dataset.mapKey === mapKey && !entry.classList.contains('leaving'));
        const previousQuantity = card ? Number(card.dataset.quantity) || 0 : 0;
        const previousRecipes = card?._pickupDetail?.recipes || [];
        if (!card) {
            card = document.createElement('div');
            card.className = 'material-pickup-card';
            card.dataset.materialId = itemId;
            card.dataset.mapKey = mapKey;
            card.innerHTML = `
                <span class="material-pickup-icon" aria-hidden="true"></span>
                <span class="material-pickup-copy">
                    <span class="material-pickup-kicker"><span data-pickup-map></span> · MATERIAL PICKUP</span>
                    <strong data-pickup-name></strong>
                    <small data-pickup-recipe></small>
                </span>
                <span class="material-pickup-amount"><b data-pickup-quantity></b><small data-pickup-total></small></span>
            `;
            materialPickupFeed.prepend(card);
        }
        const currentRecipes = Array.isArray(detail.recipes) ? detail.recipes : [];
        const mergedRecipes = currentRecipes.map(recipe => {
            const previousRecipe = previousRecipes.find(entry => entry.id === recipe.id);
            return {
                ...recipe,
                advances: Boolean(recipe.advances || previousRecipe?.advances),
                newlyDiscovered: Boolean(recipe.newlyDiscovered || previousRecipe?.newlyDiscovered)
            };
        });
        const nextDetail = {
            ...detail,
            recipes: mergedRecipes,
            quantity: previousQuantity + Math.max(0, Math.floor(Number(detail.quantity) || 0))
        };
        card._pickupDetail = nextDetail;
        card.dataset.quantity = String(nextDetail.quantity);
        const icon = card.querySelector('.material-pickup-icon');
        if (icon && !icon.hasChildNodes()) {
            if (detail.image) {
                const image = document.createElement('img');
                image.src = detail.image;
                image.alt = '';
                image.draggable = false;
                icon.appendChild(image);
            } else {
                icon.textContent = detail.icon || '◆';
            }
        }
        renderMaterialPickupCard(card, nextDetail);
        card.classList.remove('leaving');
        void card.offsetWidth;
        card.classList.add('visible');
        scheduleMaterialPickupRemoval(card);
        while (materialPickupFeed.children.length > MATERIAL_PICKUP_STACK_LIMIT) {
            const oldest = materialPickupFeed.lastElementChild;
            window.clearTimeout(materialPickupTimers.get(oldest));
            oldest?.remove();
        }
    };

    window.addEventListener('robstradomus-material-pickup', showMaterialPickup);

    const getNewTabUnlocks = tabId => game.getTabUnlocks(tabId)
        .filter(notice => notice.acknowledged !== true);

    const unlockMarkerMarkup = (count = 1, label = 'NEW') => {
        const suffix = count > 1 ? ` · ${count}` : '';
        return `<span class="content-new-marker" aria-label="${escapeNotificationText(label)}${suffix}">${escapeNotificationText(label)}${suffix}</span>`;
    };

    const acknowledgeUnlocks = (tabId, unlockIds) => {
        [...new Set((Array.isArray(unlockIds) ? unlockIds : [unlockIds]).filter(Boolean))]
            .forEach(unlockId => game.acknowledgeTabUnlock(tabId, unlockId));
    };

    const bindUnlockAcknowledgement = (element, tabId, unlockIds) => {
        if (!element) return;
        const acknowledge = () => {
            const pendingIds = (Array.isArray(unlockIds) ? unlockIds : [unlockIds])
                .filter(unlockId => game.isTabUnlockNew(tabId, unlockId));
            if (pendingIds.length === 0) return;
            acknowledgeUnlocks(tabId, pendingIds);
            element.classList.remove('notification-new-item');
            element.querySelectorAll('.content-new-marker').forEach(marker => marker.remove());
        };
        element.addEventListener('pointerenter', acknowledge);
        element.addEventListener('click', acknowledge);
    };

    const decorateNewUnlock = (element, tabId, unlockIds, count = 1) => {
        const ids = (Array.isArray(unlockIds) ? unlockIds : [unlockIds])
            .filter(unlockId => game.isTabUnlockNew(tabId, unlockId));
        if (!element || ids.length === 0) return false;
        element.classList.add('notification-new-item');
        element.insertAdjacentHTML('beforeend', unlockMarkerMarkup(count));
        bindUnlockAcknowledgement(element, tabId, ids);
        return true;
    };

    const renderMapUnlockMarkers = () => {
        const notices = getNewTabUnlocks('maps');
        mapBtns.forEach(button => {
            button.querySelectorAll('.map-button-notice').forEach(marker => marker.remove());
            const mapKey = button.dataset.map;
            const mapNotices = notices.filter(notice => notice.id.startsWith(`mastery:${mapKey}:`) || notice.id.startsWith(`zone:${mapKey}:`));
            button.classList.toggle('notification-new-item', mapNotices.length > 0);
            if (mapNotices.length > 0) {
                const marker = document.createElement('span');
                marker.className = 'map-button-notice content-new-marker';
                marker.setAttribute('aria-label', `${mapNotices.length} new ${MAPS[mapKey]?.name || 'map'} unlocks`);
                marker.textContent = `NEW${mapNotices.length > 1 ? ` · ${mapNotices.length}` : ''}`;
                button.appendChild(marker);
            }
            button.onpointerenter = () => {
                acknowledgeUnlocks('maps', mapNotices.map(notice => notice.id));
            };
        });
    };

    const renderTabNotificationBadges = () => {
        tabNotificationMeta.forEach(({ tabId, buttonId, label }) => {
            const button = document.getElementById(buttonId);
            if (!button) return;
            button.querySelectorAll('.tab-notice-badge').forEach(marker => marker.remove());
            const unreadCount = game.getTabUnlocks(tabId)
                .filter(notice => notice.tabRead !== true).length;
            const readyUpgradeCount = tabId === 'upgrades'
                ? game.getUpgradeStates().filter(state => state.affordable && !state.maxed).length
                : 0;
            button.classList.toggle('upgrade-tab-ready', tabId === 'upgrades' && readyUpgradeCount > 0);
            const ariaDetails = [];
            if (readyUpgradeCount > 0) {
                ariaDetails.push(`${readyUpgradeCount} upgrade${readyUpgradeCount === 1 ? '' : 's'} ready`);
            }
            if (unreadCount > 0) {
                ariaDetails.push(`${unreadCount} new unlock${unreadCount === 1 ? '' : 's'}`);
            }
            button.setAttribute('aria-label', ariaDetails.length > 0
                ? `${label} · ${ariaDetails.join(' · ')}`
                : label);
            if (unreadCount > 0) {
                const marker = document.createElement('span');
                marker.className = 'tab-notice-badge';
                marker.setAttribute('aria-hidden', 'true');
                marker.textContent = unreadCount > 1 ? `NEW · ${unreadCount}` : 'NEW';
                button.appendChild(marker);
            }
        });
        renderMapUnlockMarkers();
    };

    const updateActiveMapButton = () => {
        mapBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.map === game.currentMapKey));
    };

    const openMapPicker = mapKey => {
        pendingMapKey = mapKey;
        renderMapPicker();
        mapPickerModal.hidden = false;
        mapPickerModal.setAttribute('aria-hidden', 'false');
    };

    const closeMapPicker = () => {
        mapPickerModal.hidden = true;
        mapPickerModal.setAttribute('aria-hidden', 'true');
    };

    const closeResetProgress = () => {
        pendingSaveDeletionSlot = null;
        if (resetProgressTitle) resetProgressTitle.textContent = 'Reset Progress?';
        if (resetProgressWarning) {
            resetProgressWarning.innerHTML = 'This will permanently clear <strong>all three save slots</strong>, your wizard progression, equipment, inventory, resources, and map mastery. Audio settings will be preserved.';
        }
        confirmResetProgressButton.textContent = 'Reset Everything';
        resetProgressModal.hidden = true;
        resetProgressModal.setAttribute('aria-hidden', 'true');
    };

    const openResetProgress = () => {
        pendingSaveDeletionSlot = null;
        if (resetProgressTitle) resetProgressTitle.textContent = 'Reset Progress?';
        if (resetProgressWarning) {
            resetProgressWarning.innerHTML = 'This will permanently clear <strong>all three save slots</strong>, your wizard progression, equipment, inventory, resources, and map mastery. Audio settings will be preserved.';
        }
        confirmResetProgressButton.textContent = 'Reset Everything';
        resetProgressModal.hidden = false;
        resetProgressModal.setAttribute('aria-hidden', 'false');
        confirmResetProgressButton.focus();
    };

    const openDeleteSaveSlot = slot => {
        const normalizedSlot = Math.max(1, Math.min(SAVE_SLOT_COUNT, Math.floor(Number(slot) || 1)));
        const slotInfo = game.getSaveSlotInfo(normalizedSlot);
        if (!slotInfo.exists) return;

        pendingSaveDeletionSlot = normalizedSlot;
        if (resetProgressTitle) resetProgressTitle.textContent = `Delete Slot ${normalizedSlot}?`;
        if (resetProgressWarning) {
            resetProgressWarning.innerHTML = `This will permanently delete <strong>Slot ${normalizedSlot}</strong>, including its wizard progression, equipment, inventory, resources, recipes, achievements, and map mastery. Other save slots and audio settings will be preserved.`;
        }
        confirmResetProgressButton.textContent = `Delete Slot ${normalizedSlot}`;
        resetProgressModal.hidden = false;
        resetProgressModal.setAttribute('aria-hidden', 'false');
        confirmResetProgressButton.focus();
    };

    const formatSalvageValue = salvage => Object.entries(salvage || {})
        .map(([currencyId, amount]) => currencyId === SALVAGE_CURRENCY.id
            ? `+${amount} ${SALVAGE_CURRENCY.name}`
            : `+${amount} ${game.getItemDefinition(currencyId)?.name || currencyId}`)
        .join(' · ');

    const getBulkSalvagePreview = rarity => {
        const entries = game.getSalvageableInventoryEntries(rarity);
        const rewards = {};
        entries.forEach(({ salvage }) => {
            Object.entries(salvage || {}).forEach(([currencyId, amount]) => {
                rewards[currencyId] = (rewards[currencyId] || 0) + amount;
            });
        });
        return { items: entries.map(entry => entry.item), rewards };
    };

    const getRarityLabel = rarity => {
        const rarityData = game.getRarityData(rarity);
        return rarityData.displayName || rarityData.name;
    };

    const updateBulkSalvageControls = () => {
        if (!bulkSalvageRarity || !bulkSalvageButton) return;
        const rarity = bulkSalvageRarity.value || RARITIES[0].name;
        const preview = getBulkSalvagePreview(rarity);
        const rarityLabel = getRarityLabel(rarity);
        bulkSalvageButton.disabled = preview.items.length === 0;
        bulkSalvageButton.textContent = `SALVAGE ALL ≤ ${rarityLabel.toUpperCase()}`;
        bulkSalvageButton.setAttribute('aria-label', preview.items.length > 0
            ? `Salvage all ${rarityLabel} and lower gear`
            : `No eligible ${rarityLabel} or lower gear to salvage`);
        if (bulkSalvageStatus) {
            bulkSalvageStatus.textContent = preview.items.length > 0
                ? `${preview.items.length} ELIGIBLE · ${formatSalvageValue(preview.rewards)}`
                : '0 ELIGIBLE';
        }
    };

    const closeSalvageConfirmation = () => {
        pendingSalvageId = null;
        pendingSalvageRarity = null;
        salvageConfirmModal.hidden = true;
        salvageConfirmModal.setAttribute('aria-hidden', 'true');
    };

    const openSalvageConfirmation = itemId => {
        const item = game.getItemInstance(itemId);
        const salvage = game.getSalvageValue(itemId);
        if (!item || !salvage) return;

        pendingSalvageId = itemId;
        pendingSalvageRarity = null;
        document.getElementById('salvage-confirm-title').textContent = 'Salvage Equipment?';
        document.getElementById('salvage-confirm-copy').textContent = 'The forge will dissolve:';
        document.getElementById('salvage-confirm-item').textContent = `${item.name} · Level ${item.level} ${item.rarity}${item.exceptionalScore ? ` · ${item.exceptionalScore}% roll` : ''}`;
        document.getElementById('salvage-confirm-reward').textContent = formatSalvageValue(salvage);
        confirmSalvageButton.textContent = 'Salvage';
        const salvageWarning = document.getElementById('salvage-confirm-warning');
        if (salvageWarning) {
            salvageWarning.textContent = 'This equipment will be destroyed. Arcane Dust is awarded immediately.';
        }
        salvageConfirmModal.hidden = false;
        salvageConfirmModal.setAttribute('aria-hidden', 'false');
        confirmSalvageButton.focus();
    };

    const openBulkSalvageConfirmation = rarity => {
        const preview = getBulkSalvagePreview(rarity);
        if (preview.items.length === 0) return;

        pendingSalvageId = null;
        pendingSalvageRarity = rarity;
        const rarityLabel = getRarityLabel(rarity);
        document.getElementById('salvage-confirm-title').textContent = 'Salvage Gear Batch?';
        document.getElementById('salvage-confirm-copy').textContent = `The forge will dissolve ${preview.items.length} eligible item${preview.items.length === 1 ? '' : 's'}:`;
        document.getElementById('salvage-confirm-item').textContent = `${rarityLabel} and lower rarity gear`;
        document.getElementById('salvage-confirm-reward').textContent = formatSalvageValue(preview.rewards);
        document.getElementById('salvage-confirm-warning').textContent = 'Equipped gear remains untouched. Every unequipped equipment item in the selected rarity range can be salvaged.';
        confirmSalvageButton.textContent = 'Salvage All';
        salvageConfirmModal.hidden = false;
        salvageConfirmModal.setAttribute('aria-hidden', 'false');
        confirmSalvageButton.focus();
    };

    const mapGearSlotLabels = {
        head: 'Head',
        weapon: 'Weapon',
        chest: 'Robe',
        ring: 'Ring',
        relic: 'Relic',
        boots: 'Boots'
    };

    // Rarity unlock scores resolve to these first meaningful expedition bands in
    // the current three-wave depth curve. The map picker uses them as guidance,
    // not as a second loot rule, so the strip stays readable and future-proof.
    const mapRarityDepths = {
        Common: 1,
        Uncommon: 5,
        Rare: 15,
        Epic: 40,
        Legendary: 100
    };

    const renderMapPicker = () => {
        mapPickerOptions.replaceChildren();
        const mapKey = Object.prototype.hasOwnProperty.call(MAPS, pendingMapKey)
            ? pendingMapKey
            : game.currentMapKey;
        const mapData = MAPS[mapKey];
        if (!mapData) return;

        const mastery = game.mapMastery[mapKey];
        const nextMilestone = game.getNextMasteryMilestone(mapKey, mastery.defeats);
        const currentBonus = Math.round(game.getMapMasteryBonus(mapKey) * 100);
        const nextReward = Math.round(mapData.masteryBonusPerMilestone * 100);
        const newMapNotices = getNewTabUnlocks('maps')
            .filter(notice => notice.id.startsWith(`mastery:${mapKey}:`) || notice.id.startsWith(`zone:${mapKey}:`));
        const gearDrops = FUTURE_DROP_ITEMS
            .filter(item => item.kind === 'equipment' && (item.dropMaps || []).includes(mapKey));
        const gearDropMarkup = gearDrops.length > 0
            ? gearDrops.map(item => {
                const rarity = game.getRarityData(item.rarity);
                const rarityLabel = rarity.displayName || rarity.name;
                const slotLabel = mapGearSlotLabels[item.slot] || item.slot || 'Gear';
                return `<li><span>${slotLabel}</span><strong>${item.name}</strong><em>${rarityLabel}</em></li>`;
            }).join('')
            : '<li><span>Gear</span><strong>No equipment drops recorded</strong><em>—</em></li>';

        const gearFamilies = gearDrops.reduce((families, item) => {
            const family = item.routeIdentity || `${mapData.name} drop pool`;
            if (!families.has(family)) families.set(family, []);
            families.get(family).push(item);
            return families;
        }, new Map());
        const routeContext = mapData.routeContext || {};
        const prioritySlots = (routeContext.prioritySlots || [])
            .map(slot => mapGearSlotLabels[slot] || slot)
            .join(' · ');
        const routeDepth = game.getMaxZoneUnlocked(mapKey);
        const routeLootIndex = game.getMaxLootRarityIndex(routeDepth, 3, mapKey);
        const routeLoot = RARITIES[routeLootIndex] || RARITIES[0];
        const routeLootLabel = routeLoot.displayName || routeLoot.name;
        const familyMarkup = [...gearFamilies.entries()]
            .sort(([, firstItems], [, secondItems]) => {
                const firstDepth = Math.min(...firstItems.map(item => mapRarityDepths[item.rarity] || 1));
                const secondDepth = Math.min(...secondItems.map(item => mapRarityDepths[item.rarity] || 1));
                return firstDepth - secondDepth;
            })
            .map(([family, items]) => {
                const slots = [...new Set(items.map(item => mapGearSlotLabels[item.slot] || item.slot || 'Gear'))];
                const depths = items.map(item => mapRarityDepths[item.rarity] || 1);
                const firstDepth = Math.min(...depths);
                const lastDepth = Math.max(...depths);
                const depthLabel = firstDepth === lastDepth
                    ? `Zone ${firstDepth}+`
                    : `Zones ${firstDepth}–${lastDepth}+`;
                const itemNames = items.map(item => item.name).join(' · ');
                return `<li title="${escapeNotificationText(`${family}: ${itemNames}`)}">
                    <strong>${escapeNotificationText(family)}</strong>
                    <span>${escapeNotificationText(slots.join(' · '))} slots</span>
                    <em>Matters ${escapeNotificationText(depthLabel)}</em>
                    <small>${escapeNotificationText(itemNames)}</small>
                </li>`;
            }).join('');
        const routeContextMarkup = `
            <div class="map-route-context" aria-label="Route farming objective">
                <div class="map-route-context-heading">
                    <span>Farming objective</span>
                    <strong>${escapeNotificationText(routeContext.objective || 'Choose the gear lane you need next')}</strong>
                </div>
                <p>${escapeNotificationText(routeContext.detail || mapData.farmReason)}</p>
                <div class="map-route-context-status">
                    <span>Target slots <b>${escapeNotificationText(prioritySlots || 'Any equipment slot')}</b></span>
                    <span>Route depth <b>Zone ${routeDepth} unlocked · ${escapeNotificationText(routeLootLabel)} active</b></span>
                </div>
                <div class="map-route-families">
                    <span>Gear families · slot targets · depth</span>
                    <ul>${familyMarkup || '<li><strong>Regional gear</strong><span>Equipment slots</span><em>Depth pending</em><small>Keep farming to reveal route drops.</small></li>'}</ul>
                </div>
            </div>
        `;
        const rosterMarkup = (mapData.monsterRoster || [])
            .map(variant => `${variant.name} · ${variant.trait}`)
            .join('<br>');
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = `map-choice selected${newMapNotices.length > 0 ? ' notification-new-item' : ''}`;
        choice.innerHTML = `
            <h3>${mapData.name}</h3>
            ${newMapNotices.length > 0 ? `<span class="map-choice-notice content-new-marker">NEW${newMapNotices.length > 1 ? ` · ${newMapNotices.length}` : ''} UNLOCK${newMapNotices.length === 1 ? '' : 'S'}</span>` : ''}
            <div class="map-choice-row"><span>Resource</span><strong>${mapData.resource}</strong></div>
            <div class="map-choice-row"><span>Difficulty</span><strong>${mapData.difficulty.toFixed(1)}×</strong></div>
            <div class="map-choice-row"><span>Mastery</span><strong>Level ${mastery.milestones}</strong></div>
            <div class="map-choice-row"><span>Defeats</span><strong>${mastery.defeats}</strong></div>
            <div class="map-choice-row"><span>Current bonus</span><strong>+${currentBonus}%</strong></div>
            <div class="map-choice-row map-choice-perk"><span>Farm perk</span><strong>${mapData.farmPerk}</strong></div>
            <div class="map-choice-reason">${mapData.farmReason}</div>
            ${routeContextMarkup}
            <div class="map-choice-roster"><span>Monster roster</span><strong>${rosterMarkup}</strong></div>
            <div class="map-choice-drops">
                <span>Gear drops</span>
                <ul>${gearDropMarkup}</ul>
            </div>
            <div class="map-choice-next">Next: ${nextMilestone} defeats for +${nextReward}% mastery yield</div>
        `;
        bindUnlockAcknowledgement(choice, 'maps', newMapNotices.map(notice => notice.id));
        mapPickerOptions.appendChild(choice);
        if (mapPickerTitle) mapPickerTitle.textContent = `${mapData.name} Expedition`;
        if (mapPickerSubtitle) mapPickerSubtitle.textContent = `Review this route’s objective, gear families, threats, and depth plan before farming here.`;
    };

    mapBtns.forEach(btn => {
        btn.onclick = () => openMapPicker(btn.dataset.map);
    });
    renderMapUnlockMarkers();

    confirmMapPickerButton.onclick = () => {
        game.setMap(pendingMapKey);
        updateActiveMapButton();
        closeMapPicker();
    };
    closeMapPickerButton.onclick = closeMapPicker;
    cancelMapPickerButton.onclick = closeMapPicker;
    mapPickerModal.onclick = event => {
        if (event.target === mapPickerModal) closeMapPicker();
    };
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (!mapPickerModal.hidden) closeMapPicker();
        if (!resetProgressModal.hidden) closeResetProgress();
        if (!salvageConfirmModal.hidden) closeSalvageConfirmation();
    });
    updateActiveMapButton();

    window.addEventListener('pagehide', () => {
        game.saveProgress();
    });

    const audioLabels = {
        master: document.getElementById('master-volume-value'),
        ambient: document.getElementById('ambient-volume-value'),
        attack: document.getElementById('attack-volume-value'),
        hit: document.getElementById('hit-volume-value'),
        celebration: document.getElementById('celebration-volume-value')
    };
    document.querySelectorAll('[data-audio-setting]').forEach(input => {
        const key = input.dataset.audioSetting;
        input.value = game.audioSettings[key];
        audioLabels[key].textContent = `${Math.round(game.audioSettings[key] * 100)}%`;
        input.oninput = () => {
            const value = Number(input.value);
            game.setAudioSetting(key, value);
            audioLabels[key].textContent = `${Math.round(value * 100)}%`;
        };
    });

    const saveSlotButtons = [...document.querySelectorAll('[data-save-slot]')];
    const startSaveSlotButtons = [...document.querySelectorAll('[data-start-save-slot]')];
    const saveSlotStatus = document.getElementById('save-slot-status');
    const saveSlotSaveButton = document.getElementById('save-slot-save');
    const saveSlotLoadButton = document.getElementById('save-slot-load');
    const saveSlotStartButton = document.getElementById('save-slot-start');
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-btn');
    const startSaveSelection = document.getElementById('start-save-selection');
    const startSaveNote = document.getElementById('start-save-note');
    const resetProgressButton = document.getElementById('reset-progress-btn');
    const saveSlotDeleteButtons = [...document.querySelectorAll('[data-delete-save-slot]')];
    const resetProgressTitle = document.getElementById('reset-progress-title');
    const resetProgressWarning = document.querySelector('.reset-progress-warning');
    const tutorialModal = document.getElementById('tutorial-modal');
    const tutorialTabButton = document.getElementById('tutorial-tab');
    const startTutorialButton = document.getElementById('start-tutorial-button');
    const closeTutorialButton = document.getElementById('close-tutorial');
    const tutorialSkipButton = document.getElementById('tutorial-skip');
    const tutorialBackButton = document.getElementById('tutorial-back');
    const tutorialNextButton = document.getElementById('tutorial-next');
    const tutorialGuideArrow = document.getElementById('tutorial-guide-arrow');
    const tutorialProgressLabel = document.getElementById('tutorial-progress-label');
    const tutorialProgressFill = document.getElementById('tutorial-progress-fill');
    const tutorialGuideKicker = document.getElementById('tutorial-guide-kicker');
    const tutorialGuideTitle = document.getElementById('tutorial-guide-title');
    const tutorialGuideBody = document.getElementById('tutorial-guide-body');
    const tutorialGuideTip = document.getElementById('tutorial-guide-tip');
    const TUTORIAL_SEEN_KEY = 'robstradomus-tutorial-seen-v1';
    let selectedSaveSlot = game.saveSlot;
    let pendingSaveDeletionSlot = null;

    const renderSaveSlots = () => {
        const saveSlots = game.getSaveSlots();
        const updateSlotButton = (button, info, detailText) => {
            const slot = Number(button.dataset.saveSlot || button.dataset.startSaveSlot);
            const isSelected = slot === selectedSaveSlot;
            const detail = button.querySelector('small');
            button.classList.toggle('selected', isSelected);
            button.setAttribute('aria-pressed', String(isSelected));
            if (detail) {
                detail.textContent = detailText(info);
                detail.title = info?.exists && info.savedAt
                    ? `Saved ${new Date(info.savedAt).toLocaleString()}`
                    : 'No save data';
            }
        };

        saveSlotButtons.forEach(button => {
            const slot = Number(button.dataset.saveSlot);
            const info = saveSlots.find(entry => entry.slot === slot);
            updateSlotButton(button, info, entry => entry?.exists
                ? `Lv ${entry.level} · ${entry.mapName}`
                : 'Empty');
        });

        saveSlotDeleteButtons.forEach(button => {
            const slot = Number(button.dataset.deleteSaveSlot);
            const info = saveSlots.find(entry => entry.slot === slot);
            button.disabled = !info?.exists;
            button.setAttribute('aria-label', `Delete save slot ${slot}`);
        });

        startSaveSlotButtons.forEach(button => {
            const slot = Number(button.dataset.startSaveSlot);
            const info = saveSlots.find(entry => entry.slot === slot);
            updateSlotButton(button, info, entry => entry?.exists
                ? `SAVED · LEVEL ${entry.level}`
                : 'EMPTY · LEVEL 1');
        });

        const selectedInfo = saveSlots.find(entry => entry.slot === selectedSaveSlot);
        if (saveSlotStatus) {
            saveSlotStatus.textContent = selectedSaveSlot === game.saveSlot
                ? `Slot ${selectedSaveSlot} active`
                : `Slot ${selectedSaveSlot} selected`;
        }
        if (saveSlotLoadButton) saveSlotLoadButton.disabled = !selectedInfo?.exists;
        if (saveSlotStartButton) {
            saveSlotStartButton.disabled = false;
            saveSlotStartButton.textContent = selectedInfo?.exists
                ? 'Load & Start Selected'
                : 'Start New Slot';
        }
        if (startSaveSelection) {
            startSaveSelection.textContent = selectedInfo?.exists
                ? `SLOT ${selectedSaveSlot} · SAVED PROGRESS`
                : `SLOT ${selectedSaveSlot} · NEW WIZARD`;
        }
        if (startSaveNote) {
            startSaveNote.innerHTML = selectedInfo?.exists
                ? `<strong>Saved progress:</strong> continue this slot at Level ${selectedInfo.level} on ${selectedInfo.mapName}.`
                : '<strong>New wizard:</strong> this slot begins clean at Level 1 with no shared progress.';
        }
        if (startButton) {
            startButton.textContent = selectedInfo?.exists
                ? `LOAD SLOT ${selectedSaveSlot} · FARM`
                : `START SLOT ${selectedSaveSlot} · LEVEL 1`;
        }
    };

    startSaveSlotButtons.forEach(button => {
        button.onclick = () => {
            selectedSaveSlot = Number(button.dataset.startSaveSlot);
            renderSaveSlots();
        };
    });

    let tutorialOpener = null;
    let tutorialStepIndex = 0;
    let tutorialFocusedTarget = null;
    let tutorialTourFrame = 0;
    const tutorialTourSteps = [
        {
            tabId: null,
            target: '#top-bar',
            fallbackTarget: '#start-btn',
            kicker: 'BATTLEFIELD · 1/2',
            title: 'Watch the battlefield',
            body: 'Your wizard fights automatically. The command bar shows your current route, zone, wave, enemy pressure, and expedition danger.',
            tip: 'Use the zone arrows when you want a harder fight with better rewards. Start farming first if the opening screen is still visible.',
            next: 'Show Farming Rates →'
        },
        {
            tabId: null,
            target: '#top-bar .combat-metrics',
            fallbackTarget: '#top-bar',
            kicker: 'BATTLEFIELD · 2/2',
            title: 'Read your farming rates',
            body: 'These counters show XP, damage, Gold, Mana, Rubies, and loot flow per second. They make it easy to compare routes and upgrades over time.',
            tip: 'Let the run farm for a moment, then use these rates to see whether a new upgrade or map is paying off.',
            next: 'Show Character →'
        },
        {
            tabId: 'character',
            target: '#character-panel .character-layout > section:first-child',
            kicker: 'CHARACTER · 1/5',
            title: 'Equip a stronger loadout',
            body: 'The Equipment section is your active loadout. Each slot accepts matching gear, and equipped bonuses immediately feed the wizard’s combat stats.',
            tip: 'Click or drag a gear card onto its matching slot. Select a piece to open the comparison panel before replacing a good roll.',
            next: 'Show Inventory →'
        },
        {
            tabId: 'character',
            target: '#character-inventory',
            kicker: 'CHARACTER · 2/5',
            title: 'Sort, compare, and use drops',
            body: 'Inventory keeps spare equipment and Arcana. Use the sort and filter controls to find new gear, consumables, or the exact slot you want to compare.',
            tip: 'Select a gear card to see Selected versus Equipped stats. Consumables can be used from their own inventory cards.',
            next: 'Show Salvage →'
        },
        {
            tabId: 'character',
            target: '#bulk-salvage-button',
            fallbackTarget: '.inventory-salvage-tools',
            kicker: 'CHARACTER · 3/5',
            title: 'Salvage spare gear',
            body: 'Salvage turns unwanted, unequipped gear into Arcane Dust. The bulk control lets you choose a highest rarity and dissolve every eligible item at once.',
            tip: 'Review the eligible count and reward preview before confirming. Equipped gear is protected, and exceptional finds can be kept.',
            next: 'Show Enhancement →'
        },
        {
            tabId: 'character',
            target: '#character-panel .gear-inline-enhance',
            fallbackTarget: '#equipment-slots',
            kicker: 'CHARACTER · 4/5',
            title: 'Enhance promising gear',
            body: 'Each ENHANCE control spends Arcane Dust for a new random bonus roll. Good items can grow stronger, while critical forge rolls can surge higher.',
            tip: 'Point at an equipped or inventory gear card’s ENHANCE button. The cost rises by rank, so invest Dust into gear you plan to keep.',
            next: 'Show Satchel →'
        },
        {
            tabId: 'character',
            target: '#inventory-capacity-track',
            kicker: 'CHARACTER · 5/5',
            title: 'Grow your permanent satchel',
            body: 'The satchel track shows your current capacity, the next expansion, and its cost. More slots mean fewer good drops are forced into salvage decisions.',
            tip: 'Farm Gold and return here when EXPAND is affordable. Capacity upgrades persist in this save slot.',
            next: 'Show Materials →'
        },
        {
            tabId: 'materials',
            target: '#materials-panel .materials-section',
            kicker: 'MATERIALS · 1/3',
            title: 'Track route materials',
            body: 'This list records the regional materials earned while farming. Material tooltips explain where each resource comes from and which recipes use it.',
            tip: 'Hover or focus a material chip for its source route, known monsters, and current owned amount.',
            next: 'Show Arcane Dust →'
        },
        {
            tabId: 'materials',
            target: '#salvage-currency-card',
            kicker: 'MATERIALS · 2/3',
            title: 'Use Arcane Dust wisely',
            body: 'Arcane Dust is the bridge between loot and power: salvage spare equipment to earn it, then spend it on enhancement rolls in Character.',
            tip: 'Check this balance before enhancing. If Dust is low, keep farming gear or use the salvage controls back in Character.',
            next: 'Show Crafting →'
        },
        {
            tabId: 'materials',
            target: '#materials-panel .crafting-section',
            kicker: 'MATERIALS · 3/3',
            title: 'Craft Arcana and Reversal Seals',
            body: 'Arcane Crafting turns materials into temporary combat boosts, useful consumables, and Reversal Seals that can undo an item’s latest enhancement roll.',
            tip: 'Locked formulas reveal their discovery leads. When a recipe is ready, click its card to craft and send the result to your inventory.',
            next: 'Show Upgrades →'
        },
        {
            tabId: 'upgrades',
            target: '#upgrades-panel .upgrade-wallet',
            kicker: 'UPGRADES · 1/3',
            title: 'Watch the three currency lanes',
            body: 'The wallet shows Gold from Grasslands, Mana from Desert, and Rubies from Dungeon. Each currency funds a different permanent combat specialty.',
            tip: 'Use the wallet before buying. A full route rotation also matters because Resource Bonus uses all three currencies together.',
            next: 'Show Core Stats →'
        },
        {
            tabId: 'upgrades',
            target: '#upg-atk',
            kicker: 'UPGRADES · 2/3',
            title: 'Buy direct combat power',
            body: 'The Attack Power row is a simple first upgrade: spend Gold for a permanent increase that improves every future fight in this save slot.',
            tip: 'The row always shows its rank, next effect, and rising cost. Max Health uses the same Gold lane when survivability matters more.',
            next: 'Show Expedition Bonus →'
        },
        {
            tabId: 'upgrades',
            target: '#upg-res',
            kicker: 'UPGRADES · 3/3',
            title: 'Scale the whole expedition',
            body: 'Resource Bonus is the convergence upgrade. It costs Gold, Mana, and Rubies, then increases the yield from every farming route.',
            tip: 'Use the biome-specific rows for immediate combat needs, then rotate maps and return to this row when the three-currency cost is covered.',
            next: 'Show Achievements →'
        },
        {
            tabId: 'achievements',
            target: '#honors-title-slots',
            kicker: 'ACHIEVEMENTS · 1/3',
            title: 'Stack mystical title bonuses',
            body: 'Mystical Honors gives you active title slots. Equipped achievement titles add their listed combat or resource bonuses together.',
            tip: 'Empty slots tell you to choose a title below. Revisit this area whenever a new milestone unlocks another title or slot.',
            next: 'Show Badges →'
        },
        {
            tabId: 'achievements',
            target: '#honors-badge-options',
            kicker: 'ACHIEVEMENTS · 2/3',
            title: 'Display your earned badges',
            body: 'Badges are the display side of achievements. Unlock them through milestone tiers, then toggle up to the available badge limit to show them in your honors identity.',
            tip: 'Titles affect combat; badges show your accomplishments. Locked options tell you which achievement tier to pursue next.',
            next: 'Show Milestones →'
        },
        {
            tabId: 'achievements',
            target: '#achievements-list',
            kicker: 'ACHIEVEMENTS · 3/3',
            title: 'Chase lifetime milestones',
            body: 'Each achievement has tier thresholds, a progress bar, and a final reward. These milestones persist for the save slot instead of resetting with a farming session.',
            tip: 'Hover a card or tier dot for the exact requirement. Completing a full track can grant a permanent journal-style reward.',
            next: 'Show Discovery →'
        },
        {
            tabId: 'discovery',
            target: '#discovery-panel .discovery-panel-callout',
            kicker: 'DISCOVERY JOURNAL · 1/2',
            title: 'Understand the Arcane Archive',
            body: 'The archive remembers equipment bases even after you equip, enhance, or salvage them. Locked records show which route can reveal each relic.',
            tip: 'Use the count here to see how much of the journal is found. Discovery is permanent progression, not a one-run checklist.',
            next: 'Show Journal Records →'
        },
        {
            tabId: 'discovery',
            target: '#equipment-journal-list',
            kicker: 'DISCOVERY JOURNAL · 2/2',
            title: 'Improve journal mastery',
            body: 'Journal cards record each item’s best rarity, strongest roll, source route, and mastery rank. Finding a higher rarity or stronger roll adds Insight and permanent bonuses.',
            tip: 'Read the route and source hints on locked cards, then farm that map. Recheck discovered cards after exceptional finds.',
            next: 'Show Choose Map →'
        },
        {
            tabId: 'maps',
            target: '#map-panel .map-btn.active',
            kicker: 'CHOOSE MAP · 1/2',
            title: 'Read a route before farming',
            body: 'Every map card gives a resource identity, route perk, and mastery progress. The active card is the route your wizard is farming now.',
            tip: 'Open a card to inspect its monsters, gear drops, difficulty, and next mastery reward before confirming the route.',
            next: 'Show Route Rotation →'
        },
        {
            tabId: 'maps',
            target: '#map-panel .map-btn[data-map="dungeon"]',
            fallbackTarget: '#map-panel .map-grid',
            kicker: 'CHOOSE MAP · 2/2',
            title: 'Rotate routes for resources',
            body: 'Grasslands supplies Gold, Desert supplies Mana, and Dungeon supplies Rubies for their matching upgrade lanes. Route mastery also improves yield over time.',
            tip: 'Switch routes when a currency lane or discovery lead needs attention. Dungeon is the critical-scaling route, so it is especially valuable for Ruby upgrades.',
            next: 'Show Settings →'
        },
        {
            tabId: 'settings',
            target: '#settings-panel .volume-row:nth-child(2)',
            kicker: 'SETTINGS · 1/2',
            title: 'Tune your audio mix',
            body: 'Master, Music, Attack, Hit, and Celebration sliders control the atmosphere and feedback independently. Audio settings save automatically.',
            tip: 'The highlighted Music slider is the quickest way to quiet or restore the ambient mystical track without muting combat cues.',
            next: 'Show Save Slots →'
        },
        {
            tabId: 'settings',
            target: '#save-slot-options',
            kicker: 'SETTINGS · 2/2',
            title: 'Protect and manage your run',
            body: 'Choose between three independent save slots. Progress saves automatically, while the controls below let you save current progress, load a slot, start fresh, or delete one slot.',
            tip: 'Always check the selected slot label before loading or deleting. Reset Progress is the separate full-wipe action at the bottom.',
            next: 'Show Combat Rewards →'
        },
        {
            tabId: null,
            target: '#activity-panel .loot-summary',
            kicker: 'COMBAT LOG · 1/2',
            title: 'Review loot and rarity access',
            body: 'The loot summary shows drops from this run and how deeper farming unlocks stronger rarity access. It is the fastest way to notice a new gear or material opportunity.',
            tip: 'Check this summary after a few defeats, then use the Character and Discovery tabs to decide whether to equip, salvage, or record a find.',
            next: 'Show Log Filters →'
        },
        {
            tabId: null,
            target: '#activity-panel .log-filter-controls',
            kicker: 'COMBAT LOG · 2/2',
            title: 'Filter the expedition history',
            body: 'The history lists combat, enemy, defeat, loot, discovery, crafting, and system notices. Filters let you hide noise and focus on the event category you need.',
            tip: 'Use All for a full audit, None for a clean slate, or combine checkboxes while you investigate a drop, milestone, or recipe discovery.',
            next: 'Finish Tour'
        }
    ];

    const hasSeenTutorial = () => {
        try {
            return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true';
        } catch (error) {
            return false;
        }
    };

    const markTutorialSeen = () => {
        try {
            window.localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
        } catch (error) {
            // Storage can be unavailable in restricted browser contexts.
        }
    };

    const clearTutorialFocus = () => {
        tutorialFocusedTarget?.classList.remove('tutorial-focus-target');
        document.querySelectorAll('.tutorial-focus-tab').forEach(element => element.classList.remove('tutorial-focus-tab'));
        tutorialFocusedTarget = null;
        if (tutorialGuideArrow) {
            tutorialGuideArrow.style.width = '0px';
            tutorialGuideArrow.hidden = true;
        }
    };

    const isVisibleTutorialTarget = element => {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };

    const getTutorialTarget = step => {
        const startScreenVisible = startScreen && window.getComputedStyle(startScreen).display !== 'none';
        if (startScreenVisible && step.fallbackTarget) {
            const startTarget = document.querySelector(step.fallbackTarget);
            if (isVisibleTutorialTarget(startTarget)) return startTarget;
        }
        const target = document.querySelector(step.target);
        if (isVisibleTutorialTarget(target)) return target;
        const fallback = step.fallbackTarget ? document.querySelector(step.fallbackTarget) : null;
        return isVisibleTutorialTarget(fallback) ? fallback : null;
    };

    const positionTutorialGuide = () => {
        if (!tutorialModal || tutorialModal.hidden || !tutorialModal.classList.contains('guided-tour')) return;
        const step = tutorialTourSteps[tutorialStepIndex];
        const target = getTutorialTarget(step);
        const dialog = tutorialModal.querySelector('.tutorial-dialog');
        if (!dialog) return;
        if (target && tutorialFocusedTarget !== target) {
            clearTutorialFocus();
            tutorialFocusedTarget = target;
            target.classList.add('tutorial-focus-target');
            const stepTabButton = step.tabId
                ? document.getElementById(`${step.tabId === 'maps' ? 'maps' : step.tabId}-tab`)
                : null;
            stepTabButton?.classList.add('tutorial-focus-tab');
        }
        if (!target) {
            if (tutorialGuideArrow) tutorialGuideArrow.hidden = true;
            return;
        }

        const targetRect = target.getBoundingClientRect();
        const dialogWidth = Math.min(390, window.innerWidth - 28);
        const targetIsLow = targetRect.top > window.innerHeight * 0.48;
        const desiredTop = targetIsLow ? 18 : window.innerHeight - Math.min(330, window.innerHeight - 28) - 18;
        const maxTop = Math.max(14, window.innerHeight - 330 - 14);
        const top = Math.max(14, Math.min(desiredTop, maxTop));
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const left = Math.max(14, Math.min(window.innerWidth - dialogWidth - 14, targetCenterX - dialogWidth / 2));
        dialog.style.left = `${Math.round(left)}px`;
        dialog.style.top = `${Math.round(top)}px`;

        if (!tutorialGuideArrow) return;
        const dialogRect = dialog.getBoundingClientRect();
        const targetCenterY = targetRect.top + targetRect.height / 2;
        const arrowStartX = Math.max(dialogRect.left + 20, Math.min(dialogRect.right - 20, targetCenterX));
        const arrowStartY = targetIsLow ? dialogRect.bottom + 7 : dialogRect.top - 7;
        const deltaX = targetCenterX - arrowStartX;
        const deltaY = targetCenterY - arrowStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        tutorialGuideArrow.hidden = distance < 18;
        tutorialGuideArrow.style.left = `${Math.round(arrowStartX)}px`;
        tutorialGuideArrow.style.top = `${Math.round(arrowStartY)}px`;
        tutorialGuideArrow.style.width = `${Math.round(distance)}px`;
        tutorialGuideArrow.style.transform = `rotate(${Math.atan2(deltaY, deltaX)}rad)`;
    };

    const renderTutorialStep = () => {
        const step = tutorialTourSteps[tutorialStepIndex];
        if (!step || !tutorialModal) return;
        clearTutorialFocus();
        tutorialProgressLabel.textContent = `Step ${tutorialStepIndex + 1} of ${tutorialTourSteps.length}`;
        tutorialProgressFill.style.width = `${Math.round(((tutorialStepIndex + 1) / tutorialTourSteps.length) * 100)}%`;
        tutorialGuideKicker.textContent = step.kicker;
        tutorialGuideTitle.textContent = step.title;
        tutorialGuideBody.textContent = step.body;
        tutorialGuideTip.innerHTML = `<strong>LOOK HERE</strong><br>${step.tip}`;
        tutorialBackButton.disabled = tutorialStepIndex === 0;
        tutorialNextButton.textContent = step.next;
        requestAnimationFrame(() => {
            const target = getTutorialTarget(step);
            if (target && step.tabId) target.scrollIntoView({ block: 'center', inline: 'nearest' });
            requestAnimationFrame(positionTutorialGuide);
        });
    };

    const showTutorialStep = index => {
        tutorialStepIndex = Math.max(0, Math.min(tutorialTourSteps.length - 1, index));
        const step = tutorialTourSteps[tutorialStepIndex];
        if (step.tabId) {
            const tabButton = document.getElementById(`${step.tabId === 'maps' ? 'maps' : step.tabId}-tab`);
            const panel = tabButton ? document.getElementById(tabButton.getAttribute('aria-controls')) : null;
            if (tabButton && !panel?.classList.contains('panel-open')) tabButton.click();
        } else {
            const openTab = document.querySelector('#tab-bar .tab-button[aria-expanded="true"]:not(#tutorial-tab)');
            openTab?.click();
        }
        renderTutorialStep();
    };

    const closeTutorial = () => {
        if (!tutorialModal) return;
        clearTutorialFocus();
        tutorialModal.classList.remove('guided-tour');
        tutorialModal.hidden = true;
        tutorialModal.setAttribute('aria-hidden', 'true');
        const opener = tutorialOpener;
        tutorialOpener = null;
        if (opener instanceof HTMLElement) opener.focus();
    };

    const openTutorial = opener => {
        if (!tutorialModal) return;
        tutorialOpener = opener instanceof HTMLElement ? opener : null;
        markTutorialSeen();
        tutorialStepIndex = 0;
        tutorialModal.classList.add('guided-tour');
        tutorialModal.hidden = false;
        tutorialModal.setAttribute('aria-hidden', 'false');
        showTutorialStep(0);
        requestAnimationFrame(() => closeTutorialButton?.focus());
    };

    startTutorialButton?.addEventListener('click', () => openTutorial(startTutorialButton));
    tutorialTabButton?.addEventListener('click', () => openTutorial(tutorialTabButton));
    closeTutorialButton?.addEventListener('click', closeTutorial);
    tutorialSkipButton?.addEventListener('click', closeTutorial);
    tutorialBackButton?.addEventListener('click', () => showTutorialStep(tutorialStepIndex - 1));
    tutorialNextButton?.addEventListener('click', () => {
        if (tutorialStepIndex >= tutorialTourSteps.length - 1) closeTutorial();
        else showTutorialStep(tutorialStepIndex + 1);
    });
    tutorialModal?.addEventListener('click', event => {
        if (event.target === tutorialModal) closeTutorial();
    });
    window.addEventListener('resize', () => {
        window.cancelAnimationFrame(tutorialTourFrame);
        tutorialTourFrame = window.requestAnimationFrame(positionTutorialGuide);
    });
    document.addEventListener('scroll', () => {
        window.cancelAnimationFrame(tutorialTourFrame);
        tutorialTourFrame = window.requestAnimationFrame(positionTutorialGuide);
    }, true);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && tutorialModal && !tutorialModal.hidden) closeTutorial();
    });

    const launchSelectedSaveSlot = () => {
        const selectedInfo = game.getSaveSlots().find(entry => entry.slot === selectedSaveSlot);
        const prepared = selectedInfo?.exists
            ? game.loadSaveSlot(selectedSaveSlot)
            : game.startNewSaveSlot(selectedSaveSlot);
        if (!prepared) return;
        startScreen.style.display = 'none';
        game.start();
        renderSaveSlots();
        if (!hasSeenTutorial()) requestAnimationFrame(() => openTutorial(startButton));
        else requestAnimationFrame(positionTutorialGuide);
    };

    startButton.onclick = launchSelectedSaveSlot;

    saveSlotButtons.forEach(button => {
        button.onclick = () => {
            selectedSaveSlot = Number(button.dataset.saveSlot);
            renderSaveSlots();
        };
    });

    saveSlotSaveButton.onclick = () => {
        if (!game.saveToSlot(selectedSaveSlot)) return;
        renderSaveSlots();
        game.showSaveToast(`Progress saved · Slot ${selectedSaveSlot}`);
    };

    saveSlotLoadButton.onclick = () => {
        if (!game.loadSaveSlot(selectedSaveSlot)) return;
        renderSaveSlots();
    };

    saveSlotStartButton.onclick = launchSelectedSaveSlot;

    saveSlotDeleteButtons.forEach(button => {
        button.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            openDeleteSaveSlot(button.dataset.deleteSaveSlot);
        };
    });

    resetProgressButton.onclick = openResetProgress;

    closeSalvageConfirmButton.onclick = closeSalvageConfirmation;
    cancelSalvageConfirmButton.onclick = closeSalvageConfirmation;
    confirmSalvageButton.onclick = () => {
        const itemId = pendingSalvageId;
        const rarity = pendingSalvageRarity;
        closeSalvageConfirmation();
        if (itemId) game.salvageItem(itemId);
        else if (rarity) game.salvageAllByRarity(rarity);
    };
    bulkSalvageRarity?.addEventListener('change', updateBulkSalvageControls);
    bulkSalvageButton?.addEventListener('click', () => {
        openBulkSalvageConfirmation(bulkSalvageRarity?.value || RARITIES[0].name);
    });
    salvageConfirmModal.onclick = event => {
        if (event.target === salvageConfirmModal) closeSalvageConfirmation();
    };

    confirmResetProgressButton.onclick = () => {
        if (pendingSaveDeletionSlot !== null) {
            const slot = pendingSaveDeletionSlot;
            const wasActiveSlot = slot === game.saveSlot;
            if (!game.deleteSaveSlot(slot)) return;

            closeResetProgress();
            selectedSaveSlot = slot;
            if (wasActiveSlot) startScreen.style.display = 'flex';
            renderSaveSlots();
            return;
        }

        if (!game.resetProgress()) return;

        closeResetProgress();
        selectedSaveSlot = 1;
        startScreen.style.display = 'flex';
        renderSaveSlots();
    };
    closeResetProgressButton.onclick = closeResetProgress;
    cancelResetProgressButton.onclick = closeResetProgress;
    resetProgressModal.onclick = event => {
        if (event.target === resetProgressModal) closeResetProgress();
    };

    window.addEventListener('robstradomus-save-changed', renderSaveSlots);
    renderSaveSlots();

    const characterSlotMeta = {
        head: { label: 'Head', glyph: '◈' },
        weapon: { label: 'Main Hand', glyph: '✦' },
        chest: { label: 'Robe', glyph: '◇' },
        boots: { label: 'Boots', glyph: '⌁' },
        relic: { label: 'Relic', glyph: '✥' },
        ring: { label: 'Ring', glyph: '✧' }
    };

    const formatItemBonuses = bonuses => {
        const entries = Object.entries(bonuses || {});
        return entries.length > 0
            ? entries.map(([stat, value]) => {
                const displayValue = stat === 'crit'
                    ? `${Math.round(value * 100)}%`
                    : stat === 'critDamage'
                        ? `${Number(value).toFixed(2)}×`
                        : Number(value).toFixed(stat === 'speed' || stat === 'regenHp' ? 1 : 0);
                return `${EQUIPMENT_STAT_LABELS[stat] || stat.toUpperCase()} +${displayValue}`;
            }).join(' · ')
            : 'No combat bonus';
    };

    const itemArtMarkup = (item, fallback, className) => item?.image
        ? `<img class="${className}" src="${item.image}" alt="" draggable="false">`
        : `<span class="${className}">${item?.icon || fallback}</span>`;

    const gearStatMeta = [
        { id: 'maxHp', label: 'HP', precision: 0 },
        { id: 'atk', label: 'ATK', precision: 0 },
        { id: 'speed', label: 'SPD', precision: 1 },
        { id: 'regenHp', label: 'REGEN', precision: 1 },
        { id: 'crit', label: 'CRIT', percent: true },
        { id: 'critDamage', label: 'CRIT DMG', precision: 1, suffix: '×' }
    ];
    let selectedEquipmentId = null;
    let lastEquipmentUpgrade = null;
    let equipmentClickTimer = null;
    let lastEquipmentClick = { itemId: null, timestamp: 0 };
    let enhancementRollAnimating = false;
    let enhancementRollAnimationId = 0;
    let inventorySort = 'newest';
    let inventoryFilter = 'all';

    const inventorySortLabels = {
        newest: 'NEWEST DROP',
        rarity: 'RARITY',
        level: 'LEVEL',
        slot: 'SLOT',
        manual: 'MANUAL ORDER'
    };
    const inventoryFilterLabels = {
        all: 'ALL ITEMS',
        equipment: 'EQUIPMENT',
        consumable: 'CONSUMABLES'
    };
    const inventorySlotOrder = ['head', 'weapon', 'chest', 'ring', 'relic', 'boots'];
    let inventoryActionFeedbackTimer = null;

    const showInventoryActionFeedback = (message, tone = 'info') => {
        const feedback = document.getElementById('inventory-action-feedback');
        if (!feedback) return;
        window.clearTimeout(inventoryActionFeedbackTimer);
        feedback.textContent = message;
        feedback.dataset.tone = tone;
        feedback.classList.add('visible');
        inventoryActionFeedbackTimer = window.setTimeout(() => {
            feedback.classList.remove('visible');
        }, 4200);
    };

    const getOwnedEquipmentItem = itemId => {
        if (typeof itemId !== 'string') return null;
        const isOwned = game.inventory.includes(itemId) || Object.values(game.equipment).includes(itemId);
        const item = isOwned ? game.getItemInstance(itemId) : null;
        return item?.kind === 'equipment' ? item : null;
    };

    const formatGearStatValue = (stat, value) => {
        const numericValue = Number(value) || 0;
        if (stat.percent) return `${Math.round(numericValue * 100)}%`;
        return `${numericValue.toFixed(stat.precision)}${stat.suffix || ''}`;
    };

    const formatGearBonus = (stat, value) => {
        const numericValue = Number(value) || 0;
        if (Math.abs(numericValue) < 0.005) return '—';
        return `${numericValue > 0 ? '+' : '−'}${formatGearStatValue(stat, Math.abs(numericValue))}`;
    };

    const gearRollbackDefinition = CONSUMABLE_ITEMS.find(item => item.gearAction === 'rollback-enhancement') || null;
    const getEnhancementPercent = item => Math.round((game.getGearEnhancementBonusForItem(item?.id) || 0) * 100);
    const getEnhancementRollSummary = item => (item?.enhancementRolls || [])
        .slice(0, item?.enhancementCount || 0)
        .map(roll => `${(Number(roll) * 100).toFixed(1)}%`)
        .join(' · ');

    const getEquipmentAffixInfo = item => {
        if (item?.kind !== 'equipment') return null;
        const progression = game.getEquipmentStatProgression(item.rarity);
        const specialization = EQUIPMENT_SLOT_SPECIALIZATIONS[item.slot] || null;
        const primaryStat = specialization?.primaryStat || null;
        const hasRandomRoll = Boolean(game.itemInstances?.[item.id]?.statRolls);
        const rolledStats = game.getEquipmentStatKeys(item).map(stat => ({
            ...gearStatMeta.find(entry => entry.id === stat),
            id: stat,
            label: EQUIPMENT_STAT_LABELS[stat] || stat.toUpperCase(),
            value: item.bonuses?.[stat],
            range: hasRandomRoll ? game.getEquipmentStatRollRange(stat, item.level, item.rarity, item) : null,
            primary: stat === primaryStat
        }));
        const rarityData = game.getRarityData(item.rarity);
        return {
            progression,
            specialization,
            primaryStat,
            rolledStats,
            rarityLabel: (rarityData.displayName || rarityData.name).toUpperCase()
        };
    };

    const equipmentExceptionalMarkup = item => item?.exceptional
        ? `<span class="equipment-exceptional-mark" aria-label="Exceptional gear${item.exceptionalScore ? `, ${item.exceptionalScore}% roll quality` : ''}">✦ EXCEPTIONAL${item.exceptionalScore ? ` · ${item.exceptionalScore}% ROLL` : ''}</span>`
        : '';

    const equipmentAffixMarkup = (item, context = 'card') => {
        const info = getEquipmentAffixInfo(item);
        if (!info) return '';
        const { progression, specialization } = info;
        const statText = info.rolledStats.length > 0
            ? info.rolledStats.map(stat => `${stat.primary ? '✦ ' : ''}${stat.label} ${formatGearBonus(stat, stat.value)}`).join(' · ')
            : 'NO ROLLED STATS';
        const specializationText = specialization
            ? `✦ ${specialization.label.toUpperCase()} · ${EQUIPMENT_STAT_LABELS[specialization.primaryStat] || specialization.primaryStat.toUpperCase()} PRIMARY`
            : '';
        return `
            <span class="equipment-affix-summary equipment-affix-${context}">
                <span class="equipment-affix-count"><b>${info.rarityLabel} · ${progression.slots} STAT SLOT${progression.slots === 1 ? '' : 'S'}</b><em>${info.rolledStats.length} ROLLED</em></span>
                ${specializationText ? `<span class="equipment-specialization">${escapeNotificationText(specializationText)}</span>` : ''}
                ${equipmentExceptionalMarkup(item)}
                <span class="equipment-affix-list">${statText}</span>
            </span>
        `;
    };

    const tooltipElement = document.getElementById('item-tooltip');
    const tooltipState = { target: null, hideTimer: null, placement: 'auto' };
    const cancelTooltipHide = () => {
        if (!tooltipState.hideTimer) return;
        window.clearTimeout(tooltipState.hideTimer);
        tooltipState.hideTimer = null;
    };
    const scheduleTooltipHide = target => {
        if (!tooltipElement || (target && tooltipState.target !== target)) return;
        cancelTooltipHide();
        tooltipState.hideTimer = window.setTimeout(() => {
            tooltipState.hideTimer = null;
            hideItemTooltip(target);
        }, 220);
    };
    const escapeTooltipHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const getTooltipRarity = item => game.getRarityData(item?.rarity).displayName
        || game.getRarityData(item?.rarity).name;

    const tooltipIconMarkup = item => item?.image
        ? `<img class="item-tooltip-icon item-image" src="${escapeTooltipHtml(item.image)}" alt="" draggable="false">`
        : `<span class="item-tooltip-icon">${escapeTooltipHtml(item?.icon || '◆')}</span>`;

    const tooltipHeadingMarkup = (item, kicker, levelText = '') => `
        <div class="item-tooltip-heading">
            ${tooltipIconMarkup(item)}
            <div>
                <span class="item-tooltip-kicker">${escapeTooltipHtml(kicker)}</span>
                <strong class="item-tooltip-title">${escapeTooltipHtml(item.name)}</strong>
                ${levelText ? `<small class="item-tooltip-level">${escapeTooltipHtml(levelText)}</small>` : ''}
            </div>
        </div>
    `;

    const equipmentComparisonMarkup = (item, context = {}) => {
        if (item?.kind !== 'equipment') return '';

        const equippedItem = context.equipped
            ? item
            : game.getItemInstance(game.equipment?.[item.slot]);
        if (equippedItem?.id === item.id) {
            return `
                <div class="item-tooltip-section item-tooltip-comparison">
                    <span class="item-tooltip-section-label">Equipment comparison</span>
                    <div class="item-tooltip-comparison-note">CURRENTLY EQUIPPED · Hover another ${escapeTooltipHtml(characterSlotMeta[item.slot]?.label || item.slot || 'item')} to see the stat difference.</div>
                </div>
            `;
        }

        const hoveredBonuses = item.bonuses || {};
        const equippedBonuses = equippedItem?.bonuses || {};
        const statEntries = gearStatMeta.filter(stat =>
            Number(hoveredBonuses[stat.id] || 0) !== 0 || Number(equippedBonuses[stat.id] || 0) !== 0
        );
        const rows = statEntries.map(stat => {
            const hoveredValue = Number(hoveredBonuses[stat.id] || 0);
            const equippedValue = Number(equippedBonuses[stat.id] || 0);
            const delta = hoveredValue - equippedValue;
            const deltaClass = Math.abs(delta) < 0.005 ? 'neutral' : delta > 0 ? 'positive' : 'negative';
            return `
                <div class="item-tooltip-comparison-row">
                    <span>${escapeTooltipHtml(stat.label)}</span>
                    <strong class="item-tooltip-comparison-equipped">${equippedItem ? escapeTooltipHtml(formatGearBonus(stat, equippedValue)) : '—'}</strong>
                    <strong>${escapeTooltipHtml(formatGearBonus(stat, hoveredValue))}</strong>
                    <strong class="item-tooltip-comparison-delta ${deltaClass}">${escapeTooltipHtml(formatGearBonus(stat, delta))}</strong>
                </div>
            `;
        }).join('');
        const gainEntries = statEntries.filter(stat => Number(hoveredBonuses[stat.id] || 0) - Number(equippedBonuses[stat.id] || 0) > 0.005);
        const lossEntries = statEntries.filter(stat => Number(hoveredBonuses[stat.id] || 0) - Number(equippedBonuses[stat.id] || 0) < -0.005);
        const gains = gainEntries.length;
        const losses = lossEntries.length;
        const lossRows = lossEntries.map(stat => {
            const hoveredValue = Number(hoveredBonuses[stat.id] || 0);
            const equippedValue = Number(equippedBonuses[stat.id] || 0);
            const lostValue = equippedValue - hoveredValue;
            return `
                <div class="item-tooltip-loss-row">
                    <span>${escapeTooltipHtml(stat.label)}</span>
                    <strong>−${escapeTooltipHtml(formatGearStatValue(stat, lostValue))}</strong>
                    <small>${escapeTooltipHtml(formatGearStatValue(stat, equippedValue))} → ${escapeTooltipHtml(formatGearStatValue(stat, hoveredValue))}</small>
                </div>
            `;
        }).join('');
        const summary = equippedItem
            ? `${gains ? `${gains} increase${gains === 1 ? '' : 's'}` : 'No increases'}${losses ? ` · ${losses} decrease${losses === 1 ? '' : 's'}` : ''}`
            : 'NO GEAR EQUIPPED · ALL HOVERED STATS ARE GAINS';
        const lossMarkup = equippedItem
            ? `
                <div class="item-tooltip-losses${losses > 0 ? ' has-loss' : ''}">
                    <span class="item-tooltip-losses-label">What you will lose</span>
                    ${lossRows || '<div class="item-tooltip-comparison-note">Nothing — this swap does not reduce equipped stats.</div>'}
                </div>
            `
            : '';

        return `
            <div class="item-tooltip-section item-tooltip-comparison">
                <span class="item-tooltip-section-label">Compare with equipped gear</span>
                <div class="item-tooltip-comparison-table">
                    <div class="item-tooltip-comparison-row item-tooltip-comparison-labels"><span>STAT</span><span>EQUIPPED</span><span>HOVERED</span><span>CHANGE</span></div>
                    ${rows || '<div class="item-tooltip-comparison-note">No combat stats to compare.</div>'}
                </div>
                <div class="item-tooltip-comparison-summary${losses > 0 ? ' has-loss' : ''}">${escapeTooltipHtml(summary)}</div>
                ${lossMarkup}
            </div>
        `;
    };

    const equipmentTooltipMarkup = (item, context = {}) => {
        const info = getEquipmentAffixInfo(item);
        if (!info) return '';
        const slotLabel = characterSlotMeta[item.slot]?.label || item.slot || 'Equipment';
        const { progression, specialization } = info;
        const rolledStats = info.rolledStats.length > 0
            ? info.rolledStats.map(stat => {
                const valueText = escapeTooltipHtml(formatGearBonus(stat, stat.value));
                const rangeText = stat.range
                    ? ` <small>(${escapeTooltipHtml(formatGearBonus(stat, stat.range.min))}–${escapeTooltipHtml(formatGearBonus(stat, stat.range.max))}${stat.primary ? ' · boosted' : ''})</small>`
                    : '';
                return `
                    <div class="item-tooltip-stat"><span>${stat.primary ? '✦ ' : ''}${escapeTooltipHtml(stat.label)}</span><strong>${valueText}${rangeText}</strong></div>
                `;
            }).join('')
            : '<div class="item-tooltip-stat"><span>No rolled combat stats</span><strong>—</strong></div>';
        const specializationText = specialization
            ? `${specialization.description} Its ${EQUIPMENT_STAT_LABELS[specialization.primaryStat] || specialization.primaryStat.toUpperCase()} roll range is ${Math.round((Number(specialization.rollMultiplier) - 1) * 100)}% higher than secondary stats.`
            : '';
        const enhancementPercent = getEnhancementPercent(item);
        const enhancementRolls = getEnhancementRollSummary(item);
        const enhancementText = `${item.enhancementCount || 0} enhancement${item.enhancementCount === 1 ? '' : 's'} · +${enhancementPercent}% total${enhancementRolls ? ` · rolls ${enhancementRolls}` : ''}`;
        return `
            ${tooltipHeadingMarkup(item, `${getTooltipRarity(item)} · ${slotLabel}`, `Level ${item.level} · ${enhancementText} · ${progression.slots} of ${progression.maxSlots} stat slots`)}
            <p class="item-tooltip-description">${escapeTooltipHtml(item.description || 'A finely made piece of arcane equipment.')}</p>
            ${specializationText ? `<div class="item-tooltip-section"><span class="item-tooltip-section-label">Slot specialization · ${escapeTooltipHtml(specialization.label)}</span><div class="item-tooltip-effect">${escapeTooltipHtml(specializationText)}</div></div>` : ''}
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">Rolled combat stats · ${info.rolledStats.length}/${progression.slots}</span>
                <div class="item-tooltip-stat-list">${rolledStats}</div>
            </div>
            ${equipmentComparisonMarkup(item, context)}
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">Enhancement</span>
                <div class="item-tooltip-potential">Each rank rolls +1–10% to this item. A crafted Reversal Seal removes the latest roll.</div>
            </div>
            ${item.exceptional ? `<div class="item-tooltip-exceptional">✦ EXCEPTIONAL FIND · ${item.exceptionalScore || '—'}% ROLL QUALITY · A rare high-quality roll.</div>` : ''}
            <div class="item-tooltip-status">${context.equipped
                ? 'EQUIPPED · Move to inventory to salvage'
                : 'CAN BE SALVAGED FOR ARCANE DUST'}${context.equipped ? ' · Currently equipped' : ''}</div>
        `;
    };

    const consumableTooltipMarkup = (item, context = {}) => {
        const isGearAction = item?.gearAction === 'rollback-enhancement';
        const stackCount = Math.max(0, Number(context.stackCount) || 0);
        const headingDetail = isGearAction
            ? `Gear action · Stack ×${stackCount}`
            : `${item.duration || 0} seconds · Stack ×${stackCount}`;
        const effectLabel = item.effectLabel || formatItemBonuses(item.bonuses);
        return `
            ${tooltipHeadingMarkup(item, `${getTooltipRarity(item)} · Consumable`, headingDetail)}
            <p class="item-tooltip-description">${escapeTooltipHtml(item.description || 'A temporary arcane preparation.')}</p>
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">${isGearAction ? 'Gear action' : 'Combat effect'}</span>
                <div class="item-tooltip-effect">${escapeTooltipHtml(effectLabel)}</div>
                <div class="item-tooltip-potential">${isGearAction
                    ? 'Select enhanced gear in the Character tab, then use one seal to remove that item’s latest enhancement rank and exact roll.'
                    : `Active for ${Number(item.duration) || 0} seconds after use.`}</div>
            </div>
            <div class="item-tooltip-status">${stackCount > 0
                ? isGearAction
                    ? `${stackCount} seal${stackCount === 1 ? '' : 's'} ready · targets the selected enhanced gear`
                    : `${stackCount} ready in inventory`
                : 'No stock in inventory'}</div>
        `;
    };

    const materialTooltipMarkup = (item, context = {}) => `
        ${tooltipHeadingMarkup(item, `${getTooltipRarity(item)} · Material`, `${context.quantity ?? game.getMaterialCount(item.id)} owned`)}
        <p class="item-tooltip-description">${escapeTooltipHtml(item.description || 'A valuable crafting material.')}</p>
        ${item.dropFrom ? `<div class="item-tooltip-section"><span class="item-tooltip-section-label">Found from</span><div class="item-tooltip-potential">${escapeTooltipHtml(item.dropFrom)}</div>${item.routeIdentity ? `<div class="item-tooltip-potential">Route identity: ${escapeTooltipHtml(item.routeIdentity)}</div>` : ''}<div class="item-tooltip-potential">Known monsters: ${escapeTooltipHtml((item.dropMonsters || []).join(' · ') || 'Route-wide discovery')}</div></div>` : ''}
    `;

    const itemTooltipMarkup = (item, context = {}) => {
        if (item?.kind === 'equipment') return equipmentTooltipMarkup(item, context);
        if (item?.kind === 'consumable') return consumableTooltipMarkup(item, context);
        if (item?.kind === 'material') return materialTooltipMarkup(item, context);
        return '';
    };

    const recipeTooltipMarkup = (recipe, output) => {
        const discoveryState = game.getCraftingRecipeState(recipe.id);
        if (!discoveryState?.discovered) {
            return `
                <div class="item-tooltip-heading">
                    <span class="item-tooltip-icon">?</span>
                    <div>
                        <span class="item-tooltip-kicker">Arcane formula · Hidden</span>
                        <strong class="item-tooltip-title">Unknown Preparation</strong>
                        <small class="item-tooltip-level">Discovery required</small>
                    </div>
                </div>
                <p class="item-tooltip-description">The recipe’s name is veiled until the wizard follows its arcane lead.</p>
                <div class="item-tooltip-section">
                    <span class="item-tooltip-section-label">Possible discoveries</span>
                    <div class="item-tooltip-potential">${escapeTooltipHtml(discoveryState?.unlockHint || 'Explore the realms and gather rare materials.')}</div>
                </div>
                <div class="item-tooltip-status">Keep farming to reveal this formula permanently.</div>
            `;
        }
        const requirements = Object.entries(recipe.materials || {}).map(([itemId, amount]) => {
            const material = game.getItemDefinition(itemId);
            const owned = game.getMaterialCount(itemId);
            const isMissing = owned < amount;
            return `<div class="item-tooltip-material${isMissing ? ' missing' : ''}"><span>${escapeTooltipHtml(material?.name || itemId)}</span><strong>${owned} / ${amount}</strong></div>`;
        }).join('');
        const hasMaterials = Object.entries(recipe.materials || {})
            .every(([itemId, amount]) => game.getMaterialCount(itemId) >= amount);
        const hasSpace = game.hasInventorySpaceForItem(output.id);
        const status = game.canCraft(recipe)
            ? 'Ready to craft'
            : !hasMaterials
                ? 'Missing materials'
                : !hasSpace
                    ? 'Inventory full'
                    : 'Unavailable';
        const isEquipmentOutput = output.kind === 'equipment';
        const recipeTierDetail = recipe.tierLabel
            ? `Tier ${recipe.tier || 1} · ${recipe.tierLabel}`
            : 'Standard formula';
        const outputDetail = isEquipmentOutput
            ? `Equipment output · ${output.slot || 'equipment'} · ${getTooltipRarity(output)}`
            : output.gearAction
                ? `Gear action · ${output.effectLabel || 'Target enhanced gear'}`
                : `${recipeTierDetail} · ${output.duration || 0} seconds · ${output.effectLabel || 'Temporary combat bonus'}`;
        const outputSectionLabel = isEquipmentOutput
            ? 'Gear profile'
            : output.gearAction ? 'Gear action' : 'Combat effect';
        const outputEffect = isEquipmentOutput
            ? formatItemBonuses(output.bonuses)
            : output.effectLabel || formatItemBonuses(output.bonuses);
        const outputGuidance = isEquipmentOutput
            ? `Uses the current expedition level. ${output.statPool?.length || 0} stats can roll, with the slot's primary stat weighted higher.`
            : output.gearAction
                ? 'Select an enhanced item in the Character tab, then use one seal to remove its latest enhancement rank and exact roll. No Dust is refunded.'
                : `Lasts ${Number(output.duration) || 0} seconds after use.`;
        const sourceHint = recipe.discovery?.conditions?.map(condition => game.getRecipeConditionLabel(condition)).join(' or ') || 'Explore the realms';
        return `
            ${tooltipHeadingMarkup(output, `${getTooltipRarity(output)} · Craftable`, outputDetail)}
            <p class="item-tooltip-description">${escapeTooltipHtml(output.description || 'A temporary arcane preparation.')}</p>
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">${outputSectionLabel}</span>
                <div class="item-tooltip-effect">${escapeTooltipHtml(outputEffect)}</div>
                <div class="item-tooltip-potential">${escapeTooltipHtml(outputGuidance)}</div>
            </div>
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">Recipe found</span>
                <div class="item-tooltip-potential">${escapeTooltipHtml(sourceHint)}</div>
            </div>
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">Ingredients</span>
                <div class="item-tooltip-material-list">${requirements || '<div class="item-tooltip-material">No ingredients</div>'}</div>
            </div>
            <div class="item-tooltip-status">${escapeTooltipHtml(status)}</div>
        `;
    };

    const getJournalMasteryGuidance = (item, discovery, mastery) => {
        if (!mastery?.nextMilestone) {
            return {
                nextRank: 'ALL RANKS COMPLETE',
                remaining: '0 INSIGHT LEFT',
                how: 'Every permanent journal mastery bonus for this item has been claimed.'
            };
        }

        const remaining = Math.max(0, mastery.nextMilestone.points - mastery.points);
        const currentRarityIndex = game.getRarityIndex(discovery?.highestRarity);
        const nextRarity = RARITIES[currentRarityIndex + 1] || null;
        const nextRarityLabel = nextRarity?.displayName || nextRarity?.name;
        const route = item?.dropFrom || discovery?.sourceMap || 'the recorded source route';
        const rarityLead = nextRarityLabel
            ? `Record a ${nextRarityLabel} or better find`
            : 'Record a stronger roll';

        return {
            nextRank: `${mastery.nextMilestone.name.toUpperCase()} AT ${mastery.nextMilestone.points} INSIGHT`,
            remaining: `${remaining} INSIGHT LEFT`,
            how: `${rarityLead} from ${route}, or beat the best recorded roll. Higher rarity grants +2 Insight per tier; an improved roll grants at least +1.`
        };
    };

    const discoveryTooltipMarkup = (item, discovery, context = {}) => {
        const slotLabel = context.slotLabel || characterSlotMeta[item?.slot]?.label || item?.slot || 'Equipment';
        if (!discovery) {
            const possibleSources = Array.isArray(item?.dropMonsters) && item.dropMonsters.length > 0
                ? item.dropMonsters.join(' · ')
                : item?.dropFrom || 'Explore the realms';
            const specialization = EQUIPMENT_SLOT_SPECIALIZATIONS[item?.slot] || null;
            const statPool = Array.isArray(item?.statPool) && item.statPool.length > 0
                ? item.statPool.map(stat => EQUIPMENT_STAT_LABELS[stat] || stat.toUpperCase()).join(' · ')
                : 'Unknown until discovered';
            const specializationText = specialization
                ? `${specialization.label} · ${EQUIPMENT_STAT_LABELS[specialization.primaryStat] || specialization.primaryStat.toUpperCase()} primary · boosted roll range`
                : 'Unknown slot specialization';
            return `
                <div class="item-tooltip-heading">
                    <span class="item-tooltip-icon">?</span>
                    <div>
                        <span class="item-tooltip-kicker">Arcane archive · Hidden</span>
                        <strong class="item-tooltip-title">Undiscovered Equipment</strong>
                        <small class="item-tooltip-level">${escapeTooltipHtml(slotLabel)} · Discovery required</small>
                    </div>
                </div>
                <p class="item-tooltip-description">This relic’s identity remains veiled until the wizard records a first drop in the Discovery Journal.</p>
                <div class="item-tooltip-section">
                    <span class="item-tooltip-section-label">Discovery lead</span>
                    <div class="item-tooltip-stat"><span>Route</span><strong>${escapeTooltipHtml(item?.routeIdentity || item?.dropFrom || 'Unknown route')}</strong></div>
                    <div class="item-tooltip-stat"><span>Known sources</span><strong>${escapeTooltipHtml(possibleSources)}</strong></div>
                    <div class="item-tooltip-stat"><span>Slot specialty</span><strong>${escapeTooltipHtml(specializationText)}</strong></div>
                    <div class="item-tooltip-stat"><span>Possible stat pool</span><strong>${escapeTooltipHtml(statPool)}</strong></div>
                </div>
                <div class="item-tooltip-status">Farm the indicated route to reveal the name, best rarity, roll quality, and mastery track.</div>
            `;
        }

        const rarityData = game.getRarityData(discovery.highestRarity);
        const rarityLabel = rarityData.displayName || rarityData.name;
        const score = Number.isFinite(discovery.strongestRollQuality)
            ? `${discovery.strongestRollQuality}%`
            : 'Not recorded';
        const mastery = game.getEquipmentJournalMasteryState(discovery);
        const masteryTarget = mastery.nextMilestone?.points || mastery.points;
        const masteryProgress = mastery.nextMilestone
            ? `${mastery.points} / ${masteryTarget} insight`
            : `${mastery.points} insight · complete`;
        const masteryGuidance = getJournalMasteryGuidance(item, discovery, mastery);
        const nextReward = mastery.nextMilestone
            ? `${mastery.nextMilestone.name} · ${mastery.nextBonusSummary || 'Next mastery bonus pending'}`
            : `All rewards claimed · ${mastery.currentBonusSummary || 'No additional bonus'}`;
        const strongestSource = discovery.strongestRollSourceMonster && discovery.strongestRollSourceMap
            ? `${discovery.strongestRollSourceMonster} · ${discovery.strongestRollSourceMap}`
            : `${discovery.sourceMonster || 'Unknown source'} · ${discovery.sourceMap || 'Unknown route'}`;
        return `
            ${tooltipHeadingMarkup(item, `${rarityLabel} · Archive record`, `${slotLabel} · Mastery ${mastery.rank}/${mastery.maxRank}`)}
            <p class="item-tooltip-description">${escapeTooltipHtml(item.description || 'A recorded piece of arcane equipment.')}</p>
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">Discovery record</span>
                <div class="item-tooltip-stat"><span>Highest rarity</span><strong>${escapeTooltipHtml(rarityLabel)}</strong></div>
                <div class="item-tooltip-stat"><span>Strongest roll</span><strong>${escapeTooltipHtml(score)}</strong></div>
                <div class="item-tooltip-stat"><span>Route identity</span><strong>${escapeTooltipHtml(item?.routeIdentity || item?.dropFrom || 'Unknown route')}</strong></div>
                <div class="item-tooltip-stat"><span>Best find source</span><strong>${escapeTooltipHtml(strongestSource)}</strong></div>
                <div class="item-tooltip-stat"><span>First recorded</span><strong>${escapeTooltipHtml(context.formatDate?.(discovery.firstFoundAt || discovery.discoveredAt) || 'Time not recorded')}</strong></div>
            </div>
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">Journal mastery</span>
                <div class="item-tooltip-stat"><span>Rank</span><strong>${mastery.rank} / ${mastery.maxRank} · ${escapeTooltipHtml(mastery.rankName)}</strong></div>
                <div class="item-tooltip-stat"><span>Insight</span><strong>${escapeTooltipHtml(masteryProgress)}</strong></div>
                <div class="item-tooltip-stat"><span>Next rank</span><strong>${escapeTooltipHtml(masteryGuidance.nextRank)}</strong></div>
                <div class="item-tooltip-stat"><span>What's left</span><strong>${escapeTooltipHtml(masteryGuidance.remaining)}</strong></div>
                <div class="item-tooltip-potential">Next reward: ${escapeTooltipHtml(nextReward)}</div>
                <div class="item-tooltip-potential">How to earn: ${escapeTooltipHtml(masteryGuidance.how)}</div>
            </div>
            <div class="item-tooltip-status">Journal mastery grants permanent combat bonuses. Insight is earned only when this entry records a higher rarity or a stronger roll.</div>
        `;
    };

    const positionItemTooltip = () => {
        if (!tooltipElement || !tooltipState.target?.isConnected || !tooltipElement.classList.contains('visible')) return;
        const targetRect = tooltipState.target.getBoundingClientRect();
        const gap = 9;
        const viewportPadding = 8;

        // Character items have several inline actions beneath them. Prefer a
        // left/right placement so those actions remain visible, but only use a
        // side when there is enough room for a readable tooltip on that side.
        if (tooltipState.placement === 'side') {
            const rightSpace = window.innerWidth - targetRect.right - gap - viewportPadding;
            const leftSpace = targetRect.left - gap - viewportPadding;
            const minimumSideWidth = 220;
            const canPlaceRight = rightSpace >= minimumSideWidth;
            const canPlaceLeft = leftSpace >= minimumSideWidth;

            if (canPlaceRight || canPlaceLeft) {
                const placeRight = canPlaceRight && (!canPlaceLeft || rightSpace >= leftSpace);
                const availableWidth = placeRight ? rightSpace : leftSpace;
                tooltipElement.style.width = `${Math.floor(Math.min(350, availableWidth))}px`;
                const tooltipRect = tooltipElement.getBoundingClientRect();
                const left = placeRight
                    ? targetRect.right + gap
                    : targetRect.left - tooltipRect.width - gap;
                const top = Math.min(
                    window.innerHeight - tooltipRect.height - viewportPadding,
                    Math.max(viewportPadding, targetRect.top + (targetRect.height - tooltipRect.height) / 2)
                );
                tooltipElement.style.transformOrigin = placeRight ? 'left center' : 'right center';
                tooltipElement.style.left = `${Math.round(left)}px`;
                tooltipElement.style.top = `${Math.round(Math.max(viewportPadding, top))}px`;
                return;
            }
        }

        // Reset the inline width when a non-character tooltip is shown or when
        // a narrow viewport cannot fit the character tooltip beside its item.
        tooltipElement.style.width = '';
        tooltipElement.style.transformOrigin = 'bottom center';
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const left = Math.min(
            Math.max(viewportPadding, targetRect.left + (targetRect.width - tooltipRect.width) / 2),
            Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding)
        );
        const aboveTop = targetRect.top - tooltipRect.height - gap;
        const top = aboveTop >= viewportPadding
            ? aboveTop
            : Math.min(window.innerHeight - tooltipRect.height - viewportPadding, targetRect.bottom + gap);
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.max(viewportPadding, Math.round(top))}px`;
    };

    const hideItemTooltip = target => {
        if (!tooltipElement || (target && tooltipState.target !== target)) return;
        cancelTooltipHide();
        tooltipState.target = null;
        tooltipState.placement = 'auto';
        tooltipElement.style.width = '';
        tooltipElement.style.transformOrigin = 'bottom center';
        tooltipElement.classList.remove('visible');
        tooltipElement.hidden = true;
        tooltipElement.setAttribute('aria-hidden', 'true');
        tooltipElement.replaceChildren();
    };

    const bindPopupTooltip = (element, renderMarkup, rarity = 'Common', focusTarget = element, placement = 'auto') => {
        if (!tooltipElement || !element || typeof renderMarkup !== 'function') return;
        const targets = [...new Set([element, focusTarget].filter(Boolean))];
        targets.forEach(target => target.removeAttribute('title'));
        const show = () => {
            cancelTooltipHide();
            tooltipState.target = element;
            tooltipState.placement = placement;
            tooltipElement.className = `item-tooltip visible rarity-${String(rarity).toLowerCase()}`;
            tooltipElement.innerHTML = renderMarkup();
            tooltipElement.hidden = false;
            tooltipElement.setAttribute('aria-hidden', 'false');
            requestAnimationFrame(positionItemTooltip);
        };
        const hide = () => scheduleTooltipHide(element);
        targets.forEach(target => {
            target.setAttribute('aria-describedby', 'item-tooltip');
            target.addEventListener('focus', show);
            target.addEventListener('blur', hide);
        });
        element.addEventListener('pointerenter', show);
        element.addEventListener('pointerleave', hide);
    };

    tooltipElement?.addEventListener('pointerenter', cancelTooltipHide);
    tooltipElement?.addEventListener('pointerleave', () => scheduleTooltipHide());

    const bindTextTooltip = (element, getMessage, kicker = 'Interface detail') => {
        if (!element) return;
        if (!(element instanceof HTMLButtonElement)
            && !(element instanceof HTMLInputElement)
            && !(element instanceof HTMLSelectElement)
            && !(element instanceof HTMLTextAreaElement)
            && !element.hasAttribute('tabindex')) {
            element.tabIndex = 0;
        }
        bindPopupTooltip(element, () => {
            const message = String(typeof getMessage === 'function' ? getMessage() : getMessage || '').trim();
            if (!message) return '';
            return `<div class="combat-tooltip-copy"><strong>${escapeTooltipHtml(kicker)}</strong><span>${escapeTooltipHtml(message)}</span></div>`;
        });
    };

    const bindCombatTooltip = element => {
        if (!element) return;
        // Static combat labels need a tab stop so the same explanation is
        // available to keyboard users as it is to pointer users. Native
        // controls already participate in the tab order on their own.
        const isNativeFocusable = element.matches('a, button, input, select, textarea, [tabindex]');
        if (!isNativeFocusable) element.tabIndex = 0;

        // Combat explanations use the styled popup instead of the browser's
        // plain native title bubble. The live copy is supplied by game.js.
        element.removeAttribute('title');
        bindPopupTooltip(element, () => {
            const message = element.dataset.tooltip?.trim();
            if (!message) return '';
            return `<div class="combat-tooltip-copy"><strong>Combat detail</strong><span>${escapeTooltipHtml(message)}</span></div>`;
        });
    };

    document.querySelectorAll('[data-combat-tooltip-target]').forEach(bindCombatTooltip);
    document.querySelectorAll('.panel-toggle').forEach(button => {
        bindTextTooltip(button, () => `${button.getAttribute('aria-label') || 'Toggle panel'}.`, 'Panel control');
    });
    const activityDragHandle = document.querySelector('[data-drag-handle="activity-panel"]');
    bindTextTooltip(activityDragHandle, 'Drag to move the combat log.', 'Panel control');

    const upgradeTooltipMarkup = element => {
        const data = element?.dataset || {};
        const rank = Number(data.upgradeRank) || 0;
        const costLabel = data.upgradeCostLabel || `${Number(data.upgradeCost) || 0} ${data.upgradeResource || 'Resource'}`;
        const stepLabel = data.upgradeCostStepLabel || `${Number(data.upgradeCostStep) || 0} ${data.upgradeResource || 'Resource'}`;
        const balanceLabel = data.upgradeBalanceLabel || '0 available';
        const resource = data.upgradeResource || 'Resource';
        const maxed = data.upgradeMaxed === 'true';
        const affordable = data.upgradeAffordable === 'true';
        const status = maxed
            ? 'Maximum upgrade reached'
            : affordable
                ? 'Ready to purchase'
                : `Need ${data.upgradeMissingLabel || 'more resources'}`;
        return `
            <div class="item-tooltip-heading">
                <span class="item-tooltip-icon">✦</span>
                <div>
                    <span class="item-tooltip-kicker">Permanent upgrade · ${escapeTooltipHtml(resource)}</span>
                    <strong class="item-tooltip-title">${escapeTooltipHtml(data.upgradeName || 'Upgrade')}</strong>
                    <small class="item-tooltip-level">Rank ${rank}${maxed ? ' · MAXED' : ` · Next rank ${rank + 1}`}</small>
                </div>
            </div>
            <p class="item-tooltip-description">Spend one or more map currencies on a permanent combat improvement. Costs rise with every rank, and convergence upgrades require a full biome rotation.</p>
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">Upgrade details</span>
                <div class="item-tooltip-stat"><span>Current rank</span><strong>${rank}</strong></div>
                <div class="item-tooltip-stat"><span>${maxed ? 'Final effect' : 'Next effect'}</span><strong>${escapeTooltipHtml(data.upgradeEffect || '—')}</strong></div>
                <div class="item-tooltip-stat"><span>${maxed ? 'Status' : 'Current cost'}</span><strong>${maxed ? 'MAXED' : escapeTooltipHtml(costLabel)}</strong></div>
                ${maxed ? '' : `<div class="item-tooltip-potential">Cost growth: ${escapeTooltipHtml(stepLabel)} per rank.</div>`}
            </div>
            <div class="item-tooltip-status">${escapeTooltipHtml(status)}${!maxed ? ` · ${escapeTooltipHtml(balanceLabel)} available` : ''}</div>
        `;
    };

    document.querySelectorAll('.upgrade-tooltip-target').forEach(target => {
        const button = target.querySelector('.upgrade-button');
        if (!button) return;
        bindPopupTooltip(target, () => upgradeTooltipMarkup(button), 'Common', button);
    });

    const bindItemTooltip = (element, item, context = {}) => {
        if (!item) return;
        element.removeAttribute('title');
        if (!(element instanceof HTMLButtonElement) && !(element instanceof HTMLInputElement)) {
            element.tabIndex = 0;
        }
        bindPopupTooltip(
            element,
            () => itemTooltipMarkup(item, context),
            item.rarity,
            element,
            context.character ? 'side' : 'auto'
        );
    };

    window.addEventListener('resize', positionItemTooltip);
    document.addEventListener('scroll', positionItemTooltip, true);

    const showEnhancementRoll = (itemId, roll, range = {}, critical = false) => {
        const popup = document.getElementById('enhancement-roll-popup');
        const item = game.getItemInstance(itemId);
        if (!popup || !item || !Number.isFinite(Number(roll))) return;

        const valueElement = popup.querySelector('.enhancement-roll-value');
        const itemElement = popup.querySelector('.enhancement-roll-item');
        const kickerElement = popup.querySelector('.enhancement-roll-kicker');
        const criticalElement = popup.querySelector('.enhancement-roll-critical');
        if (!valueElement || !itemElement || !kickerElement || !criticalElement) return;

        const animationId = ++enhancementRollAnimationId;
        enhancementRollAnimating = true;
        const minPercent = Math.max(0.1, Number(range.min) || 1);
        const maxPercent = Math.max(minPercent, Number(range.max) || 10);
        const finalPercent = Math.max(0, Number(roll) * 100);
        const startedAt = performance.now();
        const spinDuration = 2000;
        let finishTimer = null;

        itemElement.textContent = item.name;
        kickerElement.textContent = critical ? 'ARCANE FORGE · CRITICAL ROLLING' : 'ARCANE FORGE · ROLLING';
        criticalElement.textContent = critical ? '✦ CRITICAL HIT · RARE FORGE SURGE' : '';
        popup.classList.toggle('critical', critical);
        popup.classList.remove('settled');
        popup.hidden = false;
        requestAnimationFrame(() => popup.classList.add('visible'));

        const finishRoll = () => {
            if (animationId !== enhancementRollAnimationId) return;
            valueElement.textContent = `+${finalPercent.toFixed(1)}%`;
            kickerElement.textContent = critical ? '✦ CRITICAL HIT · ROLL LOCKED' : 'ENHANCEMENT ROLL · LOCKED';
            popup.classList.add('settled');
            finishTimer = window.setTimeout(() => {
                if (animationId !== enhancementRollAnimationId) return;
                popup.classList.remove('visible', 'settled');
                window.setTimeout(() => {
                    if (animationId === enhancementRollAnimationId) popup.hidden = true;
                }, 220);
                enhancementRollAnimating = false;
            }, 1450);
        };

        const spin = now => {
            if (animationId !== enhancementRollAnimationId) return;
            const progress = Math.min(1, (now - startedAt) / spinDuration);
            const eased = progress >= 1 ? 1 : 1 - Math.pow(1 - progress, 2);
            const jitter = Math.sin(now * 0.045) * (1 - eased) * 0.35;
            const displayedPercent = progress >= 1
                ? finalPercent
                : minPercent + Math.random() * (maxPercent - minPercent) + jitter;
            valueElement.textContent = `+${Math.max(minPercent, Math.min(maxPercent, displayedPercent)).toFixed(1)}%`;
            if (progress < 1) {
                requestAnimationFrame(spin);
            } else {
                finishRoll();
            }
        };

        if (finishTimer) window.clearTimeout(finishTimer);
        requestAnimationFrame(spin);
    };

    const performGearEnhancement = itemId => {
        if (enhancementRollAnimating || !game.enhanceGear(itemId)) return false;
        const enhancementState = game.getGearEnhancementState(itemId);
        const roll = enhancementState?.enhancementRolls?.at(-1);
        renderCharacterPanel();
        if (Number.isFinite(Number(roll))) {
            const critical = enhancementState.lastRollCritical === true;
            showEnhancementRoll(itemId, roll, critical
                ? {
                    min: enhancementState.criticalRollMinPercent,
                    max: enhancementState.criticalRollMaxPercent
                }
                : {
                    min: enhancementState.nextRollMinPercent,
                    max: enhancementState.nextRollMaxPercent
                }, critical);
        }
        return true;
    };

    const appendGearEnhancementButton = (container, item) => {
        if (!container || item?.kind !== 'equipment') return;
        const enhancementState = game.getGearEnhancementState(item.id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gear-inline-enhance';
        button.draggable = false;
        button.disabled = !enhancementState || enhancementState.maxed || !enhancementState.canAfford;
        button.textContent = enhancementState?.maxed
            ? 'MAX BONUS'
            : `ENHANCE · ${enhancementState?.cost?.toLocaleString() || 0} ${SALVAGE_CURRENCY.shortName}`;
        const status = enhancementState?.maxed
            ? `Maximum enhancement ranks reached (+${enhancementState.bonusPercent}% total from ${enhancementState.maxEnhancements} rolls).`
            : enhancementState?.canAfford
                ? `Spend ${enhancementState.cost.toLocaleString()} ${SALVAGE_CURRENCY.name} to gamble a new +${enhancementState.nextRollMinPercent}–${enhancementState.nextRollMaxPercent}% roll onto this gear. A ${enhancementState.criticalChancePercent}% critical hit can surge to +${enhancementState.criticalRollMinPercent}–${enhancementState.criticalRollMaxPercent}%.`
                : `Need ${Math.max(0, enhancementState?.cost - enhancementState?.balance || 0).toLocaleString()} more ${SALVAGE_CURRENCY.name}. Salvage spare gear to earn it.`;
        button.setAttribute('aria-label', `${button.textContent} ${item.name}. ${status}`);
        bindTextTooltip(button, status, 'Gear enhancement');
        button.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            performGearEnhancement(item.id);
        };
        container.appendChild(button);
    };

    const renderGearComparison = () => {
        const comparisonContainer = document.getElementById('gear-comparison');
        if (!comparisonContainer) return;

        const selectedItem = getOwnedEquipmentItem(selectedEquipmentId);
        if (!selectedItem) {
            selectedEquipmentId = null;
            comparisonContainer.innerHTML = `
                <div class="gear-comparison-empty">
                    <span class="gear-comparison-empty-icon">✺</span>
                    <div><strong>GEAR FORGE · SELECT GEAR</strong><small>Click any gear card above to reveal EQUIP and ENHANCE controls. Enhance with Arcane Dust from the Materials tab.</small></div>
                </div>
            `;
            return;
        }

        const slotMeta = characterSlotMeta[selectedItem.slot] || { label: selectedItem.slot, glyph: selectedItem.icon || '◆' };
        const equippedItem = game.getItemInstance(game.equipment[selectedItem.slot]);
        const isCurrentlyEquipped = equippedItem?.id === selectedItem.id;
        const selectedBonuses = selectedItem.bonuses || {};
        const equippedBonuses = equippedItem?.bonuses || {};
        const statEntries = gearStatMeta.filter(stat =>
            Number(selectedBonuses[stat.id] || 0) !== 0 || Number(equippedBonuses[stat.id] || 0) !== 0
        );
        const statRows = statEntries.length > 0
            ? statEntries.map(stat => {
                const selectedValue = Number(selectedBonuses[stat.id] || 0);
                const equippedValue = Number(equippedBonuses[stat.id] || 0);
                const delta = selectedValue - equippedValue;
                const deltaClass = Math.abs(delta) < 0.005 ? 'neutral' : delta > 0 ? 'positive' : 'negative';
                return `
                    <div class="gear-comparison-row">
                        <span>${stat.label}</span>
                        <strong>${formatGearBonus(stat, selectedValue)}</strong>
                        <span class="gear-current-value">${equippedItem ? formatGearBonus(stat, equippedValue) : '—'}</span>
                        <strong class="gear-delta ${deltaClass}">${formatGearBonus(stat, delta)}</strong>
                    </div>
                `;
            }).join('')
            : `<div class="gear-comparison-no-stats">No combat bonuses on this item.</div>`;

        const gains = statEntries.filter(stat => Number(selectedBonuses[stat.id] || 0) - Number(equippedBonuses[stat.id] || 0) > 0.005).length;
        const losses = statEntries.filter(stat => Number(selectedBonuses[stat.id] || 0) - Number(equippedBonuses[stat.id] || 0) < -0.005).length;
        const recentUpgrade = isCurrentlyEquipped
            && lastEquipmentUpgrade?.itemId === selectedItem.id
            ? lastEquipmentUpgrade
            : null;
        const comparisonSummary = isCurrentlyEquipped
            ? recentUpgrade
                ? `EQUIPPED · ${recentUpgrade.deltaText}${recentUpgrade.displacedItemName ? ` · ${recentUpgrade.displacedItemName} returned to inventory` : ''}`
                : 'CURRENTLY EQUIPPED · Select another item to compare'
            : equippedItem
                ? `${gains ? `${gains} increase${gains === 1 ? '' : 's'}` : 'No increases'}${losses ? ` · ${losses} decrease${losses === 1 ? '' : 's'}` : ''}`
                : `No ${slotMeta.label.toLowerCase()} equipped · all listed bonuses are gains`;
        const canEquipUpgrade = !isCurrentlyEquipped && game.getInventoryIndex(selectedItem.id) >= 0;
        const equipActionLabel = isCurrentlyEquipped ? 'EQUIPPED' : 'EQUIP UPGRADE';
        const equipActionNote = isCurrentlyEquipped
            ? 'This gear is already in its matching loadout slot.'
            : equippedItem
                ? `Replaces ${equippedItem.name} · displaced gear returns to inventory.`
                : `Fills the empty ${slotMeta.label.toLowerCase()} slot.`;
        const enhancementState = game.getGearEnhancementState(selectedItem.id);
        const canEnhance = Boolean(enhancementState && !enhancementState.maxed && enhancementState.canAfford);
        const enhancementLabel = enhancementState?.maxed
            ? 'MAX BONUS'
            : `ENHANCE · ${enhancementState?.cost?.toLocaleString() || 0} ${SALVAGE_CURRENCY.shortName}`;
        const enhancementNote = enhancementState?.maxed
            ? `Maximum enhancement ranks reached: +${enhancementState.bonusPercent}% total from ${enhancementState.maxEnhancements} rolls.`
            : `${enhancementState?.balance?.toLocaleString() || 0} ${SALVAGE_CURRENCY.name} available · next roll is randomly +${enhancementState?.nextRollMinPercent || 1}–${enhancementState?.nextRollMaxPercent || 10}%; ${enhancementState?.criticalChancePercent || 5}% critical chance for +${enhancementState?.criticalRollMinPercent || 8}–${enhancementState?.criticalRollMaxPercent || 15}%; each rank costs more.`;
        const reversalCount = gearRollbackDefinition ? game.getConsumableCount(gearRollbackDefinition.id) : 0;
        const canReverse = Boolean(gearRollbackDefinition && selectedItem.enhancementCount > 0 && reversalCount > 0);
        const reversalLabel = gearRollbackDefinition
            ? `REVERSE LAST ROLL · ${reversalCount} SEAL${reversalCount === 1 ? '' : 'S'}`
            : 'REVERSE LAST ROLL';
        const reversalNote = !gearRollbackDefinition
            ? 'Reversal Seal unavailable.'
            : selectedItem.enhancementCount <= 0
                ? 'Enhance this item at least once before reversing its latest roll.'
                : reversalCount <= 0
                    ? 'Craft an Enhancement Reversal Seal in Materials to undo the latest roll.'
                    : `Consumes 1 seal and removes the latest +${selectedItem.enhancementRolls?.at(-1)
                        ? game.formatEnhancementRollPercent(selectedItem.enhancementRolls.at(-1))
                        : '1.0%'} roll exactly. No Dust is refunded.`;

        comparisonContainer.innerHTML = `
            <div class="gear-comparison-heading">
                <div>
                    <h4 class="character-section-title">Gear Comparison</h4>
                    <small>Matching slot · ${slotMeta.label}</small>
                </div>
                <button class="gear-comparison-clear" type="button" aria-label="Clear selected gear">CLEAR</button>
            </div>
            <div class="gear-comparison-items">
                <div class="gear-comparison-item selected${selectedItem.exceptional ? ' exceptional' : ''} rarity-${selectedItem.rarity.toLowerCase()}" aria-label="Selected gear${selectedItem.exceptional ? ', exceptional roll quality' : ''}">
                    ${itemArtMarkup(selectedItem, slotMeta.glyph, 'gear-comparison-icon item-image')}
                    <span class="gear-comparison-copy"><strong>${selectedItem.name}</strong><small>SELECTED · ${selectedItem.rarity} · LEVEL ${selectedItem.level} · +${selectedItem.enhancementCount || 0} ENH · +${getEnhancementPercent(selectedItem)}%</small>${equipmentAffixMarkup(selectedItem, 'comparison')}</span>
                </div>
                <span class="gear-comparison-arrow" aria-hidden="true">VS</span>
                <div class="gear-comparison-item current${equippedItem ? ` rarity-${equippedItem.rarity.toLowerCase()}${equippedItem.exceptional ? ' exceptional' : ''}` : ' empty'}" aria-label="Currently equipped gear">
                    ${equippedItem
                        ? `${itemArtMarkup(equippedItem, slotMeta.glyph, 'gear-comparison-icon item-image')}<span class="gear-comparison-copy"><strong>${equippedItem.name}</strong><small>${isCurrentlyEquipped ? 'CURRENTLY EQUIPPED' : `${equippedItem.rarity} · LEVEL ${equippedItem.level}`} · +${equippedItem.enhancementCount || 0} ENH · +${getEnhancementPercent(equippedItem)}%</small>${equipmentAffixMarkup(equippedItem, 'comparison')}</span>`
                        : `<span class="gear-comparison-icon">${slotMeta.glyph}</span><span class="gear-comparison-copy"><strong>Nothing equipped</strong><small>${slotMeta.label.toUpperCase()} SLOT · EMPTY</small></span>`}
                </div>
            </div>
            <div class="gear-comparison-table" role="table" aria-label="Combat bonus comparison">
                <div class="gear-comparison-row gear-comparison-labels"><span>STAT</span><span>SELECTED</span><span>EQUIPPED</span><span>CHANGE</span></div>
                ${statRows}
            </div>
            <div class="gear-comparison-actions">
                <div class="gear-comparison-action-buttons">
                    <button class="gear-comparison-equip" type="button" ${canEquipUpgrade ? '' : 'disabled'} aria-label="${equipActionLabel} ${selectedItem.name}">${equipActionLabel}</button>
                    <button class="gear-comparison-enhance" type="button" ${canEnhance ? '' : 'disabled'} aria-label="${enhancementLabel} ${selectedItem.name}">${enhancementLabel}</button>
                    <button class="gear-comparison-reverse" type="button" ${canReverse ? '' : 'disabled'} aria-label="${reversalLabel} on ${selectedItem.name}. ${reversalNote}">${reversalLabel}</button>
                </div>
                <span class="gear-comparison-action-note">${equipActionNote}<br>${enhancementNote}<br>${reversalNote}</span>
            </div>
            <div class="gear-comparison-summary ${losses > 0 ? 'has-loss' : ''}">${comparisonSummary}</div>
        `;
        bindItemTooltip(
            comparisonContainer.querySelector('.gear-comparison-item.selected'),
            selectedItem,
            { character: true }
        );
        if (equippedItem) {
            bindItemTooltip(
                comparisonContainer.querySelector('.gear-comparison-item.current'),
                equippedItem,
                { equipped: isCurrentlyEquipped, character: true }
            );
        }
        comparisonContainer.querySelector('.gear-comparison-equip')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (!canEquipUpgrade) return;

            const deltaEntries = statEntries
                .map(stat => ({
                    stat,
                    delta: Number(selectedBonuses[stat.id] || 0) - Number(equippedBonuses[stat.id] || 0)
                }))
                .filter(({ delta }) => Math.abs(delta) >= 0.005);
            lastEquipmentUpgrade = {
                itemId: selectedItem.id,
                deltaText: deltaEntries.length > 0
                    ? deltaEntries.map(({ stat, delta }) => `${stat.label} ${formatGearBonus(stat, delta)}`).join(' · ')
                    : 'No combat stat change',
                displacedItemName: equippedItem?.name || null
            };
            if (!game.equipUpgrade(selectedItem.id)) {
                lastEquipmentUpgrade = null;
                renderCharacterPanel();
                return;
            }
            // The inventory-changed event also refreshes the panel, but this
            // direct refresh keeps the new equipped state visible immediately.
            renderCharacterPanel();
        });
        const reverseButton = comparisonContainer.querySelector('.gear-comparison-reverse');
        if (reverseButton) {
            bindTextTooltip(reverseButton, reversalNote, 'Enhancement reversal');
            reverseButton.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                if (!canReverse || !gearRollbackDefinition) return;
                if (game.useGearRollbackConsumable(gearRollbackDefinition.id, selectedItem.id)) renderCharacterPanel();
            });
        }
        comparisonContainer.querySelector('.gear-comparison-enhance')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            performGearEnhancement(selectedItem.id);
        });
        comparisonContainer.querySelector('.gear-comparison-clear').onclick = () => {
            selectedEquipmentId = null;
            renderCharacterPanel();
        };
    };

    const selectEquipmentItem = itemId => {
        if (!getOwnedEquipmentItem(itemId)) return;
        if (selectedEquipmentId !== itemId) lastEquipmentUpgrade = null;
        selectedEquipmentId = selectedEquipmentId === itemId ? null : itemId;
        if (!selectedEquipmentId) lastEquipmentUpgrade = null;
        renderCharacterPanel();
    };

    const bindEquipmentSelection = (element, item) => {
        if (!item || item.kind !== 'equipment') return;
        const isSelected = () => selectedEquipmentId === item.id;
        element.classList.toggle('selected', isSelected());
        element.setAttribute('aria-pressed', String(isSelected()));
        element.onclick = event => {
            const actionButton = event.target instanceof Element
                ? event.target.closest('button')
                : null;
            if (actionButton && actionButton !== element) {
                // Nested controls such as Enhance, Protect, Salvage, and Use
                // must not inherit a pending card-selection click.
                window.clearTimeout(equipmentClickTimer);
                equipmentClickTimer = null;
                lastEquipmentClick = { itemId: null, timestamp: 0 };
                return;
            }

            // Inventory gear is draggable and the first click also rebuilds the
            // panel. Defer that selection render long enough for a second click
            // to arrive on the same card, including base starter gear cards.
            const now = performance.now();
            const isDoubleClick = lastEquipmentClick.itemId === item.id
                && now - lastEquipmentClick.timestamp < 500;
            lastEquipmentClick = { itemId: item.id, timestamp: now };
            window.clearTimeout(equipmentClickTimer);

            if (isDoubleClick) {
                event.preventDefault();
                event.stopPropagation();
                lastEquipmentClick = { itemId: null, timestamp: 0 };
                lastEquipmentUpgrade = null;
                if (game.toggleEquipment(item.id)) renderCharacterPanel();
                return;
            }

            equipmentClickTimer = window.setTimeout(() => {
                equipmentClickTimer = null;
                selectEquipmentItem(item.id);
            }, 240);
        };
        if (!(element instanceof HTMLButtonElement)) {
            element.setAttribute('role', 'button');
            element.tabIndex = 0;
            element.onkeydown = event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                selectEquipmentItem(item.id);
            };
        }
    };

    const readDraggedLocation = event => {
        try {
            return JSON.parse(event.dataTransfer?.getData('text/plain') || '');
        } catch (error) {
            return null;
        }
    };

    let activeDragLocation = null;

    const locationsMatch = (first, second) => first?.type === second?.type
        && (first.type === 'inventory'
            ? first.index === second.index
            : first.type === 'equipment' && first.slot === second.slot);

    const canDropAt = (source, destination) => {
        if (!source || !destination || locationsMatch(source, destination)) return false;

        const sourceItem = game.getLocationItem(source);
        if (!sourceItem) return false;

        if (source.type === 'inventory' && destination.type === 'inventory') {
            return Number.isInteger(source.index)
                && Number.isInteger(destination.index)
                && source.index >= 0
                && source.index < game.inventory.length
                && destination.index >= 0
                && destination.index < game.inventory.length;
        }

        if (source.type === 'inventory' && destination.type === 'equipment') {
            return sourceItem.slot === destination.slot
                && Object.prototype.hasOwnProperty.call(game.equipment, destination.slot);
        }

        if (source.type === 'equipment' && destination.type === 'inventory') {
            if (!Number.isInteger(destination.index)
                || destination.index < 0
                || destination.index >= game.inventory.length) {
                return false;
            }
            const displacedItem = game.getLocationItem(destination);
            return !displacedItem || displacedItem.slot === source.slot;
        }

        return false;
    };

    const readElementLocation = element => element.dataset.locationType === 'inventory'
        ? { type: 'inventory', index: Number(element.dataset.inventoryIndex) }
        : { type: 'equipment', slot: element.dataset.equipmentSlot };

    const clearDragHighlights = () => {
        activeDragLocation = null;
        document.body.classList.remove('inventory-dragging');
        document.querySelectorAll('[data-location-type]').forEach(target => {
            target.classList.remove('drop-preview', 'drop-target', 'drop-invalid', 'dragging');
            target.setAttribute('aria-grabbed', 'false');
        });
    };

    const highlightValidDropTargets = () => {
        if (!activeDragLocation) return;
        document.body.classList.add('inventory-dragging');
        document.querySelectorAll('[data-location-type]').forEach(target => {
            const destination = readElementLocation(target);
            const canPreviewDrop = destination.type !== 'inventory'
                && canDropAt(activeDragLocation, destination);
            target.classList.toggle('drop-preview', canPreviewDrop);
        });
    };

    const bindMovableLocation = (element, location, item) => {
        element.dataset.locationType = location.type;
        if (location.type === 'inventory') element.dataset.inventoryIndex = String(location.index);
        if (location.type === 'equipment') element.dataset.equipmentSlot = location.slot;
        element.draggable = Boolean(item);
        element.setAttribute('aria-grabbed', 'false');

        element.ondragstart = event => {
            if (!item) {
                event.preventDefault();
                return;
            }
            activeDragLocation = location;
            event.dataTransfer.setData('text/plain', JSON.stringify(location));
            event.dataTransfer.effectAllowed = 'move';
            element.setAttribute('aria-grabbed', 'true');
            element.classList.add('dragging');
            highlightValidDropTargets();
        };
        element.ondragend = clearDragHighlights;
        element.ondragover = event => {
            const source = activeDragLocation || readDraggedLocation(event);
            const canDrop = canDropAt(source, location);
            element.classList.toggle('drop-target', canDrop);
            element.classList.toggle('drop-invalid', Boolean(source) && !canDrop);
            if (!canDrop) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        };
        element.ondragleave = event => {
            if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
            element.classList.remove('drop-target', 'drop-invalid');
        };
        element.ondrop = event => {
            const source = activeDragLocation || readDraggedLocation(event);
            const canDrop = canDropAt(source, location);
            if (!canDrop) {
                clearDragHighlights();
                return;
            }
            event.preventDefault();
            game.moveItem(source, location);
            clearDragHighlights();
            renderCharacterPanel();
        };
    };

    const getInventoryEntries = () => {
        const entries = game.inventory.map((itemId, index) => ({
            itemId,
            index,
            item: game.getLocationItem({ type: 'inventory', index })
        }));
        const visibleEntries = inventoryFilter === 'all'
            ? entries
            : entries.filter(entry => !entry.item || entry.item.kind === inventoryFilter);
        const entriesForView = inventoryFilter === 'all'
            ? visibleEntries
            : [
                ...visibleEntries.filter(entry => entry.item),
                ...visibleEntries.filter(entry => !entry.item).slice(0, 1)
            ];
        const compareText = (first, second) => String(first.item?.name || '').localeCompare(String(second.item?.name || ''));

        return entriesForView.sort((first, second) => {
            if (!first.item && !second.item) return first.index - second.index;
            if (!first.item) return 1;
            if (!second.item) return -1;
            if (inventorySort === 'rarity') {
                const rarityDelta = game.getRarityIndex(second.item.rarity) - game.getRarityIndex(first.item.rarity);
                if (rarityDelta !== 0) return rarityDelta;
            } else if (inventorySort === 'level') {
                const levelDelta = (Number(second.item.level) || 1) - (Number(first.item.level) || 1);
                if (levelDelta !== 0) return levelDelta;
            } else if (inventorySort === 'slot') {
                const firstSlotIndex = inventorySlotOrder.indexOf(first.item.slot || '');
                const secondSlotIndex = inventorySlotOrder.indexOf(second.item.slot || '');
                const slotDelta = (firstSlotIndex < 0 ? inventorySlotOrder.length : firstSlotIndex)
                    - (secondSlotIndex < 0 ? inventorySlotOrder.length : secondSlotIndex);
                if (slotDelta !== 0) return slotDelta;
            } else if (inventorySort === 'newest') {
                const newestDelta = (Number(second.item.acquiredAt) || 0) - (Number(first.item.acquiredAt) || 0);
                if (newestDelta !== 0) return newestDelta;
            } else if (inventorySort === 'manual') {
                return first.index - second.index;
            }
            return compareText(first, second) || first.index - second.index;
        });
    };

    const syncInventoryControls = () => {
        const sortSelect = document.getElementById('inventory-sort');
        if (sortSelect) sortSelect.value = inventorySort;
        document.querySelectorAll('[data-inventory-filter]').forEach(button => {
            const isActive = button.dataset.inventoryFilter === inventoryFilter;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
        if (autoSalvageNonExceptionalToggle) {
            autoSalvageNonExceptionalToggle.checked = game.autoSalvageNonExceptional === true;
            autoSalvageNonExceptionalToggle.setAttribute('aria-label', autoSalvageNonExceptionalToggle.checked
                ? 'Disable automatic salvage of non-exceptional gear'
                : 'Enable automatic salvage of non-exceptional gear');
        }
        if (autoSalvageStatus) {
            autoSalvageStatus.textContent = game.autoSalvageNonExceptional === true
                ? 'ACTIVE · NEW GEAR IS SALVAGED · EXCEPTIONAL FINDS KEPT'
                : 'OFF · NEW GEAR STAYS IN INVENTORY';
        }
    };

    const renderConsumableLoadout = () => {
        const slotsContainer = document.getElementById('consumable-loadout-slots');
        if (!slotsContainer) return;
        const state = game.getConsumableLoadoutState();
        const countLabel = document.getElementById('consumable-loadout-count');
        const nextLabel = document.getElementById('consumable-loadout-next');
        const upgradeButton = document.getElementById('consumable-loadout-upgrade-button');
        if (countLabel) countLabel.textContent = `${state.equipped.length} / ${state.slots} EQUIPPED · ${state.slots} / ${state.maxSlots} SLOTS`;
        if (nextLabel) {
            nextLabel.textContent = state.upgrade.maxed
                ? 'The arcana rack has reached its three-slot limit.'
                : `${state.upgrade.next.name} · ${state.upgrade.costLabel}${state.upgrade.canAfford ? ' · READY' : ` · NEED ${state.upgrade.missingCostLabel}`}`;
        }
        if (upgradeButton) {
            upgradeButton.disabled = state.upgrade.maxed || !state.upgrade.canAfford;
            upgradeButton.textContent = state.upgrade.maxed ? 'MAXED' : `UPGRADE TO ${state.upgrade.nextSlots}`;
            upgradeButton.setAttribute('aria-label', state.upgrade.maxed
                ? 'Consumable loadout is maxed at three slots'
                : `Upgrade consumable loadout to ${state.upgrade.nextSlots} slots for ${state.upgrade.costLabel}`);
            upgradeButton.title = state.upgrade.maxed
                ? 'Maximum consumable loadout reached.'
                : state.upgrade.canAfford
                    ? `Purchase ${state.upgrade.next.name}.`
                    : `Need ${state.upgrade.missingCostLabel}.`;
            upgradeButton.onclick = () => {
                if (game.purchaseConsumableLoadoutUpgrade()) renderCharacterPanel();
            };
        }

        slotsContainer.replaceChildren();
        for (let index = 0; index < state.maxSlots; index++) {
            const item = state.equipped[index] || null;
            const slot = document.createElement('div');
            slot.className = `consumable-loadout-slot${index >= state.slots ? ' locked' : item ? ` filled rarity-${item.rarity.toLowerCase()}` : ' empty'}`;
            if (index >= state.slots) {
                slot.setAttribute('aria-label', `Consumable loadout slot ${index + 1} is locked. Upgrade the rack to unlock it.`);
                slot.innerHTML = `<div class="consumable-loadout-item"><span class="consumable-loadout-icon">▣</span><span><strong>SLOT ${index + 1} LOCKED</strong><small>UPGRADE THE RACK</small></span></div><span class="consumable-loadout-status">AVAILABLE AT ${index + 1} SLOTS</span>`;
            } else if (!item) {
                slot.setAttribute('aria-label', `Consumable loadout slot ${index + 1} is empty. Equip a timed preparation from inventory.`);
                slot.innerHTML = `<div class="consumable-loadout-item"><span class="consumable-loadout-icon">＋</span><span><strong>EMPTY PREPARATION</strong><small>SELECT FROM INVENTORY</small></span></div><span class="consumable-loadout-status">SLOT ${index + 1} READY</span>`;
            } else {
                const activeText = item.active > 0
                    ? `ACTIVE · ${Math.ceil(item.active)}s`
                    : item.stackCount > 0
                        ? `READY · ×${item.stackCount} IN STOCK`
                        : item.autoUse ? 'NO STOCK · AUTO-USE ARMED' : 'NO STOCK · RESTOCK TO USE';
                slot.setAttribute('aria-label', `${item.name} preparation slot ${index + 1}. ${activeText}. ${item.autoUse ? 'Auto-use is armed.' : 'Auto-use is off.'}`);
                slot.innerHTML = `
                    <div class="consumable-loadout-item">
                        ${itemArtMarkup(item, item.icon, 'consumable-loadout-icon item-image')}
                        <span><strong>${item.name}</strong><small>${item.effectLabel}</small></span>
                    </div>
                    <span class="consumable-loadout-status">${activeText}</span>
                    <label class="consumable-loadout-auto"><input type="checkbox" ${item.autoUse ? 'checked' : ''}> AUTO-USE ON EXPIRY</label>
                    <button class="consumable-loadout-remove" type="button">UNEQUIP</button>
                `;
                const autoToggle = slot.querySelector('input');
                autoToggle.setAttribute('aria-label', `Auto-use ${item.name} when its effect expires`);
                autoToggle.onchange = () => game.setConsumableAutoUse(item.id, autoToggle.checked);
                const removeButton = slot.querySelector('.consumable-loadout-remove');
                removeButton.setAttribute('aria-label', `Unequip ${item.name}`);
                removeButton.onclick = () => {
                    if (game.unequipConsumable(item.id)) renderCharacterPanel();
                };
                bindItemTooltip(slot, item, { stackCount: item.stackCount, character: true });
            }
            slotsContainer.appendChild(slot);
        }
    };

    const renderCharacterPanel = () => {
        hideItemTooltip();
        const slotContainer = document.getElementById('equipment-slots');
        const inventoryContainer = document.getElementById('character-inventory');
        if (!slotContainer || !inventoryContainer || !game.wizard) return;

        const effectiveStats = game.wizard.getEffectiveStats();
        document.getElementById('character-level').textContent = `LEVEL ${game.wizard.level}`;
        const characterTitle = document.getElementById('character-title');
        const characterTitleNotices = getNewTabUnlocks('character')
            .filter(notice => notice.id.startsWith('hero-title:'));
        const displayTitle = game.getDisplayTitle(game.wizard.level);
        if (characterTitle) characterTitle.textContent = displayTitle;
        const characterTitleNotice = document.getElementById('character-title-notice');
        if (characterTitleNotice) {
            characterTitleNotice.hidden = characterTitleNotices.length === 0;
            characterTitleNotice.textContent = characterTitleNotices.length > 1
                ? `NEW · ${characterTitleNotices.length}`
                : 'NEW';
            characterTitleNotice.setAttribute('aria-label', `${characterTitleNotices.length} new hero title${characterTitleNotices.length === 1 ? '' : 's'}`);
            const acknowledgeCharacterTitles = () => {
                acknowledgeUnlocks('character', characterTitleNotices.map(notice => notice.id));
                renderCharacterPanel();
            };
            characterTitleNotice.onpointerenter = acknowledgeCharacterTitles;
            characterTitleNotice.onclick = acknowledgeCharacterTitles;
        }
        document.getElementById('character-stat-hp').textContent = Math.floor(effectiveStats.maxHp);
        document.getElementById('character-stat-atk').textContent = Math.floor(effectiveStats.atk);
        document.getElementById('character-stat-spd').textContent = effectiveStats.speed.toFixed(1);
        document.getElementById('character-stat-crit').textContent = `${Math.round(effectiveStats.crit * 100)}%`;
        const characterCritDamage = document.getElementById('character-stat-crit-damage');
        if (characterCritDamage) characterCritDamage.textContent = `${effectiveStats.critDamage.toFixed(1)}×`;
        const inventoryExpansion = game.getInventoryExpansionState();
        document.getElementById('inventory-count').textContent = `${inventoryExpansion.used} / ${inventoryExpansion.capacity} USED`;
        const capacityMilestone = document.getElementById('inventory-capacity-milestone');
        const capacityNext = document.getElementById('inventory-capacity-next');
        const expandInventoryButton = document.getElementById('inventory-expand-button');
        if (capacityMilestone) {
            capacityMilestone.textContent = inventoryExpansion.maxed
                ? `${inventoryExpansion.capacity} SLOTS · MAX CAPACITY`
                : `${inventoryExpansion.capacity} → ${inventoryExpansion.nextCapacity} SLOTS`;
        }
        if (capacityNext) {
            capacityNext.textContent = inventoryExpansion.maxed
                ? 'The expedition vault has reached its final capacity.'
                : `${inventoryExpansion.next.name} · ${inventoryExpansion.costLabel}${inventoryExpansion.canAfford ? ' · READY' : ` · NEED ${inventoryExpansion.missingCostLabel}`}`;
        }
        if (expandInventoryButton) {
            expandInventoryButton.disabled = !inventoryExpansion.canAfford;
            expandInventoryButton.textContent = inventoryExpansion.maxed
                ? 'MAXED'
                : `EXPAND +${inventoryExpansion.next.slots}`;
            expandInventoryButton.setAttribute('aria-label', inventoryExpansion.maxed
                ? 'Inventory capacity is maxed'
                : `Purchase ${inventoryExpansion.next.name} for ${inventoryExpansion.costLabel}`);
            expandInventoryButton.title = inventoryExpansion.maxed
                ? 'Maximum inventory capacity reached.'
                : inventoryExpansion.canAfford
                    ? `Purchase ${inventoryExpansion.next.name}.`
                    : `Need ${inventoryExpansion.missingCostLabel}.`;
            expandInventoryButton.onclick = () => {
                if (game.purchaseInventoryExpansion()) renderCharacterPanel();
            };
        }
        const consumableCount = document.getElementById('consumable-count');
        if (consumableCount) consumableCount.textContent = `${game.getTotalConsumableCount()} ARCANA`;
        syncInventoryControls();
        updateBulkSalvageControls();

        slotContainer.replaceChildren();
        Object.entries(characterSlotMeta).forEach(([slot, meta]) => {
            const location = { type: 'equipment', slot };
            const item = game.getLocationItem(location);
            const slotWrap = document.createElement('div');
            slotWrap.className = 'equipment-slot-wrap';
            const slotButton = document.createElement('button');
            slotButton.type = 'button';
            slotButton.className = `equipment-slot${item ? ' filled' : ''}${item ? ` rarity-${item.rarity.toLowerCase()}${item.exceptional ? ' exceptional' : ''}` : ''}`;
            slotButton.setAttribute('aria-label', item
                ? `${meta.label}: ${item.name}, level ${item.level}, ${item.rarity}, ${item.enhancementCount || 0} enhancements. Drag it to inventory to unequip.`
                : `${meta.label}: empty. Drag compatible gear here to equip it.`);
            slotButton.innerHTML = `
                ${item ? itemArtMarkup(item, meta.glyph, 'slot-glyph item-image') : `<span class="slot-glyph">${meta.glyph}</span>`}
                <span class="slot-label">${meta.label}</span>
                <strong>${item ? `${item.name} · Lv ${item.level}${item.enhancementCount ? ` · +${item.enhancementCount} · +${getEnhancementPercent(item)}%` : ''}` : 'Empty'}</strong>
                ${item ? `<small class="equipment-slot-affixes">${equipmentAffixMarkup(item, 'slot')}</small>` : '<small>Drop compatible gear here</small>'}
            `;
            bindMovableLocation(slotButton, location, item);
            bindEquipmentSelection(slotButton, item);
            if (item) {
                bindItemTooltip(slotButton, item, { equipped: true, character: true });
                decorateNewUnlock(slotButton, 'character', item.id);
                slotWrap.appendChild(slotButton);
                appendGearEnhancementButton(slotWrap, item);
            } else {
                slotWrap.appendChild(slotButton);
            }
            slotContainer.appendChild(slotWrap);
        });

        renderConsumableLoadout();

        const dollBadges = document.getElementById('doll-equipment-badges');
        if (dollBadges) {
            dollBadges.replaceChildren();
            Object.entries(characterSlotMeta).forEach(([slot, meta]) => {
                const location = { type: 'equipment', slot };
                const item = game.getLocationItem(location);
                const badge = document.createElement('button');
                badge.type = 'button';
                badge.className = `doll-equipment-badge${item ? '' : ' empty'}${item ? ` rarity-${item.rarity.toLowerCase()}${item.exceptional ? ' exceptional' : ''}` : ''}`;
                badge.dataset.slot = slot;
                badge.innerHTML = item
                    ? itemArtMarkup(item, meta.glyph, 'doll-item-image')
                    : meta.glyph;
                badge.setAttribute('aria-label', item
                    ? `${item.name}, level ${item.level}, ${item.enhancementCount || 0} enhancements, +${getEnhancementPercent(item)}% item bonus, equipped in ${meta.label}. Drag to inventory to unequip.`
                    : `${meta.label} slot is empty. Drag compatible gear here.`);
                bindMovableLocation(badge, location, item);
                bindEquipmentSelection(badge, item);
                if (item) {
                    bindItemTooltip(badge, item, { equipped: true, character: true });
                    decorateNewUnlock(badge, 'character', item.id);
                }
                dollBadges.appendChild(badge);
            });
        }

        inventoryContainer.replaceChildren();
        const inventoryEntries = getInventoryEntries();
        const inventoryViewStatus = document.getElementById('inventory-view-status');
        if (inventoryViewStatus) {
            const shownItems = inventoryEntries.filter(entry => entry.item).length;
            const visibleLabel = shownItems === 1 ? 'ITEM' : 'ITEMS';
            inventoryViewStatus.textContent = `${shownItems} ${visibleLabel} · ${inventoryFilterLabels[inventoryFilter]} · ${inventorySortLabels[inventorySort]}`;
        }
        inventoryEntries.forEach(({ index, item }) => {
            const location = { type: 'inventory', index };
            const salvage = item ? game.getSalvageValue(item.id) : null;
            const inventorySlot = document.createElement('div');
            inventorySlot.className = `inventory-slot${item ? ` filled rarity-${item.rarity.toLowerCase()}${item.exceptional ? ' exceptional' : ''}` : ' empty'}`;
            inventorySlot.setAttribute('draggable', String(Boolean(item)));
            const isConsumable = item?.kind === 'consumable';
            const isGearActionConsumable = isConsumable && item.gearAction === 'rollback-enhancement';
            const isEquippedConsumable = isConsumable && game.isConsumableEquipped(item.id);
            const consumableEquipability = isConsumable && !isGearActionConsumable
                ? game.getConsumableEquipability(item.id)
                : { canEquip: false, reason: 'Reversal Seals are used on selected gear.' };
            const stackCount = isConsumable ? game.getConsumableCount(item.id) : 1;
            const selectedRollbackTarget = isGearActionConsumable ? getOwnedEquipmentItem(selectedEquipmentId) : null;
            const canUseRollbackOnSelected = Boolean(
                isGearActionConsumable
                && selectedRollbackTarget
                && selectedRollbackTarget.enhancementCount > 0
                && stackCount > 0
            );
            inventorySlot.setAttribute('aria-label', item
                ? (item.kind === 'consumable'
                    ? isGearActionConsumable
                        ? `Inventory slot ${index + 1}: ${item.name}, stack of ${stackCount}. Select enhanced gear in the Character tab, then use a seal to remove its latest enhancement roll.`
                        : `Inventory slot ${index + 1}: ${item.name}, stack of ${stackCount}, ${item.effectLabel}, ${item.duration} seconds. Use it from this slot.`
                    : `Inventory slot ${index + 1}: ${item.name}, level ${item.level}, ${item.rarity}, ${item.enhancementCount || 0} enhancements, +${getEnhancementPercent(item)}% item bonus${item.exceptional ? ', exceptional roll quality' : ''}. Drag to move.`)
                : `Empty inventory slot ${index + 1}. Drop gear here to unequip it.`);
            inventorySlot.innerHTML = item
                ? `${itemArtMarkup(item, item.icon, 'inventory-item-icon item-image')}${item.exceptional ? '<span class="inventory-exceptional-mark" aria-hidden="true">✦</span>' : ''}${isConsumable ? `<span class="inventory-stack-count">×${stackCount}</span>` : ''}<strong>${item.name}</strong>${isConsumable ? `<small>${isGearActionConsumable ? 'GEAR ACTION' : `${item.duration}s · ${item.effectLabel}`} · ×${stackCount}</small>` : equipmentAffixMarkup(item, 'inventory')}`
                : `<span class="inventory-slot-number">${String(index + 1).padStart(2, '0')}</span><small>EMPTY · DROP GEAR</small>`;
            if (item && isConsumable && !isGearActionConsumable) {
                const equipButton = document.createElement('button');
                equipButton.type = 'button';
                equipButton.className = `inventory-equip-button${!isEquippedConsumable && !consumableEquipability.canEquip ? ' blocked' : ''}`;
                equipButton.draggable = false;
                equipButton.textContent = isEquippedConsumable ? 'UNEQUIP' : 'EQUIP';
                equipButton.setAttribute('aria-label', isEquippedConsumable
                    ? `Unequip ${item.name} from the consumable loadout`
                    : consumableEquipability.canEquip
                        ? `Equip ${item.name} in the consumable loadout`
                        : `Cannot equip ${item.name}: ${consumableEquipability.reason}`);
                equipButton.title = isEquippedConsumable
                    ? `Remove ${item.name} from the consumable loadout.`
                    : consumableEquipability.reason;
                bindTextTooltip(equipButton, isEquippedConsumable
                    ? `Removes ${item.name} from the combat preparation rack. Its active effect, if any, remains active.`
                    : consumableEquipability.canEquip
                        ? `Adds ${item.name} to the combat preparation rack. The item stays in inventory and can be used from this card.`
                        : consumableEquipability.reason, 'Consumable loadout');
                equipButton.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (game.isConsumableEquipped(item.id)) {
                        if (game.unequipConsumable(item.id)) {
                            showInventoryActionFeedback(`${item.name} removed from the consumable loadout.`, 'success');
                        }
                        return;
                    }
                    const equipability = game.getConsumableEquipability(item.id);
                    if (!equipability.canEquip) {
                        showInventoryActionFeedback(`${item.name} · ${equipability.reason}`, 'warning');
                        return;
                    }
                    if (game.equipConsumable(item.id)) {
                        showInventoryActionFeedback(`${item.name} equipped in the consumable loadout.`, 'success');
                    }
                };
                inventorySlot.appendChild(equipButton);
            }
            if (item && isConsumable) {
                const useButton = document.createElement('button');
                useButton.type = 'button';
                useButton.className = isGearActionConsumable ? 'inventory-rollback-button' : 'inventory-use-button';
                useButton.draggable = false;
                useButton.textContent = isGearActionConsumable
                    ? canUseRollbackOnSelected ? 'REVERSE' : 'SELECT GEAR'
                    : 'USE';
                useButton.setAttribute('aria-label', isGearActionConsumable
                    ? canUseRollbackOnSelected
                        ? `Use one ${item.name} on ${selectedRollbackTarget.name} to remove its latest enhancement roll`
                        : `Select enhanced gear before using ${item.name}`
                    : `Use ${item.name}`);
                bindTextTooltip(useButton, isGearActionConsumable
                    ? canUseRollbackOnSelected
                        ? `Consumes one seal to remove ${selectedRollbackTarget.name}'s latest enhancement rank and exact roll. No Arcane Dust is refunded.`
                        : `Select an enhanced gear item in the Character tab first. This seal removes only that item's latest enhancement roll.`
                    : `Activates ${item.name} for ${item.duration} seconds.`, isGearActionConsumable ? 'Enhancement reversal' : 'Consumable action');
                useButton.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (isGearActionConsumable) {
                        if (canUseRollbackOnSelected) {
                            if (game.useGearRollbackConsumable(item.id, selectedRollbackTarget.id)) renderCharacterPanel();
                        } else {
                            document.getElementById('gear-comparison')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                        return;
                    }
                    if (game.useConsumable(item.id)) renderCharacterPanel();
                };
                inventorySlot.appendChild(useButton);
            }
            if (item && item.kind === 'equipment') appendGearEnhancementButton(inventorySlot, item);
            if (item && salvage) {
                const salvageButton = document.createElement('button');
                salvageButton.type = 'button';
                salvageButton.className = 'inventory-salvage-button';
                salvageButton.draggable = false;
                salvageButton.textContent = `SALVAGE · ${formatSalvageValue(salvage)}`;
                salvageButton.setAttribute('aria-label', `Salvage ${item.name} for ${formatSalvageValue(salvage)}`);
                bindTextTooltip(salvageButton, `Converts ${item.name} into ${formatSalvageValue(salvage)} for gear enhancements.`, 'Salvage action');
                salvageButton.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    openSalvageConfirmation(item.id);
                };
                inventorySlot.appendChild(salvageButton);
            }
            bindMovableLocation(inventorySlot, location, item?.kind === 'equipment' ? item : null);
            bindEquipmentSelection(inventorySlot, item);
            if (item) {
                bindItemTooltip(inventorySlot, item, {
                    stackCount: isConsumable ? stackCount : undefined,
                    equipped: item.kind === 'equipment' && game.getEquipmentSlotForItem(item.id) !== null,
                    character: true
                });
                if (item.kind === 'equipment') decorateNewUnlock(inventorySlot, 'character', item.id);
            }
            inventoryContainer.appendChild(inventorySlot);
        });

        const bonuses = game.getEquipmentBonuses();
        document.getElementById('equipment-bonus-summary').textContent =
            `Gear bonus: +${bonuses.maxHp} HP · +${bonuses.atk} ATK · +${bonuses.speed.toFixed(1)} SPD · +${Math.round(bonuses.crit * 100)}% CRIT · +${bonuses.critDamage.toFixed(1)}× CRIT DMG`;
        const journalBonusSummary = document.getElementById('journal-bonus-summary');
        if (journalBonusSummary) {
            const journalBonuses = game.getEquipmentJournalMasteryBonuses();
            const summary = game.formatEquipmentJournalMasteryBonusSummary(journalBonuses);
            const achievementBonuses = game.getAchievementFinalRewardBonuses();
            const achievementSummary = game.formatEquipmentJournalMasteryBonusSummary(achievementBonuses);
            const summaryParts = [];
            if (summary) summaryParts.push(`Journal mastery: ${summary}`);
            if (achievementSummary) summaryParts.push(`Achievement codex: ${achievementSummary}`);
            journalBonusSummary.textContent = summaryParts.join(' · ') || 'Journal mastery: no permanent bonuses yet.';
        }
    };

    document.getElementById('inventory-sort')?.addEventListener('change', event => {
        const nextSort = event.target.value;
        if (!Object.prototype.hasOwnProperty.call(inventorySortLabels, nextSort)) return;
        inventorySort = nextSort;
        renderCharacterPanel();
    });
    document.querySelectorAll('[data-inventory-filter]').forEach(button => {
        button.addEventListener('click', () => {
            const nextFilter = button.dataset.inventoryFilter;
            if (!Object.prototype.hasOwnProperty.call(inventoryFilterLabels, nextFilter)) return;
            inventoryFilter = nextFilter;
            renderCharacterPanel();
        });
    });
    autoSalvageNonExceptionalToggle?.addEventListener('change', event => {
        game.setAutoSalvageNonExceptional(event.target.checked);
    });

    const renderMaterialsPanel = () => {
        hideItemTooltip();
        const materialsContainer = document.getElementById('materials-list');
        const craftingContainer = document.getElementById('crafting-recipes');
        const effectsContainer = document.getElementById('active-consumable-effects');
        if (!materialsContainer || !craftingContainer) return;

        if (effectsContainer) {
            const activeEffects = game.getActiveConsumableEffects();
            effectsContainer.replaceChildren();
            effectsContainer.hidden = activeEffects.length === 0;
            if (activeEffects.length > 0) {
                const heading = document.createElement('div');
                heading.className = 'active-effects-heading';
                heading.textContent = 'ACTIVE ARCANA';
                effectsContainer.appendChild(heading);
                activeEffects.forEach(({ definition, remaining }) => {
                    const effect = document.createElement('div');
                    effect.className = `active-effect rarity-${definition.rarity.toLowerCase()}`;
                    effect.innerHTML = `
                        ${itemArtMarkup(definition, definition.icon, 'active-effect-icon item-image')}
                        <span><strong>${definition.name}</strong><small>${definition.effectLabel}</small></span>
                        <b>${Math.ceil(remaining)}s</b>
                    `;
                    bindItemTooltip(effect, definition, { stackCount: game.getConsumableCount(definition.id) });
                    effectsContainer.appendChild(effect);
                });
            }
        }

        materialsContainer.replaceChildren();
        let totalMaterials = 0;
        FUTURE_DROP_ITEMS
            .filter(item => item.kind === 'material')
            .forEach(material => {
                const quantity = game.getMaterialCount(material.id);
                totalMaterials += quantity;
                const materialChip = document.createElement('div');
                materialChip.className = `material-chip rarity-${material.rarity.toLowerCase()}`;
                materialChip.innerHTML = `${itemArtMarkup(material, material.icon, 'material-icon item-image')}<span>${material.name}</span><strong>${quantity}</strong>`;
                bindItemTooltip(materialChip, material, { quantity });
                decorateNewUnlock(materialChip, 'materials', `material:${material.id}`);
                materialsContainer.appendChild(materialChip);
            });
        const materialsTotal = document.getElementById('materials-total');
        if (materialsTotal) materialsTotal.textContent = `${totalMaterials} TOTAL`;
        const salvageCurrencyAmount = document.getElementById('salvage-currency-amount');
        if (salvageCurrencyAmount) salvageCurrencyAmount.textContent = game.getSalvageCurrency().toLocaleString();

        craftingContainer.replaceChildren();
        CRAFTING_RECIPES.forEach(recipe => {
            const output = game.getItemDefinition(recipe.output);
            const discoveryState = game.getCraftingRecipeState(recipe.id);
            if (!output || !discoveryState) return;
            const recipeButton = document.createElement('button');
            const isDiscovered = discoveryState.discovered;
            const canCraftRecipe = isDiscovered && game.canCraft(recipe);
            recipeButton.type = 'button';
            recipeButton.className = `crafting-recipe rarity-${recipe.rarity.toLowerCase()}${canCraftRecipe ? '' : ' is-disabled'}${!isDiscovered ? ' recipe-locked' : ''}`;
            recipeButton.setAttribute('aria-disabled', String(!canCraftRecipe));
            recipeButton.setAttribute('aria-label', isDiscovered
                ? `${output.name} recipe${canCraftRecipe ? ', ready to craft' : ', missing materials or inventory space'}`
                : 'Hidden arcane formula, discovery required');
            const recipeSource = recipe.discovery?.conditions?.map(condition => game.getRecipeConditionLabel(condition)).join(' or ') || 'Explore the realms';
            const recipeTierSummary = recipe.tierLabel
                ? `TIER ${recipe.tier || 1} · ${recipe.tierLabel.toUpperCase()} · `
                : '';
            const recipeOutputSummary = output.kind === 'equipment'
                ? `${recipeTierSummary}CRAFTED ${output.rarity.toUpperCase()} ${output.slot.toUpperCase()} · ${formatItemBonuses(output.bonuses)}`
                : output.gearAction
                    ? `${recipeTierSummary}GEAR ACTION · ${output.effectLabel}`
                    : `${recipeTierSummary}${output.duration}s · ${output.effectLabel}`;
            recipeButton.innerHTML = isDiscovered
                ? `
                    ${itemArtMarkup(output, output.icon, 'crafting-output-icon item-image')}
                    <span class="crafting-recipe-copy"><strong>${output.name}</strong><small>${recipeOutputSummary} · ${recipeSource} · ${Object.entries(recipe.materials).map(([id, amount]) => `${game.getItemDefinition(id)?.name || id} ×${amount}`).join(' · ')}</small></span>
                    <span class="crafting-action">CRAFT</span>
                `
                : `
                    <span class="crafting-output-icon recipe-locked-icon" aria-hidden="true">?</span>
                    <span class="crafting-recipe-copy"><strong>Unknown Formula</strong><small>Hidden · ${discoveryState.unlockHint}</small></span>
                    <span class="crafting-action">LOCKED</span>
                `;
            bindPopupTooltip(
                recipeButton,
                () => recipeTooltipMarkup(recipe, output),
                isDiscovered ? output.rarity : 'Common'
            );
            decorateNewUnlock(recipeButton, 'materials', `recipe:${recipe.id}`);
            recipeButton.onclick = () => {
                acknowledgeUnlocks('materials', `recipe:${recipe.id}`);
                if (!canCraftRecipe) return;
                if (game.craftItem(recipe.id)) renderMaterialsPanel();
            };
            craftingContainer.appendChild(recipeButton);
        });
        const recipeDiscoveryStatus = document.getElementById('recipe-discovery-status');
        if (recipeDiscoveryStatus) {
            recipeDiscoveryStatus.textContent = `${game.getDiscoveredRecipeCount()} / ${CRAFTING_RECIPES.length} FORMULAS REVEALED`;
        }
    };

    const renderAchievementsPanel = () => {
        const list = document.getElementById('achievements-list');
        const summary = document.getElementById('achievement-summary');
        if (!list) return;

        // A refresh replaces the dynamic achievement controls. Close any tooltip
        // that was attached to an element which is about to be removed.
        hideItemTooltip();

        const states = game.getAchievementStates();
        const getAchievementState = achievementId => states.find(state => state.id === achievementId);
        const unlockedTiers = states.reduce((total, state) => total + state.tier, 0);
        const totalTiers = states.reduce((total, state) => total + state.maxTier, 0);
        const completed = states.filter(state => state.complete).length;
        const formatValue = value => Math.floor(Number(value) || 0).toLocaleString();
        const honors = game.getAchievementHonors();
        const unlockedTitles = honors.titleStates.filter(title => title.unlocked).length;

        const bindAchievementTooltipOnce = (element, renderMarkup, rarity = 'Epic') => {
            if (!element || element.dataset.achievementTooltipBound === 'true') return;
            element.dataset.achievementTooltipBound = 'true';
            if (!(element instanceof HTMLButtonElement) && !element.hasAttribute('tabindex')) element.tabIndex = 0;
            bindPopupTooltip(element, renderMarkup, rarity);
        };

        const achievementTooltipMarkup = state => {
            const tierRows = state.thresholds.map((threshold, index) => {
                const tierName = ACHIEVEMENT_TIER_NAMES[index] || `Tier ${index + 1}`;
                const status = index < state.tier ? 'REACHED' : index === state.tier && !state.complete ? 'NEXT' : 'LOCKED';
                return `<div class="item-tooltip-stat"><span>${escapeTooltipHtml(tierName)}</span><strong>${formatValue(threshold)} · ${status}</strong></div>`;
            }).join('');
            const finalRewardMarkup = state.finalReward
                ? `
                    <div class="item-tooltip-section">
                        <span class="item-tooltip-section-label">Final journal reward</span>
                        <div class="item-tooltip-effect">${escapeTooltipHtml(state.finalReward.icon || '✺')} ${escapeTooltipHtml(state.finalReward.name)} · ${escapeTooltipHtml(state.finalRewardSummary || 'Permanent wizard progression')}</div>
                        <div class="item-tooltip-potential">${escapeTooltipHtml(state.finalReward.description)} ${state.complete ? 'Permanently active.' : 'Granted when every tier is complete.'}</div>
                    </div>
                `
                : '';
            return `
                <div class="item-tooltip-heading">
                    <span class="item-tooltip-icon">${escapeTooltipHtml(state.icon)}</span>
                    <div>
                        <span class="item-tooltip-kicker">Lifetime achievement</span>
                        <strong class="item-tooltip-title">${escapeTooltipHtml(state.name)}</strong>
                        <small class="item-tooltip-level">Tier ${state.tier} of ${state.maxTier}</small>
                    </div>
                </div>
                <p class="item-tooltip-description">${escapeTooltipHtml(state.description)}</p>
                <div class="item-tooltip-section">
                    <span class="item-tooltip-section-label">Current progress</span>
                    <div class="item-tooltip-stat"><span>Lifetime total</span><strong>${formatValue(state.value)}</strong></div>
                    <div class="item-tooltip-stat"><span>Status</span><strong>${state.complete ? 'COMPLETE' : `${formatValue(state.nextThreshold - state.value)} TO NEXT`}</strong></div>
                </div>
                <div class="item-tooltip-section">
                    <span class="item-tooltip-section-label">Tier milestones</span>
                    <div class="item-tooltip-stat-list">${tierRows}</div>
                </div>
                ${finalRewardMarkup}
                <div class="item-tooltip-status">Achievement tiers unlock combat titles with real bonuses and displayable badges. Completing the full track also grants its final journal reward permanently.</div>
            `;
        };

        const honorRequirementMarkup = (honor, kind) => {
            const source = getAchievementState(honor.achievementId);
            const requiredTier = Math.max(1, Number(honor.requiredTier) || 1);
            const threshold = source?.thresholds?.[requiredTier - 1];
            const status = honor.unlocked
                ? kind === 'title'
                    ? honor.equipped ? 'EQUIPPED' : 'UNLOCKED · CLICK TO EQUIP'
                    : honor.displayed ? 'DISPLAYED' : 'UNLOCKED · CLICK TO DISPLAY'
                : 'LOCKED';
            return `
                <div class="item-tooltip-section">
                    <span class="item-tooltip-section-label">Unlock requirement</span>
                    <div class="item-tooltip-stat"><span>${escapeTooltipHtml(honor.achievementName)}</span><strong>${escapeTooltipHtml(honor.achievementTierName)} TIER</strong></div>
                    <div class="item-tooltip-potential">Reach ${formatValue(threshold)} ${escapeTooltipHtml(source?.metric || 'lifetime progress')}.</div>
                </div>
                <div class="item-tooltip-status">${status}</div>
            `;
        };

        const honorTitleTooltipMarkup = title => `
            <div class="item-tooltip-heading">
                <span class="item-tooltip-icon">${escapeTooltipHtml(title.icon || '✦')}</span>
                <div>
                    <span class="item-tooltip-kicker">${escapeTooltipHtml(title.rarity || 'Mystical')} honor · Title</span>
                    <strong class="item-tooltip-title">${escapeTooltipHtml(title.name)}</strong>
                    <small class="item-tooltip-level">${escapeTooltipHtml(title.equipped ? `Equipped in slot ${title.equippedSlot + 1}` : 'Combat title')}</small>
                </div>
            </div>
            <p class="item-tooltip-description">${escapeTooltipHtml(title.description)}</p>
            <div class="item-tooltip-section">
                <span class="item-tooltip-section-label">Combat bonus</span>
                <div class="item-tooltip-effect">${escapeTooltipHtml(title.bonusSummary || 'No bonus')}</div>
            </div>
            ${honorRequirementMarkup(title, 'title')}
        `;

        const honorBadgeTooltipMarkup = badge => `
            <div class="item-tooltip-heading">
                <span class="item-tooltip-icon">${escapeTooltipHtml(badge.icon || '◇')}</span>
                <div>
                    <span class="item-tooltip-kicker">Mystical honor · Badge</span>
                    <strong class="item-tooltip-title">${escapeTooltipHtml(badge.name)}</strong>
                    <small class="item-tooltip-level">Up to ${honors.badgeLimit} displayed</small>
                </div>
            </div>
            <p class="item-tooltip-description">${escapeTooltipHtml(badge.description)}</p>
            ${honorRequirementMarkup(badge, 'badge')}
        `;

        if (summary) {
            summary.textContent = `${unlockedTiers} / ${totalTiers} TIERS · ${completed} COMPLETE`;
            bindAchievementTooltipOnce(summary, () => {
                const currentStates = game.getAchievementStates();
                const currentTiers = currentStates.reduce((total, state) => total + state.tier, 0);
                const currentTotal = currentStates.reduce((total, state) => total + state.maxTier, 0);
                return `<div class="combat-tooltip-copy"><strong>Achievement progress</strong><span>${currentTiers} of ${currentTotal} lifetime milestones reached across ${currentStates.length} achievements. Earned tiers unlock combat titles with stackable bonuses and displayable badges.</span></div>`;
            }, 'Legendary');
        }

        const honorsSummary = document.getElementById('honors-summary');
        if (honorsSummary) {
            honorsSummary.textContent = `${unlockedTitles} TITLES · ${honors.equippedTitles.length}/${honors.titleSlotCount} ACTIVE · ${honors.displayedBadges.length}/${honors.badgeLimit} BADGES`;
            bindAchievementTooltipOnce(honorsSummary, () => {
                const currentHonors = game.getAchievementHonors();
                return `<div class="combat-tooltip-copy"><strong>Mystical Honors</strong><span>Achievement identity with real progression rewards. Equip up to ${currentHonors.titleSlotCount} unlocked titles; their combat and resource bonuses stack. Display up to ${currentHonors.badgeLimit} badges.</span></div>`;
            });
        }

        const titleSlotCount = document.getElementById('honors-title-slot-count');
        if (titleSlotCount) titleSlotCount.textContent = `${honors.equippedTitles.length}/${honors.titleSlotCount} ACTIVE`;

        const titleBonusEntries = Object.entries(honors.titleBonuses || {})
            .filter(([, value]) => Math.abs(Number(value) || 0) > 0.0005);
        const stackedTitleBonusText = titleBonusEntries.length > 0
            ? titleBonusEntries
                .map(([stat, value]) => `+${game.formatTitleBonusValue(stat, value)} ${TITLE_BONUS_STAT_LABELS[stat] || stat.toUpperCase()}`)
                .join(' · ')
            : 'No achievement title bonuses active.';
        const titleBonusSummary = document.getElementById('honors-title-bonus-summary');
        if (titleBonusSummary) titleBonusSummary.textContent = stackedTitleBonusText;

        const titleSlots = document.getElementById('honors-title-slots');
        if (titleSlots) {
            titleSlots.replaceChildren();
            const totalTitleSlots = Math.max(6, honors.titleSlotCount);
            const unlockBySlot = new Map(honors.titleSlotUnlocks.map(unlock => [unlock.slots, unlock]));
            for (let index = 0; index < totalTitleSlots; index++) {
                const slotNumber = index + 1;
                const title = honors.equippedTitles[index] || null;
                const slot = document.createElement('div');
                slot.className = `honors-title-slot${title ? ` rarity-${String(title.rarity).toLowerCase()}` : ''}${slotNumber > honors.titleSlotCount ? ' locked' : title ? ' active' : ' empty'}`;
                slot.tabIndex = 0;

                if (slotNumber > honors.titleSlotCount) {
                    const unlock = unlockBySlot.get(slotNumber);
                    const requirement = unlock ? `${unlock.requiredTiers} TOTAL TIERS` : 'MORE TIERS';
                    slot.setAttribute('aria-label', `Title slot ${slotNumber} locked. Reach ${requirement} to unlock.`);
                    slot.innerHTML = `<span class="honors-title-slot-icon" aria-hidden="true">🔒</span><span class="honors-title-slot-copy"><small>SLOT ${slotNumber} · LOCKED</small><strong>LOCKED SLOT</strong><em>${requirement} TO UNLOCK</em></span>`;
                    bindPopupTooltip(slot, () => `<div class="combat-tooltip-copy"><strong>Title slot ${slotNumber}</strong><span>Reach ${escapeTooltipHtml(requirement.toLowerCase())} to unlock another active combat title slot.</span></div>`, 'Common');
                    decorateNewUnlock(slot, 'achievements', `title-slot:${slotNumber}`);
                } else if (title) {
                    slot.setAttribute('aria-label', `Title slot ${slotNumber}: ${title.name}, ${title.bonusSummary}.`);
                    slot.innerHTML = `<span class="honors-title-slot-icon" aria-hidden="true">${escapeTooltipHtml(title.icon)}</span><span class="honors-title-slot-copy"><small>SLOT ${slotNumber} · ${escapeTooltipHtml(title.rarity)}</small><strong>${escapeTooltipHtml(title.name)}</strong><em>${escapeTooltipHtml(title.bonusSummary)}</em></span><button class="honors-title-slot-remove" type="button" aria-label="Remove ${escapeTooltipHtml(title.name)} from title slot ${slotNumber}">REMOVE</button>`;
                    bindPopupTooltip(slot, () => honorTitleTooltipMarkup(title), title.rarity);
                    slot.querySelector('.honors-title-slot-remove').onclick = event => {
                        event.preventDefault();
                        event.stopPropagation();
                        game.toggleAchievementTitle(title.id);
                    };
                } else {
                    slot.setAttribute('aria-label', `Title slot ${slotNumber} is empty.`);
                    slot.innerHTML = `<span class="honors-title-slot-icon" aria-hidden="true">＋</span><span class="honors-title-slot-copy"><small>SLOT ${slotNumber} · AVAILABLE</small><strong>EMPTY SLOT</strong><em>Equip an earned title below</em></span>`;
                    bindPopupTooltip(slot, () => `<div class="combat-tooltip-copy"><strong>Empty title slot</strong><span>Choose an unlocked combat title below. Bonuses stack across every active slot.</span></div>`, 'Common');
                }
                titleSlots.appendChild(slot);
            }
        }

        const titleControlSummary = document.getElementById('honors-title-control-summary');
        if (titleControlSummary) titleControlSummary.textContent = `${honors.equippedTitles.length}/${honors.titleSlotCount} ACTIVE · TOGGLE TO EQUIP`;

        const displayedBadges = document.getElementById('honors-displayed-badges');
        if (displayedBadges) {
            displayedBadges.replaceChildren();
            if (honors.displayedBadges.length === 0) {
                const empty = document.createElement('span');
                empty.className = 'honors-empty';
                empty.textContent = 'No badges displayed';
                empty.tabIndex = 0;
                bindAchievementTooltipOnce(empty, () => `<div class="combat-tooltip-copy"><strong>Displayed badges</strong><span>Unlock badges through achievement tiers, then click them below to display up to ${honors.badgeLimit} at once.</span></div>`);
                displayedBadges.appendChild(empty);
            } else {
                honors.displayedBadges.forEach(badge => {
                    const badgeChip = document.createElement('span');
                    badgeChip.className = 'honors-display-badge';
                    badgeChip.setAttribute('aria-label', badge.name);
                    badgeChip.tabIndex = 0;
                    badgeChip.innerHTML = `<b aria-hidden="true">${badge.icon}</b><span>${badge.name}</span>`;
                    bindPopupTooltip(badgeChip, () => honorBadgeTooltipMarkup(badge), 'Rare');
                    displayedBadges.appendChild(badgeChip);
                });
            }
        }

        const titleOptions = document.getElementById('honors-title-options');
        if (titleOptions) {
            titleOptions.replaceChildren();
            const noneButton = document.createElement('button');
            noneButton.type = 'button';
            noneButton.className = `honor-option honor-title-option${honors.equippedTitles.length === 0 ? ' selected' : ''}`;
            noneButton.setAttribute('aria-pressed', String(honors.equippedTitles.length === 0));
            noneButton.innerHTML = '<span class="honor-option-icon" aria-hidden="true">—</span><span class="honor-option-copy"><strong>Hero level title</strong><small>Clear achievement titles and use the current level title</small></span><span class="honor-option-action">CLEAR</span>';
            bindPopupTooltip(noneButton, () => `<div class="combat-tooltip-copy"><strong>Hero level title</strong><span>Clear every equipped achievement title. The wizard’s current Hero level title will be shown instead, with no achievement title bonuses active.</span></div>`);
            noneButton.onclick = () => game.setAchievementTitle(null);
            titleOptions.appendChild(noneButton);
            honors.titleStates.forEach(title => {
                const canToggle = title.unlocked && (title.equipped || honors.equippedTitles.length < honors.titleSlotCount);
                const option = document.createElement('button');
                option.type = 'button';
                option.className = `honor-option honor-title-option${title.unlocked ? '' : ' locked'}${title.equipped ? ' selected' : ''}`;
                option.disabled = !canToggle;
                option.setAttribute('aria-pressed', String(title.equipped));
                option.setAttribute('aria-label', title.unlocked
                    ? `${title.equipped ? 'Remove' : 'Equip'} ${title.name}`
                    : `${title.name} locked`);
                const titleDetail = title.unlocked
                    ? `${title.rarity} · ${title.bonusSummary}`
                    : `Locked · ${title.achievementName} ${title.achievementTierName}`;
                const actionLabel = title.equipped ? 'REMOVE' : canToggle ? 'EQUIP' : 'FULL';
                option.innerHTML = `<span class="honor-option-icon" aria-hidden="true">${title.unlocked ? escapeTooltipHtml(title.icon) : '◇'}</span><span class="honor-option-copy"><strong>${escapeTooltipHtml(title.name)}</strong><small>${escapeTooltipHtml(titleDetail)}</small></span><span class="honor-option-action">${actionLabel}</span>`;
                bindPopupTooltip(option, () => honorTitleTooltipMarkup(title), title.rarity || 'Epic');
                decorateNewUnlock(option, 'achievements', `title:${title.id}`);
                option.onclick = () => {
                    acknowledgeUnlocks('achievements', `title:${title.id}`);
                    game.toggleAchievementTitle(title.id);
                };
                titleOptions.appendChild(option);
            });
        }

        const badgeOptions = document.getElementById('honors-badge-options');
        if (badgeOptions) {
            badgeOptions.replaceChildren();
            honors.badgeStates.forEach(badge => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = `honor-option honor-badge-option${badge.unlocked ? '' : ' locked'}${badge.displayed ? ' selected' : ''}`;
                option.disabled = !badge.unlocked;
                option.setAttribute('aria-pressed', String(badge.displayed));
                option.setAttribute('aria-label', badge.unlocked ? `${badge.displayed ? 'Hide' : 'Display'} ${badge.name} badge` : `${badge.name} locked`);
                option.innerHTML = `<span class="honor-option-icon" aria-hidden="true">${badge.unlocked ? badge.icon : '◇'}</span><span class="honor-option-copy"><strong>${badge.name}</strong><small>${badge.unlocked ? badge.description : `Locked · ${badge.achievementName} ${badge.achievementTierName}`}</small></span>${badge.displayed ? '<b class="honor-selected-mark" aria-label="Displayed">✓</b>' : ''}`;
                bindPopupTooltip(option, () => honorBadgeTooltipMarkup(badge), 'Rare');
                decorateNewUnlock(option, 'achievements', `badge:${badge.id}`);
                option.onclick = () => {
                    acknowledgeUnlocks('achievements', `badge:${badge.id}`);
                    game.toggleAchievementBadge(badge.id);
                };
                badgeOptions.appendChild(option);
            });
        }

        list.replaceChildren();
        states.forEach(state => {
            const card = document.createElement('article');
            card.className = `achievement-card${state.complete ? ' complete' : state.tier > 0 ? ' active' : ''}`;
            const targetText = state.complete
                ? 'ALL TIERS COMPLETE'
                : `${formatValue(state.value)} / ${formatValue(state.nextThreshold)}`;
            const tierLabel = state.complete
                ? `${ACHIEVEMENT_TIER_NAMES[state.maxTier - 1] || 'MYTHIC'} COMPLETE`
                : state.tier > 0
                    ? `${state.tierName.toUpperCase()} TIER · NEXT ${formatValue(state.nextThreshold)}`
                    : `LOCKED · REACH ${formatValue(state.nextThreshold)}`;
            const tierDots = state.thresholds.map((threshold, index) => {
                const tierUnlockId = `achievement:${state.id}:${index + 1}`;
                const isNewTier = game.isTabUnlockNew('achievements', tierUnlockId);
                return `
                    <span class="achievement-tier-dot${index < state.tier ? ' reached' : ''}${index === state.tier && !state.complete ? ' current' : ''}${isNewTier ? ' notification-new-tier' : ''}" data-unlock-id="${tierUnlockId}" title="${isNewTier ? 'NEW · ' : ''}${ACHIEVEMENT_TIER_NAMES[index] || `Tier ${index + 1}`}: ${formatValue(threshold)}"></span>
                `;
            }).join('');
            const newTierUnlocks = getNewTabUnlocks('achievements')
                .filter(notice => notice.id.startsWith(`achievement:${state.id}:`));
            card.innerHTML = `
                <div class="achievement-card-heading">
                    <span class="achievement-icon" aria-hidden="true">${state.icon}</span>
                    <div class="achievement-copy">
                        <strong>${state.name}</strong>
                        <small>${state.description}</small>
                    </div>
                    <b class="achievement-rank">${state.tier}/${state.maxTier}</b>
                </div>
                <div class="achievement-progress-label"><span>${tierLabel}</span><strong>${targetText}</strong></div>
                <div class="achievement-progress-track" aria-label="${state.name} progress"><span style="width: ${Math.round(state.progress * 100)}%"></span></div>
                <div class="achievement-tier-track" aria-label="${state.name} tiers">${tierDots}</div>
                ${state.finalReward ? `<div class="achievement-final-reward" aria-label="Final journal reward: ${escapeNotificationText(state.finalReward.name)} · ${escapeNotificationText(state.finalRewardSummary || 'Permanent wizard progression')}">
                    <span class="achievement-final-reward-icon" aria-hidden="true">${escapeNotificationText(state.finalReward.icon || '✺')}</span>
                    <span class="achievement-final-reward-copy"><small>FINAL JOURNAL REWARD · ${escapeNotificationText(state.finalRewardSummary || 'PERMANENT BENEFIT')}</small><strong>${escapeNotificationText(state.finalReward.name)}</strong></span>
                    <span class="achievement-final-reward-status">${state.complete ? 'ACTIVE' : 'COMPLETE TRACK'}</span>
                </div>` : ''}
            `;
            decorateNewUnlock(card, 'achievements', newTierUnlocks.map(notice => notice.id), newTierUnlocks.length);
            card.tabIndex = 0;
            card.setAttribute('aria-label', `${state.name}: ${tierLabel}. ${targetText}.`);
            bindPopupTooltip(card, () => achievementTooltipMarkup(state), state.complete ? 'Legendary' : 'Epic');
            card.querySelectorAll('.achievement-tier-dot').forEach((dot, index) => {
                const tierName = ACHIEVEMENT_TIER_NAMES[index] || `Tier ${index + 1}`;
                const reached = index < state.tier;
                dot.removeAttribute('title');
                dot.tabIndex = 0;
                dot.setAttribute('aria-label', `${tierName}: ${formatValue(state.thresholds[index])}${reached ? ' reached' : ' locked'}`);
                bindPopupTooltip(dot, () => `<div class="combat-tooltip-copy"><strong>${escapeTooltipHtml(state.name)} · ${escapeTooltipHtml(tierName)}</strong><span>Milestone: ${formatValue(state.thresholds[index])}. ${reached ? 'This tier is reached.' : `You need ${formatValue(Math.max(0, state.thresholds[index] - state.value))} more.`}</span></div>`, state.complete ? 'Legendary' : 'Epic');
            });
            list.appendChild(card);
        });
    };

    const renderDiscoveryJournal = () => {
        const list = document.getElementById('equipment-journal-list');
        const summary = document.getElementById('journal-summary');
        const masterySummary = document.getElementById('journal-mastery-summary');
        const tabCount = document.getElementById('journal-tab-count');
        const discoveryTabCount = document.getElementById('discovery-tab-count');
        if (!list) return;

        hideItemTooltip();
        const equipmentDefinitions = FUTURE_DROP_ITEMS.filter(item => item.kind === 'equipment');
        const discoveries = new Map(game.getEquipmentJournalEntries().map(entry => [entry.item.id, entry.discovery]));
        const foundCount = discoveries.size;
        const masteryTotals = game.getEquipmentJournalMasteryTotals();
        const countText = `${foundCount} / ${equipmentDefinitions.length} FOUND`;
        if (summary) summary.textContent = countText;
        if (masterySummary) {
            const bonusText = game.formatEquipmentJournalMasteryBonusSummary(masteryTotals.bonuses);
            masterySummary.textContent = `${masteryTotals.ranks} MASTERY RANKS${bonusText ? ` · ${bonusText}` : ''}`;
        }
        if (tabCount) tabCount.textContent = `${foundCount} / ${equipmentDefinitions.length}`;
        if (discoveryTabCount) discoveryTabCount.textContent = `${foundCount} / ${equipmentDefinitions.length}`;

        list.replaceChildren();
        const formatJournalDate = timestamp => {
            if (!Number.isFinite(timestamp) || timestamp <= 0) return 'TIME NOT RECORDED';
            return new Date(timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        };
        const slotLabel = item => characterSlotMeta[item.slot]?.label || item.slot || 'Equipment';

        [...equipmentDefinitions]
            .sort((first, second) => {
                const firstDiscovery = discoveries.get(first.id);
                const secondDiscovery = discoveries.get(second.id);
                if (Boolean(firstDiscovery) !== Boolean(secondDiscovery)) return firstDiscovery ? -1 : 1;
                if (firstDiscovery && secondDiscovery) {
                    const rarityDelta = game.getRarityIndex(secondDiscovery.highestRarity) - game.getRarityIndex(firstDiscovery.highestRarity);
                    if (rarityDelta !== 0) return rarityDelta;
                    return (Number(secondDiscovery.acquiredAt) || 0) - (Number(firstDiscovery.acquiredAt) || 0);
                }
                return first.name.localeCompare(second.name);
            })
            .forEach(item => {
                const discovery = discoveries.get(item.id);
                const specialization = EQUIPMENT_SLOT_SPECIALIZATIONS[item.slot] || null;
                const specializationLabel = specialization
                    ? `${specialization.label.toUpperCase()} · ${EQUIPMENT_STAT_LABELS[specialization.primaryStat] || specialization.primaryStat.toUpperCase()} PRIMARY`
                    : 'SPECIALIZATION UNKNOWN';
                const unlockId = `equipment:${item.id}`;
                const article = document.createElement('article');
                if (!discovery) {
                    article.className = 'equipment-journal-entry locked';
                    article.setAttribute('aria-label', `Undiscovered equipment base. ${slotLabel(item)}. Possible source: ${item.dropFrom || 'unknown route'}.`);
                    article.innerHTML = `
                        <div class="journal-entry-card-top">
                            <span class="journal-entry-icon journal-entry-locked-icon" aria-hidden="true">?</span>
                            <div class="journal-entry-copy">
                                <strong class="journal-entry-title">UNDISCOVERED EQUIPMENT</strong>
                                <span class="journal-entry-detail">${escapeNotificationText(slotLabel(item).toUpperCase())} · ${escapeNotificationText(specializationLabel)} · BASE HIDDEN</span>
                                <span class="journal-entry-source">ROUTE · ${escapeNotificationText(item.routeIdentity || item.dropFrom || 'Explore the realms')}</span>
                                <span class="journal-entry-source">SOURCES · ${escapeNotificationText((item.dropMonsters || []).join(' · ') || 'Route-wide discovery')}</span>
                            </div>
                        </div>
                        <div class="journal-entry-locked-copy">This relic has not been recorded yet. Keep farming the indicated route to reveal its name, rarity profile, and mastery track.</div>
                        <span class="journal-entry-time">STATUS · AWAITING FIRST DISCOVERY</span>
                    `;
                } else {
                    const rarityData = game.getRarityData(discovery.highestRarity);
                    const rarityLabel = rarityData.displayName || rarityData.name;
                    const score = Number.isFinite(discovery.strongestRollQuality)
                        ? `${discovery.strongestRollQuality}%`
                        : '—';
                    const mastery = game.getEquipmentJournalMasteryState(discovery);
                    const masteryTarget = mastery.nextMilestone?.points || mastery.points;
                    const masteryPointsLabel = mastery.nextMilestone
                        ? `${mastery.points} / ${masteryTarget}`
                        : `${mastery.points} INSIGHT`;
                    const masteryRewardLabel = mastery.nextMilestone
                        ? `NEXT ${mastery.nextMilestone.name.toUpperCase()} · ${mastery.nextBonusSummary}`
                        : `ALL REWARDS CLAIMED · ${mastery.currentBonusSummary}`;
                    const masteryGuidance = getJournalMasteryGuidance(item, discovery, mastery);
                    const hasExceptionalQuality = Number.isFinite(discovery.strongestRollQuality)
                        && discovery.strongestRollQuality >= 86;
                    article.className = `equipment-journal-entry rarity-${String(discovery.highestRarity).toLowerCase()}${hasExceptionalQuality ? ' exceptional' : ''}`;
                    article.setAttribute('aria-label', `${item.name}. Mastery ${mastery.rank} of ${mastery.maxRank}, ${mastery.rankName}. Highest rarity ${rarityLabel}. Strongest roll quality ${score}. Source ${discovery.sourceMonster}, ${discovery.sourceMap}. Acquired ${formatJournalDate(discovery.acquiredAt)}.`);
                    article.innerHTML = `
                        <div class="journal-entry-card-top">
                            ${itemArtMarkup(item, item.icon || '◆', 'journal-entry-icon item-image')}
                            <div class="journal-entry-copy">
                                <strong class="journal-entry-title">${escapeNotificationText(item.name)}</strong>
                                <span class="journal-entry-detail">${escapeNotificationText(slotLabel(item).toUpperCase())} · ${escapeNotificationText(specializationLabel)} · ${hasExceptionalQuality ? '✦ ' : ''}${escapeNotificationText(rarityLabel.toUpperCase())} HIGHEST</span>
                                <span class="journal-entry-source">ROUTE · ${escapeNotificationText(item.routeIdentity || item.dropFrom || 'Unknown route')}</span>
                                <span class="journal-entry-source">SOURCE · ${escapeNotificationText(discovery.sourceMonster || 'Unknown source')} · ${escapeNotificationText(discovery.sourceMap || 'Unknown route')}</span>
                            </div>
                        </div>
                        <div class="journal-entry-mastery">
                            <div class="journal-entry-mastery-heading"><span>MASTERY ${mastery.rank}/${mastery.maxRank} · ${escapeNotificationText(mastery.rankName.toUpperCase())}</span><strong>${escapeNotificationText(masteryPointsLabel)}</strong></div>
                            <div class="journal-mastery-track" aria-label="${item.name} mastery progress"><span style="width: ${Math.round(mastery.progress * 100)}%"></span></div>
                            <small class="journal-entry-reward">${escapeNotificationText(masteryRewardLabel)}</small>
                            <div class="journal-entry-guidance">
                                <span>ROAD TO NEXT RANK</span>
                                <strong>${escapeNotificationText(masteryGuidance.nextRank)} · ${escapeNotificationText(masteryGuidance.remaining)}</strong>
                                <small>HOW: ${escapeNotificationText(masteryGuidance.how)}</small>
                            </div>
                        </div>
                        <div class="journal-entry-stats"><span>BEST ROLL <strong>${escapeNotificationText(score)}</strong></span><span>ACQUIRED <strong>${escapeNotificationText(formatJournalDate(discovery.acquiredAt))}</strong></span></div>
                    `;
                    decorateNewUnlock(article, 'discovery', unlockId);
                }
                article.tabIndex = 0;
                article.removeAttribute('title');
                bindPopupTooltip(
                    article,
                    () => discoveryTooltipMarkup(item, discovery, {
                        slotLabel: slotLabel(item),
                        formatDate: formatJournalDate
                    }),
                    discovery ? discovery.highestRarity : 'Common'
                );
                list.appendChild(article);
            });
    };

    const tabs = [
        { tabId: 'character', button: document.getElementById('character-tab'), panel: document.getElementById('character-panel') },
        { tabId: 'materials', button: document.getElementById('materials-tab'), panel: document.getElementById('materials-panel') },
        { tabId: 'upgrades', button: document.getElementById('upgrades-tab'), panel: document.getElementById('upgrades-panel') },
        { tabId: 'achievements', button: document.getElementById('achievements-tab'), panel: document.getElementById('achievements-panel') },
        { tabId: 'discovery', button: document.getElementById('discovery-tab'), panel: document.getElementById('discovery-panel') },
        { tabId: 'maps', button: document.getElementById('maps-tab'), panel: document.getElementById('map-panel') },
        { tabId: 'settings', button: document.getElementById('settings-tab'), panel: document.getElementById('settings-panel') }
    ];
    const bottomBar = document.getElementById('bottom-bar');

    tabs.forEach(({ tabId, button, panel }) => {
        button.onpointerenter = () => {
            if (game.hasUnreadTabUnlocks(tabId)) game.markTabUnlocksViewed(tabId);
        };
        button.onclick = () => {
            const shouldOpen = !panel.classList.contains('panel-open');
            if (shouldOpen) game.markTabUnlocksViewed(tabId);

            tabs.forEach(({ button: otherButton, panel: otherPanel }) => {
                const isOpen = shouldOpen && otherPanel === panel;
                otherPanel.classList.toggle('panel-open', isOpen);
                otherButton.classList.toggle('active', isOpen);
                otherButton.setAttribute('aria-expanded', String(isOpen));
            });
            bottomBar?.classList.toggle('tab-view-open', shouldOpen);

            if (panel === document.getElementById('character-panel') && shouldOpen) {
                renderCharacterPanel();
            }
            if (panel === document.getElementById('materials-panel') && shouldOpen) {
                renderMaterialsPanel();
            }
            if (panel === document.getElementById('achievements-panel') && shouldOpen) {
                renderAchievementsPanel();
            }
            if (panel === document.getElementById('discovery-panel') && shouldOpen) {
                renderDiscoveryJournal();
            }
            renderTabNotificationBadges();
        };
    });

    window.addEventListener('robstradomus-achievements-changed', () => {
        if (document.getElementById('achievements-panel')?.classList.contains('panel-open')) {
            renderAchievementsPanel();
        }
    });
    window.addEventListener('robstradomus-inventory-changed', () => {
        renderCharacterPanel();
        renderMaterialsPanel();
    });
    window.addEventListener('robstradomus-tab-unlocks-changed', () => {
        renderTabNotificationBadges();
        if (document.getElementById('character-panel')?.classList.contains('panel-open')) renderCharacterPanel();
        if (document.getElementById('materials-panel')?.classList.contains('panel-open')) renderMaterialsPanel();
        if (document.getElementById('achievements-panel')?.classList.contains('panel-open')) renderAchievementsPanel();
        if (document.getElementById('discovery-panel')?.classList.contains('panel-open')) renderDiscoveryJournal();
    });
    window.addEventListener('robstradomus-upgrades-changed', renderTabNotificationBadges);
    window.addEventListener('robstradomus-equipment-journal-changed', () => {
        renderDiscoveryJournal();
        if (document.getElementById('character-panel')?.classList.contains('panel-open')) renderCharacterPanel();
    });
    renderDiscoveryJournal();
    renderCharacterPanel();
    renderMaterialsPanel();
    renderAchievementsPanel();
    renderTabNotificationBadges();

    // Handle clicks on UI panels to prevent interaction with game underneath
    const uiPanels = document.querySelectorAll('.ui-panel');
    uiPanels.forEach(p => {
        p.addEventListener('mousedown', e => e.stopPropagation());
    });
});
