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
        // Añadimos /api/ a la ruta
        const response = await fetch(`${API_URL}/api/vendedor/pedidos/todos/${idVendedor}`);
        
        if (!response.ok) throw new Error("Error en servidor");
        const pedidos = await response.json();

        contenedorPendientes.innerHTML = "";
        contenedorConfirmados.innerHTML = "";

        pedidos.forEach(p => { // 'p' ahora está correctamente definida dentro del bucle
            const div = document.createElement('div');
            div.className = 'tarjeta-pedido';

            // Usamos fecha_pedido que es lo que envía el servidor
            const fechaLimpia = p.fecha_pedido ? p.fecha_pedido.split('T')[0] : "Pendiente";

            if (p.estado_pedido === 'pendiente') {
                div.innerHTML = `
                    <h4>Pedido #${p.id_pedido}</h4>
                    <p>Producto: ${p.nombre_producto}</p>
                    <button onclick="abrirModalAgendar(${p.id_pedido})">📅 Agendar</button>
                `;
                contenedorPendientes.appendChild(div);
            } else if (p.estado_pedido === 'confirmado') {
                div.innerHTML = `
                    <h4>Pedido #${p.id_pedido} ✅</h4>
                    <p>Fecha: ${fechaLimpia} - Hora: ${p.hora_entrega}</p>
                    <button onclick="finalizarPedido(${p.id_pedido})">📦 Entregado</button>
                `;
                contenedorConfirmados.appendChild(div);
            }
        });
    } catch (error) {
        console.error("❌ Error al cargar pedidos:", error);
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