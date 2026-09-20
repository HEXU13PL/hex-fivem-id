import { getPlayers } from './fetch.js';
import { STORAGE_KEYS } from './utils/constants.js';

let pingChartInstance = null;
let platformChartInstance = null;
let playerChartInstance = null;
let activityChartInstance = null;
const MAX_HISTORY_POINTS = 20;
const HIGH_PING_THRESHOLD = 120;

export const initStatistics = () => {
    // Nasłuchiwanie na zdarzenie zmiany zakładki lub kliknięcie w przycisk zakładki
    window.addEventListener('tabChanged', (e) => {
        if (e.detail && e.detail.tabId === 'statistics') {
            updateCharts();
        }
    });

    const statTabButton = document.querySelector('.tab-button[data-tab="statistics"]');
    if (statTabButton) {
        statTabButton.addEventListener('click', () => {
            // Krótkie opóźnienie, aby tab-content zdążył zmienić klasę na .active (potrzebne do prawidłowych wymiarów canvas)
            setTimeout(updateCharts, 50);
        });
    }

    // Odświeżenie przy zmianie koloru motywu
    const colorPicker = document.querySelector('#accent-color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('change', () => {
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'statistics-tab') {
                updateCharts();
            }
        });
    }
};

export const updateCharts = () => {
    const emptyState = document.getElementById('analytics-empty-state');
    const dashboard = document.getElementById('analytics-dashboard');

    if (!emptyState || !dashboard) return;

    const players = getPlayers();

    if (!players || !Array.isArray(players) || players.length === 0) {
        emptyState.style.display = 'block';
        dashboard.style.display = 'none';
        destroyCharts();
        return;
    }

    emptyState.style.display = 'none';
    dashboard.style.display = 'block';

    updateKpiCards(players);
    try {
        updateActivityHistory(players);
        renderHighPingList(players);
    } catch (error) {
        console.warn('Extended statistics unavailable:', error);
    }

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not loaded yet');
        return;
    }

    // Upewniamy się, że element tab-content jest widoczny przed rysowaniem wykresów
    requestAnimationFrame(() => {
        updatePingChart(players);
        updatePlatformChart(players);
        updatePlayerIdChart(players);
    });
};

const destroyCharts = () => {
    if (pingChartInstance) {
        pingChartInstance.destroy();
        pingChartInstance = null;
    }
    if (platformChartInstance) {
        platformChartInstance.destroy();
        platformChartInstance = null;
    }
    if (playerChartInstance) {
        playerChartInstance.destroy();
        playerChartInstance = null;
    }
    if (activityChartInstance) {
        activityChartInstance.destroy();
        activityChartInstance = null;
    }
};

const updateKpiCards = (players) => {
    const pings = players.map(p => Number(p.ping) || 0);
    const minPing = Math.min(...pings);
    const maxPing = Math.max(...pings);
    const avgPing = Math.round(pings.reduce((sum, val) => sum + val, 0) / players.length);

    const avgPingEl = document.getElementById('kpi-avg-ping');
    const pingQualityEl = document.getElementById('kpi-ping-quality');
    const pingRangeEl = document.getElementById('kpi-ping-range');
    const discordCoverageEl = document.getElementById('kpi-discord-coverage');
    const discordCountEl = document.getElementById('kpi-discord-count');
    const steamCoverageEl = document.getElementById('kpi-steam-coverage');
    const steamCountEl = document.getElementById('kpi-steam-count');
    const discordProgressEl = document.getElementById('kpi-discord-progress');
    const steamProgressEl = document.getElementById('kpi-steam-progress');
    const occupancyProgressEl = document.getElementById('kpi-occupancy-progress');
    const occupancyEl = document.getElementById('kpi-occupancy');
    const occupancyCountEl = document.getElementById('kpi-occupancy-count');
    const highPingEl = document.getElementById('kpi-high-ping');
    const highPingCountEl = document.getElementById('kpi-high-ping-count');

    if (avgPingEl) {
        avgPingEl.innerHTML = `${avgPing} <span class="unit">ms</span>`;
    }

    if (pingQualityEl) {
        if (avgPing <= 45) {
            pingQualityEl.textContent = '🟢 Znakomita jakość połączenia';
            pingQualityEl.style.color = '#00e676';
        } else if (avgPing <= 85) {
            pingQualityEl.textContent = '🔵 Dobra jakość połączenia';
            pingQualityEl.style.color = '#66c0f4';
        } else if (avgPing <= 140) {
            pingQualityEl.textContent = '🟡 Średnie opóźnienia graczy';
            pingQualityEl.style.color = '#f1c40f';
        } else {
            pingQualityEl.textContent = '🔴 Wysokie opóźnienia / możliwy lag';
            pingQualityEl.style.color = '#ff1e27';
        }
    }

    if (pingRangeEl) {
        pingRangeEl.innerHTML = `${minPing} - ${maxPing} <span class="unit">ms</span>`;
    }

    const discordCount = players.filter(p => p.socials && p.socials.discord).length;
    const discordPct = Math.round((discordCount / players.length) * 100);
    if (discordCoverageEl) discordCoverageEl.textContent = `${discordPct}%`;
    if (discordCountEl) discordCountEl.textContent = `${discordCount} / ${players.length} graczy`;
    if (discordProgressEl) discordProgressEl.style.width = `${discordPct}%`;

    const steamCount = players.filter(p => p.socials && p.socials.steam).length;
    const steamPct = Math.round((steamCount / players.length) * 100);
    if (steamCoverageEl) steamCoverageEl.textContent = `${steamPct}%`;
    if (steamCountEl) steamCountEl.textContent = `${steamCount} / ${players.length} graczy`;
    if (steamProgressEl) steamProgressEl.style.width = `${steamPct}%`;

    const statPlayers = document.getElementById('stat-players')?.textContent || '';
    const maxClients = Number(statPlayers.split('/')[1]?.trim()) || 0;
    const occupancy = maxClients > 0 ? Math.min(100, Math.round((players.length / maxClients) * 100)) : 0;
    if (occupancyEl) occupancyEl.textContent = `${occupancy}%`;
    if (occupancyCountEl) occupancyCountEl.textContent = `${players.length} / ${maxClients || '?'} slotów`;
    if (occupancyProgressEl) occupancyProgressEl.style.width = `${occupancy}%`;

    const highPingCount = pings.filter((ping) => ping > HIGH_PING_THRESHOLD).length;
    if (highPingEl) highPingEl.textContent = highPingCount;
    if (highPingCountEl) highPingCountEl.textContent = `graczy powyżej ${HIGH_PING_THRESHOLD} ms`;
};

