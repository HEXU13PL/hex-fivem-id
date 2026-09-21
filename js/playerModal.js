import { showNotification } from './notifications.js';
import { isPlayerFavorite, togglePlayerFavorite, getPlayerKey } from './favorites.js';
import { hexToDecimal } from './utils/user.js';
import { lookupDiscordUser, getDefaultDiscordAvatar } from './utils/discord.js';
import { sendLog } from './logger.js';

let modalLookupToken = 0;

let modalEl = null;
let currentModalPlayer = null;

export const initPlayerModal = () => {
    modalEl = document.getElementById('player-modal');
    if (!modalEl) return;

    // Zamykanie po kliknięciu w tło (backdrop)
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
            closePlayerModal();
        }
    });

    // Zamykanie przyciskiem X
    const closeBtn = modalEl.querySelector('.modal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closePlayerModal();
        });
    }

    // Zamykanie klawiszem Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalEl && modalEl.classList.contains('active')) {
            closePlayerModal();
        }
    });
};

export const openPlayerModal = (player) => {
    if (!modalEl) {
        modalEl = document.getElementById('player-modal');
    }
    if (!modalEl || !player) return;

    currentModalPlayer = player;

    // 1. Podstawowe informacje w nagłówku modala
    const avatarEl = document.getElementById('modal-avatar');
    const nameEl = document.getElementById('modal-player-name');
    const idBadgeEl = document.getElementById('modal-server-id');
    const pingBadgeEl = document.getElementById('modal-ping-badge');
    const favBtn = document.getElementById('modal-fav-btn');

    if (nameEl) nameEl.textContent = player.name || 'Nieznany gracz';
    if (idBadgeEl) idBadgeEl.textContent = `ID #${player.id}`;

    // Ping
    const ping = Number(player.ping) || 0;
    if (pingBadgeEl) {
        pingBadgeEl.textContent = `${ping} ms`;
        if (ping < 50) {
            pingBadgeEl.style.color = '#00e676';
            pingBadgeEl.style.borderColor = 'rgba(0, 230, 118, 0.4)';
            pingBadgeEl.style.background = 'rgba(0, 230, 118, 0.1)';
        } else if (ping < 100) {
            pingBadgeEl.style.color = '#66c0f4';
            pingBadgeEl.style.borderColor = 'rgba(102, 192, 244, 0.4)';
            pingBadgeEl.style.background = 'rgba(102, 192, 244, 0.1)';
        } else if (ping < 150) {
            pingBadgeEl.style.color = '#f1c40f';
            pingBadgeEl.style.borderColor = 'rgba(241, 196, 15, 0.4)';
            pingBadgeEl.style.background = 'rgba(241, 196, 15, 0.1)';
        } else {
            pingBadgeEl.style.color = '#ff1e27';
            pingBadgeEl.style.borderColor = 'rgba(255, 30, 39, 0.4)';
            pingBadgeEl.style.background = 'rgba(255, 30, 39, 0.1)';
        }
    }

    const discordTagEl = document.getElementById('modal-discord-tag');
    const lookupToken = ++modalLookupToken;

    if (avatarEl) {
        avatarEl.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
    }
    if (discordTagEl) {
        discordTagEl.style.display = 'none';
        discordTagEl.textContent = '';
    }

    // 2. Parsowanie identyfikatorów
    const identifiers = player.identifiers || [];
    const ids = parseIdentifiers(identifiers);

    if (ids.discord) {
        if (avatarEl) avatarEl.src = getDefaultDiscordAvatar(ids.discord);
        if (discordTagEl) {
            discordTagEl.textContent = 'Ładowanie Discord...';
            discordTagEl.style.display = 'inline-block';
        }

        lookupDiscordUser(ids.discord).then((user) => {
            if (lookupToken !== modalLookupToken) return;
            if (!user) {
                if (discordTagEl) discordTagEl.style.display = 'none';
                return;
            }
            if (avatarEl) avatarEl.src = user.avatarUrl;
            if (discordTagEl) {
                discordTagEl.textContent = user.globalName
                    ? `${user.displayName} · @${user.username}`
                    : `@${user.username}`;
                discordTagEl.style.display = 'inline-block';
                discordTagEl.title = `Discord ID: ${ids.discord}`;
            }
        });
    }

    // 3. Renderowanie listy identyfikatorów
    renderIdentifiersList(ids, player);

    // 4. Przycisk ulubionych w modalu
    updateModalFavButton(player);

    // 5. Podpięcie szybkich akcji
    setupQuickActions(ids, player);

    // Otwarcie modala
    modalEl.style.display = 'flex';
    requestAnimationFrame(() => {
        modalEl.classList.add('active');
    });
};

