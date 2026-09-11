import { showNotification } from './notifications.js';

// Wklej swój webhook poniżej
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1547978459660288201/u7y8LBnTVmlqs8cXbsxoxh-IXMxnZcnih1S8swN8O3gGW8Yu7OVDXwxWGBsXNK7Pm8rN'; 

export function isValidServerId(id) {
    return typeof id === 'string' && id.length >= 5 && /^[a-zA-Z0-9]+$/.test(id);
}

export function extractServerId(input) {
    if (!input) return '';
    const match = input.match(/(?:cfx\.re\/join\/|fivem\.net\/join\/)?([a-zA-Z0-9]+)/);
    return match ? match[1] : input;
}

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
        console.error('Błąd wysyłania logów na Discord:', err);
    }
}

export async function fetchServer(serverId, actionType = 'connect') {
    if (!serverId) return;
    
    const loader = document.querySelector('#loader');
    if (loader) loader.style.display = 'flex';

    try {
        const targetUrl = `https://servers-frontend.fivem.net/api/servers/single/${serverId}`;
        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);

        if (!response.ok) throw new Error('Nie znaleziono serwera lub serwer jest offline.');

        const json = await response.json();
        const data = json.Data;

        const onlineCount = data.clients ?? (data.players ? data.players.length : 0);
        const maxCount = data.sv_maxclients ?? data.svMaxclients ?? '?';
        const cleanName = data.hostname ? data.hostname.replace(/\^[0-9]/g, '') : serverId;

        const serverNameEl = document.querySelector('#server-name');
        if (serverNameEl) serverNameEl.textContent = cleanName;

        const statStatus = document.querySelector('#stat-status');
        const statPlayers = document.querySelector('#stat-players');
        const statId = document.querySelector('#stat-id');

        if (statStatus) statStatus.textContent = 'Online';
        if (statId) statId.textContent = serverId.toUpperCase();
        if (statPlayers) statPlayers.textContent = `${onlineCount} / ${maxCount}`;

        sendDiscordLog(actionType, serverId, onlineCount, maxCount, cleanName);

        showNotification(`Pomyślnie załadowano serwer ${serverId.toUpperCase()}`);
        return data;

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        if (loader) loader.style.display = 'none';
    }
}