const getHistoryKey = () => {
    const serverId = localStorage.getItem(STORAGE_KEYS.SERVER_ID) || document.getElementById('stat-id')?.textContent || 'unknown';
    return `analyticsHistory:${serverId}`;
};

const readActivityHistory = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(getHistoryKey()) || '[]');
        return Array.isArray(stored) ? stored.slice(-MAX_HISTORY_POINTS) : [];
    } catch {
        return [];
    }
};

const updateActivityHistory = (players) => {
    const pings = players.map((player) => Number(player.ping) || 0);
    const point = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        players: players.length,
        ping: Math.round(pings.reduce((sum, value) => sum + value, 0) / players.length)
    };
    const history = readActivityHistory();
    const lastPoint = history[history.length - 1];
    if (!lastPoint || lastPoint.players !== point.players || lastPoint.ping !== point.ping) {
        history.push(point);
        try {
            localStorage.setItem(getHistoryKey(), JSON.stringify(history.slice(-MAX_HISTORY_POINTS)));
        } catch (error) {
            console.warn('Could not save analytics history:', error);
        }
    }
    renderActivityChart(readActivityHistory());
};

const renderHighPingList = (players) => {
    const container = document.getElementById('high-ping-list');
    if (!container) return;

    const worstPlayers = [...players]
        .sort((a, b) => (Number(b.ping) || 0) - (Number(a.ping) || 0))
        .slice(0, 5);
    container.innerHTML = worstPlayers.map((player, index) => {
        const ping = Number(player.ping) || 0;
        const level = ping > 200 ? 'critical' : ping > HIGH_PING_THRESHOLD ? 'warning' : 'normal';
        return `<div class="high-ping-row"><span class="high-ping-rank">${index + 1}</span><span class="high-ping-name">${escapeHtml(player.name)}</span><span class="high-ping-id">ID ${escapeHtml(String(player.id))}</span><strong class="high-ping-value ${level}">${ping} ms</strong></div>`;
    }).join('');
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

const renderActivityChart = (history) => {
    const ctx = document.getElementById('activity-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (activityChartInstance) activityChartInstance.destroy();

    const baseOptions = getChartBaseOptions();
    const accentColor = getThemeAccentColor();
    activityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map((point) => point.time),
            datasets: [
                { label: 'Gracze online', data: history.map((point) => point.players), borderColor: accentColor, backgroundColor: hexToRgbaStr(accentColor, 0.16), fill: true, tension: 0.35, yAxisID: 'players' },
                { label: 'Średni ping (ms)', data: history.map((point) => point.ping), borderColor: '#66c0f4', backgroundColor: 'transparent', tension: 0.35, yAxisID: 'ping' }
            ]
        },
        options: {
            ...baseOptions,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9a9ab0' } },
                players: { beginAtZero: true, position: 'left', grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9a9ab0', precision: 0 } },
                ping: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#66c0f4', precision: 0 } }
            }
        }
    });
};

const getThemeAccentColor = () => {
    const computed = getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim();
    return computed || '#e50914';
};

const getChartBaseOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    color: '#9a9ab0',
    plugins: {
        legend: {
            labels: {
                color: '#9a9ab0',
                font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 },
                boxWidth: 14,
                boxHeight: 14,
                useBorderRadius: true,
                borderRadius: 4
            }
        },
        tooltip: {
            backgroundColor: 'rgba(20, 20, 28, 0.95)',
            titleColor: '#f8f9fa',
            bodyColor: '#9a9ab0',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 700 },
            bodyFont: { family: "'JetBrains Mono', monospace" }
        }
    }
});

