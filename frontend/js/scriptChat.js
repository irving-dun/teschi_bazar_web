// =======================================================
// CONFIGURACIÓN Y VARIABLES GLOBALES DEL CHAT
// =======================================================
// CAMBIO: Ahora usamos API_BASE_URL (de firebase-config.js) para que funcione en cualquier laptop
let socketChat;
let idConversacionActual = null;

// Elementos del DOM
const chatContainer = document.getElementById('chat-container');
const chatBody = document.getElementById('chat-body');
const chatInput = document.getElementById('chat-input');
const enviarMensajeBtn = document.getElementById('enviar-mensaje-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const chatProductoNombre = document.getElementById('chat-producto-nombre');

// =======================================================
// 1. UTILIDADES DE FIREBASE (Obtener Token y Usuario)
// =======================================================

function obtenerUsuarioFirebase() {
    return new Promise((resolve, reject) => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            unsubscribe();
            if (user) resolve(user);
            else resolve(null);
        }, reject);
    });
}

// =======================================================
// 2. LÓGICA DE CONEXIÓN Y REGISTRO (Socket.IO)
// =======================================================

async function conectarChat(userId, idToken, idProducto) {
    if (!socketChat) {
        // CAMBIO: Conectamos directamente al servidor de Render definido globalmente
        socketChat = io(API_BASE_URL);

        socketChat.on('server:auth_error', (msg) => {
            alert(msg);
            cerrarChat();
        });

        // Escuchar nuevos mensajes en tiempo real
        socketChat.on('server:nuevo_mensaje', (mensaje) => {
            // El userId es necesario para saber si el mensaje es "mio" o "del otro"
            renderizarMensaje(mensaje, userId);
        });
    }

    // Registrar al usuario en el servidor para que el socket sepa quién es
    socketChat.emit('client:registrar_usuario', { idToken, userId });
}

// =======================================================
// 3. CARGAR HISTORIAL DE MENSAJES (API REST)
// =======================================================

async function cargarHistorialYConversacion(idProducto) {
    try {
        // CAMBIO: Aquí se podría implementar un fetch a `${API_BASE_URL}/api/chat/historial/${idProducto}`
        // Por ahora, mantenemos la limpieza del indicador de carga como en tu original.
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error("Error al cargar historial:", error);
    }
}

// =======================================================
// 4. INTERFAZ DE USUARIO (Renderizado)
// =======================================================

function renderizarMensaje(msg, userIdLocal) {
    const div = document.createElement('div');
    // CAMBIO: Verificamos si el remitente coincide con el usuario logueado para asignar la clase CSS
    const claseMio = msg.id_remitente === userIdLocal ? 'mio' : 'otro';
    div.classList.add('mensaje-chat', claseMio);

    // Formatear la hora
    const fecha = msg.fecha_envio ? new Date(msg.fecha_envio) : new Date();
    const horaFormateada = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <p>${msg.contenido}</p>
        <span class="timestamp">${horaFormateada}</span>
    `;

    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight; // Auto-scroll al final para ver el último mensaje
}

// =======================================================
// 5. ACCIONES PRINCIPALES (Abrir, Cerrar, Enviar)
// =======================================================

async function abrirChat() {
    const user = await obtenerUsuarioFirebase();
    
    if (!user) {
        alert("Debes iniciar sesión para contactar al vendedor.");
        window.location.href = 'login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');
    const idToken = await user.getIdToken();

    // Mostrar UI del Chat
    chatContainer.classList.remove('chat-oculto');
    chatContainer.classList.add('chat-visible');
    
    // Ocultar botón de contactar mientras el chat está abierto
    const btnContactar = document.getElementById('botonContactar');
    if (btnContactar) btnContactar.style.display = 'none';
    
    // Configurar nombre del producto en el encabezado del chat
    const nombreProd = document.getElementById('nombreProducto').textContent;
    chatProductoNombre.textContent = `Chat: ${nombreProd}`;

    // Conectar vía Sockets
    await conectarChat(user.uid, idToken, idProducto);
    enviarMensajeBtn.disabled = false;
    cargarHistorialYConversacion(idProducto);
}

function cerrarChat() {
    chatContainer.classList.remove('chat-visible');
    chatContainer.classList.add('chat-oculto');
    const btnContactar = document.getElementById('botonContactar');
    if (btnContactar) btnContactar.style.display = 'block';
}

async function enviarMensaje() {
    const contenido = chatInput.value.trim();
    if (!contenido) return;

    const user = firebase.auth().currentUser;
    if (!user) return;

    const idToken = await user.getIdToken();
    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');

    const data = {
        idToken: idToken,
        remitenteId: user.uid,
        productoId: idProducto,
        contenido: contenido
    };

    // CAMBIO: Emitimos el mensaje al servidor a través del Socket
    socketChat.emit('client:enviar_mensaje', data);
    chatInput.value = ''; // Limpiar el campo de texto
}

// Event Listeners
const btnContactar = document.getElementById('botonContactar');
if (btnContactar) btnContactar.addEventListener('click', abrirChat);

const btnCerrarChat = document.getElementById('cerrar-chat-btn');
if (btnCerrarChat) btnCerrarChat.addEventListener('click', cerrarChat);

if (enviarMensajeBtn) enviarMensajeBtn.addEventListener('click', enviarMensaje);

// Enviar con la tecla Enter
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensaje();
    }
});