export const closePlayerModal = () => {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    setTimeout(() => {
        if (!modalEl.classList.contains('active')) {
            modalEl.style.display = 'none';
        }
    }, 200);
    currentModalPlayer = null;
};

const parseIdentifiers = (identifiers) => {
    const parsed = {
        steamHex: null,
        steamDec: null,
        license: null,
        license2: null,
        discord: null,
        fivem: null,
        xbl: null,
        live: null,
        rawList: identifiers
    };

    identifiers.forEach(idStr => {
        if (idStr.startsWith('steam:')) {
            parsed.steamHex = idStr;
            const hexClean = idStr.replace('steam:', '');
            parsed.steamDec = hexToDecimal(hexClean);
        } else if (idStr.startsWith('license:')) {
            parsed.license = idStr;
        } else if (idStr.startsWith('license2:')) {
            parsed.license2 = idStr;
        } else if (idStr.startsWith('discord:')) {
            parsed.discord = idStr.replace('discord:', '');
        } else if (idStr.startsWith('fivem:')) {
            parsed.fivem = idStr.replace('fivem:', '');
        } else if (idStr.startsWith('xbl:')) {
            parsed.xbl = idStr.replace('xbl:', '');
        } else if (idStr.startsWith('live:')) {
            parsed.live = idStr.replace('live:', '');
        }
    });

    return parsed;
};

const renderIdentifiersList = (ids, player) => {
    const container = document.getElementById('modal-identifiers-list');
    if (!container) return;

    container.innerHTML = '';

    const items = [
        { label: 'Steam HEX', value: ids.steamHex, icon: 'img/steam.svg', type: 'steam' },
        { label: 'Steam ID64 (Dec)', value: ids.steamDec, icon: 'img/steam.svg', type: 'steam' },
        { label: 'Rockstar License', value: ids.license, badge: 'LIC', type: 'license' },
        { label: 'Rockstar License 2', value: ids.license2, badge: 'LIC2', type: 'license' },
        { label: 'Discord ID', value: ids.discord, icon: 'img/discord.svg', type: 'discord' },
        { label: 'Discord Mention', value: ids.discord ? `<@${ids.discord}>` : null, icon: 'img/discord.svg', type: 'discord' },
        { label: 'FiveM Forum ID', value: ids.fivem, badge: 'CFX', type: 'fivem' },
        { label: 'Xbox Live (XBL)', value: ids.xbl, badge: 'XBL', type: 'other' },
        { label: 'Microsoft Live', value: ids.live, badge: 'LIVE', type: 'other' },
    ];

    let renderedCount = 0;
    items.forEach(item => {
        if (!item.value) return;
        renderedCount++;

        const row = document.createElement('div');
        row.className = 'modal-id-row';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'modal-id-label';
        labelDiv.textContent = item.label;

        const valueDiv = document.createElement('div');
        valueDiv.className = 'modal-id-value-box';

        const valSpan = document.createElement('span');
        valSpan.className = 'modal-id-val';
        valSpan.textContent = item.value;
        valSpan.title = item.value;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'modal-id-copy-btn';
        copyBtn.type = 'button';
        copyBtn.title = `Kopiuj ${item.label}`;
        copyBtn.innerHTML = '📋 Kopiuj';

        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(item.value, `Skopiowano ${item.label}`);
            copyBtn.innerHTML = '✅ Skopiowano';
            setTimeout(() => {
                copyBtn.innerHTML = '📋 Kopiuj';
            }, 1500);
        });

        valueDiv.appendChild(valSpan);
        valueDiv.appendChild(copyBtn);

        row.appendChild(labelDiv);
        row.appendChild(valueDiv);
        container.appendChild(row);
    });

    if (renderedCount === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'modal-no-ids';
        emptyDiv.textContent = 'Brak dostępnych identyfikatorów dla tego gracza.';
        container.appendChild(emptyDiv);
    }
};

