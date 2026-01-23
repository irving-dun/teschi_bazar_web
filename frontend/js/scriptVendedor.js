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

        for (const p of pedidos) {
            // --- NUEVO: RECUPERAR NOMBRE REAL DESDE FIREBASE ---
            let nombreCompradorReal = "Usuario"; 
            if (p.id_comprador) {
                try {
                    // Consultamos Firestore usando el ID del comprador que viene de la DB
                    const userDoc = await firebase.firestore().collection('usuarios').doc(p.id_comprador.trim()).get();
                    if (userDoc.exists) {
                        nombreCompradorReal = userDoc.data().nombre || "Sin nombre";
                    }
                } catch (errorFB) {
                    console.error("Error al obtener nombre de Firebase:", errorFB);
                }
            }

            // Formatear la fecha para que se vea limpia
            const fechaTxt = p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString() : 'Pendiente';

            const tarjeta = document.createElement('div');
            tarjeta.className = "tarjeta-pedido-v3";
            tarjeta.style = `
                background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                border-left: 6px solid ${p.estado_pedido === 'pendiente' ? '#ff9f43' : '#27ae60'};
            `;

            // LÓGICA DE BOTÓN DINÁMICO
            let botonAccion = "";
            if (p.estado_pedido === 'pendiente') {
                botonAccion = `<button onclick="abrirModalAgendar(${p.id_pedido}, '${nombreCompradorReal}')" 
                               style="width: 100%; padding: 12px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                               📅 Agendar Cita
                               </button>`;
            } else if (p.estado_pedido === 'agendado') {
                botonAccion = `<button onclick="confirmarEntregaFinal(${p.id_pedido})" 
                               style="width: 100%; padding: 12px; background: #27ae60; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                               💰 Confirmar entrega
                               </button>`;
            }

            // DISEÑO RECUPERADO (Incluye cantidad, cliente y fecha arriba)
            tarjeta.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 15px;">
                    <span style="font-weight: 800; color: #2c3e50; font-size: 1.1em;">🆔 Pedido #${p.id_pedido}</span>
                    <span style="color: #7f8c8d; font-size: 0.9em; font-weight: 500;">📅 ${fechaTxt}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.95em; color: #34495e;">
                    <p style="margin: 0;"><strong>👤 Cliente:</strong><br> ${nombreCompradorReal}</p>
                    <p style="margin: 0;"><strong>📦 Producto:</strong><br> ${p.nombre_producto}</p>
                    <p style="margin: 0;"><strong>🔢 Cantidad:</strong><br> ${p.cantidad || 1} unidad(es)</p>
                    <p style="margin: 0;"><strong>💰 Total:</strong><br> <span style="font-weight: 800; color: #2c3e50;">$${p.total_pedido}</span></p>
                </div>

                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-top: 15px; border: 1px dashed #dee2e6;">
                    <p style="margin: 0; font-size: 0.9em; color: #636e72;">
                        <i class="fas fa-map-marker-alt" style="color: #e74c3c;"></i> <strong>Entrega:</strong> ${p.lugar_entrega || 'No especificada'}
                    </p>
                </div>

                <div style="margin-top: 15px;">
                    ${botonAccion}
                </div>
            `;

            // Clasificación por contenedores según el estado
            if (p.estado_pedido === 'pendiente') {
                contenedorPendientes.appendChild(tarjeta);
            } else if (p.estado_pedido === 'agendado') {
                contenedorConfirmados.appendChild(tarjeta);
            }
        }
    } catch (error) { 
        console.error("Error al cargar pedidos:", error); 
    }
}

// --- FUNCIÓN PARA CONFIRMAR DINERO Y ENTREGA (Botón Verde) ---
async function confirmarEntregaFinal(idPedido) {
    const respuesta = confirm("¿Confirmas que recibiste el dinero y entregaste el producto?");
    
    if (respuesta) {
        try {
            const res = await fetch(`${API_URL}/api/pedidos/finalizar/${idPedido}`, {
                method: 'PUT'
            });

            if (res.ok) {
                alert("✅ ¡Venta finalizada con éxito! El dinero ha sido confirmado.");
                location.reload(); 
            } else {
                alert("Error al procesar la entrega en el servidor.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("No se pudo conectar con el servidor.");
        }
    }
}

// ------------ 3. LÓGICA DEL MODAL ------------
function abrirModalAgendar(idPedido, nombreComprador) {
    const modal = document.getElementById('modal-agendar');
    const infoTxt = document.getElementById('info-pedido-txt');
    if (!modal) return;

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
    const idPedido = parseInt(modal.dataset.idPedido); 
    const fecha = document.getElementById('fecha-entrega').value;
    const hora = document.getElementById('hora-entrega').value;
    const lugar = document.getElementById('lugar-entrega').value;

    if (!idPedido || !fecha || !hora || !lugar) {
        alert("Por favor, completa todos los campos de la cita.");
        return;
    }

    const datosCita = { id_pedido: idPedido, fecha, hora, lugar };

    try {
        const res = await fetch(`${API_URL}/api/pedidos/confirmar-cita`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosCita)
        });
        
        if (res.ok) {
            alert(`¡Cita agendada con éxito!`);
            cerrarModal();
            location.reload();
        } else {
            const error = await res.json();
            alert("Error: " + error.error);
        }
    } catch (error) {
        alert("No se pudo conectar con el servidor.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputFecha = document.getElementById('fecha-entrega');
    if (inputFecha) {
        const hoy = new Date();
        const fechaMinima = hoy.toISOString().split('T')[0];
        inputFecha.setAttribute('min', fechaMinima);
    }
});