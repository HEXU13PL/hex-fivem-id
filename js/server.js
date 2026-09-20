import { addToHistory } from './history.js';

let lastMaxClients = 0;

export const setTitle = (title) => {
    const statStatus = document.querySelector('#stat-status');
    if (statStatus) {
        if (title.includes('Loading')) {
            statStatus.textContent = 'Connecting...';
        } else if (title.includes('Error')) {
            setServerStatus('Offline', false);
        }
    }
};

export const setServerStatus = (status, isOnline = true) => {
    const statStatus = document.querySelector('#stat-status');
    const badge = document.querySelector('.badge-live');
    if (statStatus) {
        statStatus.textContent = status;
    }
    if (badge) {
        if (isOnline) {
            badge.innerHTML = '<span class="status-dot-online"></span> ONLINE';
            badge.style.color = 'var(--online-color)';
            badge.style.background = 'rgba(0, 230, 118, 0.1)';
        } else {
            badge.innerHTML = '<span style="width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; display: inline-block; box-shadow: 0 0 10px #ef4444; margin-right: 8px;"></span> OFFLINE';
            badge.style.color = '#ef4444';
            badge.style.background = 'rgba(239, 68, 68, 0.1)';
        }
    }
};

export const setServerInfo = (serverId, data) => {
    if (!data) return;

    // 1. Current Server ID
    const statId = document.querySelector('#stat-id');
    if (statId) {
        statId.textContent = serverId;
    }

    // 2. Server Status Badge
    setServerStatus('Online', true);

    // 3. Clean Hostname / Server Name
    const serverNameEl = document.querySelector('#server-name');
    let cleanName = 'FiveM Server';
    if (data.hostname) {
        // Usuwamy kody kolorów FiveM (^0, ^1, ... ^9)
        cleanName = data.hostname.replace(/\^[0-9]/g, '').trim();
    }
    if (serverNameEl && cleanName) {
        serverNameEl.textContent = cleanName;
        serverNameEl.title = cleanName;
    }

    // 4. Server Icon
    const serverIconEl = document.querySelector('#server-icon');
    let iconSrc = 'https://fivem.net/favicon.png';
    if (serverIconEl) {
        if (data.icon) {
            iconSrc = data.icon.startsWith('data:') ? data.icon : `data:image/png;base64,${data.icon}`;
            serverIconEl.src = iconSrc;
            serverIconEl.style.display = 'block';
        } else {
            serverIconEl.src = iconSrc;
            serverIconEl.style.display = 'block';
        }
    }

    // 5. Active Players / Max Clients
    const statPlayers = document.querySelector('#stat-players');
    const clients = data.clients ?? (Array.isArray(data.players) ? data.players.length : 0);
    const maxClients = data.sv_maxclients ?? data.vars?.sv_maxclients ?? data.svMaxclients ?? 0;
    lastMaxClients = maxClients;

    if (statPlayers) {
        statPlayers.textContent = `${clients} / ${maxClients}`;
    }

    const serverVersion = data.vars?.version ?? data.version ?? data.serverVersion ?? 'Brak danych';
    const oneSyncValue = data.vars?.onesync ?? data.vars?.onesync_enabled ?? data.onesync;
    const oneSync = oneSyncValue === true || ['on', 'enabled', 'true', '1'].includes(String(oneSyncValue).toLowerCase())
        ? 'ON'
        : oneSyncValue === false || ['off', 'disabled', 'false', '0'].includes(String(oneSyncValue).toLowerCase())
            ? 'OFF'
            : oneSyncValue || 'Brak danych';

    const versionEl = document.querySelector('#kpi-server-version');
    const oneSyncEl = document.querySelector('#kpi-onesync');
    if (versionEl) versionEl.textContent = String(serverVersion);
    if (oneSyncEl) oneSyncEl.textContent = String(oneSync);

    // 6. Update History with real server name and icon
    if (typeof addToHistory === 'function') {
        addToHistory(serverId, cleanName, iconSrc);
    }
};

export const updatePlayerCount = (currentCount) => {
    const statPlayers = document.querySelector('#stat-players');
    if (statPlayers) {
        statPlayers.textContent = `${currentCount} / ${lastMaxClients || '?'}`;
    }
};