const setupQuickActions = (ids, player) => {
    // 1. Kopiuj format txAdmin / Ban
    const copyTxAdminBtn = document.getElementById('modal-action-txadmin');
    if (copyTxAdminBtn) {
        copyTxAdminBtn.onclick = () => {
            const list = [];
            if (ids.steamHex) list.push(ids.steamHex);
            if (ids.license) list.push(ids.license);
            if (ids.license2) list.push(ids.license2);
            if (ids.discord) list.push(`discord:${ids.discord}`);
            if (ids.xbl) list.push(`xbl:${ids.xbl}`);
            if (ids.live) list.push(`live:${ids.live}`);

            const text = list.join(', ');
            copyToClipboard(text, 'Skopiowano identyfikatory do txAdmin!');
        };
    }

    // 2. Kopiuj format server.cfg
    const copyCfgBtn = document.getElementById('modal-action-cfg');
    if (copyCfgBtn) {
        copyCfgBtn.onclick = () => {
            const identifier = ids.steamHex || ids.license || (ids.discord ? `discord:${ids.discord}` : null);
            if (identifier) {
                const cfgLine = `add_principal identifier.${identifier} group.admin`;
                copyToClipboard(cfgLine, 'Skopiowano permisję server.cfg!');
            } else {
                showNotification('Brak identyfikatora Steam lub License do reguły cfg', 'warning');
            }
        };
    }

    // 3. Link Steam / SteamRep
    const steamBtn = document.getElementById('modal-action-steam');
    if (steamBtn) {
        if (ids.steamDec) {
            steamBtn.style.display = 'inline-flex';
            steamBtn.onclick = () => {
                window.open(`https://steamcommunity.com/profiles/${ids.steamDec}`, '_blank');
            };
        } else {
            steamBtn.style.display = 'none';
        }
    }

    // 4. Link Discorder Tools
    const discordBtn = document.getElementById('modal-action-discorder');
    if (discordBtn) {
        if (ids.discord) {
            discordBtn.style.display = 'inline-flex';
            discordBtn.onclick = () => {
                copyToClipboard(ids.discord, `Skopiowano Discord ID: ${ids.discord}`);
                window.open('https://discorder.tools/discord-id-lookup/', '_blank');
            };
        } else {
            discordBtn.style.display = 'none';
        }
    }

    // 5. Kopiuj wszystkie ID jako JSON
    const copyJsonBtn = document.getElementById('modal-action-json');
    if (copyJsonBtn) {
        copyJsonBtn.onclick = () => {
            const dataObj = {
                name: player.name,
                serverId: player.id,
                ping: player.ping,
                identifiers: ids.rawList
            };
            copyToClipboard(JSON.stringify(dataObj, null, 2), 'Skopiowano dane gracza jako JSON!');
        };
    }
};

const updateModalFavButton = (player) => {
    const favBtn = document.getElementById('modal-fav-btn');
    if (!favBtn) return;

    const playerKey = getPlayerKey(player);
    const isFav = isPlayerFavorite(playerKey);

    favBtn.innerHTML = isFav ? '⭐ W Ulubionych' : '☆ Dodaj do Ulubionych';
    favBtn.className = isFav ? 'modal-btn modal-btn-fav active' : 'modal-btn modal-btn-fav';

    favBtn.onclick = () => {
        // Znajdź wiersz w tabeli, aby zaktualizować ikonę gwiazdki
        const row = document.querySelector(`tr[data-player-key="${playerKey}"]`);
        const imgElement = row ? row.querySelector('.table-favorite img') : { src: '' };
        
        togglePlayerFavorite(playerKey, player.name, imgElement);
        updateModalFavButton(player);
    };
};

const copyToClipboard = (text, successMessage) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
        .then(() => {
            showNotification(successMessage, 'success');
        })
        .catch(() => {
            showNotification('Błąd podczas kopiowania do schowka', 'error');
        });
};
