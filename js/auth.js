import { showNotification } from './notifications.js';
import { isConfiguredProUser } from './proUsers.js';

const API_BASE_URL = window.HEX_AUTH_API_BASE_URL || '/api';
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
let currentUser = null;

const apiUrl = (path) => `${API_BASE_URL.replace(/\/$/, '')}${path}`;

async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    if (!response.ok) {
        const error = new Error(`Authentication request failed (${response.status})`);
        error.status = response.status;
        throw error;
    }
    return response.status === 204 ? null : response.json();
}

function avatarUrl(user) {
    return user?.avatarUrl || user?.avatar_url || DEFAULT_AVATAR;
}

function renderAccount() {
    const button = document.querySelector('#account-button');
    const label = document.querySelector('#account-button-label');
    const menu = document.querySelector('#account-menu');
    const avatar = document.querySelector('#account-menu-avatar');
    const name = document.querySelector('#account-menu-name');
    const status = document.querySelector('#account-menu-status');
    if (!button || !label || !menu || !avatar || !name || !status) return;

    if (!currentUser) {
        label.textContent = 'Zaloguj przez Discord';
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        return;
    }

    const displayName = currentUser.globalName || currentUser.username || currentUser.displayName || 'Discord user';
    const isPro = currentUser.isPro === true || isConfiguredProUser(currentUser.id);
    label.innerHTML = '';
    const image = document.createElement('img');
    image.className = 'account-avatar';
    image.src = avatarUrl(currentUser);
    image.alt = '';
    label.append(image, document.createTextNode(displayName));
    avatar.src = avatarUrl(currentUser);
    name.textContent = displayName;
    status.textContent = isPro ? 'PRO • aktywne konto' : 'Konto standardowe';
    document.querySelector('#pro-panel-button')?.toggleAttribute('disabled', !isPro);
}

function toggleMenu() {
    const menu = document.querySelector('#account-menu');
    const button = document.querySelector('#account-button');
    if (!menu || !button || !currentUser) return;
    menu.hidden = !menu.hidden;
    button.setAttribute('aria-expanded', String(!menu.hidden));
}

function openProPanel() {
    const isPro = currentUser?.isPro === true || isConfiguredProUser(currentUser?.id);
    const overlay = document.querySelector('#pro-panel-overlay');
    const form = document.querySelector('#pro-panel-form');
    const lock = document.querySelector('#pro-panel-lock');
    if (!overlay || !form || !lock) return;
    form.hidden = !isPro;
    lock.hidden = isPro;
    overlay.hidden = false;
}

async function loadUser() {
    try {
        const payload = await request('/auth/me');
        currentUser = payload?.user || payload || null;
    } catch (error) {
        if (error.status !== 401 && error.status !== 404) {
            console.error('Could not load Discord session.', error);
        }
        currentUser = null;
    }
    renderAccount();
}

export function initAuth() {
    const button = document.querySelector('#account-button');
    const menu = document.querySelector('#account-menu');
    button?.addEventListener('click', () => {
        if (!currentUser) {
            window.location.assign(apiUrl('/auth/discord'));
            return;
        }
        toggleMenu();
    });
    document.querySelector('#pro-panel-button')?.addEventListener('click', openProPanel);
    document.querySelector('#pro-panel-close')?.addEventListener('click', () => {
        document.querySelector('#pro-panel-overlay').hidden = true;
    });
    document.querySelector('#pro-panel-overlay')?.addEventListener('click', (event) => {
        if (event.target.id === 'pro-panel-overlay') event.currentTarget.hidden = true;
    });
    document.querySelector('#logout-button')?.addEventListener('click', async () => {
        try {
            await request('/auth/logout', { method: 'POST' });
            currentUser = null;
            renderAccount();
            showNotification('Wylogowano z Discorda', 'success');
        } catch (error) {
            console.error('Could not log out.', error);
            showNotification('Nie udało się wylogować', 'error');
        }
    });
    document.querySelector('#pro-webhook-save')?.addEventListener('click', async () => {
        const input = document.querySelector('#pro-webhook-url');
        const webhookUrl = input?.value.trim();
        if (!webhookUrl || !/^https:\/\/(discord(?:app)?\.com)\/api\/webhooks\/\d+\/.+$/i.test(webhookUrl)) {
            showNotification('Podaj poprawny adres webhooka Discord', 'warning');
            return;
        }
        try {
            await request('/pro/webhook', { method: 'POST', body: JSON.stringify({ webhookUrl }) });
            showNotification('Webhook zapisany', 'success');
            document.querySelector('#pro-panel-overlay').hidden = true;
        } catch (error) {
            console.error('Could not save webhook.', error);
            showNotification(error.status === 403 ? 'Panel Pro jest zablokowany dla tego konta' : 'Nie udało się zapisać webhooka', 'error');
        }
    });
    document.addEventListener('click', (event) => {
        if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
            menu.hidden = true;
            button.setAttribute('aria-expanded', 'false');
        }
    });
    loadUser();
}

export async function notifyFavoriteOnline(playerName, serverId) {
    const isPro = currentUser?.isPro === true || isConfiguredProUser(currentUser?.id);
    if (!isPro) return;
    try {
        await request('/pro/favorite-online', {
            method: 'POST',
            body: JSON.stringify({ playerName, serverId }),
        });
    } catch (error) {
        console.error('Could not send favorite webhook notification.', error);
    }
}
