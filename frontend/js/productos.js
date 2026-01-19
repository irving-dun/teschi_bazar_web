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

    // CAMBIADO: URL de tu servidor en Render
    const servidorUrl = "https://teschi-bazar-web.onrender.com"; 

    try {
        // CAMBIADO: Usamos la URL de Render para la petición
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
            
            card.style.cursor = 'pointer';
            card.onclick = () => {
                window.location.href = `detalleProducto.html?id=${prod.id_producto}`;
            };

            let urlImagenFinal = '/frontend/img/placeholder.png'; // Imagen por defecto
            
            if (prod.url_imagen) {
                urlImagenFinal = prod.url_imagen.startsWith('http') 
                    ? prod.url_imagen 
                    : `${servidorUrl}${prod.url_imagen}`;
            }

            card.innerHTML = `
                <div class="imagen-contenedor">
                    <img src="${urlImagenFinal}" style="width:100%; display:block;" onerror="this.src='/frontend/img/placeholder.png'" />
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
        contenedor.innerHTML = `<p style="color:red;">Error al conectar con el servidor de Teschi Bazar.</p>`;
    }
}