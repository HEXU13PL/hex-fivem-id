import { showNotification } from './notifications.js';

let currentPlayers = [];

export function getPlayers() {
    return currentPlayers;
}

export function isValidServerId(id) {
    return typeof id === 'string' && id.length >= 5 && /^[a-zA-Z0-9]+$/.test(id);
}

export function extractServerId(input) {
    if (!input) return '';
    const match = input.match(/(?:cfx\.re\/join\/|fivem\.net\/join\/)?([a-zA-Z0-9]+)/);
    return match ? match[1] : input;
}

export async function fetchServer(serverId) {
    if (!serverId) return;
    
    const loader = document.querySelector('#loader');
    if (loader) loader.style.display = 'flex';

    try {
        const targetUrl = `https://servers-frontend.fivem.net/api/servers/single/${serverId}`;
        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);

        if (!response.ok) throw new Error('Nie znaleziono serwera lub serwer jest offline.');

        const json = await response.json();
        const data = json.Data;

        currentPlayers = data.players || [];

        const onlineCount = data.clients ?? currentPlayers.length;
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

        showNotification(`Pomyślnie załadowano serwer ${serverId.toUpperCase()}`);
        return data;

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        if (loader) loader.style.display = 'none';
    }
}