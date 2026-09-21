import { STORAGE_KEYS } from './utils/constants.js';
import { fetchServer, getPlayers } from './fetch.js';
import { showNotification, notifyFavoriteStatus, requestNotificationPermission } from './notifications.js';
import { sendLog } from './logger.js';
import { openPlayerModal } from './playerModal.js';
import { lookupDiscordUser, getDefaultDiscordAvatar } from './utils/discord.js';

let favorites = [];
let activePlayerKeys = new Set();
let hasReceivedPlayerStatus = false;

export const getPlayerKey = (player) => {
	if (player.socials && player.socials.steam) return `steam:${player.socials.steam}`;
	if (player.socials && player.socials.discord) return `discord:${player.socials.discord}`;
	return `name:${player.name}`;
};

const getPlayerKeyFromRow = (row) => {
	const key = row.getAttribute('data-player-key');
	if (key) return key;
	const playerId = row.querySelector('.table-id').textContent;
	return `id:${playerId}`;
};

export const initFavorites = () => {
	loadFavorites();
	document.addEventListener('click', (e) => {
		if (e.target.closest('.table-favorite img')) {
			const row = e.target.closest('tr');
			if (!row) return;

			const playerName = row.querySelector('.table-name').textContent;
			const playerKey = getPlayerKeyFromRow(row);
			togglePlayerFavorite(playerKey, playerName, e.target);
		}
	});

	const favoritesMenu = document.querySelector('#favorites-menu');
	if (favoritesMenu) {
		renderFavoritesMenu();

		const favoritesButton = document.querySelector('#favorites-button');
		if (favoritesButton) {
			favoritesButton.addEventListener('click', () => {
				favoritesMenu.classList.toggle('show');
			});

			document.addEventListener('click', (e) => {
				if (!e.target.closest('#favorites-button') && !e.target.closest('#favorites-menu')) {
					favoritesMenu.classList.remove('show');
				}
			});
		}
	}

	renderFavoritePlayers();
};

const loadFavorites = () => {
	const storedFavorites = localStorage.getItem(STORAGE_KEYS.FAVORITES);
	if (storedFavorites) {
		try {
			favorites = JSON.parse(storedFavorites);
		} catch (error) {
			console.error('Failed to parse favorites from localStorage:', error);
			favorites = [];
		}
	}
};

const saveFavorites = () => {
	localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
};

export const toggleServerFavorite = (serverId, serverName, serverIcon) => {
	const existingIndex = favorites.findIndex((fav) => fav.type === 'server' && fav.id === serverId);

	if (existingIndex >= 0) {
		favorites.splice(existingIndex, 1);
		showNotification(`Server "${serverName}" removed from favorites`, 'info');
	} else {
		favorites.push({
			type: 'server',
			id: serverId,
			name: serverName,
			icon: serverIcon,
			timestamp: Date.now(),
		});
		showNotification(`Server "${serverName}" added to favorites`, 'success');
	}

	saveFavorites();
	renderFavoritesMenu();
};

export const togglePlayerFavorite = (playerKey, playerName, imgElement) => {
	const existingIndex = favorites.findIndex((fav) => fav.type === 'player' && fav.key === playerKey);

	if (existingIndex >= 0) {
		favorites.splice(existingIndex, 1);
		imgElement.src = 'img/empty-star.svg';
		showNotification(`Player "${playerName}" removed from favorites`, 'info');
		
		sendLog('FAVORITE_REMOVE', {
			name: playerName,
			key: playerKey
		});
	} else {
		favorites.push({
			type: 'player',
			key: playerKey,
			name: playerName,
			timestamp: Date.now(),
		});
		imgElement.src = 'img/star.svg';
		showNotification(`Player "${playerName}" added to favorites`, 'success');

		sendLog('FAVORITE_ADD', {
			name: playerName,
			key: playerKey
		});
		requestNotificationPermission();
	}

	saveFavorites();
	renderFavoritesMenu();
	renderFavoritePlayers();
};

export const isPlayerFavorite = (playerKey) => {
	return favorites.some((fav) => fav.type === 'player' && fav.key === playerKey);
};

export const isServerFavorite = (serverId) => {
	return favorites.some((fav) => fav.type === 'server' && fav.id === serverId);
};

