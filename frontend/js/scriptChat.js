// =======================================================
// LÓGICA INICIAL DEL CHAT (scriptChat.js)
// =======================================================

// 1. Obtención de Elementos del DOM
const chatContainer = document.getElementById('chat-container');
const botonContactar = document.getElementById('botonContactar');
const cerrarChatBtn = document.getElementById('cerrar-chat-btn');

// Elementos de la interfaz de chat (para referencia futura)
const chatBody = document.getElementById('chat-body');
const chatInput = document.getElementById('chat-input');
const enviarMensajeBtn = document.getElementById('enviar-mensaje-btn');
const loadingIndicator = document.getElementById('loading-indicator');


// 2. Manejadores de Eventos para Abrir y Cerrar

/**
 * Muestra la ventana de chat y oculta el botón de contacto.
 * Aquí es donde se iniciará la conexión WebSocket y la carga del historial.
 */
function abrirChat() {
    chatContainer.classList.remove('chat-oculto');
    chatContainer.classList.add('chat-visible');
    botonContactar.style.display = 'none';

    // *** PASO CLAVE PARA LA PRÓXIMA ETAPA ***
    // 1. Verificar autenticación Firebase (¿El usuario está logueado?)
    // 2. Obtener los IDs necesarios (Producto, Comprador, Vendedor).
    // 3. Iniciar la conexión Socket.IO y cargar el historial.

    console.log("Chat abierto. La siguiente etapa es iniciar la conexión y la carga de datos.");
}

/**
 * Oculta la ventana de chat y muestra el botón de contacto.
 * Aquí se limpiarán datos y se podría desconectar el socket (opcional).
 */
function cerrarChat() {
    chatContainer.classList.remove('chat-visible');
    chatContainer.classList.add('chat-oculto');
    botonContactar.style.display = 'block';

    console.log("Chat cerrado.");
}

// 3. Asignación de Event Listeners
if (botonContactar) {
    botonContactar.addEventListener('click', abrirChat);
}

if (cerrarChatBtn) {
    cerrarChatBtn.addEventListener('click', cerrarChat);
}