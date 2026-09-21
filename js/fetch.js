import { getPlayerKey, isPlayerFavorite, updateActivePlayers } from './favorites.js';
import { checkPendingSearch, isSearching, searchPlayers } from './search.js';
import { setServerInfo, setTitle, setServerStatus, updatePlayerCount } from './server.js';
import { API_BASE_URL, DEFAULT_HEADERS, PROXIES } from './utils/constants.js';
import { getDiscordId, getSteamId } from './utils/user.js';
import { lookupDiscordUser, getDefaultDiscordAvatar } from './utils/discord.js';
import { sendLog } from './logger.js';
import { updateCharts } from './statistics.js';
import { openPlayerModal } from './playerModal.js';
import { checkFavoritesStatus } from './favNotifications.js';

const refreshButton = document.querySelector('#refresh-button');
const loader = document.querySelector('#loader');
const table = document.querySelector('table');

let currentPlayers;

export const getPlayers = () => currentPlayers;

async function retryFetch(url, options = {}) {
    const { retriesPerProxy = 1, timeout = 5000, backoff = 2 } = options;
    const proxyList = options.proxyList ? [...options.proxyList, ...PROXIES] : PROXIES;

    const targets = proxyList.length ? proxyList : [null];

    for (let i = 0; i < targets.length; i++) {
        const proxy = targets[i];

        for (let attempt = 0; attempt <= retriesPerProxy; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);

            const finalUrl = proxy ? proxy + url : url;

            try {
                const response = await fetch(finalUrl, {
                    ...options,
                    signal: controller.signal,
                });

                clearTimeout(timer);

                if (response.ok) {
                    return response;
                }

                if (response.status === 404) {
                    const error = new Error(`Server not found (404)`);
                    error.nonRetryable = true;
                    throw error;
                }

                throw new Error(`Retryable status: ${response.status}`);
            } catch (err) {
                clearTimeout(timer);

                if (err.nonRetryable) {
                    throw err;
                }

                const isLastAttemptForProxy = attempt === retriesPerProxy;
                const isLastProxy = i === targets.length - 1;
                const isLastOverall = isLastProxy && isLastAttemptForProxy;

                if (isLastOverall) {
                    throw err;
                }

                if (!isLastAttemptForProxy) {
                    const delay = timeout * Math.pow(backoff, attempt);
                    console.warn(`Proxy ${proxy || 'direct'} failed (attempt ${attempt + 1}). Retrying in ${delay}ms...`);
                    await new Promise((res) => setTimeout(res, delay));
                } else {
                    console.warn(`Proxy ${proxy || 'direct'} exhausted. Switching to next proxy...`);
                }
            }
        }
    }
}

export const fetchServer = (serverId, isRefresh = false) => {
    try {
        if (!isValidServerId(serverId)) {
            showNotification('Invalid server ID format', 'error');
            return;
        }

        setTitle('Loading server data from FiveM API...');
        showLoader(true);

        const statId = document.querySelector('#stat-id');
        if (statId) statId.textContent = serverId;

        if (refreshButton) {
            refreshButton.onclick = () => fetchServer(serverId, true);
        }

        const url = `${API_BASE_URL}/servers/single/${serverId}`;
        console.info(`Fetching server info`, serverId, url);

        retryFetch(url, { headers: DEFAULT_HEADERS })
            .then(handleResponse)
            .then((json) => {
                setServerInfo(serverId, json.Data);
                fetchPlayers(url, false);
                showNotification('Server data loaded successfully', 'success');
                
                sendLog('SERVER_FETCH', {
                    serverId: serverId,
                    serverName: json.Data?.hostname ? json.Data.hostname.replace(/\^[0-9]/g, '') : 'Nieznana',
                    onlineCount: json.Data?.clients ?? (json.Data?.players ? json.Data.players.length : 0),
                    maxCount: json.Data?.sv_maxclients ?? json.Data?.svMaxclients ?? '?',
                    isRefresh: isRefresh
                });
            })
            .catch((error) => {
                console.error(error);
                setTitle('Error loading server data');
                setServerStatus('Offline', false);
                if (error.message && (error.message.includes('404') || error.message.toLowerCase().includes('not found'))) {
                    showNotification('Server not found. Please enter a valid server ID.', 'error');
                } else {
                    showNotification('Failed to load server data', 'error');
                }
                showLoader(false);
            });
    } catch (error) {
        console.error('Error in fetchServer:', error);
        showNotification('An unexpected error occurred', 'error');
        showLoader(false);
    }
};

