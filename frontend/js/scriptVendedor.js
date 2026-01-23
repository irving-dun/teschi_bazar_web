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

        // Usamos for...of para poder usar await y consultar Firebase secuencialmente
        for (const p of pedidos) {
            const fecha = p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString() : '1/22/2026';
            
            // --- LÓGICA PARA EXTRAER NOMBRE DESDE FIREBASE ---
            let nombreCompradorReal = "Cargando..."; 
            
            if (p.id_comprador) {
                try {
                    // Consultamos el documento en Firestore usando el UID de la tabla de PostgreSQL
                    const userDoc = await firebase.firestore()
                        .collection('usuarios')
                        .doc(p.id_comprador.trim())
                        .get();

                    if (userDoc.exists) {
                        nombreCompradorReal = userDoc.data().nombre || "Usuario sin nombre";
                    } else {
                        nombreCompradorReal = "ID no encontrado";
                    }
                } catch (errorFB) {
                    console.error("Error consultando Firestore:", errorFB);
                    nombreCompradorReal = "Error de conexión";
                }
            }
            // -----------------------------------------------

            const tarjeta = document.createElement('div');
            
            // Mantenemos tus estilos originales exactamente como los tenías
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
                    <p style="margin: 5px 0;"><strong>👤 Cliente:</strong><br> <span class="nombre-cliente">${nombreCompradorReal}</span></p>
                    <p style="margin: 5px 0;"><strong>📦 Producto:</strong><br> ${p.nombre_producto}</p>
                    <p style="margin: 5px 0;"><strong>🔢 Cantidad:</strong><br> ${p.cantidad} unidad(es)</p>
                    <p style="margin: 5px 0;"><strong>💰 Total:</strong><br> $${p.total_pedido}</p>
                </div>

                <div style="background: #f9f9f9; padding: 10px; border-radius: 6px; margin-top: 10px;">
                    <p style="margin: 0; font-size: 0.9em;"><strong>📍 Entrega:</strong> ${p.lugar_entrega}</p>
                </div>

                <div style="margin-top: 15px;">
                    ${p.estado_pedido === 'pendiente'
                    ? `<button onclick="abrirModalAgendar(${p.id_pedido}, '${nombreCompradorReal}')" 
                               style="width: 100%; padding: 10px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                               📅 Agendar Cita
                       </button>`
                    : `<div style="text-align: center; color: #10ac84; font-weight: bold; padding: 10px; border: 1px solid #10ac84; border-radius: 5px;">
                           ✅ Cita Confirmada
                       </div>`
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
        console.error("Error al cargar pedidos:", error);
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
        const res = await fetch(`https://teschi-bazar-web.onrender.com/api/pedidos/confirmar-cita`, {
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