// =======================================================
// CONFIGURACIÓN Y VARIABLES GLOBALES DEL CHAT
// =======================================================
const servidorUrl = "https://tu-app-en-render.onrender.com"; // ⚠️ CAMBIA ESTO POR TU URL DE RENDER
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
// 2. LÓGICA DE CONEXIÓN Y REGISTRO (socketChat.IO)
// =======================================================

async function conectarChat(userId, idToken, idProducto) {
    // Inicializar socketChat si no existe
    if (!socketChat) {
        socketChat = io(servidorUrl);

        // Escuchar errores de autenticación
        socketChat.on('server:auth_error', (msg) => {
            alert(msg);
            cerrarChat();
        });

        // Escuchar nuevos mensajes en tiempo real
        socketChat.on('server:nuevo_mensaje', (mensaje) => {
            renderizarMensaje(mensaje, userId);
        });
    }

    // Registrar al usuario en el servidor
    socketChat.emit('client:registrar_usuario', { idToken, userId });
}

// =======================================================
// 3. CARGAR HISTORIAL DE MENSAJES (API REST)
// =======================================================

async function cargarHistorialYConversacion(idProducto) {
    try {
        // En un flujo real, primero necesitamos saber el ID de la conversación.
        // El servidor creará o buscará la conversación al enviar el primer mensaje,
        // pero para el historial, necesitamos llamar a nuestra nueva ruta.
        
        // NOTA: Para obtener el historial antes del primer mensaje, 
        // podrías necesitar una ruta que busque la conversacion por id_producto y comprador.
        // Por ahora, ocultamos el loading.
        loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error("Error al cargar historial:", error);
    }
}

// =======================================================
// 4. INTERFAZ DE USUARIO (Renderizado)
// =======================================================

function renderizarMensaje(msg, userIdLocal) {
    const div = document.createElement('div');
    // Si el remitente es el usuario actual, burbuja a la derecha, si no, a la izquierda
    const claseMio = msg.id_remitente === userIdLocal ? 'mio' : 'otro';
    div.classList.add('mensaje-chat', claseMio);

    const fecha = new Date(msg.fecha_envio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <p>${msg.contenido}</p>
        <span class="timestamp">${fecha}</span>
    `;

    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight; // Auto-scroll al final
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

    // Mostrar UI
    chatContainer.classList.remove('chat-oculto');
    chatContainer.classList.add('chat-visible');
    document.getElementById('botonContactar').style.display = 'none';
    
    // Configurar nombre del producto en el chat
    const nombreProd = document.getElementById('nombreProducto').textContent;
    chatProductoNombre.textContent = `Chat: ${nombreProd}`;

    // Conectar y Habilitar
    await conectarChat(user.uid, idToken, idProducto);
    enviarMensajeBtn.disabled = false;
    cargarHistorialYConversacion(idProducto);
}

function cerrarChat() {
    chatContainer.classList.remove('chat-visible');
    chatContainer.classList.add('chat-oculto');
    document.getElementById('botonContactar').style.display = 'block';
}

async function enviarMensaje() {
    const contenido = chatInput.value.trim();
    if (!contenido) return;

    const user = firebase.auth().currentUser;
    const idToken = await user.getIdToken();
    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');

    const data = {
        idToken: idToken,
        remitenteId: user.uid,
        productoId: idProducto,
        contenido: contenido
    };

    socketChat.emit('client:enviar_mensaje', data);
    chatInput.value = ''; // Limpiar input
}

// Event Listeners
document.getElementById('botonContactar').addEventListener('click', abrirChat);
document.getElementById('cerrar-chat-btn').addEventListener('click', cerrarChat);
enviarMensajeBtn.addEventListener('click', enviarMensaje);

// Enviar con la tecla Enter
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensaje();
    }
});