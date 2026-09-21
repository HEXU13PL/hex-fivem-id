import { BANNED_USERS } from './bannedUsers.js';

(function checkUserBan() {
    try {
        const visitorId = localStorage.getItem('hex_user_id');
        
        if (visitorId && BANNED_USERS.has(visitorId)) {
            document.documentElement.innerHTML = `
                <head>
                    <title>Dostęp Zablokowany</title>
                    <meta charset="UTF-8">
                </head>
                <body style="background:#0a0e17; color:#ffffff; font-family:'Plus Jakarta Sans', sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
                    <div style="text-align:center; padding: 20px;">
                        <h1 style="color:#ef4444; font-size: 2.5rem; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px;">Dostęp Zablokowany</h1>
                        <p style="color:#8c9ba5; font-size: 1.05rem; margin-bottom: 8px;">Zostałeś zablokowany przez administratora.</p>
                        <p style="color:#5c5c70; font-size: 0.9rem;">WYPIERDALAJ 😉</p>
                    </div>
                </body>
            `;
            
            window.stop();
        }
    } catch (e) {
        console.error('Błąd sprawdzania statusu blokady:', e);
    }
})();
