import { BANNED_USERS } from './bannedUsers.js';
import { ALLOWED_SESSION_IDS, SITE_ACCESS_LOCKED } from './siteAccess.js';

const SESSION_ID_STORAGE_KEY = 'hex_user_id';
const SESSION_ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function createSessionId() {
    const randomValues = new Uint8Array(10);
    crypto.getRandomValues(randomValues);
    const suffix = Array.from(randomValues, (value) => SESSION_ID_ALPHABET[value % SESSION_ID_ALPHABET.length]).join('');
    return `USR-${suffix}`;
}

function getSessionId() {
    const storedSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (storedSessionId) return storedSessionId;

    const sessionId = createSessionId();
    localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
    return sessionId;
}

function copySessionId(sessionId, status) {
    const showCopyResult = (message) => {
        status.textContent = message;
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(sessionId).then(
            () => showCopyResult('ID sesji skopiowane.'),
            () => showCopyResult('Nie udało się skopiować ID. Zaznacz je i skopiuj ręcznie.')
        );
        return;
    }

    const input = document.createElement('textarea');
    input.value = sessionId;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    try {
        input.select();
        const copied = document.execCommand('copy');
        showCopyResult(copied ? 'ID sesji skopiowane.' : 'Nie udało się skopiować ID. Zaznacz je i skopiuj ręcznie.');
    } catch (error) {
        console.error('Nie udało się skopiować ID sesji:', error);
        showCopyResult('Nie udało się skopiować ID. Zaznacz je i skopiuj ręcznie.');
    } finally {
        input.remove();
    }
}

function showBlockedPage(sessionId, reason) {
    document.documentElement.innerHTML = `
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Strona tymczasowo zablokowana</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    min-height: 100vh;
                    margin: 0;
                    padding: 24px;
                    display: grid;
                    place-items: center;
                    background: #070709;
                    color: #f8f9fa;
                    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
                }
                main {
                    width: min(100%, 460px);
                    padding: 40px 32px;
                    border: 1px solid rgba(255,255,255,.1);
                    border-radius: 16px;
                    background: #14141c;
                    text-align: center;
                    box-shadow: 0 24px 80px rgba(0,0,0,.4);
                }
                h1 { margin: 0 0 12px; color: #ff3942; font-size: clamp(1.8rem, 8vw, 2.4rem); }
                p { margin: 0 0 24px; color: #b5b5c7; line-height: 1.6; }
                .session-label { display: block; margin-bottom: 8px; color: #8c8c9e; font-size: .85rem; }
                code {
                    display: block;
                    margin-bottom: 16px;
                    padding: 12px;
                    border: 1px solid rgba(255,255,255,.1);
                    border-radius: 8px;
                    background: #0a0a10;
                    color: #fff;
                    font-size: 1rem;
                    overflow-wrap: anywhere;
                }
                button {
                    width: 100%;
                    padding: 12px 18px;
                    border: 0;
                    border-radius: 8px;
                    background: #e50914;
                    color: white;
                    font: inherit;
                    font-weight: 700;
                    cursor: pointer;
                }
                button:hover { background: #ff1e27; }
                #copy-status { min-height: 1.4em; margin: 12px 0 0; color: #9a9ab0; font-size: .85rem; }
            </style>
        </head>
        <body>
            <main>
                <h1>Strona tymczasowo zablokowana</h1>
                <p>${reason}</p>
                <span class="session-label">Twoje ID sesji</span>
                <code id="session-id"></code>
                <button id="copy-session-id" type="button">Kopiuj ID sesji</button>
                <p id="copy-status" role="status" aria-live="polite"></p>
            </main>
        </body>
    `;

    const idElement = document.getElementById('session-id');
    const copyButton = document.getElementById('copy-session-id');
    const status = document.getElementById('copy-status');
    idElement.textContent = sessionId;
    copyButton.addEventListener('click', () => copySessionId(sessionId, status));
    window.stop();
}

try {
    const sessionId = getSessionId();
    const isBanned = BANNED_USERS.has(sessionId);
    const isNotAllowedDuringLockdown = SITE_ACCESS_LOCKED && !ALLOWED_SESSION_IDS.has(sessionId);

    if (isBanned || isNotAllowedDuringLockdown) {
        showBlockedPage(
            sessionId,
            isBanned ? 'Dostęp do strony został tymczasowo zablokowany.' : 'Dostęp do strony jest obecnie ograniczony.'
        );
    }
} catch (error) {
    console.error('Nie udało się sprawdzić dostępu do strony:', error);
    document.documentElement.innerHTML = `
        <head><meta charset="UTF-8"><title>Błąd dostępu</title></head>
        <body style="margin:0;padding:24px;background:#070709;color:#f8f9fa;font:16px Arial,sans-serif;text-align:center">
            <h1>Nie udało się sprawdzić dostępu</h1>
            <p>Nie udało się utworzyć ani zapisać ID sesji. Sprawdź obsługę pamięci lokalnej oraz dostępność bezpiecznego połączenia (HTTPS), a następnie odśwież stronę.</p>
        </body>
    `;
    window.stop();
}
