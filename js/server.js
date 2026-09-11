const serverTitle = document.querySelector('#server-title');
const serverHostname = document.querySelector('#server-hostname');
const serverIcon = document.querySelector('#server-icon');
const serverClients = document.querySelector('#server-clients');
const serverConnect = document.querySelector('#server-connect');

export const setTitle = (title) => {
	if (serverTitle) {
		serverTitle.textContent = title;
	}
};

export const setServerInfo = (serverId, data) => {
	if (!data) return;

	if (serverHostname) {
		serverHostname.textContent = data.hostname || 'FiveM Server';
	}

	if (serverIcon && data.icon) {
		serverIcson.src = `data:image/png;base64,${data.icon}`;
	}

	if (serverClients) {
		const clients = data.clients ?? 0;
		const maxClients = data.sv_maxclients ?? 0;
		serverClients.textContent = `${clients}/${maxClients}`;
	}

	if (serverConnect) {
		serverConnect.href = `https://cfx.re/join/${serverId}`;
	}
};