import { getPlayerKey, isPlayerFavorite, updateActivePlayers } from './favorites.js';
import { checkPendingSearch, isSearching, searchPlayers } from './search.js';
import { setServerInfo, setTitle } from './server.js';
import { API_BASE_URL, DEFAULT_HEADERS, PROXIES } from './utils/constants.js';
import { getDiscordId, getSteamId } from './utils/user.js';

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

export const fetchServer = (serverId) => {
    try {
        if (!isValidServerId(serverId)) {
            showNotification('Invalid server ID format', 'error');
            return;
        }

        setTitle('Loading server data from FiveM API...');
        showLoader(true);

        if (refreshButton) {
            refreshButton.onclick = () => fetchServer(serverId);
        }

        const url = `${API_BASE_URL}/servers/single/${serverId}`;
        console.info(`Fetching server info`, serverId, url);

        retryFetch(url, { headers: DEFAULT_HEADERS })
            .then(handleResponse)
            .then((json) => {
                setServerInfo(serverId, json.Data);
                fetchPlayers(url, false);
                showNotification('Server data loaded successfully', 'success');
            })
            .catch((error) => {
                console.error(error);
                setTitle('Error loading server data');
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

            if (!arraysEqual(currentPlayers, players)) {
                currentPlayers = players;
                renderPlayers(players);
                updateActivePlayers(players);
                checkPendingSearch();
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

        if (player.identifiers) {
            const steamIdentifier = getSteamId(player.identifiers);
            if (steamIdentifier) socials.steam = steamIdentifier;

            const discordIdentifier = getDiscordId(player.identifiers);
            if (discordIdentifier) socials.discord = discordIdentifier;
        }

        formattedPlayers.push({
            name: player.name,
            id: player.id,
            socials,
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

        // Badge Discorda obok nicku
        if (player.socials && player.socials.discord) {
            const discordId = player.socials.discord;
            const discordContainer = document.createElement('span');
            discordContainer.className = 'discord-user-badge';
            discordContainer.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; font-size: 0.8em; color: #5865F2; background: rgba(88, 101, 242, 0.15); padding: 2px 8px; border-radius: 12px; vertical-align: middle;';

            // Domyślny wygląd z ID
            discordContainer.innerHTML = `
                <img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="Discord" style="width: 14px; height: 14px; border-radius: 50%;">
                <span>${discordId}</span>
            `;
            name.appendChild(discordContainer);

            // Dociąganie nicku i avataru (Lanyard API)
            fetch(`https://api.lanyard.rest/v1/users/${discordId}`)
                .then((res) => res.json())
                .then((data) => {
                    if (data.success && data.data && data.data.discord_user) {
                        const user = data.data.discord_user;
                        const avatarUrl = user.avatar 
                            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`
                            : 'https://cdn.discordapp.com/embed/avatars/0.png';

                        discordContainer.innerHTML = `
                            <img src="${avatarUrl}" alt="Avatar" style="width: 14px; height: 14px; border-radius: 50%; object-fit: cover;">
                            <span>@${user.username}</span>
                        `;
                    }
                })
                .catch(() => {});
        }

        ping.textContent = `${player.ping}ms`;

        if (player.socials.steam) {
            const link = document.createElement('a');
            link.href = STEAM_LINK.replace('%id%', player.socials.steam);
            link.target = '_blank';
            const steamImg = document.createElement('img');
            steamImg.src = 'img/steam.svg';
            steamImg.alt = 'Steam';
            link.appendChild(steamImg);
            socials.appendChild(link);
        }
        if (player.socials.discord) {
            const link = document.createElement('a');
            link.href = DISCORD_LINK.replace('%id%', player.socials.discord);
            link.target = '_blank';
            const discordImg = document.createElement('img');
            discordImg.src = 'img/discord.svg';
            discordImg.alt = 'Discord';
            link.appendChild(discordImg);
            socials.appendChild(link);
        }

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
    link.href = 'https://github.com/HEXU13PL';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'hex';

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