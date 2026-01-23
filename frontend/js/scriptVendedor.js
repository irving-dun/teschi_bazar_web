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
        const pedidos = await response.json();

        contenedorPendientes.innerHTML = "";
        contenedorConfirmados.innerHTML = "";

        // USAMOS FOR...OF para que el código ESPERE a Firebase en cada pedido
        for (const p of pedidos) {
            const fecha = p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString() : 'Pendiente';
            
            let nombreReal = "Cargando..."; // Estado inicial

            // --- LÓGICA DE FIREBASE ---
            if (p.id_comprador) {
                try {
                    const uidLimpio = p.id_comprador.trim();
                    // Buscamos directamente por ID de documento
                    const userDoc = await firebase.firestore().collection('usuarios').doc(uidLimpio).get();
                    
                    if (userDoc.exists) {
                        nombreReal = userDoc.data().nombre;
                    } else {
                        // Si no existe en Firebase, usamos el nombre de SQL o "Usuario"
                        nombreReal = p.nombre_comprador || "Usuario";
                        console.warn(`ID no encontrado en Firebase: ${uidLimpio}`);
                    }
                } catch (errorFB) {
                    console.error("Error consultando Firestore:", errorFB);
                    nombreReal = p.nombre_comprador || "Error Cliente";
                }
            }

            const tarjeta = document.createElement('div');
            tarjeta.className = "tarjeta-pedido-v3";
            tarjeta.style = `
                background: white;
                border-radius: 10px;
                padding: 18px;
                margin-bottom: 15px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                border-left: 6px solid ${p.estado_pedido === 'pendiente' ? '#ff9f43' : '#10ac84'};
            `;

            tarjeta.innerHTML = `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 10px;">
                    <span style="font-weight: bold; color: #2c3e50;">🆔 Pedido #${p.id_pedido}</span>
                    <span style="color: #7f8c8d; font-size: 0.9em;">📅 ${fecha}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.95em;">
                    <p><strong>👤 Cliente:</strong><br> <span class="nombre-cliente">${nombreReal}</span></p>
                    <p><strong>📦 Producto:</strong><br> ${p.nombre_producto}</p>
                    <p><strong>🔢 Cantidad:</strong><br> ${p.cantidad} unidad(es)</p>
                    <p><strong>💰 Total:</strong><br> $${p.total_pedido}</p>
                </div>

                <div style="background: #f9f9f9; padding: 10px; border-radius: 6px; margin-top: 10px;">
                    <p style="margin: 0;"><strong>📍 Entrega:</strong> ${p.lugar_entrega}</p>
                    ${p.notas_comprador ? `<p style="margin: 5px 0 0 0; font-size: 0.85em; color: #666;">📝 ${p.notas_comprador}</p>` : ''}
                </div>

                <div style="margin-top: 15px;">
                    ${p.estado_pedido === 'pendiente'
                    ? `<button onclick="abrirModalAgendar(${p.id_pedido}, '${nombreReal}')" style="width: 100%; background: #3498db; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: bold;">📅 Agendar Cita</button>`
                    : `<button onclick="finalizarPedido(${p.id_pedido})" style="width: 100%; background: #27ae60; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: bold;">✅ Entregado</button>`
                    }
                </div>
            `;

            if (p.estado_pedido === 'pendiente') {
                contenedorPendientes.appendChild(tarjeta);
            } else {
                contenedorConfirmados.appendChild(tarjeta);
            }
        }
    } catch (error) {
        console.error("Error general:", error);
    }
}



// ---------------------------------------


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