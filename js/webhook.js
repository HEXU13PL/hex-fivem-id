import { getPlayers } from './fetch.js';

// Twój adres URL webhooka z Discorda
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1547978459660288201/u7y8LBnTVmlqs8cXbsxoxh-IXMxnZcnih1S8swN8O3gGW8Yu7OVDXwxWGBsXNK7Pm8rN';

// Czas w milisekundach (5 minut = 300 000 ms)
const INTERVAL_TIME = 5 * 60 * 1000; 

let webhookInterval = null;

const showNotification = (message, type) => {
    if (window.createNotification) {
        window.createNotification({
            message,
            type,
            duration: 3000,
        });
    }
};

export async function sendPlayersToDiscordManual() {
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('TUTAJ_WKLEJ')) {
        showNotification('Ustaw URL webhooka w js/webhook.js!', 'error');
        return;
    }

    const players = getPlayers();

    if (!players || players.length === 0) {
        showNotification('Brak danych o graczach do wysłania', 'error');
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
            text: 'HEX FiveM id • Manual Export',
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
            showNotification('Wysłano listę graczy na Discorda!', 'success');
        } else {
            showNotification(`Błąd wysyłania: Status ${response.status}`, 'error');
        }
    } catch (error) {
        console.error('Błąd podczas wysyłania webhooka:', error);
        showNotification('Błąd połączenia z Discordem', 'error');
    }
}

export const startWebhookNotifier = () => {
    if (webhookInterval) return;

    console.info('Webhook notifier started (every 5 minutes)');

    webhookInterval = setInterval(() => {
        sendPlayersToDiscordManual();
    }, INTERVAL_TIME);
};

// Obsługa przycisku w HTML (jeśli przycisk ma id="send-webhook-button")
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('#send-webhook-button');
    if (btn) {
        btn.addEventListener('click', sendPlayersToDiscordManual);
    }
});

// Automatyczny interval w tle
startWebhookNotifier();