const btnContactar = document.getElementById('btnContactarVendedor');
const chatWindow = document.getElementById('chat-window'); // Tu ventana emergente
const chatContent = document.getElementById('chat-content'); // Contenedor interno

let currentConvId = null;

btnContactar.addEventListener('click', async () => {
    const user = firebase.auth().currentUser;
    if (!user) return alert("Debes iniciar sesión para contactar al vendedor");

    // Datos obtenidos de detalleProducto.js
    const idVendedor = document.getElementById('detalleNombreVendedor').getAttribute('data-uid-vendedor');
    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');

    chatWindow.classList.remove('chat-oculto');
    chatWindow.classList.add('chat-visible');
    chatWindow.style.display = 'flex';
    btnContactar.style.display = 'none';

    if (user.uid === idVendedor) {
        // ESCENARIO VENDEDOR: Cargar lista de interesados
        cargarListaInteresados(idProducto);
    } else {
        // ESCENARIO COMPRADOR: Abrir chat directo
        abrirChatDirecto(user.uid, idVendedor, idProducto);
    }
});

async function cargarListaInteresados(idProducto) {
    chatContent.innerHTML = "<p>Cargando interesados...</p>";
    const res = await fetch(`${API_BASE_URL}/api/chat/vendedor/producto/${idProducto}`);
    const conversatines = await res.json();

    chatContent.innerHTML = "<h4>Interesados en este producto:</h4>";
    
    for (const conv of conversatines) {
        // Extraemos nombre desde Firebase como lo haces en el perfil
        const userDoc = await firebase.firestore().collection('usuarios').doc(conv.id_comprador).get();
        const nombre = userDoc.exists ? userDoc.data().nombre : "Usuario";

        const item = document.createElement('div');
        item.className = "item-conversacion";
        item.style = "padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;";
        item.innerHTML = `<strong>${nombre}</strong><br><small>ID: ${conv.id_conversacion}</small>`;
        item.onclick = () => iniciarMensajeria(conv.id_conversacion);
        chatContent.appendChild(item);
    }
}

async function abrirChatDirecto(uidComprador, uidVendedor, idProducto) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/chat/obtener-conversacion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id_comprador: uidComprador, 
                id_vendedor: uidVendedor, 
                id_producto: idProducto 
            })
        });

        if (!res.ok) {
            const error = await res.json();
            console.error("Error del servidor:", error);
            return alert("No se pudo iniciar el chat: " + (error.error || "Error desconocido"));
        }

        const conv = await res.json();
        
        // Solo si tenemos un ID válido, iniciamos la mensajería
        if (conv && conv.id_conversacion) {
            iniciarMensajeria(conv.id_conversacion);
        } else {
            console.error("El servidor no devolvió un ID de conversación válido");
        }
    } catch (err) {
        console.error("Error en la petición:", err);
    }
}

// En scriptChat.js

// Conexión inicial al socket (ya tienes la librería en tu HTML)


async function iniciarMensajeria(idConv) {
    currentConvId = idConv;
    socket.emit('join_room', idConv); // Unirse a la sala privada

    // 1. Limpiar contenedor y preparar interfaz de chat
    chatContent.innerHTML = `
        <div id="header-chat" style="display: flex; align-items: center; padding: 5px; border-bottom: 1px solid #ddd;">
            <button id="btnVolverChat" style="display:none; margin-right: 10px; background: none; border: none; cursor: pointer;">⬅️</button>
            <span id="chat-con-quien" style="font-weight: bold; font-size: 0.9em;">Chat</span>
        </div>
        <div id="mensajes-lista" style="height: 300px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
            </div>
    `;

    // 2. Mostrar botón volver solo si el usuario es el vendedor
    const idVendedor = document.getElementById('detalleNombreVendedor').getAttribute('data-uid-vendedor');
    if (firebase.auth().currentUser.uid === idVendedor) {
        const btnVolver = document.getElementById('btnVolverChat');
        btnVolver.style.display = 'block';
        btnVolver.onclick = () => {
            const idProducto = new URLSearchParams(window.location.search).get('id');
            cargarListaInteresados(idProducto);
        };
    }

    // 3. Cargar mensajes antiguos desde la DB
    cargarHistorial(idConv);
}

// ... (tu código anterior de scriptChat.js se mantiene igual hasta iniciarMensajeria)

async function cargarHistorial(idConv) {
    const lista = document.getElementById('mensajes-lista');
    lista.innerHTML = "<p style='text-align:center; font-size:0.8em;'>Cargando historial...</p>";

    try {
        const res = await fetch(`${API_BASE_URL}/api/chat/mensajes/${idConv}`);
        const mensajes = await res.json();
        
        lista.innerHTML = ""; // Limpiar el "cargando"
        mensajes.forEach(msg => pintarMensaje(msg));
        lista.scrollTop = lista.scrollHeight; // Bajar el scroll al final
    } catch (error) {
        console.error("Error al cargar historial:", error);
    }
}

// Función para pintar las burbujas de texto
function pintarMensaje(msg) {
    const lista = document.getElementById('mensajes-lista');
    if (!lista) return;

    const soyYo = msg.id_remitente === firebase.auth().currentUser.uid;
    const burbuja = document.createElement('div');
    
    burbuja.style = `
        max-width: 85%;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 0.9em;
        margin-bottom: 4px;
        word-wrap: break-word;
        align-self: ${soyYo ? 'flex-end' : 'flex-start'};
        background: ${soyYo ? '#3498db' : '#ecf0f1'};
        color: ${soyYo ? 'white' : '#2c3e50'};
    `;
    burbuja.textContent = msg.contenido;
    lista.appendChild(burbuja);
    lista.scrollTop = lista.scrollHeight;
}

// Lógica para enviar mensajes
document.getElementById('btnEnviarMensaje').addEventListener('click', enviarMensaje);

// También enviar con la tecla "Enter"
document.getElementById('inputMensaje').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensaje();
    }
});

function enviarMensaje() {
    const input = document.getElementById('inputMensaje');
    const contenido = input.value.trim();
    const user = firebase.auth().currentUser;

    if (contenido && currentConvId && user) {
        const data = {
            id_conversacion: currentConvId,
            id_remitente: user.uid,
            contenido: contenido
        };
        
        // Enviamos por Socket.io
        socket.emit('send_message', data);
        input.value = ""; // Limpiar caja
    }
}

// Escuchar mensajes en tiempo real
socket.on('receive_message', (msg) => {
    if (msg.id_conversacion === currentConvId) {
        pintarMensaje(msg);
    }
});