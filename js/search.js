import { getPlayers, renderPlayers } from './fetch.js';
import { getPlayerKey } from './favorites.js';
import { sendLog } from './logger.js';

let search;
let searching = false;
let pendingSearch = null;
let lastSearchQuery = '';

export const initializeSearch = () => {
	search = document.querySelector('#search');
	search.addEventListener('keyup', () => searchPlayers());
	
	const url = new URL(window.location.href);
	if (url.searchParams.has('search')) {
		const searchValue = url.searchParams.get('search');
		search.value = searchValue;
		pendingSearch = searchValue; 
	}
};

export const searchPlayers = () => {
	const value = search.value;
	updateSearchParam(value);

	let players = getPlayers();
	if (!players) {
		return;
	}

	if (value.length < 1) {
		searching = false;
		lastSearchQuery = '';
		return renderPlayers(players, true);
	}

	searching = true;

	if (value.length >= 2 && value !== lastSearchQuery) {
		lastSearchQuery = value;
		sendLog('PLAYER_SEARCH', { query: value });
	}

	players = players.filter(
		(player) =>
			player.id.toString().startsWith(value) ||
			player.name.toLowerCase().includes(value.toLowerCase()) ||
			getPlayerKey(player).toLowerCase().includes(value.toLowerCase())
	);
	renderPlayers(players, true);
};

export const checkPendingSearch = () => {
	if (pendingSearch) {
		searchPlayers();
		pendingSearch = null;
	}
};

const updateSearchParam = (searchValue) => {
	const url = new URL(window.location.href);
	if (searchValue.length > 0) {
		url.searchParams.set('search', searchValue);
	} else {
		url.searchParams.delete('search');
	}
	window.history.replaceState(null, null, url);
};

export const isSearching = () => searching;
