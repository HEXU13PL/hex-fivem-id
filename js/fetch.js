async function fetchServerData(serverId) {
    if (!serverId) return;
    showLoader(true);
    
    try {
        const response = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`);
        if (!response.ok) throw new Error('Nie znaleziono serwera lub serwer jest offline.');
        
        const json = await response.json();
        const data = json.Data;

        currentPlayers = data.players || [];
        
        if (serverNameEl && data.hostname) {
            const cleanName = data.hostname.replace(/\^[0-9]/g, '');
            serverNameEl.textContent = cleanName.length > 30 ? cleanName.substring(0, 30) + '...' : cleanName;
        }

        if (statStatus) statStatus.textContent = 'Online';
        if (statId) statId.textContent = serverId.toUpperCase();
        if (statPlayers) {
            const onlineCount = data.clients ?? currentPlayers.length;
            const maxCount = data.sv_maxclients ?? data.svMaxclients ?? '?';
            statPlayers.textContent = `${onlineCount} / ${maxCount}`;
        }

        saveToHistory(serverId, data.hostname ? data.hostname.replace(/\^[0-9]/g, '') : serverId);
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