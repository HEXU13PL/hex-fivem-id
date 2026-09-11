import { getPlayers } from './fetch.js';

// Twój adres URL webhooka z Discorda
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1547978459660288201/u7y8LBnTVmlqs8cXbsxoxh-IXMxnZcnih1S8swN8O3gGW8Yu7OVDXwxWGBsXNK7Pm8rN';

// Czas w milisekundach (5 minut = 300 000 ms)
const INTERVAL_TIME = 5 * 60 * 1000; 

let webhookInterval = null;

export const startWebhookNotifier = () => {
    if (webhookInterval) return;

    console.info('Webhook notifier started (every 5 minutes)');
    
    // Pierwsze wysłanie po 10 sekundach (daje czas na załadowanie danych z serwera)
    setTimeout(() => {
        sendPlayersToDiscord();
    }, 10000);

    // Cykliczne wysyłanie co 5 minut
    webhookInterval = setInterval(() => {
        sendPlayersToDiscord();
    }, INTERVAL_TIME);
};

async function sendPlayersToDiscord() {
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('TUTAJ_WKLEJ')) {
        console.warn('Webhook URL nie jest skonfigurowany.');
        return;
    }

    const players = getPlayers();

    if (!players || players.length === 0) {
        console.info('Brak graczy do wysłania na webhook.');
        return;
    }

    const playerListString = players
        .slice(0, 50)
        .map((p) => `\`[ID: ${p.id}]\` **${p.name}** (${p.ping}ms)`)
        .join('\n');

    const embed = {
        title: `📊 Aktualna lista graczy (${players.length})`,
        color: 0x5865f2,
        description: playerListString || 'Brak graczy online',
        timestamp: new Date().toISOString(),
        footer: {
            text: 'HEX FiveM id • Auto-updater',
        },
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                embeds: [embed],
            }),
        });

        if (response.ok) {
            console.info('Wysłano listę graczy na webhook Discorda.');
        } else {
            console.error(`Błąd wysyłania webhooka: Status ${response.status}`);
        }
    } catch (error) {
        console.error('Błąd podczas wysyłania webhooka:', error);
    }
}

// Uruchomienie automatyczne przy załadowaniu modułu
startWebhookNotifier();
