async function fetchServerData(serverId, actionType = 'connect') {
    if (!serverId) return;
    showLoader(true);
    
    try {
        // Użycie CORS proxy (naprawia blokadę na GitHub Pages)
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

        // Wysyłanie logu na Discord Webhook
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