// scriptCompra.js

// 1. Manejo del clic en "Comprar Ahora"
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'botonComprar') {
        const usuario = firebase.auth().currentUser;

        if (!usuario) {
            alert("Debes iniciar sesión para realizar un pedido.");
            window.location.href = "login.html";
            return;
        }
        abrirModalPedido();
    }
});

function abrirModalPedido() {
    const modal = document.getElementById('modalCompra');
    
    // Extraer datos de la interfaz cargada de PostgreSQL
    const nombre = document.getElementById('nombreProducto').textContent;
    const precioTxt = document.getElementById('precioProducto').textContent;
    const stockTxt = document.getElementById('detalleDisponibilidad').textContent;

    const precioUnitario = parseFloat(precioTxt.replace(/[^0-9.-]+/g, ""));
    const stockMaximo = parseInt(stockTxt.replace(/[^0-9]+/g, "")) || 0;

    if (stockMaximo <= 0) {
        alert("Este producto no tiene existencias disponibles.");
        return;
    }

    // Llenar el modal
    document.getElementById('modalNombreProducto').textContent = nombre;
    document.getElementById('modalStockDisponible').textContent = `Disponibles: ${stockMaximo}`;
    document.getElementById('cantidadCompra').value = 1;
    
    modal.style.display = 'block';
    actualizarTotalModal(precioUnitario);

    // Configurar botones de cantidad
    configurarControles(precioUnitario, stockMaximo);
}

function configurarControles(precio, max) {
    const btnSumar = document.getElementById('btnSumar');
    const btnRestar = document.getElementById('btnRestar');
    const input = document.getElementById('cantidadCompra');

    btnSumar.onclick = () => {
        let actual = parseInt(input.value);
        if (actual < max) {
            input.value = actual + 1;
            actualizarTotalModal(precio);
        }
    };

    btnRestar.onclick = () => {
        let actual = parseInt(input.value);
        if (actual > 1) {
            input.value = actual - 1;
            actualizarTotalModal(precio);
        }
    };
}

function actualizarTotalModal(precio) {
    const cant = parseInt(document.getElementById('cantidadCompra').value);
    document.getElementById('modalTotalPagar').textContent = `$${(precio * cant).toFixed(2)} MXN`;
}

// --- LÓGICA DE CIERRE DE MODAL ---
// Usamos delegación de eventos para el botón cancelar para que no falle
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modalCompra');
    // Si el clic es en el botón cancelar o fuera del contenido del modal
    if (e.target.id === 'btnCancelarCompra' || e.target === modal) {
        modal.style.display = 'none';
    }
});

// 2. Confirmar Pedido
document.getElementById('btnConfirmarPedido').addEventListener('click', async () => {
    const user = firebase.auth().currentUser;
    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');

    const pedido = {
        id_comprador: user.uid,
        id_producto: idProducto,
        cantidad: parseInt(document.getElementById('cantidadCompra').value),
        total: parseFloat(document.getElementById('modalTotalPagar').textContent.replace(/[^0-9.-]+/g, ""))
    };

    try {
        const res = await fetch('/api/pedidos/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedido)
        });

        if (res.ok) {
            alert("¡Pedido realizado con éxito!");
            location.reload(); 
        } else {
            const err = await res.json();
            alert("Error: " + err.error);
        }
    } catch (error) {
        console.error("Error en la transacción:", error);
    }
});