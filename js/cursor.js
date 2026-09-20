const CURSOR_STORAGE_KEY = 'customCursor';
const CROSS_CURSOR_IMAGE = 'https://cdn.nest.rip/uploads/04d2f2f5-1338-4321-815b-10c857650485.gif';
const HELLO_KITTY_CURSOR_IMAGE = 'https://cdn.nest.rip/uploads/92e1a4d9-32d6-4534-881d-cd799d432681.gif';

const cursorOptions = {
    default: null,
    cross: (color, image) => image ? `url("${image}") 16 16, crosshair` : `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><circle cx='16' cy='16' r='7' fill='none' stroke='${color}' stroke-width='2'/><path d='M16 2v8M16 22v8M2 16h8M22 16h8' stroke='${color}' stroke-width='2'/></svg>`)}") 16 16, crosshair`,
    helloKitty: (color, image) => image ? `url("${image}") 16 16, pointer` : `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M8 7l5 2c2-2 4-2 6 0l5-2-1 7c2 4 0 11-5 13-2 1-5 1-7 0-5-2-7-9-5-13z' fill='#ff8fbd' stroke='#070709' stroke-width='2'/><circle cx='13' cy='16' r='1.5' fill='#070709'/><circle cx='20' cy='16' r='1.5' fill='#070709'/><path d='M15 20h3' stroke='#070709' stroke-width='1.5'/><path d='M21 9l3-3 3 3-3 3z' fill='${color}' stroke='#070709' stroke-width='1.5'/></svg>`)}") 16 16, pointer`,
};

const getAccentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim() || '#e50914';

const getImageUrl = (name) => name === 'cross' ? CROSS_CURSOR_IMAGE : HELLO_KITTY_CURSOR_IMAGE;

let animatedCursorElement = null;

const initAnimatedCursor = () => {
    if (animatedCursorElement) return;
    animatedCursorElement = document.createElement('img');
    animatedCursorElement.className = 'animated-custom-cursor';
    animatedCursorElement.alt = '';
    animatedCursorElement.setAttribute('aria-hidden', 'true');
    document.body.appendChild(animatedCursorElement);

    document.addEventListener('pointermove', (event) => {
        if (!animatedCursorElement) return;
        animatedCursorElement.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    });
};

const applyCursor = (name) => {
    const cursor = cursorOptions[name];
    const imageUrl = getImageUrl(name);
    const isAnimated = Boolean(cursor && imageUrl);
    document.documentElement.style.setProperty('--custom-cursor', isAnimated ? 'none' : cursor ? cursor(getAccentColor(), '') : 'auto');
    document.body.dataset.cursor = name;

    if (animatedCursorElement) {
        animatedCursorElement.src = isAnimated ? imageUrl : '';
        animatedCursorElement.hidden = !isAnimated;
    }
};

export const initCursor = () => {
    const select = document.querySelector('#cursor-style');
    if (!select) return;

    const savedCursor = localStorage.getItem(CURSOR_STORAGE_KEY) || 'default';
    select.value = cursorOptions[savedCursor] ? savedCursor : 'default';
    initAnimatedCursor();
    applyCursor(select.value);

    select.addEventListener('change', () => {
        applyCursor(select.value);
        localStorage.setItem(CURSOR_STORAGE_KEY, select.value);
    });

    document.querySelector('#accent-color-picker')?.addEventListener('input', () => {
        applyCursor(select.value);
    });
};

