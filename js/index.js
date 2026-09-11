// ----------------------------------------------------
// KONFIGURACJA DISCORD WEBHOOK
// ----------------------------------------------------
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1547978459660288201/u7y8LBnTVmlqs8cXbsxoxh-IXMxnZcnih1S8swN8O3gGW8Yu7OVDXwxWGBsXNK7Pm8rN'; // Podmień na swój link Webhook z Discorda

let currentPlayers = [];
let favorites = JSON.parse(localStorage.getItem('hex_favorites')) || [];
let history = JSON.parse(localStorage.getItem('hex_history')) || [];

// Elementy DOM
const serverInput = document.getElementById('server-id');
const connectBtn = document.getElementById('server-id-button');
const refreshBtn = document.getElementById('refresh-button');
const searchInput = document.getElementById('search');
const loader = document.getElementById('loader');
const playersTable = document.getElementById('players-table');
const serverNameEl = document.getElementById('server-name');

// Kafelki Statystyk KPI
const statStatus = document.getElementById('stat-status');
const statPlayers = document.getElementById('stat-players');
const statId = document.getElementById('stat-id');

// Zakładki
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Wysyłanie logów na Discord Webhook
async function sendDiscordLog(actionType, serverId, onlineCount = 0, maxCount = 0, serverName = '') {
    if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('TUTAJ_WKLEJ_SWOJ_WEBHOOK')) return;

    const isRefresh = actionType === 'refresh';
    const embed = {
        title: isRefresh ? '🔄 Odświeżono Serwer' : '🔍 Wyszukano Serwer',
        color: isRefresh ? 3447003 : 15009812,
        fields: [
            { name: 'Nazwa Serwera', value: serverName || 'Nieznana', inline: false },
            { name: 'Server ID', value: `\`${serverId.toUpperCase()}\``, inline: true },
            { name: 'Gracze Online', value: `\`${onlineCount} / ${maxCount}\``, inline: true }
        ],
        footer: { text: 'HEX FiveM ID • System Logów' },
        timestamp: new Date().toISOString()
    };

    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
    } catch (err) {
        console.error('Błąd podczas wysyłania logów na Discord:', err);
    }
}

async function fetchServerData(serverId, actionType = 'connect') {
    if (!serverId) return;
    showLoader(true);
    
    try {
        // Użycie CORS proxy do działania na GitHub Pages
        const targetUrl = `https://servers-frontend.fivem.net/api/servers/single/${serverId}`;
        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
        
        if (!response.ok) throw new Error('Nie znaleziono serwera lub serwer jest offline.');
        
        const json = await response.json();
        const data = json.Data;

        currentPlayers = data.players || [];
        
        let cleanName = serverId;
        if (serverNameEl && data.hostname) {
            cleanName = data.hostname.replace(/\^[0-9]/g, '');
            serverNameEl.textContent = cleanName.length > 30 ? cleanName.substring(0, 30) + '...' : cleanName;
        }

        const onlineCount = data.clients ?? currentPlayers.length;
        const maxCount = data.sv_maxclients ?? data.svMaxclients ?? '?';

        if (statStatus) statStatus.textContent = 'Online';
        if (statId) statId.textContent = serverId.toUpperCase();
        if (statPlayers) {
            statPlayers.textContent = `${onlineCount} / ${maxCount}`;
        }

        // Wysyłanie logu
        sendDiscordLog(actionType, serverId, onlineCount, maxCount, cleanName);

        saveToHistory(serverId, cleanName);
        renderPlayersTable(currentPlayers);
        showNotification(`Pomyślnie załadowano serwer ${serverId.toUpperCase()}`);

    } catch (error) {
        showNotification(error.message, true);
        if (statStatus) statStatus.textContent = 'Offline';
        if (statPlayers) statPlayers.textContent = '0 / 0';
        if (statId) statId.textContent = 'ERR';
    } finally {
        showLoader(false);
    }
}

function renderPlayersTable(players) {
    const rows = playersTable.querySelectorAll('tr:not(#table-header)');
    rows.forEach(row => row.remove());

    if (!players || players.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'table-footer';
        tr.innerHTML = `<td colspan="6">Brak graczy na serwerze lub brak danych.</td>`;
        playersTable.appendChild(tr);
        return;
    }

    players.forEach((player, index) => {
        const tr = document.createElement('tr');

        const discordId = player.identifiers?.find(id => id.startsWith('discord:'))?.replace('discord:', '') || null;
        const steamHex = player.identifiers?.find(id => id.startsWith('steam:'))?.replace('steam:', '') || null;
        const license = player.identifiers?.find(id => id.startsWith('license:'))?.replace('license:', '') || null;

        let identifiersHtml = '<div class="table-socials">';
        if (discordId) {
            identifiersHtml += `<a href="https://discord.com/users/${discordId}" target="_blank" class="id-badge discord">Discord: ${discordId}</a>`;
        }
        if (steamHex) {
            identifiersHtml += `<span class="id-badge steam">Steam: ${steamHex}</span>`;
        }
        if (license) {
            identifiersHtml += `<span class="id-badge license">Lic: ${license.substring(0, 8)}...</span>`;
        }
        identifiersHtml += '</div>';

        const isFav = favorites.some(f => f.id === player.id || f.name === player.name);

        tr.innerHTML = `
            <td class="table-no">${index + 1}</td>
            <td class="table-favorite" data-id="${player.id}">
                <img src="img/star.svg" style="${isFav ? 'filter: invert(21%) sepia(91%) saturate(5838%) hue-rotate(352deg) brightness(96%) contrast(105%);' : 'opacity:0.3;'}" alt="Fav">
            </td>
            <td class="table-id">${player.id}</td>
            <td class="table-name">${escapeHtml(player.name)}</td>
            <td>${identifiersHtml}</td>
            <td class="table-ping">${player.ping}ms</td>
        `;

        playersTable.appendChild(tr);
    });
}

function showLoader(show) {
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

function showNotification(msg, isError = false) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const note = document.createElement('div');
    note.className = 'notification';
    if (isError) note.style.borderLeftColor = 'var(--offline-color)';
    note.innerHTML = `<span>${msg}</span>`;
    container.appendChild(note);
    setTimeout(() => note.remove(), 3000);
}

function escapeHtml(str) {
    return str ? str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
}

function saveToHistory(id, name) {
    history = history.filter(h => h.id !== id);
    history.unshift({ id, name, time: new Date().toLocaleTimeString() });
    if (history.length > 5) history.pop();
    localStorage.setItem('hex_history', JSON.stringify(history));
}

if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        const id = serverInput.value.trim();
        if (id) fetchServerData(id, 'connect');
    });
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        const id = serverInput.value.trim();
        if (id) fetchServerData(id, 'refresh');
    });
}

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = currentPlayers.filter(p => 
            p.name.toLowerCase().includes(query) || 
            String(p.id).includes(query) ||
            p.identifiers?.some(id => id.toLowerCase().includes(query))
        );
        renderPlayersTable(filtered);
    });
}

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const target = btn.getAttribute('data-tab');
        document.getElementById(`${target}-tab`).classList.add('active');
    });
});