// 1. Manejo del clic en "Comprar Ahora"
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'botonComprar') {
        const usuarioLogueado = firebase.auth().currentUser;

        // 1. Verificación de sesión
        if (!usuarioLogueado) {
            alert("Inicia sesión para comprar.");
            return;
        }

        // 2. Validación: No comprarse a sí mismo
        // Extraemos el ID del vendedor que ya cargamos en el panel
        const idVendedor = document.getElementById('detalleNombreVendedor').textContent.trim();

        if (usuarioLogueado.uid === idVendedor) {
            alert("⚠️ No puedes comprar tu propio producto.");
            return;
        }

        abrirModalPedido();
    }
});

let precioGlobal = 0;
let stockMaximoGlobal = 0;

function abrirModalPedido() {
    const modal = document.getElementById('modalCompra');

    // Extraer datos de la interfaz cargada de la DB
    const nombre = document.getElementById('nombreProducto').textContent;
    const precioTxt = document.getElementById('precioProducto').textContent;
    const stockTxt = document.getElementById('detalleDisponibilidad').textContent;
    const puntoEncuentro = document.getElementById('detalleUbicacionEntrega').textContent;


    // Guardar en variables globales para el selector
    precioGlobal = parseFloat(precioTxt.replace(/[^0-9.-]+/g, ""));
    stockMaximoGlobal = parseInt(stockTxt.replace(/[^0-9]+/g, "")) || 0;

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    vincularControles();

    if (stockMaximoGlobal <= 0) {
        alert("Este producto no tiene existencias.");
        return;
    }

    // Llenar modal (SIN FECHAS, solo lo que el comprador necesita)
    document.getElementById('modalNombreProducto').textContent = nombre;
    document.getElementById('modalStockDisponible').textContent = `Disponibles: ${stockMaximoGlobal}`;
    document.getElementById('modalLugarReferencia').textContent = puntoEncuentro;
    document.getElementById('cantidadCompra').value = 1;

    actualizarTotalModal();
    modal.style.display = 'block';

    // Reinicializar los controles cada vez que se abre el modal
    vincularControles();
}

function vincularControles() {
    const btnSumar = document.getElementById('btnSumar');
    const btnRestar = document.getElementById('btnRestar');
    const input = document.getElementById('cantidadCompra');

    // Desvincular eventos previos para evitar duplicados
    btnSumar.onclick = null;
    btnRestar.onclick = null;

    btnSumar.onclick = () => {
        let actual = parseInt(input.value);
        if (actual < stockMaximoGlobal) {
            input.value = actual + 1;
            actualizarTotalModal();
        }
    };

    btnRestar.onclick = () => {
        let actual = parseInt(input.value);
        if (actual > 1) {
            input.value = actual - 1;
            actualizarTotalModal();
        }
    };
}

function actualizarTotalModal() {
    const cant = parseInt(document.getElementById('cantidadCompra').value);
    document.getElementById('modalTotalPagar').textContent = `$${(precioGlobal * cant).toFixed(2)} MXN`;
}

// --- LÓGICA DE CIERRE DE MODAL ---
// Usamos delegación de eventos para el botón cancelar para que no falle
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modalCompra');
    // Si el clic es en el botón cancelar o fuera del contenido del modal
    if (e.target.id === 'btnCancelarCompra' || e.target === modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
});

// 2. Confirmar Pedido
document.getElementById('btnConfirmarPedido').onclick = async () => {
    // 1. Obtener el usuario actual de Firebase
    const user = firebase.auth().currentUser;

    // Validación de seguridad: Si no hay usuario, no continuar
    if (!user) {
        alert("Debes iniciar sesión para realizar un pedido.");
        return;
    }

    // 2. Obtener el ID del producto desde la URL
    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');

    // 3. Construir el objeto de la petición con los datos del modal
    const peticion = {
        id_comprador: user.uid, // Ahora user está bien definido
        id_producto: idProducto,
        cantidad: parseInt(document.getElementById('cantidadCompra').value) || 1,
        // Limpiamos el texto del total para obtener solo el número
        total: parseFloat(document.getElementById('modalTotalPagar').textContent.replace(/[^0-9.-]+/g, "")),
        metodo_pago: document.getElementById('modalMetodoPago').value,
        lugar_entrega: document.getElementById('modalLugarReferencia').textContent,
        estado_pedido: 'pendiente'
    };

    try {
        const res = await fetch('https://teschi-bazar-web.onrender.com/api/pedidos/crear-peticion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(peticion)
        });

        // 5. Manejo de la respuesta 
        if (res.ok) {
            const data = await res.json();
            console.log("Pedido creado con ID:", data.id_pedido); // Confirmación en consola

            alert("Petición enviada. Espera a que el vendedor confirme la fecha.");

            // Función para cerrar el modal (asegúrate de que exista en tu script)
            if (typeof cerrarModal === 'function') {
                cerrarModal();
            } else {
                document.getElementById('modalCompra').style.display = 'none';
            }

        } else {
            const err = await res.json();
            alert("Error del servidor: " + err.error);
        }
    } catch (error) {
        console.error("Error al enviar petición:", error);
        alert("No se pudo conectar con el servidor. Verifica que esté corriendo en el puerto 3000.");
    }
};
// Dentro de la lógica de Confirmar Pedido en scriptCompra.js
const pedido = {
    id_comprador: user.uid,
    id_producto: idProducto,
    cantidad: parseInt(document.getElementById('cantidadCompra').value),
    total: parseFloat(document.getElementById('modalTotalPagar').textContent.replace(/[^0-9.-]+/g, "")),
    metodo_pago: document.getElementById('modalMetodoPago').value, // Nuevo
    lugar_entrega: document.getElementById('modalLugarEntrega').value // Nuevo
};