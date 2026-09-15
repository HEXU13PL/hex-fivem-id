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

    toggleBtn.classList.add('active');
    if (statusText) {
        statusText.textContent = 'ON';
        statusText.style.color = 'var(--online-color)';
    }
    if (dot) {
        dot.style.background = 'var(--online-color)';
        dot.style.boxShadow = '0 0 8px var(--online-color)';
    }
    startAutoRefresh();

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
    const tables = document.querySelectorAll('#players-table, #favorites-table');

    tables.forEach(table => {
        if (!table) return;

        const processTable = () => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                // Pomijamy nagłówki i komunikaty w stopce
                if (row.id === 'table-header' || row.id === 'favorites-table-header' || row.classList.contains('table-footer')) return;

                // Wyszukujemy identyfikator Discord (17-19 cyfr, pomijając Steam ID 76561...)
                const match = row.textContent.match(/\b(?!76561)\d{17,19}\b/);
                if (!match) return;

                const discordId = match[0];

                // Docelowa komórka to ZAWSZE kolumna Socials (.table-socials lub 5. komórka wiersza)
                const targetCell = row.querySelector('.table-socials') || row.cells[4];
                if (!targetCell || targetCell.querySelector('.dl-lookup-btn')) return;

                const discordBadge = targetCell.querySelector('.id-badge.discord');
                const btn = createLookupBtn(discordId);

                if (discordBadge) {
                    discordBadge.after(btn);
                } else {
                    targetCell.appendChild(btn);
                }
            });
        };

        const observer = new MutationObserver(processTable);
        observer.observe(table, { childList: true, subtree: true });
        processTable();
    });
}

function createLookupBtn(discordId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dl-lookup-btn';
    btn.title = 'Skopiuj Discord ID i otwórz discorder.tools';
    btn.innerHTML = '🔍 Lookup';

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        navigator.clipboard.writeText(discordId).then(() => {
            showNotification(`Skopiowano ID: ${discordId}`, 'info');
        }).catch(() => {
            showNotification('Błąd kopiowania ID', 'error');
        });

        window.open('https://discorder.tools/discord-id-lookup/', '_blank');
    });

    return btn;
}