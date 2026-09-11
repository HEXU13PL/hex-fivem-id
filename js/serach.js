import { getPlayers, renderPlayers } from './fetch.js';

let search;
let searching = false;

export const initializeSearch = () => {
	search = document.querySelector('#search');
	search.addEventListener('keyup', (event) => serachPlayers());
	
	const url = new URL(window.location.href);
	if (url.searchParams.has('search')) {
		const searchValue = url.searchParams.get('search');
		search.value = searchValue;
		serachPlayers();
	}
};

export const serachPlayers = () => {
	const value = search.value;
	updateSearchParam(value);
	
	let players = getPlayers();
	if (value.length < 1) {
		searching = false;
		return renderPlayers(players, true);
	}

	searching = true;
	players = players.filter(
		(player) => player.id.toString().startsWith(value) || player.name.toLowerCase().includes(value.toLowerCase())
	);
	renderPlayers(players, true);
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
