// 1. Inicialización de Socket.io
const socket = io('http://localhost:3000');
let contadorLocal = 0;

// 2. Observador de estado de Firebase
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("🔔 Sistema de notificaciones activo para:", user.uid);

        // --- ESCUCHAR NOTIFICACIONES EN TIEMPO REAL ---
        socket.on(`notificacion_${user.uid}`, (data) => {
            mostrarAlertaVisual(data.mensaje); // El recuadro verde
            incrementarContador();
            // Si el menú está abierto, lo actualizamos de una vez
            const menu = document.getElementById('menuNotificaciones');
            if (menu.style.display === 'block') {
                cargarNotificacionesEnMenu(user.uid);
            }
        });

        // --- CONFIGURACIÓN DE LA CAMPANA ---
        const btnCampana = document.getElementById('btnCampana');
        const menu = document.getElementById('menuNotificaciones');

        btnCampana.onclick = (e) => {
            e.stopPropagation();
            const isVisible = menu.style.display === 'block';
            menu.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                cargarNotificacionesEnMenu(user.uid);
                resetearContador(); // Limpia el círculo rojo al leer
            }
        };

        // Cargar contador inicial (opcional: podrías pedir al server las no leídas)
    } else {
        console.log("Sistema de notificaciones en espera: Usuario no autenticado.");
    }
});

// --- FUNCIONES DE APOYO ---

function mostrarAlertaVisual(mensaje) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999;
        font-family: 'Poppins', sans-serif;
        animation: slideIn 0.5s ease-out;
    `;
    toast.innerText = mensaje;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.5s ease-in';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

function incrementarContador() {
    contadorLocal++;
    const badge = document.getElementById('contadorNotificaciones');
    if (badge) {
        badge.innerText = contadorLocal;
        badge.style.display = 'block';
    }
}

function resetearContador() {
    contadorLocal = 0;
    const badge = document.getElementById('contadorNotificaciones');
    if (badge) badge.style.display = 'none';
}

async function cargarNotificacionesEnMenu(uid) {
    try {
        const res = await fetch(`http://localhost:3000/api/notificaciones/${uid}`);
        const notificaciones = await res.json();
        
        const lista = document.getElementById('listaNotificaciones');
        lista.innerHTML = ''; 

        if (!notificaciones || notificaciones.length === 0) {
            lista.innerHTML = '<p style="padding: 10px; font-size: 14px; color: #666;">No hay notificaciones</p>';
            return;
        }

        notificaciones.forEach(notif => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 12px; 
                border-bottom: 1px solid #eee; 
                cursor: pointer; 
                background: ${notif.leida ? 'white' : '#f8f9fa'};
                transition: background 0.3s;
            `;
            item.innerHTML = `
                <strong style="font-size: 12px; color: #333;">NUEVA PETICIÓN</strong>
                <p style="margin: 0; font-size: 13px; color: #555;">${notif.mensaje}</p>
                <small style="font-size: 10px; color: #999;">${new Date(notif.fecha_creacion).toLocaleString()}</small>
            `;
            
            item.onmouseover = () => item.style.background = "#e9ecef";
            item.onmouseout = () => item.style.background = notif.leida ? 'white' : '#f8f9fa';
            
            item.onclick = () => {
                window.location.href = 'publicaciones.html';
            };
            
            lista.appendChild(item);
        });
    } catch (error) {
        console.error("Error al cargar menú:", error);
    }
}

// Cerrar menú al hacer clic en cualquier otra parte
window.addEventListener('click', () => {
    const menu = document.getElementById('menuNotificaciones');
    if (menu) menu.style.display = 'none';
});

// Estilos de animación
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
`;
document.head.appendChild(style);