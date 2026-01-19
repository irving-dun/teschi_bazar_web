// ------------ 1. OBSERVADOR DE SESIÓN (FIREBASE) ------------
// Detecta quién es el usuario logueado y carga sus ventas
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log("Usuario autenticado:", user.uid);
        obtenerPedidosDelVendedor(user.uid);
    } else {
        // Si no hay sesión, redirigir al login
        window.location.href = "login.html";
    }
});

// ------------ 2. CARGAR PEDIDOS DESDE EL SERVIDOR ------------
async function obtenerPedidosDelVendedor(idVendedor) {
    const contenedorPendientes = document.getElementById('lista-pedidos-pendientes');
    const contenedorConfirmados = document.getElementById('lista-pedidos-confirmados');

    try {
        const response = await fetch(`http://localhost:3000/api/vendedor/pedidos/todos/${idVendedor}`);
        const pedidos = await response.json();

        contenedorPendientes.innerHTML = "";
        contenedorConfirmados.innerHTML = "";

        for (const p of pedidos) {
            // Intentamos obtener el nombre real de Firebase
            let nombreReal = "Cargando...";
            try {
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
                div.innerHTML = `
                    <div class="info-principal">
                        <h4>Pedido #${p.id_pedido} ✅</h4>
                        <p><strong>📦 Entrega:</strong> ${p.nombre_producto} (${p.cantidad} pzs)</p>
                        <p><strong>👤 Cliente:</strong> ${nombreReal}</p>
                        <p><strong>📍 Punto:</strong> ${p.lugar_entrega}</p>
                        <p><strong>⏰ Fecha:</strong> ${p.fecha_entrega.split('T')[0]} a las ${p.hora_entrega}</p>
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
        const response = await fetch(`http://localhost:3000/api/pedidos/finalizar/${idPedido}`, {
            method: 'PUT', // ¡Debe ser PUT!
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        if (data.success) {
            alert("Venta finalizada y stock actualizado");
            location.reload(); // Para ver los cambios
        }
    } catch (error) {
        console.error("Error al conectar con el servidor:", error);
    }
}
// ------------ 3. LÓGICA DEL MODAL (VENTANA EMERGENTE) ------------

// Abre el modal y guarda el ID del pedido para saber a cuál ponerle fecha
function abrirModalAgendar(idPedido, nombreComprador) {
    const modal = document.getElementById('modal-agendar');
    const infoTxt = document.getElementById('info-pedido-txt');

    if (!modal) return console.error("Error: No se encontró el modal con ID 'modal-agendar' en el HTML.");

    // Guardar el ID en el dataset del modal para recuperarlo después
    modal.dataset.idPedido = idPedido;
    infoTxt.innerText = `Define la cita de entrega para: ${nombreComprador}`;

    modal.classList.remove('hidden');
}

// Cierra el modal sin guardar cambios
function cerrarModal() {
    const modal = document.getElementById('modal-agendar');
    modal.classList.add('hidden');
}

// ------------ 4. ENVIAR PROPUESTA AL SERVIDOR (BOTÓN GUARDAR) ------------
async function enviarPropuesta() {
    const modal = document.getElementById('modal-agendar');
    const idPedido = modal.dataset.idPedido;

    const fecha = document.getElementById('fecha-entrega').value;
    const hora = document.getElementById('hora-entrega').value;
    const lugar = document.getElementById('lugar-entrega').value;

    // Validación extra por seguridad
    if (!fecha || !hora || !lugar) {
        alert("Por favor, completa todos los campos de la cita.");
        return;
    }

    const datosCita = {
        id_pedido: idPedido,
        fecha: fecha,
        hora: hora,
        lugar: lugar
    };

    try {
        const res = await fetch('http://localhost:3000/api/pedidos/confirmar-cita', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosCita)
        });

        if (res.ok) {
            alert(`¡Cita agendada! Se ha enviado la propuesta para el día ${fecha} a las ${hora} en ${lugar}.`);
            cerrarModal();
            // Recargamos la lista para que el pedido "pendiente" desaparezca 
            // ya que ahora su estado será 'confirmado'
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

// Ejecutar cuando cargue la página para configurar el mínimo del calendario
document.addEventListener('DOMContentLoaded', () => {
    const inputFecha = document.getElementById('fecha-entrega');
    if (inputFecha) {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        let mm = hoy.getMonth() + 1; // Enero es 0
        let dd = hoy.getDate();

        // Formatear a dos dígitos (06 en lugar de 6)
        if (dd < 10) dd = '0' + dd;
        if (mm < 10) mm = '0' + mm;

        const fechaMinima = `${yyyy}-${mm}-${dd}`;
        inputFecha.setAttribute('min', fechaMinima);
        console.log("Fecha mínima establecida:", fechaMinima);
    }
});