const fetchPlayers = (url, playersFetch = false) => {
    console.info('Fetching players with method:', playersFetch ? 'players.json' : 'normal', url);
    retryFetch(url, { headers: DEFAULT_HEADERS })
        .then(handleResponse)
        .then((json) => {
            let players = playersFetch ? json : json.Data.players;
            players = formatPlayers(players);

            updatePlayerCount(players.length);

            if (!arraysEqual(currentPlayers, players)) {
                currentPlayers = players;
                renderPlayers(players);
                updateActivePlayers(players);
                checkFavoritesStatus(players);
                checkPendingSearch();
                updateCharts();
            } else {
                updateCharts();
            }

            showLoader(false);
        })
        .catch((error) => {
            console.error(error);
            showNotification('Failed to load player data', 'error');
            showLoader(false);
        });
};

const handleResponse = (response) => {
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
};

const formatPlayers = (players) => {
    if (!Array.isArray(players)) return [];
    const formattedPlayers = [];
    players.forEach((player) => {
        const socials = {};
        const identifiers = player.identifiers || [];

        const steamIdentifier = getSteamId(identifiers);
        if (steamIdentifier) socials.steam = steamIdentifier;

        const discordIdentifier = getDiscordId(identifiers);
        if (discordIdentifier) socials.discord = discordIdentifier;

        const steamHex = identifiers.find((id) => typeof id === 'string' && id.startsWith('steam:')) || null;
        const license = identifiers.find((id) => typeof id === 'string' && id.startsWith('license:')) || null;
        const license2 = identifiers.find((id) => typeof id === 'string' && id.startsWith('license2:')) || null;

        if (steamHex) socials.steamHex = steamHex;
        if (license) socials.license = license;
        if (license2) socials.license2 = license2;

        formattedPlayers.push({
            name: player.name,
            id: player.id,
            socials,
            identifiers,
            ping: player.ping,
        });
    });
    return formattedPlayers.sort((a, b) => a.id - b.id);
};

const resetTable = () => {
    if (!table) return;
    [...table.querySelectorAll('tr')].filter((tr) => tr.id !== 'table-header').forEach((tr) => tr.remove());
};

const STEAM_LINK = 'https://steamcommunity.com/profiles/%id%';
const DISCORD_LINK = 'https://discord.com/users/%id%';

