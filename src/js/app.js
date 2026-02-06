/**
 * ANIRUL - Aplicación Principal
 * Sistema de Bitácora RPG Turn-Based
 */

const { ipcRenderer } = require('electron');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════

let profiles = [];
let currentProfile = null;
let currentProfileId = null;
let selectedDocuments = [];
let combat = null;
let selectedSkill = null;
let pendingSkill = null;
let pendingDamage = 0;
let editingEntryIndex = null;
let currentActor = 'player'; // 'player' or enemy id
let selectedDocFilter = null; // For filtering skills by document

const parser = new SkillParser();

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initTitlebar();
    loadProfiles();
    initInputFocusFix();
});

function initTitlebar() {
    document.getElementById('btn-minimize').onclick = () => ipcRenderer.send('window-minimize');
    document.getElementById('btn-maximize').onclick = () => ipcRenderer.send('window-maximize');
    document.getElementById('btn-close').onclick = () => ipcRenderer.send('window-close');
}

/**
 * Fix for Electron input focus issues
 * Prevents inputs from losing focus unexpectedly
 */
function initInputFocusFix() {
    // Logic removed: Replaced by CSS -webkit-app-region: no-drag solution
    // The previous JS listeners were potential causes of input blocking/conflict.
    console.log('initInputFocusFix: Legacy fix disabled.');
}

// ═══════════════════════════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════════════════════════

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'screen-profiles') {
        renderProfilesList();
        newProfile();
    } else if (screenId === 'screen-select-profile') {
        renderProfileSelectList();
    }
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE PERFILES
// ═══════════════════════════════════════════════════════════════

async function loadProfiles() {
    profiles = await ipcRenderer.invoke('load-profiles');
}

function renderProfilesList() {
    const container = document.getElementById('profiles-list-content');

    if (profiles.length === 0) {
        container.innerHTML = '<div class="log-empty">No hay perfiles</div>';
        return;
    }

    container.innerHTML = profiles.map(p => `
        <div class="profile-item ${p.id === currentProfileId ? 'active' : ''}" onclick="selectProfile('${p.id}')">
            <div class="profile-item-name">${p.nombre}</div>
            <div class="profile-item-meta">${p.habilidades ? p.habilidades.length : 0} habilidades</div>
        </div>
    `).join('');
}

function selectProfile(profileId) {
    currentProfileId = profileId;
    currentProfile = profiles.find(p => p.id === profileId);

    if (!currentProfile) return;

    document.getElementById('editor-title').textContent = `Editar: ${currentProfile.nombre}`;
    document.getElementById('profile-name').value = currentProfile.nombre;

    const stats = currentProfile.stats || {};
    document.getElementById('stat-vit').value = stats.VIT_max || 100;
    document.getElementById('stat-fue').value = stats.FUE || 5;
    document.getElementById('stat-vel').value = stats.VEL || 5;
    document.getElementById('stat-pm').value = stats.PM || 5;
    document.getElementById('stat-vol').value = stats.VOL || 5;
    document.getElementById('stat-ref').value = stats.REF || 5;

    selectedDocuments = (currentProfile.documentos || []).map(d => d.ruta);
    renderDocumentsList();
    updateSkillCount();
    renderProfilesList();
}

function newProfile() {
    currentProfileId = null;
    currentProfile = null;
    selectedDocuments = [];

    document.getElementById('editor-title').textContent = 'Nuevo Perfil';
    document.getElementById('profile-name').value = '';
    document.getElementById('stat-vit').value = 100;
    document.getElementById('stat-fue').value = 5;
    document.getElementById('stat-vel').value = 5;
    document.getElementById('stat-pm').value = 5;
    document.getElementById('stat-vol').value = 5;
    document.getElementById('stat-ref').value = 5;

    renderDocumentsList();
    updateSkillCount();
    renderProfilesList();
}

async function addDocuments() {
    const filePaths = await ipcRenderer.invoke('dialog-open-files');

    for (const filePath of filePaths) {
        if (!selectedDocuments.includes(filePath)) {
            selectedDocuments.push(filePath);
        }
    }

    renderDocumentsList();
    updateSkillCount();
}

function removeDocument(index) {
    selectedDocuments.splice(index, 1);
    renderDocumentsList();
    updateSkillCount();
}

function renderDocumentsList() {
    const container = document.getElementById('documents-list');

    if (selectedDocuments.length === 0) {
        container.innerHTML = '<span style="color: var(--text-tertiary); font-size: 11px;">Sin documentos</span>';
        return;
    }

    container.innerHTML = selectedDocuments.map((doc, i) => `
        <div class="document-tag">
            <span>${path.basename(doc)}</span>
            <button onclick="removeDocument(${i})">×</button>
        </div>
    `).join('');
}

async function updateSkillCount() {
    let totalSkills = 0;

    for (const filePath of selectedDocuments) {
        const result = await ipcRenderer.invoke('read-file', filePath);
        if (result.success) {
            const skills = parser.parseFile(result.content, path.basename(filePath), filePath);
            totalSkills += skills.length;
        }
    }

    document.getElementById('total-skills').textContent = `Total: ${totalSkills} habilidades`;
}

