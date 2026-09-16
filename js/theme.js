export function initTheme() {
    const picker = document.querySelector('#accent-color-picker');
    if (!picker) return;

    // Pobierz zapisany kolor lub użyj domyślnego czerwonego
    const savedColor = localStorage.getItem('theme_accent_color') || '#e50914';
    picker.value = savedColor;
    applyAccentColor(savedColor);

    // Dynamiczna zmiana podczas przesuwania po palecie kolorów
    picker.addEventListener('input', (e) => {
        applyAccentColor(e.target.value);
    });

    // Zapisz wybrany kolor po opuszczeniu okna wyboru
    picker.addEventListener('change', (e) => {
        localStorage.setItem('theme_accent_color', e.target.value);
    });
}

function applyAccentColor(hexColor) {
    const root = document.documentElement;
    const rgbaGlow = hexToRgba(hexColor, 0.35);
    const borderGlow = hexToRgba(hexColor, 0.4);

    root.style.setProperty('--accent-red', hexColor);
    root.style.setProperty('--accent-red-hover', hexColor);
    root.style.setProperty('--accent-red-glow', rgbaGlow);
    root.style.setProperty('--border-glow', borderGlow);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', hexColor);
}

function hexToRgba(hex, alpha) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}