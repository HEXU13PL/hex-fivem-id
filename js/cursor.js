const CURSOR_STORAGE_KEY = 'customCursor';
const CROSS_CURSOR_IMAGE = 'https://cdn.nest.rip/uploads/04d2f2f5-1338-4321-815b-10c857650485.gif';
const HELLO_KITTY_CURSOR_IMAGE = 'https://cdn.nest.rip/uploads/92e1a4d9-32d6-4534-881d-cd799d432681.gif';
const STICH_CURSOR_IMAGE = 'https://cdn.nest.rip/uploads/32b12e10-0aea-4560-9080-9cc1c47250f9.gif';
const JIGGLYPUFF_CURSOR_IMAGE = 'https://cdn.nest.rip/uploads/9da9bc90-fc76-48d5-84a1-d6d56af3557e.png';

const cursorOptions = {
    default: null,
    cross: (color, image) => image ? `url("${image}") 16 16, crosshair` : `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><circle cx='16' cy='16' r='7' fill='none' stroke='${color}' stroke-width='2'/><path d='M16 2v8M16 22v8M2 16h8M22 16h8' stroke='${color}' stroke-width='2'/></svg>`)}") 16 16, crosshair`,
    helloKitty: (color, image) => image ? `url("${image}") 16 16, pointer` : `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M8 7l5 2c2-2 4-2 6 0l5-2-1 7c2 4 0 11-5 13-2 1-5 1-7 0-5-2-7-9-5-13z' fill='#ff8fbd' stroke='#070709' stroke-width='2'/><circle cx='13' cy='16' r='1.5' fill='#070709'/><circle cx='20' cy='16' r='1.5' fill='#070709'/><path d='M15 20h3' stroke='#070709' stroke-width='1.5'/><path d='M21 9l3-3 3 3-3 3z' fill='${color}' stroke='#070709' stroke-width='1.5'/></svg>`)}") 16 16, pointer`,
    stich: (color, image) => image ? `url("${image}") 16 16, pointer` : `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M9 24c0-5 3-9 7-9s7 4 7 9' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round'/><circle cx='16' cy='11' r='6' fill='#7ec8ff' stroke='#0a0a0a' stroke-width='2'/><circle cx='13.5' cy='11' r='1.3' fill='#0a0a0a'/><circle cx='18.5' cy='11' r='1.3' fill='#0a0a0a'/><path d='M14 15.5c1 .8 3 .8 4 0' stroke='#0a0a0a' stroke-width='1.5' stroke-linecap='round'/><path d='M8 8l4 2 2-4 2 4 4-2 1 4-7 3-7-3z' fill='${color}' opacity='0.9' stroke='#0a0a0a' stroke-width='1.5'/><path d='M9 21l-3 5M23 21l3 5' stroke='#0a0a0a' stroke-width='2' stroke-linecap='round'/></svg>`)}") 16 16, pointer`,
    jigglypuff: (color, image) => image ? `url("${image}") 16 16, pointer` : `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M9 17c0-5 3-9 7-9s7 4 7 9c0 5-3 9-7 9s-7-4-7-9z' fill='#ffd6e8' stroke='#0a0a0a' stroke-width='2'/><circle cx='13.5' cy='14' r='1.5' fill='#0a0a0a'/><circle cx='18.5' cy='14' r='1.5' fill='#0a0a0a'/><path d='M14.5 18.5c1 .8 2 .8 3 0' stroke='#0a0a0a' stroke-width='1.5'/><path d='M11 9c1-3 4-5 7-5 3 0 6 2 7 5' stroke='${color}' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M10 21c-2 2-4 4-4 7M22 21c2 2 4 4 4 7' stroke='#0a0a0a' stroke-width='2' stroke-linecap='round'/></svg>`)}") 16 16, pointer`,
};

const getAccentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim() || '#e50914';

const getImageUrl = (name) => {
    if (name === 'cross') return CROSS_CURSOR_IMAGE;
    if (name === 'helloKitty') return HELLO_KITTY_CURSOR_IMAGE;
    if (name === 'stich') return STICH_CURSOR_IMAGE;
    if (name === 'jigglypuff') return JIGGLYPUFF_CURSOR_IMAGE;
    return '';
};

let animatedCursorElement = null;

const initAnimatedCursor = () => {
    if (animatedCursorElement) return;
    animatedCursorElement = document.createElement('img');
    animatedCursorElement.className = 'animated-custom-cursor';
    animatedCursorElement.alt = '';
    animatedCursorElement.setAttribute('aria-hidden', 'true');
    document.body.appendChild(animatedCursorElement);

    const moveCursor = (event) => {
        if (!animatedCursorElement) return;
        animatedCursorElement.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    };
    document.addEventListener('pointermove', moveCursor, { passive: true });
    document.addEventListener('mousemove', moveCursor, { passive: true });
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
        animatedCursorElement.style.display = isAnimated ? 'block' : 'none';
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

