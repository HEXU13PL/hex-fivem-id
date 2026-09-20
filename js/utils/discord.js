const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
const CACHE_KEY = 'discordUserCache';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CONCURRENT = 6;

const memoryCache = new Map();
const inflight = new Map();
let activeRequests = 0;
const waitQueue = [];

const loadPersistedCache = () => {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw);
		Object.entries(parsed).forEach(([id, entry]) => {
			if (entry && entry.fetchedAt && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
				memoryCache.set(id, entry);
			}
		});
	} catch {
		// ignore broken cache
	}
};

const persistCache = () => {
	const serialized = {};
	memoryCache.forEach((entry, id) => {
		if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
			serialized[id] = entry;
		}
	});
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(serialized));
	} catch {
		// quota / private mode
	}
};

loadPersistedCache();

const defaultAvatarUrl = (userId) => {
	try {
		const index = Number(BigInt(userId) >> 22n) % 6;
		return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
	} catch {
		return DEFAULT_AVATAR;
	}
};

const buildAvatarUrl = (userId, avatarHash, size = 128) => {
	if (!avatarHash) return defaultAvatarUrl(userId);
	const ext = String(avatarHash).startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
};

const normalizeUser = (raw, userId, size = 128) => {
	if (!raw || typeof raw !== 'object') return null;

	const nested = raw.data?.discord_user || raw.discord_user || raw.data || raw.user || raw;
	const id = String(nested.id || userId);
	const username = nested.username || nested.tag || nested.name || '';
	if (!id || (!username && !nested.global_name && !nested.globalName && !nested.avatar && !nested.avatarURL)) {
		return null;
	}

	const globalName = nested.global_name || nested.globalName || '';
	const avatarHash = typeof nested.avatar === 'string'
		? nested.avatar
		: nested.avatar?.id || nested.avatar?.hash || '';
	const avatarUrl = nested.avatarURL
		|| nested.avatar?.link
		|| buildAvatarUrl(id, avatarHash, size);

	const displayName = globalName || username || id;

	return {
		id,
		username: username || displayName,
		globalName,
		displayName,
		avatarUrl: avatarUrl || defaultAvatarUrl(id),
		fetchedAt: Date.now(),
	};
};

const fetchJson = async (url) => {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
};

const fetchFromApis = async (userId) => {
	const endpoints = [
		`https://api.discord.id/v1/users/${userId}`,
		`https://japi.rest/discord/v1/user/${userId}`,
		`https://api.lanyard.rest/v1/users/${userId}`,
	];

	for (const url of endpoints) {
		try {
			const json = await fetchJson(url);
			const user = normalizeUser(json, userId);
			if (user) return user;
		} catch {
			// try next source
		}
	}
	return null;
};

const runQueued = (fn) =>
	new Promise((resolve, reject) => {
		waitQueue.push({ fn, resolve, reject });
		pumpQueue();
	});

const pumpQueue = () => {
	while (activeRequests < MAX_CONCURRENT && waitQueue.length > 0) {
		const item = waitQueue.shift();
		activeRequests += 1;
		Promise.resolve()
			.then(item.fn)
			.then(item.resolve, item.reject)
			.finally(() => {
				activeRequests -= 1;
				pumpQueue();
			});
	}
};

export const getDefaultDiscordAvatar = (userId) => defaultAvatarUrl(userId);

export const lookupDiscordUser = (userId) => {
	const id = String(userId || '').trim();
	if (!id) return Promise.resolve(null);

	const cached = memoryCache.get(id);
	if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
		return Promise.resolve(cached);
	}

	if (inflight.has(id)) return inflight.get(id);

	const request = runQueued(() => fetchFromApis(id)).then((user) => {
		if (user) {
			memoryCache.set(id, user);
			persistCache();
		}
		inflight.delete(id);
		return user;
	}).catch(() => {
		inflight.delete(id);
		return null;
	});

	inflight.set(id, request);
	return request;
};
