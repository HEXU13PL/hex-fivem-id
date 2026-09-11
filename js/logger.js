const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1547978459660288201/u7y8LBnTVmlqs8cXbsxoxh-IXMxnZcnih1S8swN8O3gGW8Yu7OVDXwxWGBsXNK7Pm8rN';

export function sendLog(type, data = {}) {
    if (!DISCORD_WEBHOOK_URL) return;

    let embed = {
        timestamp: new Date().toISOString(),
        footer: { text: 'HEX FiveM ID • System Logów' }
    };

    switch (type) {
        case 'SERVER_FETCH':
            embed.title = data.isRefresh ? '🔄 Odświeżono Serwer' : '🔍 Wyszukano Serwer';
            embed.color = data.isRefresh ? 3447003 : 15009812;
            embed.fields = [
                { name: 'Nazwa Serwera', value: data.serverName || 'Nieznana', inline: false },
                { name: 'Server ID', value: `\`${(data.serverId || '').toUpperCase()}\``, inline: true },
                { name: 'Gracze Online', value: `\`${data.onlineCount} / ${data.maxCount}\``, inline: true }
            ];
            break;

        case 'FAVORITE_ADD':
            embed.title = '⭐ Dodano Gracza do Ulubionych';
            embed.color = 15844367;
            embed.fields = [
                { name: 'Gracz', value: data.name || 'Nieznany', inline: true },
                { name: 'Identyfikator', value: `\`${data.key || 'N/A'}\``, inline: true }
            ];
            break;

        case 'FAVORITE_REMOVE':
            embed.title = '🗑️ Usunięto Gracza z Ulubionych';
            embed.color = 15158332;
            embed.fields = [
                { name: 'Gracz', value: data.name || 'Nieznany', inline: true },
                { name: 'Identyfikator', value: `\`${data.key || 'N/A'}\``, inline: true }
            ];
            break;

        case 'DISCORD_COPY':
            embed.title = '📋 Skopiowano Discord ID';
            embed.color = 5814786;
            embed.fields = [
                { name: 'Wzmianka', value: `<@${data.discordId}>`, inline: true },
                { name: 'Discord ID', value: `\`${data.discordId}\``, inline: true },
                { name: 'Gracz', value: data.playerName || 'Nieznany', inline: true }
            ];
            break;

        case 'PLAYER_SEARCH':
            embed.title = '🔎 Wyszukiwanie Gracza na Liście';
            embed.color = 3066993;
            embed.fields = [
                { name: 'Szukana fraza', value: `\`${data.query}\``, inline: true }
            ];
            break;

        default:
            return;
    }

    try {
        fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        }).catch(() => {});
    } catch (e) {}
}