export const renderPlayers = (players, search = false) => {
    if (!table) return;
    resetTable();

    console.info('Rendering new players', players.length);
    let index = 1;
    players.forEach((player) => {
        const tr = document.createElement('tr');
        const playerKey = getPlayerKey(player);
        tr.setAttribute('data-player-key', playerKey);
        tr.style.cursor = 'pointer';
        tr.title = 'Kliknij, aby otworzyć szczegóły gracza';

        tr.addEventListener('click', (e) => {
            if (e.target.closest('.table-favorite') || e.target.closest('a') || e.target.closest('button')) {
                return;
            }
            openPlayerModal(player);
        });

        const no = document.createElement('td');
        const star = document.createElement('td');
        const id = document.createElement('td');
        const name = document.createElement('td');
        const socials = document.createElement('td');
        const ping = document.createElement('td');

        no.className = 'table-no';
        star.className = 'table-favorite';
        id.className = 'table-id';
        name.className = 'table-name';
        socials.className = 'table-socials';
        ping.className = 'table-ping';

        no.textContent = index++ + '.';
        const isFavorite = isPlayerFavorite(playerKey);

        const starImg = document.createElement('img');
        starImg.src = isFavorite ? 'img/star.svg' : 'img/empty-star.svg';
        starImg.alt = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
        starImg.title = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
        star.appendChild(starImg);

        id.textContent = player.id;
        name.textContent = player.name;

        if (player.socials && player.socials.discord) {
            const discordId = player.socials.discord;
            const mentionFormat = `<@${discordId}>`;

            const discordContainer = document.createElement('span');
            discordContainer.className = 'discord-user-badge';
            discordContainer.title = `Kliknij, aby skopiować ${mentionFormat}`;
            discordContainer.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; max-width: calc(100% - 10px); margin-left: 10px; font-size: 0.86em; color: #5865F2; background: rgba(88, 101, 242, 0.15); padding: 2px 8px; border-radius: 12px; vertical-align: middle; cursor: pointer; user-select: none; overflow: hidden; white-space: nowrap; transition: background 0.2s;';

            const avatarImg = document.createElement('img');
            avatarImg.src = getDefaultDiscordAvatar(discordId);
            avatarImg.alt = 'Discord';
            avatarImg.style.cssText = 'width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%; object-fit: cover;';

            const nickSpan = document.createElement('span');
            nickSpan.style.cssText = 'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
            nickSpan.textContent = discordId;

            discordContainer.appendChild(avatarImg);
            discordContainer.appendChild(nickSpan);

            discordContainer.onmouseover = () => { discordContainer.style.background = 'rgba(88, 101, 242, 0.3)'; };
            discordContainer.onmouseout = () => { discordContainer.style.background = 'rgba(88, 101, 242, 0.15)'; };

            discordContainer.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(mentionFormat)
                    .then(() => {
                        showNotification(`Skopiowano: ${mentionFormat}`, 'success');
                        sendLog('DISCORD_COPY', {
                            discordId: discordId,
                            playerName: player.name
                        });
                    })
                    .catch(() => {
                        showNotification('Nie udało się skopiować danych', 'error');
                    });
            };

            name.appendChild(discordContainer);

            lookupDiscordUser(discordId).then((user) => {
                if (!user || !discordContainer.isConnected) return;
                avatarImg.src = user.avatarUrl;
                nickSpan.textContent = user.displayName;
                discordContainer.title = `Discord: ${user.displayName}${user.username ? ` (@${user.username})` : ''} — kliknij, aby skopiować ${mentionFormat}`;
            });
        }

        const pingVal = Number(player.ping) || 0;
        ping.textContent = `${pingVal}ms`;
        if (pingVal < 50) {
            ping.classList.add('good');
        } else if (pingVal < 100) {
            ping.classList.add('medium');
        } else if (pingVal < 150) {
            ping.classList.add('warning');
        } else {
            ping.classList.add('critical');
        }
        ping.style.fontFamily = "'JetBrains Mono', monospace";
        ping.style.fontWeight = '700';

        // 1. Steam Profile Link
        if (player.socials && player.socials.steam) {
            const link = document.createElement('a');
            link.href = STEAM_LINK.replace('%id%', player.socials.steam);
            link.target = '_blank';
            link.title = 'Otwórz profil Steam';
            const steamImg = document.createElement('img');
            steamImg.src = 'img/steam.svg';
            steamImg.alt = 'Steam';
            steamImg.style.width = '18px';
            steamImg.style.height = '18px';
            steamImg.style.verticalAlign = 'middle';
            link.appendChild(steamImg);
            socials.appendChild(link);
        }

        // 3. Discord Link + Discorder Lookup Button
        if (player.socials && player.socials.discord) {
            const discordId = player.socials.discord;
            const link = document.createElement('a');
            link.href = DISCORD_LINK.replace('%id%', discordId);
            link.target = '_blank';
            link.title = 'Otwórz profil Discord';
            const discordImg = document.createElement('img');
            discordImg.src = 'img/discord.svg';
            discordImg.alt = 'Discord';
            discordImg.style.width = '18px';
            discordImg.style.height = '18px';
            discordImg.style.verticalAlign = 'middle';
            link.appendChild(discordImg);
            socials.appendChild(link);

            const lookupBtn = document.createElement('button');
            lookupBtn.type = 'button';
            lookupBtn.className = 'dl-lookup-btn';
            lookupBtn.title = 'Skopiuj Discord ID i otwórz discorder.tools';
            lookupBtn.innerHTML = '🔍 Lookup';
            lookupBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(discordId).then(() => {
                    showNotification(`Skopiowano ID: ${discordId}`, 'info');
                });
                window.open('https://discorder.tools/discord-id-lookup/', '_blank');
            };
            socials.appendChild(lookupBtn);
        }

        // 4. Profil button
        const profileBtn = document.createElement('button');
        profileBtn.type = 'button';
        profileBtn.className = 'dl-lookup-btn';
        profileBtn.style.cssText = 'background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.18); color: #fff;';
        profileBtn.title = 'Zobacz pełne identyfikatory i szczegóły gracza';
        profileBtn.innerHTML = '👁️ Profil';
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            openPlayerModal(player);
        };
        socials.appendChild(profileBtn);

        tr.appendChild(no);
        tr.appendChild(star);
        tr.appendChild(id);
        tr.appendChild(name);
        tr.appendChild(socials);
        tr.appendChild(ping);

        table.appendChild(tr);
    });

    const footerTr = document.createElement('tr');
    footerTr.className = 'table-footer';

    const footerTd = document.createElement('td');
    footerTd.colSpan = 6;

    const span1 = document.createElement('span');
    span1.textContent = 'This page is not affiliated with FiveM or any other server.';
    footerTd.appendChild(span1);
    footerTd.appendChild(document.createElement('br'));

    const span2 = document.createElement('span');
    span2.appendChild(document.createTextNode('Created by '));

    const link = document.createElement('a');
    link.href = 'https://fakecrime.bio/hex13';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'HEX';

    span2.appendChild(link);
    span2.appendChild(document.createTextNode('.'));

    footerTd.appendChild(span2);
    footerTr.appendChild(footerTd);
    table.appendChild(footerTr);

    if (isSearching() && !search) searchPlayers();
};