const updatePingChart = (players) => {
    const ctx = document.getElementById('ping-chart');
    if (!ctx) return;

    if (pingChartInstance) {
        pingChartInstance.destroy();
        pingChartInstance = null;
    }

    const buckets = {
        '< 40ms': 0,
        '40-79ms': 0,
        '80-119ms': 0,
        '120-199ms': 0,
        '200ms+': 0
    };

    players.forEach(player => {
        const ping = Number(player.ping) || 0;
        if (ping < 40) buckets['< 40ms']++;
        else if (ping < 80) buckets['40-79ms']++;
        else if (ping < 120) buckets['80-119ms']++;
        else if (ping < 200) buckets['120-199ms']++;
        else buckets['200ms+']++;
    });

    const labels = Object.keys(buckets);
    const data = labels.map(key => buckets[key]);

    const baseOptions = getChartBaseOptions();
    pingChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Liczba graczy',
                data,
                backgroundColor: [
                    'rgba(0, 230, 118, 0.65)',
                    'rgba(102, 192, 244, 0.65)',
                    'rgba(241, 196, 15, 0.65)',
                    'rgba(230, 126, 34, 0.65)',
                    'rgba(229, 9, 20, 0.65)'
                ],
                borderColor: [
                    '#00e676',
                    '#66c0f4',
                    '#f1c40f',
                    '#e67e22',
                    '#e50914'
                ],
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            ...baseOptions,
            plugins: {
                ...baseOptions.plugins,
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9a9ab0', font: { family: "'JetBrains Mono', monospace", size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#9a9ab0',
                        precision: 0,
                        font: { family: "'JetBrains Mono', monospace", size: 11 }
                    }
                }
            }
        }
    });
};

const updatePlatformChart = (players) => {
    const ctx = document.getElementById('platform-chart');
    if (!ctx) return;

    if (platformChartInstance) {
        platformChartInstance.destroy();
        platformChartInstance = null;
    }

    let both = 0;
    let onlySteam = 0;
    let onlyDiscord = 0;
    let licenseOnly = 0;

    players.forEach(p => {
        const hasSteam = Boolean(p.socials && p.socials.steam);
        const hasDiscord = Boolean(p.socials && p.socials.discord);

        if (hasSteam && hasDiscord) both++;
        else if (hasSteam && !hasDiscord) onlySteam++;
        else if (!hasSteam && hasDiscord) onlyDiscord++;
        else licenseOnly++;
    });

    const labels = ['Steam + Discord', 'Tylko Steam', 'Tylko Discord', 'Tylko Licencja'];
    const data = [both, onlySteam, onlyDiscord, licenseOnly];

    const baseOptions = getChartBaseOptions();
    platformChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: [
                    'rgba(142, 161, 255, 0.8)',
                    'rgba(102, 192, 244, 0.8)',
                    'rgba(88, 101, 242, 0.8)',
                    'rgba(243, 156, 18, 0.8)'
                ],
                borderColor: '#14141c',
                borderWidth: 3
            }]
        },
        options: {
            ...baseOptions,
            cutout: '68%',
            plugins: {
                ...baseOptions.plugins,
                legend: {
                    position: 'bottom',
                    labels: {
                        ...baseOptions.plugins.legend.labels,
                        padding: 14
                    }
                }
            }
        }
    });
};

const updatePlayerIdChart = (players) => {
    const ctx = document.getElementById('player-chart');
    if (!ctx) return;

    if (playerChartInstance) {
        playerChartInstance.destroy();
        playerChartInstance = null;
    }

    const rangeSize = 10;
    const ranges = {};

    players.forEach(player => {
        const id = Number(player.id) || 0;
        const rangeIndex = Math.floor(id / rangeSize);
        const rangeStart = rangeIndex * rangeSize;
        const rangeEnd = rangeStart + rangeSize - 1;
        const rangeLabel = `${rangeStart}-${rangeEnd}`;

        if (!ranges[rangeLabel]) {
            ranges[rangeLabel] = 0;
        }
        ranges[rangeLabel]++;
    });

    const labels = Object.keys(ranges).sort((a, b) => {
        const aStart = parseInt(a.split('-')[0], 10);
        const bStart = parseInt(b.split('-')[0], 10);
        return aStart - bStart;
    });

    const data = labels.map(label => ranges[label]);
    const accentColor = getThemeAccentColor();

    const baseOptions = getChartBaseOptions();
    playerChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Gracze w przedziale ID',
                data,
                backgroundColor: accentColor.startsWith('#')
                    ? hexToRgbaStr(accentColor, 0.65)
                    : accentColor,
                borderColor: accentColor,
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            ...baseOptions,
            plugins: {
                ...baseOptions.plugins,
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9a9ab0', font: { family: "'JetBrains Mono', monospace", size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#9a9ab0',
                        precision: 0,
                        font: { family: "'JetBrains Mono', monospace", size: 11 }
                    }
                }
            }
        }
    });
};

const hexToRgbaStr = (hex, alpha) => {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
};
