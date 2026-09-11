import { getPlayers } from './fetch.js';

// TUTAJ WKLEJ SWÓJ ADRES WEBHOOKA Z DISCORDA
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1547978459660288201/u7y8LBnTVmlqs8cXbsxoxh-IXMxnZcnih1S8swN8O3gGW8Yu7OVDXwxWGBsXNK7Pm8rN';

const showNotification = (message, type = 'info') => {
    if (typeof window.createNotification === 'function') {
        window.createNotification({
            message,
            type,
            duration: 4000,
        });
    } else {
        alert(`${type.toUpperCase()}: ${message}`);
    }
};

export async function sendPlayersToDiscordManual() {
    // 1. Sprawdzenie czy wklejono URL
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('TUTAJ_WKLEJ')) {
        showNotification('Ustaw prawidłowy URL webhooka w pliku js/webhook.js!', 'error');
        console.error('[Webhook] Brak poprawnego URL w pliku js/webhook.js');
        return;
    }

    // 2. Pobranie graczy z aplikacji
    const players = getPlayers();

    if (!players || !Array.isArray(players) || players.length === 0) {
        showNotification('Brak pobranych graczy do wysłania. Połącz się najpierw z serwerem!', 'error');
        return;
    }

    // 3. Przygotowanie treści (Discord ma limit 2000 znaków na wiadomość)
    const playerListString = players
        .slice(0, 30) // ograniczenie do 30 graczy w jednej wiadomości
        .map((p) => `\`[ID: ${p.id || '?'}]\` **${p.name || 'Nieznany'}** (${p.ping ?? '?'}ms)`)
        .join('\n');

    const payload = {
        embeds: [
            {
                title: `📊 Aktualna lista graczy online (${players.length})`,
                color: 0x5865f2,
                description: playerListString || 'Brak graczy',
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'HEX FiveM Browser',
                },
            },
        ],
    };

    // Użycie publicznego CORS Proxy, ponieważ przeglądarki blokują bezpośrednie requesty fetch do Discord API
    const targetUrl = WEBHOOK_URL.trim();
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        showNotification('Wysyłanie danych na Discorda...', 'info');

        let response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        // Backup próba wysłania bezpośrednio, jeśli proxy zawiedzie
        if (!response.ok && response.status !== 204) {
            response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        }

        if (response.ok || response.status === 204) {
            showNotification('Pomyślnie wysłano listę graczy na Discorda!', 'success');
        } else {
            const errText = await response.text();
            console.error('[Webhook Error]', response.status, errText);
            showNotification(`Błąd Discorda (${response.status}). Sprawdź konsolę (F12).`, 'error');
        }
    } catch (error) {
        console.error('[Webhook Catch Error]', error);
        showNotification('Błąd połączenia. Sprawdź konsolę (F12).', 'error');
    }
}

// Podpięcie event listenera po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('#send-webhook-button');
    if (btn) {
        btn.addEventListener('click', sendPlayersToDiscordManual);
    }
});