// --- CONFIGURACIÓN GLOBAL ---
const API_URL = API_BASE_URL;

// ------------ 1. OBSERVADOR DE SESIÓN (FIREBASE) ------------
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log("Usuario autenticado:", user.uid);
        obtenerPedidosDelVendedor(user.uid);
    } else {
        window.location.href = "login.html";
    }
});

// ------------ 2. CARGAR PEDIDOS DESDE EL SERVIDOR ------------
async function obtenerPedidosDelVendedor(idVendedor) {
    const contenedorPendientes = document.getElementById('lista-pedidos-pendientes');
    const contenedorConfirmados = document.getElementById('lista-pedidos-confirmados');

    try {
        // CORRECCIÓN: Se añade /api/ a la ruta para coincidir con el servidor
        const response = await fetch(`${API_URL}/api/vendedor/pedidos/todos/${idVendedor}`);

        // Validación de respuesta para evitar el error de SyntaxError: Unexpected token '<'
        if (!response.ok) {
            console.error(`Error en la petición: ${response.status}`);
            return;
        }

        const pedidos = await response.json();

        contenedorPendientes.innerHTML = "";
        contenedorConfirmados.innerHTML = "";

        for (const p of pedidos) {
            let nombreReal = "Cargando...";
            try {
                // Mantenemos tu lógica de Firebase Firestore intacta
                const userDoc = await firebase.firestore().collection('usuarios').doc(p.id_comprador).get();
                nombreReal = userDoc.exists ? userDoc.data().nombre : "Usuario Desconocido";
            } catch (e) {
                nombreReal = "Error de conexión";
            }

            const div = document.createElement('div');
            div.className = 'tarjeta-pedido';

            if (p.estado_pedido === 'pendiente') {
                div.innerHTML = `
                    <div class="info-principal">
                        <h4>Pedido #${p.id_pedido}</h4>
                        <p><strong>🛍️ Producto:</strong> ${p.nombre_producto}</p>
                        <p><strong>🔢 Unidades:</strong> ${p.cantidad}</p>
                        <p><strong>👤 Comprador:</strong> ${nombreReal}</p>
                        <p><strong>💰 Monto Total:</strong> $${p.total_pedido}</p>
                    </div>
                    <div class="acciones">
                        <button class="btn-agendar-cita" onclick="abrirModalAgendar(${p.id_pedido}, '${nombreReal}')">
                            📅 Agendar Entrega
                        </button>
                    </div>
                `;
                contenedorPendientes.appendChild(div);
            } else if (p.estado_pedido === 'confirmado') {
                div.style.borderLeft = "6px solid #2196F3";

                // CORRECCIÓN: Movido dentro del bucle y usando 'fecha_pedido' que es el nombre real en tu DB
                const fechaLimpia = p.fecha_pedido ? p.fecha_pedido.split('T')[0] : "Pendiente";

                div.innerHTML = `
                    <div class="info-principal">
                        <h4>Pedido #${p.id_pedido} ✅</h4>
                        <p><strong>📦 Entrega:</strong> ${p.nombre_producto} (${p.cantidad} pzs)</p>
                        <p><strong>👤 Cliente:</strong> ${nombreReal}</p>
                        <p><strong>📍 Punto:</strong> ${p.lugar_entrega}</p>
                        <p><strong>⏰ Fecha:</strong> ${fechaLimpia} a las ${p.hora_entrega}</p>
                        <p><strong>💵 Monto Total:</strong> $${p.total_pedido}</p>
                    </div>
                    <div class="acciones">
                        <button class="btn-finalizar" onclick="finalizarPedido(${p.id_pedido})" 
                            style="background-color: #0fb515; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;">
                            📦 Marcar como Entregado
                        </button>
                    </div>
                `;
                contenedorConfirmados.appendChild(div);
            }
        }
    } catch (error) {
        console.error("Error al cargar pedidos:", error);
    }
}

async function finalizarPedido(idPedido) {
    try {
        const response = await fetch(`${API_URL}/pedidos/finalizar/${idPedido}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        if (data.success) {
            alert("Venta finalizada y stock actualizado");
            location.reload();
        }
    } catch (error) {
        console.error("Error al conectar con el servidor:", error);
    }
}

// ------------ 3. LÓGICA DEL MODAL ------------
function abrirModalAgendar(idPedido, nombreComprador) {
    const modal = document.getElementById('modal-agendar');
    const infoTxt = document.getElementById('info-pedido-txt');

    if (!modal) return console.error("Error: No se encontró el modal.");

    modal.dataset.idPedido = idPedido;
    infoTxt.innerText = `Define la cita de entrega para: ${nombreComprador}`;
    modal.classList.remove('hidden');
}

function cerrarModal() {
    const modal = document.getElementById('modal-agendar');
    modal.classList.add('hidden');
}

// ------------ 4. ENVIAR PROPUESTA (BOTÓN GUARDAR) ------------
async function enviarPropuesta() {
    const modal = document.getElementById('modal-agendar');
    const idPedido = modal.dataset.idPedido;
    const fecha = document.getElementById('fecha-entrega').value;
    const hora = document.getElementById('hora-entrega').value;
    const lugar = document.getElementById('lugar-entrega').value;

    if (!fecha || !hora || !lugar) {
        alert("Por favor, completa todos los campos de la cita.");
        return;
    }

    const datosCita = { id_pedido: idPedido, fecha, hora, lugar };

    try {
        const res = await fetch(`${API_URL}/pedidos/confirmar-cita`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosCita)
        });

        if (res.ok) {
            alert(`¡Cita agendada para el día ${fecha} a las ${hora} en ${lugar}.`);
            cerrarModal();
            location.reload();
        } else {
            const error = await res.json();
            alert("Error al guardar la cita: " + error.error);
        }
    } catch (error) {
        console.error("Error en la conexión:", error);
        alert("No se pudo conectar con el servidor para guardar la cita.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputFecha = document.getElementById('fecha-entrega');
    if (inputFecha) {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        let mm = String(hoy.getMonth() + 1).padStart(2, '0');
        let dd = String(hoy.getDate()).padStart(2, '0');
        const fechaMinima = `${yyyy}-${mm}-${dd}`;
        inputFecha.setAttribute('min', fechaMinima);
    }
});