async function saveProfile() {
    const nombre = document.getElementById('profile-name').value.trim();

    if (!nombre) {
        showAlert('El nombre es requerido');
        return;
    }

    const stats = {
        VIT_max: parseInt(document.getElementById('stat-vit').value) || 100,
        FUE: parseInt(document.getElementById('stat-fue').value) || 5,
        VEL: parseInt(document.getElementById('stat-vel').value) || 5,
        PM: parseInt(document.getElementById('stat-pm').value) || 5,
        VOL: parseInt(document.getElementById('stat-vol').value) || 5,
        REF: parseInt(document.getElementById('stat-ref').value) || 5
    };

    const habilidades = [];
    const documentos = [];

    for (const filePath of selectedDocuments) {
        const result = await ipcRenderer.invoke('read-file', filePath);
        if (result.success) {
            const skills = parser.parseFile(result.content, path.basename(filePath), filePath);
            habilidades.push(...skills);
            documentos.push({
                ruta: filePath,
                nombre: path.basename(filePath),
                habilidades_count: skills.length
            });
        }
    }

    const profile = {
        id: currentProfileId || nombre.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        nombre: nombre,
        stats: stats,
        documentos: documentos,
        habilidades: habilidades
    };

    const result = await ipcRenderer.invoke('save-profile', profile);

    if (result.success) {
        await loadProfiles();
        renderProfilesList();
        selectProfile(profile.id);
        showAlert('Perfil guardado');
    } else {
        showAlert('Error: ' + result.error);
    }
}

async function deleteProfile() {
    if (!currentProfileId) return;

    if (!confirm(`¿Eliminar "${currentProfile.nombre}"?`)) {
        return;
    }

    await ipcRenderer.invoke('delete-profile', currentProfileId);
    await loadProfiles();
    newProfile();
    renderProfilesList();
}

// ═══════════════════════════════════════════════════════════════
// SELECCIÓN DE PERFIL PARA COMBATE
// ═══════════════════════════════════════════════════════════════