export const updateActivePlayers = (players) => {
	const nextActivePlayerKeys = new Set(players.map((p) => getPlayerKey(p)));

	if (hasReceivedPlayerStatus) {
		favorites
			.filter((favorite) => favorite.type === 'player')
			.forEach((favorite) => {
				const wasOnline = activePlayerKeys.has(favorite.key);
				const isOnline = nextActivePlayerKeys.has(favorite.key);
				if (wasOnline !== isOnline) {
					notifyFavoriteStatus(favorite.name, isOnline);
				}
			});
	}

	activePlayerKeys = nextActivePlayerKeys;
	hasReceivedPlayerStatus = true;
	renderFavoritePlayers();
};

const renderFavoritesMenu = () => {
	const favoritesMenu = document.querySelector('#favorites-menu');
	if (!favoritesMenu) return;

	while (favoritesMenu.firstChild) {
		favoritesMenu.removeChild(favoritesMenu.firstChild);
	}

	const serverFavorites = favorites.filter((fav) => fav.type === 'server');
	const playerFavorites = favorites.filter((fav) => fav.type === 'player');

	if (serverFavorites.length === 0 && playerFavorites.length === 0) {
		const noFavDiv = document.createElement('div');
		noFavDiv.className = 'no-favorites';
		noFavDiv.textContent = 'No favorites yet';
		favoritesMenu.appendChild(noFavDiv);
	} else {
		if (serverFavorites.length > 0) {
			const section = document.createElement('div');
			section.className = 'favorites-section';
			const h3 = document.createElement('h3');
			h3.textContent = 'Favorite Servers';
			section.appendChild(h3);
			const ul = document.createElement('ul');
			serverFavorites.forEach((server) => {
				const li = document.createElement('li');
				const button = document.createElement('button');
				button.className = 'favorite-item';
				button.setAttribute('data-server-id', server.id);

				const img = document.createElement('img');
				img.className = 'server-icon';
				img.src = server.icon || 'https://fivem.net/favicon.png';
				img.alt = '';

				const span = document.createElement('span');
				span.textContent = server.name;

				button.appendChild(img);
				button.appendChild(span);
				li.appendChild(button);
				ul.appendChild(li);
			});
			section.appendChild(ul);
			favoritesMenu.appendChild(section);
		}

		if (playerFavorites.length > 0) {
			const section = document.createElement('div');
			section.className = 'favorites-section';
			const h3 = document.createElement('h3');
			h3.textContent = 'Favorite Players';
			section.appendChild(h3);
			const ul = document.createElement('ul');
			playerFavorites.forEach((player) => {
				const li = document.createElement('li');
				const span = document.createElement('span');
				span.className = 'favorite-player';
				span.textContent = `${player.name} (${player.key})`;
				li.appendChild(span);
				ul.appendChild(li);
			});
			section.appendChild(ul);
			favoritesMenu.appendChild(section);
		}
	}

	favoritesMenu.querySelectorAll('.favorite-item').forEach((button) => {
		button.addEventListener('click', () => {
			const serverId = button.getAttribute('data-server-id');
			if (serverId) {
				const input = document.querySelector('#server-id');
				if (input) input.value = serverId;
				const statId = document.querySelector('#stat-id');
				if (statId) statId.textContent = serverId;
				localStorage.setItem(STORAGE_KEYS.SERVER_ID, serverId);
				const url = new URL(window.location.href);
				url.searchParams.set('serverId', serverId);
				window.history.replaceState(null, null, url);
				fetchServer(serverId);
				favoritesMenu.classList.remove('show');
			}
		});
	});
};

