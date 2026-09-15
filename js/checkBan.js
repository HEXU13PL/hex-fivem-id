
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
                <body style="background:#0f172a; color:#ffffff; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
                    <div style="text-align:center; padding: 20px;">
                        <h1 style="color:#ef4444; font-size: 2.5rem; margin-bottom: 10px;">Dostęp Zablokowany</h1>
                        <p style="color:#94a3b8; font-size: 1.1rem;">Twój identyfikator (<b>${visitorId}</b>) został zablokowany przez administratora.</p>
                    </div>
                </body>
            `;
            
            window.stop();
        }
    } catch (e) {
        console.error('Błąd sprawdzania statusu blokady:', e);
    }
})();