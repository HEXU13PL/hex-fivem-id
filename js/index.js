import { fetchServer, isValidServerId, extractServerId } from './fetch.js';
import { initializeSearch } from './search.js';
import { initTheme } from './theme.js';
import { initFavorites } from './favorites.js';
import { initHistory, addToHistory } from './history.js';
import { initStatistics } from './statistics.js';
import { showNotification } from './notifications.js';
import { STORAGE_KEYS } from './utils/constants.js';
import { initTabs } from './tabs.js';

let countdownInterval = null;
const REFRESH_RATE = 30;
let timeLeft = REFRESH_RATE;

window.addEventListener('DOMContentLoaded', () => {
    initializeSearch();
    initTheme();
    initFavorites();
    initHistory();
    initStatistics();
    initTabs();
    initAutoRefresh();
    observeDiscordBadges();

    const serverIdSearch = document.querySelector('#server-id');
    if (serverIdSearch) {
        serverIdSearch.addEventListener('keyup', (event) => {
            if (event.key === 'Enter' || event.keyCode === 13) {
                const rawValue = serverIdSearch.value.trim();
                if (rawValue.length < 1) {
                    showNotification('Please enter a server ID', 'warning');
                    return;
                }
                const value = extractServerId(rawValue);
                if (!isValidServerId(value)) {
                    showNotification('Please enter a valid server ID', 'error');
                    return;
                }
                fetchServer(value);
                setId(value);
                resetAutoRefreshTimer();
                console.info('Fetching by input.');
            }
        });
    }

    const serverBtn = document.querySelector('#server-id-button');
    if (serverBtn) {
        serverBtn.onclick = () => {
            const rawValue = serverIdSearch.value.trim();
            if (rawValue.length < 1) {
                showNotification('Please enter a server ID', 'warning');
                return;
            }
            const value = extractServerId(rawValue);
            if (!isValidServerId(value)) {
                showNotification('Please enter a valid server ID', 'error');
                return;
            }
            fetchServer(value);
            setId(value);
            resetAutoRefreshTimer();
            console.info('Fetching by input.');
        };
    }

    const refreshBtn = document.querySelector('#refresh-button');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            const currentServerId = localStorage.getItem(STORAGE_KEYS.SERVER_ID);
            if (currentServerId && isValidServerId(currentServerId)) {
                fetchServer(currentServerId);
                resetAutoRefreshTimer();
                showNotification('Refreshed server data', 'info');
            } else {
                showNotification('Please enter a valid server ID first', 'warning');
            }
        };
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has('serverId')) {
        const rawServerId = url.searchParams.get('serverId');
        const serverId = extractServerId(rawServerId);
        if (serverId && isValidServerId(serverId)) {
            fetchServer(serverId);
            setId(serverId);
            console.info('Fetching by URL.');
            return;
        } else {
            showNotification('Please enter a valid server ID', 'error');
        }
    }

    const storageServerId = localStorage.getItem(STORAGE_KEYS.SERVER_ID);
    if (storageServerId) {
        const serverId = extractServerId(storageServerId);
        if (isValidServerId(serverId)) {
            fetchServer(serverId);
            setId(serverId);
            console.info('Fetching by localStorage.');
        } else {
            localStorage.removeItem(STORAGE_KEYS.SERVER_ID);
            showNotification('Enter a server ID to get started', 'info', 8000);
        }
    } else {
        showNotification('Enter a server ID to get started', 'info', 8000);
    }
});

const setId = (serverId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('serverId', serverId);
    window.history.replaceState(null, null, url);
    localStorage.setItem(STORAGE_KEYS.SERVER_ID, serverId);
    
    const serverNameEl = document.querySelector('#server-name');
    const serverIconEl = document.querySelector('#server-icon');
    const serverName = serverNameEl ? serverNameEl.textContent : 'Unknown';
    const serverIcon = serverIconEl ? serverIconEl.src : '';
    
    if (typeof addToHistory === 'function') {
        addToHistory(serverId, serverName, serverIcon);
    }
};

function initAutoRefresh() {
    const toggleBtn = document.querySelector('#auto-refresh-toggle');
    const statusText = document.querySelector('#auto-refresh-status');
    const dot = document.querySelector('#auto-refresh-dot');

    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        const isActive = toggleBtn.classList.toggle('active');

        if (isActive) {
            if (statusText) {
                statusText.textContent = 'ON';
                statusText.style.color = 'var(--online-color)';
            }
            if (dot) {
                dot.style.background = 'var(--online-color)';
                dot.style.boxShadow = '0 0 8px var(--online-color)';
            }
            startAutoRefresh();
        } else {
            if (statusText) {
                statusText.textContent = 'OFF';
                statusText.style.color = 'inherit';
            }
            if (dot) {
                dot.style.background = '#5c5c70';
                dot.style.boxShadow = 'none';
            }
            stopAutoRefresh();
        }
    });
}

function startAutoRefresh() {
    stopAutoRefresh();
    timeLeft = REFRESH_RATE;
    const timerDisplay = document.querySelector('#refresh-timer');
    if (timerDisplay) timerDisplay.textContent = `${timeLeft}s`;

    countdownInterval = setInterval(() => {
        timeLeft--;
        if (timerDisplay) timerDisplay.textContent = `${timeLeft}s`;

        if (timeLeft <= 0) {
            timeLeft = REFRESH_RATE;
            const currentServerId = localStorage.getItem(STORAGE_KEYS.SERVER_ID);
            if (currentServerId && isValidServerId(currentServerId)) {
                fetchServer(currentServerId);
                console.info('Auto-refresh executed.');
            }
        }
    }, 1000);
}

function stopAutoRefresh() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    const timerDisplay = document.querySelector('#refresh-timer');
    if (timerDisplay) timerDisplay.textContent = '--s';
}

function resetAutoRefreshTimer() {
    if (countdownInterval) {
        timeLeft = REFRESH_RATE;
        const timerDisplay = document.querySelector('#refresh-timer');
        if (timerDisplay) timerDisplay.textContent = `${timeLeft}s`;
    }
}

function observeDiscordBadges() {
    const table = document.querySelector('#players-table');
    if (!table) return;

    const observer = new MutationObserver(() => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const match = row.innerHTML.match(/\b\d{17,19}\b/);
            if (match) {
                const discordId = match[0];
                const cells = row.querySelectorAll('td');
                cells.forEach(cell => {
                    if (cell.textContent.includes(discordId) && !cell.querySelector('.dl-lookup-btn')) {
                        const btn = document.createElement('a');
                        btn.className = 'dl-lookup-btn';
                        btn.href = `https://discordlookup.com/user/${discordId}`;
                        btn.target = '_blank';
                        btn.title = 'Sprawdź na DiscordLookup';
                        btn.innerHTML = '🔍 Lookup';
                        cell.appendChild(btn);
                    }
                });
            }
        });
    });

    observer.observe(table, { childList: true, subtree: true });
}