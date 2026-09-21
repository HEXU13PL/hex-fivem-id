import { STORAGE_KEYS } from './utils/constants.js';
import { isPlayerFavorite, getPlayerKey } from './favorites.js';
import { showNotification } from './notifications.js';
import { notifyFavoriteOnline } from './auth.js';

let previousOnlineKeys = null; // null = first run, skip notifications
let notificationsEnabled = true;
let browserNotificationsEnabled = false;

/**
 * Initialize favourite notifications system.
 * Sets up the toggle button and loads saved preference.
 */
export const initFavNotifications = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.FAV_NOTIFICATIONS);
    if (saved !== null) {
        notificationsEnabled = saved === 'true';
    }

    const savedBrowserNotifications = localStorage.getItem(STORAGE_KEYS.BROWSER_NOTIFICATIONS);
    browserNotificationsEnabled = savedBrowserNotifications === 'true'
        && 'Notification' in window
        && Notification.permission === 'granted';

    const toggleBtn = document.getElementById('fav-notif-toggle');
    if (toggleBtn) {
        updateToggleButton(toggleBtn);
        toggleBtn.addEventListener('click', async () => {
            notificationsEnabled = !notificationsEnabled;
            localStorage.setItem(STORAGE_KEYS.FAV_NOTIFICATIONS, String(notificationsEnabled));

            if (notificationsEnabled) {
                await enableBrowserNotifications();
            } else {
                browserNotificationsEnabled = false;
                localStorage.setItem(STORAGE_KEYS.BROWSER_NOTIFICATIONS, 'false');
            }

            updateToggleButton(toggleBtn);
            showNotification(
                notificationsEnabled
                    ? 'Powiadomienia o ulubionych: WŁĄCZONE'
                    : 'Powiadomienia o ulubionych: WYŁĄCZONE',
                'info',
                3000
            );
        });
    }
};

async function enableBrowserNotifications() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') {
        showNotification('Powiadomienia są zablokowane w ustawieniach przeglądarki', 'warning');
        return;
    }

    const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    browserNotificationsEnabled = permission === 'granted';
    localStorage.setItem(STORAGE_KEYS.BROWSER_NOTIFICATIONS, String(browserNotificationsEnabled));
}

function showBrowserNotification(title, body) {
    if (!browserNotificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: 'https://fivem.net/favicon.png', tag: 'hex-fivem-favorite' });
}

/**
 * Update the toggle button appearance based on current state.
 */
function updateToggleButton(btn) {
    const icon = btn.querySelector('.fav-notif-icon');
    const label = btn.querySelector('.fav-notif-label');
    if (notificationsEnabled) {
        btn.classList.add('active');
        if (icon) icon.textContent = '🔔';
        if (label) label.textContent = 'ON';
        if (label) label.style.color = 'var(--online-color)';
    } else {
        btn.classList.remove('active');
        if (icon) icon.textContent = '🔕';
        if (label) label.textContent = 'OFF';
        if (label) label.style.color = '';
    }
}

/**
 * Play a short notification beep using Web Audio API.
 */
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);

        // Clean up
        oscillator.onended = () => ctx.close();
    } catch (e) {
        // Silently fail if audio not available
    }
}

/**
 * Check which favourite players came online or went offline.
 * Called after every player list fetch/render.
 * @param {Array} currentPlayers - the latest player list from the server
 */
export const checkFavoritesStatus = (currentPlayers) => {
    if (!currentPlayers || !Array.isArray(currentPlayers)) return;

    const currentOnlineKeys = new Set();
    currentPlayers.forEach((player) => {
        const key = getPlayerKey(player);
        if (isPlayerFavorite(key)) {
            currentOnlineKeys.add(key);
        }
    });

    // Skip notifications on first fetch (no previous data to compare)
    if (previousOnlineKeys === null) {
        previousOnlineKeys = currentOnlineKeys;
        return;
    }

    if (!notificationsEnabled) {
        previousOnlineKeys = currentOnlineKeys;
        return;
    }

    // Find who came online
    currentOnlineKeys.forEach((key) => {
        if (!previousOnlineKeys.has(key)) {
            const player = currentPlayers.find((p) => getPlayerKey(p) === key);
            const name = player ? player.name : key;
            showNotification(`🟢 ${name} jest teraz ONLINE`, 'success', 8000);
            showBrowserNotification('Ulubiony gracz jest online', `${name} pojawił się na serwerze.`);
            notifyFavoriteOnline(name, localStorage.getItem(STORAGE_KEYS.SERVER_ID));
            playNotificationSound();
        }
    });

    // Find who went offline
    previousOnlineKeys.forEach((key) => {
        if (!currentOnlineKeys.has(key)) {
            showNotification(`🔴 ${extractName(key)} wyszedł z serwera`, 'warning', 8000);
            showBrowserNotification('Ulubiony gracz wyszedł', `${extractName(key)} opuścił serwer.`);
        }
    });

    previousOnlineKeys = currentOnlineKeys;
};

/**
 * Extract a human-readable name from a player key.
 * Keys are like "steam:xxx", "discord:xxx", "name:xxx".
 */
function extractName(key) {
    if (key.startsWith('name:')) return key.replace('name:', '');
    return key;
}
