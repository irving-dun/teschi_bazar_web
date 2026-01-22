// --- CONFIGURACIÓN GLOBAL ---

const API_URL = "https://teschi-bazar-web.onrender.com";

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
        const response = await fetch(`${API_URL}/api/vendedor/pedidos/todos/${idVendedor}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }

        const pedidos = await response.json();
        
        // Limpiar contenedores
        contenedorPendientes.innerHTML = "";
        contenedorConfirmados.innerHTML = "";

        if (pedidos.length === 0) {
            contenedorPendientes.innerHTML = "<p style='color: gray; padding: 20px;'>No tienes pedidos aún.</p>";
            return;
        }

        pedidos.forEach(p => {
            // Formatear la fecha que viene de la base de datos
            const fechaFormateada = p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString() : 'Fecha pendiente';
            
            const tarjeta = document.createElement('div');
            // Estilo moderno de tarjeta
            tarjeta.style = `
                background: white;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 15px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                border-left: 6px solid ${p.estado_pedido === 'pendiente' ? '#FFA500' : '#2ecc71'};
                display: flex;
                flex-direction: column;
                gap: 8px;
            `;

            tarjeta.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <span style="font-weight: bold; color: #333; font-size: 1.1em;">Pedido #${p.id_pedido}</span>
                    <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 5px; font-size: 0.85em; color: #666;">${fechaFormateada}</span>
                </div>
                <div style="color: #555;">
                    <p style="margin: 5px 0;"><strong>📦 Producto:</strong> ${p.nombre_producto}</p>
                    <p style="margin: 5px 0;"><strong>💰 Total:</strong> $${p.total_pedido}</p>
                    <p style="margin: 5px 0;"><strong>📍 Lugar:</strong> ${p.lugar_entrega || 'No especificado'}</p>
                    <p style="margin: 5px 0;"><strong>💳 Pago:</strong> ${p.metodo_pago}</p>
                </div>
                <div style="margin-top: 10px; display: flex; gap: 10px;">
                    ${p.estado_pedido === 'pendiente' 
                        ? `<button onclick="agendarPedido(${p.id_pedido})" style="flex: 1; background: #3498db; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">🗓️ Agendar Cita</button>`
                        : `<button onclick="marcarEntregado(${p.id_pedido})" style="flex: 1; background: #2ecc71; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">✅ Finalizar</button>`
                    }
                </div>
            `;

            if (p.estado_pedido === 'pendiente') {
                contenedorPendientes.appendChild(tarjeta);
            } else {
                contenedorConfirmados.appendChild(tarjeta);
            }
        });

    } catch (error) {
        console.error("❌ Error al cargar pedidos:", error);
        alert("Error de conexión con el servidor. Por favor, intenta más tarde.");
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