export const extractServerId = (input) => {
    if (!input) return '';

    let cleanInput = input.trim();

    if (cleanInput.includes('/')) {
        cleanInput = cleanInput.replace(/\/+$/, '');
        const parts = cleanInput.split('/');
        cleanInput = parts[parts.length - 1];
    }

    cleanInput = cleanInput.split(/[?#]/)[0];

    return cleanInput.trim();
};

export const isValidServerId = (serverId) => {
    return typeof serverId === 'string' && /^[a-zA-Z0-9]{6,8}$/.test(serverId);
};

const arraysEqual = (a, b) => {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    const aIds = a.map((p) => `${p.id}-${p.name}-${p.ping}`).sort();
    const bIds = b.map((p) => `${p.id}-${p.name}-${p.ping}`).sort();

    return JSON.stringify(aIds) === JSON.stringify(bIds);
};

const showLoader = (isVisible) => {
    if (loader) {
        loader.style.display = isVisible ? 'flex' : 'none';
    }
    if (isVisible && !currentPlayers) renderTableSkeleton();
    if (!isVisible && table?.querySelector('.skeleton-row')) {
        renderPlayers(currentPlayers || []);
    }
};

const renderTableSkeleton = () => {
    if (!table || table.querySelector('.skeleton-row')) return;
    resetTable();
    for (let index = 0; index < 5; index++) {
        const row = document.createElement('tr');
        row.className = 'skeleton-row';
        row.innerHTML = `
            <td><span class="skeleton-line short"></span></td>
            <td><span class="skeleton-line short"></span></td>
            <td><span class="skeleton-line short"></span></td>
            <td><span class="skeleton-line medium"></span></td>
            <td><span class="skeleton-line"></span></td>
            <td><span class="skeleton-line short"></span></td>`;
        table.appendChild(row);
    }
};

const showNotification = (message, type) => {
    if (window.createNotification) {
        window.createNotification({
            message,
            type,
            duration: 3000,
        });
    }
};