export const renderFavoritePlayers = () => {
	const favoritesTable = document.getElementById('favorites-table');
	if (!favoritesTable) return;

	const headerRow = favoritesTable.querySelector('#favorites-table-header');
	const rows = [...favoritesTable.querySelectorAll('tr')];
	const footerRow = favoritesTable.querySelector('.table-footer');

	rows.forEach((row) => {
		if (row !== headerRow && row !== footerRow) {
			row.remove();
		}
	});

	const playerFavorites = favorites.filter((fav) => fav.type === 'player');

	if (playerFavorites.length === 0) {
		if (footerRow) {
			const td = footerRow.querySelector('td');
			if (td) {
				while (td.firstChild) td.removeChild(td.firstChild);
				const span = document.createElement('span');
				span.textContent = 'No favorite players yet. Click on the star icon next to a player to add them to favorites.';
				td.appendChild(span);
			}
		}
		return;
	}

	let index = 1;
	playerFavorites.forEach((player) => {
		const isOnline = activePlayerKeys.has(player.key);
		const allPlayers = (typeof getPlayers === 'function' ? getPlayers() : []) || [];
		const matchedPlayer = allPlayers.find((currentPlayer) => getPlayerKey(currentPlayer) === player.key);
		const discordId = matchedPlayer?.socials?.discord
			|| (player.key.startsWith('discord:') ? player.key.replace('discord:', '') : null);
		const tr = document.createElement('tr');
		if (isOnline) {
			tr.classList.add('player-online');
		} else {
			tr.classList.add('player-offline');
		}
		tr.setAttribute('data-player-key', player.key);
		tr.style.cursor = 'pointer';
		tr.title = 'Kliknij, aby otworzyć szczegóły gracza';

		tr.addEventListener('click', (e) => {
			if (e.target.closest('.table-favorite') || e.target.closest('a') || e.target.closest('button')) {
				return;
			}
			const allPlayers = (typeof getPlayers === 'function' ? getPlayers() : []) || [];
			const matched = allPlayers.find((p) => getPlayerKey(p) === player.key);
			if (matched) {
				openPlayerModal(matched);
			} else {
				openPlayerModal({
					name: player.name,
					id: isOnline ? 'Online' : 'Offline',
					ping: '--',
					identifiers: [player.key],
				});
			}
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
		const starImg = document.createElement('img');
		starImg.src = 'img/star.svg';
		starImg.alt = 'Remove from Favorites';
		starImg.title = 'Remove from Favorites';
		star.appendChild(starImg);
		id.textContent = player.key;

		const playerNameText = document.createElement('span');
		playerNameText.className = 'player-name-text';
		playerNameText.textContent = player.name;
		name.appendChild(playerNameText);

		if (discordId) {
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
				navigator.clipboard.writeText(mentionFormat).then(() => {
					showNotification(`Skopiowano: ${mentionFormat}`, 'success');
				});
			};
			name.appendChild(discordContainer);

			lookupDiscordUser(discordId).then((user) => {
				if (!user || !discordContainer.isConnected) return;
				const resolvedDisplayName = user.displayName || user.username || discordId;
				if (resolvedDisplayName.trim().toLowerCase() === (player.name || '').trim().toLowerCase()) {
					discordContainer.style.display = 'none';
					return;
				}
				avatarImg.src = user.avatarUrl;
				nickSpan.textContent = resolvedDisplayName;
				discordContainer.title = `Discord: ${resolvedDisplayName}${user.username ? ` (@${user.username})` : ''} — kliknij, aby skopiować ${mentionFormat}`;
			});
		}

		const ping_text = document.createElement('span');
		ping_text.textContent = isOnline ? 'Online' : 'Offline';
		const statusImg = document.createElement('img');
		statusImg.src = isOnline ? 'img/Online.svg' : 'img/Offline.svg';
		statusImg.alt = isOnline ? 'Online' : 'Offline';
		statusImg.title = isOnline ? 'Online' : 'Offline';
		ping.appendChild(statusImg);
		ping.appendChild(ping_text);

		if (discordId) {
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

		const profileBtn = document.createElement('button');
		profileBtn.type = 'button';
		profileBtn.className = 'dl-lookup-btn';
		profileBtn.style.cssText = 'background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.18); color: #fff;';
		profileBtn.title = 'Zobacz szczegóły gracza';
		profileBtn.innerHTML = '👁️ Profil';
		profileBtn.onclick = (e) => {
			e.stopPropagation();
			const allPlayers = (typeof getPlayers === 'function' ? getPlayers() : []) || [];
			const matched = allPlayers.find((p) => getPlayerKey(p) === player.key);
			if (matched) {
				openPlayerModal(matched);
			} else {
				openPlayerModal({
					name: player.name,
					id: isOnline ? 'Online' : 'Offline',
					ping: '--',
					identifiers: [player.key],
				});
			}
		};
		socials.appendChild(profileBtn);

		tr.appendChild(no);
		tr.appendChild(star);
		tr.appendChild(id);
		tr.appendChild(name);
		tr.appendChild(socials);
		tr.appendChild(ping);

		starImg.addEventListener('click', function (e) {
			e.stopPropagation();
			togglePlayerFavorite(player.key, player.name, this);
			renderFavoritePlayers();
		});

		if (footerRow && footerRow.parentNode === favoritesTable) {
			favoritesTable.insertBefore(tr, footerRow);
		} else {
			favoritesTable.appendChild(tr);
		}
	});

	if (footerRow) {
		const td = footerRow.querySelector('td');
		if (td) {
			while (td.firstChild) td.removeChild(td.firstChild);
			const span = document.createElement('span');
			span.textContent = `Showing ${playerFavorites.length} favorite player${playerFavorites.length !== 1 ? 's' : ''}.`;
			td.appendChild(span);
		}
	}
};
