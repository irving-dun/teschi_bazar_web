document.addEventListener('DOMContentLoaded', () => {
    const categoriaId = document.body.getAttribute('data-categoria');
    if (categoriaId) {
        cargarProductos(categoriaId);
    } else {
        cargarProductos(1); 
    }
});

async function cargarProductos(idCat) {
    let contenedor = document.getElementById('contenedor-productos') || document.getElementById('contenedor-ropa');

    if (!contenedor) return;

    try {
        const servidorUrl = "http://127.0.0.1:3000"; 
        const respuesta = await fetch(`${servidorUrl}/api/productos/categoria/${idCat}`);
        
        if (!respuesta.ok) throw new Error(`Error: ${respuesta.status}`);

        const productos = await respuesta.json();
        contenedor.innerHTML = "";

        if (productos.length === 0) {
            contenedor.innerHTML = "<h3>No hay productos en esta categoría todavía.</h3>";
            return;
        }

        productos.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'producto-card';
    
    // Hacemos que toda la tarjeta sea clickeable por seguridad
    card.style.cursor = 'pointer';
    card.onclick = () => {
        window.location.href = `detalleProducto.html?id=${prod.id_producto}`;
    };

    const urlImagenCompleta = prod.url_imagen ? `${servidorUrl}${prod.url_imagen}` : null;

    const imgHtml = urlImagenCompleta 
        ? `<img src="${urlImagenCompleta}" style="width:100%; display:block;" />` 
        : `<div style="background:#eee; height:200px; display:flex; align-items:center; justify-content:center;">Sin Imagen</div>`;

    card.innerHTML = `
        <div class="imagen-contenedor">
            ${imgHtml}
        </div>
        <div class="info-contenedor">
            <h3 class="titulo-producto">${prod.nombre_producto || 'Producto'}</h3>
            <p class="descripcion">${prod.descripcion || 'Sin descripción'}</p>
            <p class="precio">$${parseFloat(prod.precio).toFixed(2)}</p>
        </div>
    `;
    contenedor.appendChild(card);
});

    } catch (error) {
        console.error("Error detallado:", error);
        contenedor.innerHTML = `<p style="color:red;">Error al cargar productos.</p>`;
    }
}