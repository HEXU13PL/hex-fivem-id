import { STORAGE_KEYS } from './utils/constants.js';

export const initTabs = () => {
	const tabButtons = document.querySelectorAll('.tab-button');
	const tabContents = document.querySelectorAll('.tab-content');

	if (!tabButtons.length) return;

	const switchTab = (tabId) => {
		tabButtons.forEach((btn) => {
			if (btn.getAttribute('data-tab') === tabId) {
				btn.classList.add('active');
			} else {
				btn.classList.remove('active');
			}
		});

		tabContents.forEach((content) => {
			if (content.id === `${tabId}-tab`) {
				content.classList.add('active');
			} else {
				content.classList.remove('active');
			}
		});

		localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tabId);
		window.dispatchEvent(new CustomEvent('tabChanged', { detail: { tabId } }));
	};

	tabButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const tabId = button.getAttribute('data-tab');
			if (tabId) switchTab(tabId);
		});
	});

	// Odczyt zapisanej zakładki lub domyślna 'players'
	const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'players';
	switchTab(savedTab);
};