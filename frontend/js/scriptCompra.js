// 1. Manejo del clic en "Comprar Ahora"
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'botonComprar') {
        const usuarioLogueado = firebase.auth().currentUser;

        if (!usuarioLogueado) {
            alert("Inicia sesión para comprar.");
            return;
        }

        // CAMBIO IMPORTANTE: Ahora obtenemos el ID real (UID) del vendedor, no su nombre
        const idVendedor = document.getElementById('detalleNombreVendedor').getAttribute('data-vendedor-id');

        // Validación: No comprarse a sí mismo
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

    const nombre = document.getElementById('nombreProducto').textContent;
    const precioTxt = document.getElementById('precioProducto').textContent;
    const stockTxt = document.getElementById('detalleDisponibilidad').textContent;
    const puntoEncuentro = document.getElementById('detalleUbicacionEntrega').textContent;

    precioGlobal = parseFloat(precioTxt.replace(/[^0-9.-]+/g, ""));
    stockMaximoGlobal = parseInt(stockTxt.replace(/[^0-9]+/g, "")) || 0;

    if (stockMaximoGlobal <= 0) {
        alert("Este producto no tiene existencias.");
        return;
    }

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    document.getElementById('modalNombreProducto').textContent = nombre;
    document.getElementById('modalStockDisponible').textContent = `Disponibles: ${stockMaximoGlobal}`;
    document.getElementById('modalLugarReferencia').textContent = puntoEncuentro;
    document.getElementById('cantidadCompra').value = 1;

    actualizarTotalModal();
    vincularControles();
}

function vincularControles() {
    const btnSumar = document.getElementById('btnSumar');
    const btnRestar = document.getElementById('btnRestar');
    const input = document.getElementById('cantidadCompra');

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

document.addEventListener('click', (e) => {
    const modal = document.getElementById('modalCompra');
    if (e.target.id === 'btnCancelarCompra' || e.target === modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
});

// 2. Confirmar Pedido
document.getElementById('btnConfirmarPedido').onclick = async () => {
    const user = firebase.auth().currentUser;

    if (!user) {
        alert("Debes iniciar sesión para realizar un pedido.");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');



    const peticion = {
        id_comprador: user.uid,
        nombre_comprador: user.displayName || "Usuario", // Enviamos el nombre desde Firebase
        id_producto: idProducto,
        cantidad: parseInt(document.getElementById('cantidadCompra').value) || 1,
        total: parseFloat(document.getElementById('modalTotalPagar').textContent.replace(/[^0-9.-]+/g, "")),
        metodo_pago: document.getElementById('modalMetodoPago').value,
        lugar_entrega: document.getElementById('modalLugarReferencia').textContent,
        estado_pedido: 'pendiente'
    };

    try {
        // CAMBIO: Usamos API_BASE_URL para que las laptops envíen la compra a Render
        const res = await fetch(`${API_BASE_URL}/api/pedidos/crear-peticion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(peticion)
        });

        if (res.ok) {
            const data = await res.json();
            alert("Petición enviada. Espera a que el vendedor confirme la fecha.");
            document.getElementById('modalCompra').style.display = 'none';
            document.body.classList.remove('modal-open');
        } else {
            const err = await res.json();
            alert("Error del servidor: " + err.error);
        }
    } catch (error) {
        console.error("Error al enviar petición:", error);
        alert("No se pudo conectar con el servidor en Render.");
    }
};