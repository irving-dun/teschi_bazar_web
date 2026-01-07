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
            // Buscamos el nombre en Firebase como ya lo hacíamos
            let nombreReal = "Cargando...";
            try {
                const userDoc = await firebase.firestore().collection('usuarios').doc(p.id_comprador).get();
                nombreReal = userDoc.exists ? userDoc.data().nombre : "Usuario Desconocido";
            } catch (e) { nombreReal = "Error de nombre"; }

            const div = document.createElement('div');
            div.className = 'tarjeta-pedido';

            if (p.estado_pedido === 'pendiente') {
                // DISEÑO PARA PENDIENTES
                div.innerHTML = `
                    <div class="info-principal">
                        <h4>Pedido #${p.id_pedido}</h4>
                        <p>Comprador: <strong>${nombreReal}</strong></p>
                        <p>Monto: <strong>$${p.total_pedido}</strong></p>
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
            <p>Entregar a: <strong>${nombreReal}</strong></p>
            <p>📍 Punto: <strong>${p.lugar_entrega}</strong></p>
            <p>⏰ Fecha: <strong>${p.fecha_entrega.split('T')[0]}</strong> a las <strong>${p.hora_entrega}</strong></p>
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
        console.error("Error:", error);
    }
}


async function finalizarPedido(idPedido) {
    if (!confirm("¿Confirmas que ya entregaste el producto y recibiste el pago?")) return;

    try {
        const res = await fetch(`http://localhost:3000/api/pedidos/finalizar/${idPedido}`, {
            method: 'PUT'
        });

        if (res.ok) {
            alert("✅ ¡Venta completada! El pedido se moverá a tu historial.");
            location.reload(); // Refresca para actualizar las listas
        } else {
            alert("Error al finalizar el pedido.");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("No se pudo conectar con el servidor.");
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