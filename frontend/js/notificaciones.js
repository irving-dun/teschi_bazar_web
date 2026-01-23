// 1. Inicialización de Socket.io
const socket = io(API_BASE_URL);
let contadorLocal = 0;

// 2. Observador de estado de Firebase
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("🔔 Sistema de notificaciones activo para:", user.uid);

        // --- ESCUCHAR NOTIFICACIONES DE PETICIONES (EXISTENTE) ---
        socket.on(`notificacion_${user.uid}`, (data) => {
            mostrarAlertaVisual(data.mensaje); 
            incrementarContador();
            const menu = document.getElementById('menuNotificaciones');
            if (menu && menu.style.display === 'block') {
                cargarNotificacionesEnMenu(user.uid);
            }
        });

        // --- NUEVO: ESCUCHAR NOTIFICACIONES DE CHAT ---
        // Usamos el evento que definimos en server.js
        socket.on(`notificacion_chat_${user.uid}`, (data) => {
            // Verificamos si el chat está abierto para NO notificar si el usuario ya está leyendo
            // currentConvId e iniciarMensajeria vienen de scriptChat.js
            const chatAbierto = (typeof chatWindow !== 'undefined' && chatWindow.style.display === 'block');
            const enMismaConversacion = (typeof currentConvId !== 'undefined' && currentConvId === data.id_conversacion);

            if (chatAbierto && enMismaConversacion) {
                return; // Silencio, el usuario ya está en el chat
            }

            // Si no está en el chat, usamos tus funciones originales
            mostrarAlertaVisual(`Mensaje nuevo: ${data.contenido}`);
            incrementarContador();
            
            // Agregamos el mensaje al menú manualmente para que aparezca de inmediato
            agregarChatAlMenu(data);
        });

        // --- CONFIGURACIÓN DE LA CAMPANA ---
        const btnCampana = document.getElementById('btnCampana');
        const menu = document.getElementById('menuNotificaciones');

        if (btnCampana && menu) {
            btnCampana.onclick = (e) => {
                e.stopPropagation();
                const isVisible = menu.style.display === 'block';
                menu.style.display = isVisible ? 'none' : 'block';
                
                if (!isVisible) {
                    cargarNotificacionesEnMenu(user.uid);
                    resetearContador(); 
                }
            };
        }
    } else {
        console.log("Sistema de notificaciones en espera: Usuario no autenticado.");
    }
});

// --- NUEVA FUNCIÓN DE APOYO PARA CHAT (No cambia las anteriores) ---

function agregarChatAlMenu(data) {
    const lista = document.getElementById('listaNotificaciones');
    if (!lista) return;

    // Buscamos el mensaje de "No tienes notificaciones" por su clase o etiqueta
    const vacio = lista.querySelector('.notif-vacia') || lista.querySelector('p');
    if (vacio) vacio.remove();

    const item = document.createElement('div');
    // Usamos tus clases de CSS si las tienes, o mantenemos el estilo para que resalte
    item.className = 'notif-item-chat'; // Puedes darle estilo en notificaciones.css
    item.style.cssText = `
        padding: 12px; 
        border-bottom: 1px solid #eee; 
        cursor: pointer; 
        background: #f0f7ff; 
    `;
    
    item.innerHTML = `
        <strong style="font-size: 12px; color: #007bff;">💬 NUEVO MENSAJE</strong>
        <p style="margin: 0; font-size: 13px; color: #333;">${data.contenido}</p>
        <small style="font-size: 10px; color: #999;">Ahora mismo</small>
    `;

    item.onclick = (e) => {
        e.stopPropagation();
        // Si el usuario está en index.html, lo mandamos al producto
        // Si está en detalleProducto.html, abrimos el chat
        if (typeof iniciarMensajeria === 'function') {
            document.getElementById('btnContactarVendedor').click();
            iniciarMensajeria(data.id_conversacion);
        } else {
            // Si no está en la página del producto, lo ideal es llevarlo allá
            // Para esto necesitaríamos el ID del producto en el evento del socket
            window.location.href = `detalleProducto.html?id=${data.id_producto}`;
        }
    };

    lista.prepend(item);
}

// --- FUNCIONES DE APOYO (SE MANTIENEN IGUAL) ---

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
    const badge = document.getElementById('contadorNotifications'); // Verifica si es 'contadorNotificaciones' o 'contadorNotifications'
    const realBadge = badge || document.getElementById('contadorNotificaciones');
    if (realBadge) {
        realBadge.innerText = contadorLocal;
        realBadge.style.display = 'block';
    }
}

function resetearContador() {
    contadorLocal = 0;
    const badge = document.getElementById('contadorNotificaciones');
    if (badge) badge.style.display = 'none';
}

async function cargarNotificacionesEnMenu(uid) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/notificaciones/${uid}`);
        const notificaciones = await res.json();
        
        const lista = document.getElementById('listaNotificaciones');
        if (!lista) return;
        
        lista.innerHTML = ''; 

        if (!notificaciones || notificaciones.length === 0) {
            lista.innerHTML = '<p style="padding: 10px; font-size: 14px; color: #e03b3bff;">No hay notificaciones</p>';
            return;
        }

        notificaciones.forEach(notif => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 12px; 
                border-bottom: 1px solid #2b2a2aff; 
                cursor: pointer; 
                background: ${notif.leida ? 'white' : '#f8f9fa'};
                transition: background 0.3s;
            `;
            item.innerHTML = `
                <strong style="font-size: 12px; color: #1b8b44ff;">NUEVA PETICIÓN</strong>
                <p style="margin: 0; font-size: 13px; color: #0c0c0cff;">${notif.mensaje}</p>
                <small style="font-size: 10px; color: #a01515ff;">${new Date(notif.fecha_creacion).toLocaleString()}</small>
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

window.addEventListener('click', () => {
    const menu = document.getElementById('menuNotificaciones');
    if (menu) menu.style.display = 'none';
});

const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
`;
document.head.appendChild(style);