function renderProfileSelectList() {
    const container = document.getElementById('select-profile-list');

    if (profiles.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-tertiary);">
                No hay perfiles. Crea uno primero.
                <br><br>
                <button class="btn" onclick="showScreen('screen-profiles')">Ir a Perfiles</button>
            </div>
        `;
        return;
    }

    container.innerHTML = profiles.map(p => `
        <div class="profile-select-card" onclick="startCombat('${p.id}')">
            <h4>${p.nombre}</h4>
            <p>${p.habilidades ? p.habilidades.length : 0} habilidades</p>
        </div>
    `).join('');
}

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE COMBATE
// ═══════════════════════════════════════════════════════════════

function startCombat(profileId) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    combat = {
        profile: profile,
        round: 1,
        turn: 1,
        vit: profile.stats.VIT_max,
        vitMax: profile.stats.VIT_max,
        pa: 8,
        paMax: 8,
        enemies: [],
        log: [],
        indirects: [],
        enemyIdCounter: 0,
        logIdCounter: 0,
        actionCount: 0
    };

    // RESET actor to player when starting new combat
    currentActor = 'player';
    clearSelectedSkill();
    showScreen('screen-combat');
    renderCombat();

    // Reset player input visibility
    document.getElementById('skill-input-area').style.display = 'block';
    document.getElementById('enemy-input-area').style.display = 'none';
}

function renderCombat() {
    if (!combat) return;

    // Save focus state before rendering
    const activeElement = document.activeElement;
    const activeId = activeElement ? activeElement.id : null;
    const activeValue = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
        ? activeElement.value : null;
    const selectionStart = activeElement && activeElement.selectionStart;
    const selectionEnd = activeElement && activeElement.selectionEnd;

    // Header
    document.getElementById('combat-title').textContent = combat.profile.nombre;
    document.getElementById('round-info').textContent = `Ronda ${combat.round} | Turno ${combat.turn}`;

    // Player stats
    document.getElementById('player-name').textContent = combat.profile.nombre;

    const vitPercent = (combat.vit / combat.vitMax) * 100;
    document.getElementById('vit-bar').style.width = vitPercent + '%';
    document.getElementById('vit-value').textContent = `${combat.vit}/${combat.vitMax}`;

    const paPercent = (combat.pa / combat.paMax) * 100;
    document.getElementById('pa-bar').style.width = paPercent + '%';
    document.getElementById('pa-value').textContent = `${combat.pa}/${combat.paMax}`;

    // Mini stats
    const stats = combat.profile.stats;
    document.getElementById('player-stats').innerHTML = `
        <div class="stat-mini"><span class="stat-mini-label">FUE</span><span class="stat-mini-value">${stats.FUE}</span></div>
        <div class="stat-mini"><span class="stat-mini-label">VEL</span><span class="stat-mini-value">${stats.VEL}</span></div>
        <div class="stat-mini"><span class="stat-mini-label">PM</span><span class="stat-mini-value">${stats.PM}</span></div>
        <div class="stat-mini"><span class="stat-mini-label">VOL</span><span class="stat-mini-value">${stats.VOL}</span></div>
        <div class="stat-mini"><span class="stat-mini-label">REF</span><span class="stat-mini-value">${stats.REF}</span></div>
    `;

    // Enemies
    renderEnemies();

    // Actor selector
    updateActorSelector();

    // Combat log
    renderCombatLog();

    // Update target dropdowns
    updateTargetDropdown();
    updatePlayerTargetDropdown();
    updateEnemyTargetDropdown();
    // Restore focus
    if (activeId) {
        const newElement = document.getElementById(activeId);
        if (newElement && typeof newElement.focus === 'function') {
            newElement.focus();
            if (activeValue !== null && (newElement.tagName === 'INPUT' || newElement.tagName === 'TEXTAREA')) {
                // Only restore value if it's different to avoid cursor jumps if not needed, 
                // but usually needed if the render reset it.
                // However, setting value moves cursor to end usually.
                // So we restore selection range.
                newElement.value = activeValue;
                if (typeof selectionStart === 'number') {
                    newElement.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        }
    }
}

/**
 * Helper to preserve focus when updating innerHTML of elements
 */
function preserveFocusUpdate(callback) {
    const activeElement = document.activeElement;
    const activeId = activeElement ? activeElement.id : null;
    const activeValue = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
        ? activeElement.value : null;
    const selectionStart = activeElement && activeElement.selectionStart;
    const selectionEnd = activeElement && activeElement.selectionEnd;

    callback();

    // Restore focus
    if (activeId) {
        const newElement = document.getElementById(activeId);
        if (newElement && typeof newElement.focus === 'function') {
            newElement.focus();
            if (activeValue !== null && (newElement.tagName === 'INPUT' || newElement.tagName === 'TEXTAREA')) {
                newElement.value = activeValue;
                if (typeof selectionStart === 'number') {
                    newElement.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        }
    }
}

function updateActorSelector() {
    const select = document.getElementById('actor-select');
    const wasFocused = document.activeElement === select;
    select.innerHTML = '<option value="player">Yo (Jugador)</option>' +
        combat.enemies.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    select.value = currentActor;
    if (wasFocused) select.focus();
}

function onActorChange() {
    currentActor = document.getElementById('actor-select').value;

    const playerInput = document.getElementById('skill-input-area');
    const enemyInput = document.getElementById('enemy-input-area');

    if (currentActor === 'player') {
        playerInput.style.display = 'block';
        enemyInput.style.display = 'none';
    } else {
        playerInput.style.display = 'none';
        enemyInput.style.display = 'block';
        // Update enemy actor name
        const enemy = combat.enemies.find(e => e.id === currentActor);
        document.getElementById('enemy-actor-name').textContent = enemy ? enemy.name : 'Adversario';
    }
}

function updateTargetDropdown() {
    const targetSelect = document.getElementById('skill-target');
    if (!targetSelect) return;

    const wasFocused = document.activeElement === targetSelect;
    const currentValue = targetSelect.value;
    targetSelect.innerHTML = '<option value="">Objetivo...</option>' +
        combat.enemies.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    if (currentValue) targetSelect.value = currentValue;
    if (wasFocused) targetSelect.focus();
}

function updatePlayerTargetDropdown() {
    const targetSelect = document.getElementById('player-free-target');
    if (!targetSelect) return;

    const wasFocused = document.activeElement === targetSelect;
    const currentValue = targetSelect.value;
    targetSelect.innerHTML = '<option value="">Objetivo...</option>' +
        combat.enemies.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    if (currentValue) targetSelect.value = currentValue;
    if (wasFocused) targetSelect.focus();
}

function updateEnemyTargetDropdown() {
    const targetSelect = document.getElementById('enemy-target');
    if (!targetSelect) return;

    const wasFocused = document.activeElement === targetSelect;
    const currentValue = targetSelect.value;
    targetSelect.innerHTML = '<option value="player">Jugador</option>' +
        combat.enemies.filter(e => e.id !== currentActor).map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    if (currentValue) targetSelect.value = currentValue;
    if (wasFocused) targetSelect.focus();
}

function renderEnemies() {
    const container = document.getElementById('enemies-list');

    if (combat.enemies.length === 0) {
        container.innerHTML = '<div class="log-empty" style="padding: 16px; text-align: center;">Sin adversarios</div>';
        return;
    }

    container.innerHTML = combat.enemies.map(e => {
        const vitPercent = (e.vit / e.vitMax) * 100;
        const paPercent = (e.pa / e.paMax) * 100;
        return `
            <div class="enemy-card">
                <div class="enemy-card-header">
                    <span class="enemy-card-name">${e.name}</span>
                    <button class="enemy-card-remove" onclick="removeEnemy('${e.id}')">×</button>
                </div>
                <div class="stat-bar">
                    <div class="stat-bar-track">
                        <div class="stat-bar-fill enemy" style="width: ${vitPercent}%"></div>
                    </div>
                </div>
                <div style="font-size: 11px; color: var(--text-tertiary); text-align: center;">VIT: ${e.vit}/${e.vitMax}</div>
                <div class="stat-bar" style="margin-top: 6px;">
                    <div class="stat-bar-track">
                        <div class="stat-bar-fill pa" style="width: ${paPercent}%"></div>
                    </div>
                </div>
                <div style="font-size: 11px; color: var(--text-tertiary); text-align: center;">PA: ${e.pa}/${e.paMax}</div>
            </div>
        `;
    }).join('');
}

function renderCombatLog() {
    const container = document.getElementById('combat-log');

    if (combat.log.length === 0) {
        container.innerHTML = '<div class="log-empty">Usa una habilidad para comenzar</div>';
        return;
    }

    // Group by round, then by turn
    const rounds = {};
    for (const entry of combat.log) {
        if (!rounds[entry.round]) {
            rounds[entry.round] = {};
        }
        if (!rounds[entry.round][entry.turn]) {
            rounds[entry.round][entry.turn] = [];
        }
        rounds[entry.round][entry.turn].push(entry);
    }

    let html = '';

    const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

    for (const roundNum of roundNumbers) {
        const turns = rounds[roundNum];
        const turnNumbers = Object.keys(turns).map(Number).sort((a, b) => a - b);

        html += `
            <div class="log-round">
                <div class="log-round-header">
                    <span class="log-round-title">Ronda ${roundNum}</span>
                    <div class="log-round-actions">
                        <button class="btn btn-icon btn-ghost btn-sm" onclick="deleteRound(${roundNum})" title="Eliminar ronda">×</button>
                    </div>
                </div>
        `;

        for (const turnNum of turnNumbers) {
            const entries = turns[turnNum];

            html += `
                <div class="log-turn">
                    <div class="log-turn-header">
                        <span class="log-turn-title">Turno ${turnNum}</span>
                        <div class="log-turn-actions">
                            <button class="btn btn-icon btn-ghost btn-sm" onclick="deleteTurn(${roundNum}, ${turnNum})" title="Eliminar turno">×</button>
                        </div>
                    </div>
            `;

            for (const entry of entries) {
                html += renderLogEntry(entry);
            }

            html += '</div>';
        }

        html += '</div>';
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function renderLogEntry(entry) {
    let iconClass = '';
    let icon = '';
    let mainText = '';

    if (entry.type === 'skill') {
        iconClass = 'skill';
        icon = '⚔';
        mainText = `<strong>${entry.actorName || 'Jugador'}</strong> usa <strong>${entry.skillName}</strong>`;
        if (entry.alcance) mainText += ` <span style="color: var(--text-tertiary);">[${entry.alcance}]</span>`;
        // Show PA cost
        if (entry.paCost !== undefined) mainText += ` <span style="color: var(--accent);">(${entry.paCost} PA)</span>`;
        if (entry.target) mainText += ` → ${entry.target}`;
        if (entry.damage > 0) {
            mainText += ` <span style="color: var(--danger);">(${entry.damage} daño)</span>`;
            const receivedClass = entry.damageReceived ? 'received' : 'pending';
            const receivedText = entry.damageReceived ? '✓ Recibido' : 'Marcar recibido';
            mainText += ` <button class="damage-received-btn ${receivedClass}" onclick="toggleDamageReceived(${entry.id})">${receivedText}</button>`;
        }
        if (entry.indirect) {
            mainText += ` <span style="color: var(--warning);">+ Indirecto ${entry.indirect.percent}% x${entry.indirect.actions} acc</span>`;
        }
    } else if (entry.type === 'enemy-action') {
        iconClass = 'damage';
        icon = '⚔';
        if (entry.damage > 0) {
            mainText = `<strong>${entry.actorName}</strong> hace <strong style="color: var(--danger);">${entry.damage}</strong> daño a ${entry.target}`;
            // Show PA cost
            if (entry.paCost !== undefined) mainText += ` <span style="color: var(--accent);">(${entry.paCost} PA)</span>`;
            const receivedClass = entry.damageReceived ? 'received' : 'pending';
            const receivedText = entry.damageReceived ? '✓ Recibido' : 'Marcar recibido';
            mainText += ` <button class="damage-received-btn ${receivedClass}" onclick="toggleDamageReceived(${entry.id})">${receivedText}</button>`;
        } else {
            mainText = `<strong>${entry.actorName}</strong> realiza una acción`;
            if (entry.paCost !== undefined) mainText += ` <span style="color: var(--accent);">(${entry.paCost} PA)</span>`;
        }
        if (entry.indirect) {
            mainText += ` <span style="color: var(--warning);">+ Indirecto ${entry.indirect.percent}% x${entry.indirect.actions} acc</span>`;
        }
    } else if (entry.type === 'player-free') {
        iconClass = 'skill';
        icon = '✦';
        mainText = `<strong>${entry.actorName || 'Jugador'}</strong>`;
        if (entry.paCost !== undefined) mainText += ` <span style="color: var(--accent);">(${entry.paCost} PA)</span>`;
        if (entry.target) mainText += ` → ${entry.target}`;
        if (entry.damage > 0) {
            mainText += ` <span style="color: var(--danger);">(${entry.damage} daño)</span>`;
            const receivedClass = entry.damageReceived ? 'received' : 'pending';
            const receivedText = entry.damageReceived ? '✓ Recibido' : 'Marcar recibido';
            mainText += ` <button class="damage-received-btn ${receivedClass}" onclick="toggleDamageReceived(${entry.id})">${receivedText}</button>`;
        }
        if (entry.indirect) {
            mainText += ` <span style="color: var(--warning);">+ Indirecto ${entry.indirect.percent}% x${entry.indirect.actions} acc</span>`;
        }
    } else if (entry.type === 'blank') {
        iconClass = '';
        icon = '⊘';
        mainText = `<span style="color: var(--text-tertiary);">Acción en blanco</span>`;
    } else if (entry.type === 'indirect-tick') {
        return `
            <div class="log-entry-indirect">
                ${entry.targetName} recibe <strong style="color: var(--danger);">-${entry.damage}</strong> por indirecto de ${entry.sourceName}
            </div>
        `;
    }

    // Show mechanical effect
    let effectText = '';
    if (entry.type === 'skill' && entry.efecto) {
        effectText = `<div class="log-entry-meta">${entry.efecto}</div>`;
    }

    return `
        <div class="log-entry ${iconClass}">
            <div class="log-entry-icon">${icon}</div>
            <div class="log-entry-content">
                <div class="log-entry-main">${mainText}</div>
                ${effectText}
                ${entry.notes ? `<div class="log-entry-meta" style="color: var(--text-tertiary); font-style: italic;">${entry.notes}</div>` : ''}
            </div>
            <div class="log-entry-actions">
                <button class="btn btn-icon btn-ghost btn-sm" onclick="editEntry(${entry.id})" title="Editar">✎</button>
                <button class="btn btn-icon btn-ghost btn-sm" onclick="deleteEntry(${entry.id})" title="Eliminar">×</button>
            </div>
        </div>
    `;
}

function toggleDamageReceived(entryId) {
    const entry = combat.log.find(e => e.id === entryId);
    if (!entry) return;

    entry.damageReceived = !entry.damageReceived;

    if (entry.damageReceived) {
        if (entry.targetId === 'player') {
            combat.vit = Math.max(0, combat.vit - entry.damage);
        } else {
            const enemy = combat.enemies.find(e => e.id === entry.targetId);
            if (enemy) {
                enemy.vit = Math.max(0, enemy.vit - entry.damage);
            }
        }
    } else {
        if (entry.targetId === 'player') {
            combat.vit = Math.min(combat.vitMax, combat.vit + entry.damage);
        } else {
            const enemy = combat.enemies.find(e => e.id === entry.targetId);
            if (enemy) {
                enemy.vit = Math.min(enemy.vitMax, enemy.vit + entry.damage);
            }
        }
    }

    renderCombat();
}

function nextTurn() {
    combat.turn++;
    renderCombat();
}

function endRound() {
    combat.pa = combat.paMax;
    combat.skillUsesThisRound = {};
    combat.round++;
    combat.turn = 1;

    for (const enemy of combat.enemies) {
        if (enemy.paMax) {
            enemy.pa = enemy.paMax;
        }
    }

    renderCombat();
}

function confirmEndCombat() {
    if (confirm('¿Terminar el combate?')) {
        combat = null;
        currentActor = 'player'; // Reset on exit
        showScreen('screen-menu');
    }
}

// ═══════════════════════════════════════════════════════════════
// ACTION PROCESSING (handles indirects)
// ═══════════════════════════════════════════════════════════════

function processAction() {
    combat.actionCount++;

    const ticksToAdd = [];

    for (let i = combat.indirects.length - 1; i >= 0; i--) {
        const ind = combat.indirects[i];
        if (ind.actionsLeft > 0) {
            const tickDamage = Math.floor(ind.baseDamage * (ind.percent / 100));

            if (ind.targetId === 'player') {
                combat.vit = Math.max(0, combat.vit - tickDamage);
            } else {
                const enemy = combat.enemies.find(e => e.id === ind.targetId);
                if (enemy) {
                    enemy.vit = Math.max(0, enemy.vit - tickDamage);
                }
            }

            combat.logIdCounter++;
            ticksToAdd.push({
                id: combat.logIdCounter,
                type: 'indirect-tick',
                round: combat.round,
                turn: combat.turn,
                targetId: ind.targetId,
                targetName: ind.targetName,
                damage: tickDamage,
                sourceName: ind.sourceName
            });

            ind.actionsLeft--;

            if (ind.actionsLeft <= 0) {
                combat.indirects.splice(i, 1);
            }
        }
    }

    combat.log.push(...ticksToAdd);
}

// ═══════════════════════════════════════════════════════════════
// SKILL INPUT BAR
// ═══════════════════════════════════════════════════════════════

function clearSelectedSkill() {
    pendingSkill = null;
    pendingDamage = 0;
    const emptyDiv = document.getElementById('skill-input-empty');
    const fullDiv = document.getElementById('skill-input-full');
    if (emptyDiv) emptyDiv.style.display = 'flex';
    if (fullDiv) fullDiv.style.display = 'none';

    const addIndirect = document.getElementById('add-indirect');
    const indirectOptions = document.getElementById('indirect-options');
    if (addIndirect) addIndirect.checked = false;
    if (indirectOptions) indirectOptions.style.display = 'none';
}

function toggleIndirectOptions() {
    const checked = document.getElementById('add-indirect').checked;
    document.getElementById('indirect-options').style.display = checked ? 'flex' : 'none';
}

function togglePlayerFreeIndirectOptions() {
    const checked = document.getElementById('player-free-indirect').checked;
    document.getElementById('player-free-indirect-options').style.display = checked ? 'flex' : 'none';
}

function toggleEnemyIndirectOptions() {
    const checked = document.getElementById('enemy-add-indirect').checked;
    document.getElementById('enemy-indirect-options').style.display = checked ? 'flex' : 'none';
}

function setSelectedSkill(skill) {
    pendingSkill = skill;

    pendingDamage = 0;
    const formula = parser.extractDamageFormula(skill.efecto);
    if (formula && combat) {
        const statValue = combat.profile.stats[formula.stat] || 5;
        pendingDamage = Math.floor(statValue * formula.multiplier);
    }

    const cost = skill.costo_pa || 1;

    document.getElementById('skill-input-empty').style.display = 'none';
    document.getElementById('skill-input-full').style.display = 'flex';

    document.getElementById('input-skill-name').textContent = skill.nombre;
    document.getElementById('input-skill-range').textContent = `Alcance: ${skill.alcance || 'N/A'}`;
    document.getElementById('input-skill-cost').textContent = `${cost} PA`;

    const damageDiv = document.getElementById('input-skill-damage');
    if (pendingDamage > 0) {
        damageDiv.style.display = 'block';
        document.getElementById('input-damage-value').textContent = pendingDamage;
    } else {
        damageDiv.style.display = 'none';
    }

    const effectText = skill.efecto || skill.efecto_visual || 'Sin descripción';
    document.getElementById('input-skill-effect').textContent = effectText;

    updateTargetDropdown();

    document.getElementById('skill-notes').value = '';
    document.getElementById('add-indirect').checked = false;
    document.getElementById('indirect-options').style.display = 'none';
}

function sendSkill() {
    if (!pendingSkill || !combat) return;

    const cost = pendingSkill.costo_pa || 1;

    if (cost > combat.pa) {
        showAlert('PA insuficiente');
        return;
    }

    const targetId = document.getElementById('skill-target').value;
    const notes = document.getElementById('skill-notes').value;
    const addIndirect = document.getElementById('add-indirect').checked;

    if (pendingDamage > 0 && !targetId) {
        showAlert('Selecciona un objetivo para habilidades con daño');
        return;
    }

    // Process existing indirects
    processAction();

    // Spend PA
    combat.pa -= cost;

    let targetName = '';
    if (targetId) {
        const enemy = combat.enemies.find(e => e.id === targetId);
        if (enemy) targetName = enemy.name;
    }

    let indirectData = null;
    if (addIndirect && pendingDamage > 0 && targetId) {
        const percent = parseInt(document.getElementById('indirect-percent').value) || 10;
        const actions = parseInt(document.getElementById('indirect-actions').value) || 3;
        indirectData = { percent, actions };

        combat.indirects.push({
            targetId: targetId,
            targetName: targetName,
            baseDamage: pendingDamage,
            percent: percent,
            actionsLeft: actions,
            sourceName: pendingSkill.nombre
        });
    }

    combat.logIdCounter++;
    combat.log.push({
        id: combat.logIdCounter,
        type: 'skill',
        round: combat.round,
        turn: combat.turn,
        actorName: combat.profile.nombre,
        skillId: pendingSkill.id,
        skillName: pendingSkill.nombre,
        alcance: pendingSkill.alcance,
        efecto: pendingSkill.efecto,
        paCost: cost,
        targetId: targetId,
        target: targetName,
        damage: pendingDamage,
        damageReceived: false,
        indirect: indirectData,
        notes: notes
    });

    clearSelectedSkill();
    renderCombat();
}

function sendBlankAction() {
    if (!combat) return;

    combat.logIdCounter++;
    combat.log.push({
        id: combat.logIdCounter,
        type: 'blank',
        round: combat.round,
        turn: combat.turn
    });

    processAction();
    renderCombat();
}

function sendPlayerFreeAction() {
    if (!combat) return;

    const damage = parseInt(document.getElementById('player-free-damage').value) || 0;
    const targetId = document.getElementById('player-free-target').value;
    const paCost = parseInt(document.getElementById('player-free-pa').value) || 0;
    const description = document.getElementById('player-free-desc').value.trim();
    const addIndirect = document.getElementById('player-free-indirect').checked;

    if (!description && damage <= 0) {
        showAlert('Ingresa una descripción o un daño');
        return;
    }

    if (paCost > combat.pa) {
        showAlert('PA insuficiente');
        return;
    }

    if (damage > 0 && !targetId) {
        showAlert('Selecciona un objetivo para habilidades con daño');
        return;
    }

    // Process existing indirects
    processAction();

    // Spend PA
    if (paCost > 0) {
        combat.pa -= paCost;
    }

    let targetName = '';
    if (targetId) {
        const enemy = combat.enemies.find(e => e.id === targetId);
        if (enemy) targetName = enemy.name;
    }

    let indirectData = null;
    if (addIndirect && damage > 0 && targetId) {
        const percent = parseInt(document.getElementById('player-free-indirect-percent').value) || 10;
        const actions = parseInt(document.getElementById('player-free-indirect-actions').value) || 3;
        indirectData = { percent, actions };

        combat.indirects.push({
            targetId: targetId,
            targetName: targetName,
            baseDamage: damage,
            percent: percent,
            actionsLeft: actions,
            sourceName: 'Jugador'
        });
    }

    combat.logIdCounter++;
    combat.log.push({
        id: combat.logIdCounter,
        type: 'player-free',
        round: combat.round,
        turn: combat.turn,
        actorName: combat.profile.nombre,
        paCost: paCost,
        targetId: targetId,
        target: targetName,
        damage: damage,
        damageReceived: false,
        indirect: indirectData,
        notes: description
    });

    // Clear inputs
    document.getElementById('player-free-damage').value = '';
    document.getElementById('player-free-pa').value = '1';
    document.getElementById('player-free-desc').value = '';
    document.getElementById('player-free-indirect').checked = false;
    document.getElementById('player-free-indirect-options').style.display = 'none';

    renderCombat();
}

function sendEnemyAction() {
    if (!combat || currentActor === 'player') return;

    const enemy = combat.enemies.find(e => e.id === currentActor);
    if (!enemy) return;

    const damage = parseInt(document.getElementById('enemy-damage').value) || 0;
    const targetId = document.getElementById('enemy-target').value;
    const addIndirect = document.getElementById('enemy-add-indirect').checked;
    const description = document.getElementById('enemy-description').value.trim();
    const paCost = parseInt(document.getElementById('enemy-pa-cost').value) || 0;

    // Allow sending without damage (just text)
    if (damage <= 0 && !description) {
        showAlert('Ingresa el daño o una descripción');
        return;
    }

    if (paCost > enemy.pa) {
        showAlert('PA insuficiente para este adversario');
        return;
    }

    // Process existing indirects FIRST
    processAction();

    // Spend enemy PA (only if paCost > 0)
    if (paCost > 0) {
        enemy.pa -= paCost;
    }

    let targetName = 'Jugador';
    if (targetId !== 'player') {
        const targetEnemy = combat.enemies.find(e => e.id === targetId);
        if (targetEnemy) targetName = targetEnemy.name;
    }

    // Add indirect AFTER processAction (so it starts from next action)
    let indirectData = null;
    if (addIndirect && damage > 0) {
        const percent = parseInt(document.getElementById('enemy-indirect-percent').value) || 10;
        const actions = parseInt(document.getElementById('enemy-indirect-actions').value) || 3;
        indirectData = { percent, actions };

        combat.indirects.push({
            targetId: targetId,
            targetName: targetName,
            baseDamage: damage,
            percent: percent,
            actionsLeft: actions,
            sourceName: enemy.name
        });
    }

    combat.logIdCounter++;
    combat.log.push({
        id: combat.logIdCounter,
        type: 'enemy-action',
        round: combat.round,
        turn: combat.turn,
        actorId: enemy.id,
        actorName: enemy.name,
        targetId: targetId,
        target: targetName,
        damage: damage,
        paCost: paCost,
        damageReceived: false,
        indirect: indirectData,
        notes: description
    });

    // Clear inputs
    document.getElementById('enemy-damage').value = '';
    document.getElementById('enemy-description').value = '';
    document.getElementById('enemy-add-indirect').checked = false;
    document.getElementById('enemy-indirect-options').style.display = 'none';

    renderCombat();
}

// ═══════════════════════════════════════════════════════════════
// LOG EDITING
// ═══════════════════════════════════════════════════════════════

function editEntry(entryId) {
    const entry = combat.log.find(e => e.id === entryId);
    if (!entry) return;

    editingEntryIndex = combat.log.indexOf(entry);

    document.getElementById('edit-entry-notes').value = entry.notes || '';
    document.getElementById('edit-entry-damage').value = entry.damage || 0;

    openModal('modal-edit-entry');
}

function saveEditingEntry() {
    if (editingEntryIndex === null) return;

    const entry = combat.log[editingEntryIndex];
    entry.notes = document.getElementById('edit-entry-notes').value;
    entry.damage = parseInt(document.getElementById('edit-entry-damage').value) || 0;

    closeModal('modal-edit-entry');
    editingEntryIndex = null;
    renderCombat();
}

function deleteEditingEntry() {
    if (editingEntryIndex === null) return;

    if (confirm('¿Eliminar esta entrada?')) {
        const entry = combat.log[editingEntryIndex];
        restoreDamageIfReceived(entry);
        combat.log.splice(editingEntryIndex, 1);
        closeModal('modal-edit-entry');
        editingEntryIndex = null;
        renderCombat();
    }
}

function deleteEntry(entryId) {
    const index = combat.log.findIndex(e => e.id === entryId);
    if (index === -1) return;

    if (confirm('¿Eliminar esta entrada?')) {
        const entry = combat.log[index];
        restoreDamageIfReceived(entry);
        combat.log.splice(index, 1);
        renderCombat();
    }
}

function restoreDamageIfReceived(entry) {
    // Restore PA if skill was used by player
    if ((entry.type === 'skill' || entry.type === 'player-free') && entry.paCost) {
        combat.pa = Math.min(combat.paMax, combat.pa + entry.paCost);
    }

    // Restore PA if enemy action
    if (entry.type === 'enemy-action' && entry.paCost && entry.actorId) {
        const enemy = combat.enemies.find(e => e.id === entry.actorId);
        if (enemy) {
            enemy.pa = Math.min(enemy.paMax, enemy.pa + entry.paCost);
        }
    }

    if (!entry.damageReceived || !entry.damage) return;

    if (entry.targetId === 'player') {
        combat.vit = Math.min(combat.vitMax, combat.vit + entry.damage);
    } else if (entry.targetId) {
        const enemy = combat.enemies.find(e => e.id === entry.targetId);
        if (enemy) {
            enemy.vit = Math.min(enemy.vitMax, enemy.vit + entry.damage);
        }
    }
}

function deleteTurn(roundNum, turnNum) {
    if (!confirm(`¿Eliminar turno ${turnNum} de la ronda ${roundNum}?`)) return;

    combat.log = combat.log.filter(e => !(e.round === roundNum && e.turn === turnNum));
    renderCombat();
}

function deleteRound(roundNum) {
    if (!confirm(`¿Eliminar toda la ronda ${roundNum}?`)) return;

    combat.log = combat.log.filter(e => e.round !== roundNum);
    renderCombat();
}

// ═══════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════

let lastFocusedElement = null;

function openModal(modalId) {
    // Store the currently focused element
    lastFocusedElement = document.activeElement;
    document.getElementById(modalId).classList.add('active');

    // Focus first input in modal if available
    setTimeout(() => {
        const modal = document.getElementById(modalId);
        const firstInput = modal.querySelector('input:not([type="checkbox"]):not([type="hidden"]), select, textarea');
        if (firstInput) {
            firstInput.focus();
        }
    }, 50);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');

    // Restore focus to previously focused element
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        setTimeout(() => {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }, 50);
    }
}

// --- Skill Selection Modal ---

function openSkillModal() {
    if (!combat) return;

    selectedSkill = null;
    selectedDocFilter = null;
    document.getElementById('skill-search').value = '';
    document.getElementById('btn-confirm-skill').disabled = true;

    renderDocumentFilters();
    const activeSkills = getActiveSkills();
    renderSkillList(activeSkills);
    document.getElementById('skill-details').innerHTML = '<p style="color: var(--text-tertiary);">Selecciona una habilidad</p>';

    openModal('modal-skill');
}

function getActiveSkills() {
    if (!combat || !combat.profile || !combat.profile.habilidades) return [];

    return combat.profile.habilidades.filter(skill => {
        if (skill.esPasiva === true) {
            return false;
        }

        const categoria = (skill.categoria || '').toLowerCase();
        const tipo = (skill.tipo || '').toLowerCase();
        const clasificacion = (skill.clasificacion || '').toLowerCase();

        if (categoria.includes('pasiv') || categoria.includes('parafernalia') ||
            tipo.includes('pasiv') || tipo.includes('parafernalia') ||
            clasificacion.includes('pasiv')) {
            return false;
        }
        return true;
    });
}

function renderDocumentFilters() {
    const container = document.getElementById('doc-filters');
    if (!container || !combat || !combat.profile) return;

    const docs = combat.profile.documentos || [];

    let html = '<button class="doc-filter-btn ' + (selectedDocFilter === null ? 'active' : '') + '" onclick="filterByDocument(null)">Todos</button>';

    for (const doc of docs) {
        const isActive = selectedDocFilter === doc.nombre ? 'active' : '';
        const shortName = doc.nombre.replace(/\[.*?\]\s*/g, '').replace('.txt', '').substring(0, 20);
        html += `<button class="doc-filter-btn ${isActive}" onclick="filterByDocument('${doc.nombre}')" title="${doc.nombre}">${shortName}</button>`;
    }

    container.innerHTML = html;
}

function filterByDocument(docName) {
    selectedDocFilter = docName;
    renderDocumentFilters();
    filterSkills();
}

function renderSkillList(skills) {
    const container = document.getElementById('skill-list');

    if (skills.length === 0) {
        container.innerHTML = '<div class="log-empty">No hay habilidades</div>';
        return;
    }

    container.innerHTML = skills.map(skill => {
        const cost = skill.costo_pa || 1;
        const canUse = cost <= combat.pa;

        return `
            <div class="skill-item ${!canUse ? 'disabled' : ''} ${selectedSkill && selectedSkill.id === skill.id ? 'selected' : ''}"
                 onclick="selectSkill('${skill.id}')"
                 style="${!canUse ? 'opacity: 0.5;' : ''}">
                <div class="skill-item-name">${skill.nombre}</div>
                <div class="skill-item-cost">${cost} PA</div>
            </div>
        `;
    }).join('');
}

function filterSkills() {
    const search = document.getElementById('skill-search').value.toLowerCase();
    let activeSkills = getActiveSkills();

    // Filter by document
    if (selectedDocFilter) {
        activeSkills = activeSkills.filter(s => s.fuente === selectedDocFilter);
    }

    // Filter by search
    const filtered = activeSkills.filter(s =>
        s.nombre.toLowerCase().includes(search)
    );
    renderSkillList(filtered);
}

function selectSkill(skillId) {
    const activeSkills = getActiveSkills();
    selectedSkill = activeSkills.find(s => s.id === skillId);
    if (!selectedSkill) return;

    const cost = selectedSkill.costo_pa || 1;
    const canUse = cost <= combat.pa;

    const details = document.getElementById('skill-details');
    details.innerHTML = `
        <div class="skill-detail-name">
            ${selectedSkill.nombre}
            ${selectedSkill.alcance ? `<span style="font-size: 12px; color: var(--text-tertiary); font-weight: normal;"> — Alcance: ${selectedSkill.alcance}</span>` : ''}
        </div>
        <div class="skill-detail-meta">
            ${selectedSkill.tipo || ''} ${selectedSkill.clasificacion ? '| ' + selectedSkill.clasificacion : ''}
            ${selectedSkill.tier ? ' | TIER ' + selectedSkill.tier : ''}
            | Costo: ${cost} PA
        </div>
        <div class="skill-detail-effect">
            ${selectedSkill.efecto || selectedSkill.efecto_visual || 'Sin descripción'}
        </div>
        ${selectedSkill.aclaraciones && selectedSkill.aclaraciones.length > 0 ? `
            <div style="margin-top: 12px; font-size: 11px; color: var(--text-tertiary);">
                <strong>Aclaraciones:</strong><br>
                ${selectedSkill.aclaraciones.map(a => '— ' + a).join('<br>')}
            </div>
        ` : ''}
    `;

    document.getElementById('btn-confirm-skill').disabled = !canUse;
    filterSkills();
}

function confirmSkillSelection() {
    if (!selectedSkill) return;

    setSelectedSkill(selectedSkill);
    closeModal('modal-skill');
}

// --- Enemy Modal ---

function openAddEnemyModal() {
    if (!combat) return;

    document.getElementById('enemy-name').value = '';
    document.getElementById('enemy-vit').value = 100;

    openModal('modal-enemy');
}

function addEnemy() {
    if (!combat) return;

    const name = document.getElementById('enemy-name').value.trim();
    if (!name) {
        showAlert('El nombre es requerido');
        return;
    }

    const vitMax = parseInt(document.getElementById('enemy-vit').value) || 100;

    combat.enemyIdCounter++;
    const enemy = {
        id: 'enemy_' + combat.enemyIdCounter,
        name: name,
        vit: vitMax,
        vitMax: vitMax,
        pa: 8,
        paMax: 8
    };

    combat.enemies.push(enemy);

    closeModal('modal-enemy');
    renderCombat();
}

function removeEnemy(enemyId) {
    if (!combat) return;
    combat.enemies = combat.enemies.filter(e => e.id !== enemyId);
    combat.indirects = combat.indirects.filter(i => i.targetId !== enemyId);
    if (currentActor === enemyId) {
        currentActor = 'player';
        onActorChange();
    }
    renderCombat();
}

function showAlert(message) {
    document.getElementById('alert-message').textContent = message;
    openModal('modal-alert');
    // Ensure the OK button gets focus
    setTimeout(() => {
        const btn = document.querySelector('#modal-alert .btn-primary');
        if (btn) btn.focus();
    }, 100);
}
