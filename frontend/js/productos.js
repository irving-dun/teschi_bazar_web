document.addEventListener('DOMContentLoaded', () => {
    // Obtenemos la categoría desde el body (data-categoria="3" en accesorios.html)
    const categoriaId = document.body.getAttribute('data-categoria');
    
    // Si existe la categoría la cargamos, si no, cargamos por defecto la 1
    if (categoriaId) {
        cargarProductos(categoriaId);
    } else {
        cargarProductos(1); 
    }
});

async function cargarProductos(idCat) {
    // Buscamos cualquier contenedor válido en las distintas páginas de categorías
    let contenedor = document.getElementById('contenedor-productos') || 
                     document.getElementById('contenedor-ropa');

    if (!contenedor) return;

    try {
        // CAMBIO: Usamos API_BASE_URL definido en firebase-config.js
        const respuesta = await fetch(`${API_BASE_URL}/api/productos/categoria/${idCat}`);
        
        if (!respuesta.ok) throw new Error(`Error: ${respuesta.status}`);

        const productos = await respuesta.json();
        contenedor.innerHTML = ""; // Limpiamos el cargando...

        if (productos.length === 0) {
            contenedor.innerHTML = "<h3>No hay productos en esta categoría todavía.</h3>";
            return;
        }

        productos.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'producto-card';
            
            // Navegación al detalle pasando el ID por URL
            card.style.cursor = 'pointer';
            card.onclick = () => {
                window.location.href = `detalleProducto.html?id=${prod.id_producto}`;
            };

            // Lógica de Imagen: Cloudinary o Local
            let urlImagenFinal = '../img/placeholder.png'; // Ruta relativa corregida
            
            if (prod.url_imagen) {
                urlImagenFinal = prod.url_imagen.startsWith('http') 
                    ? prod.url_imagen 
                    : `${API_BASE_URL}${prod.url_imagen}`;
            }

            card.innerHTML = `
                <div class="imagen-contenedor">
                    <img src="${urlImagenFinal}" 
                         style="width:100%; display:block;" 
                         onerror="this.src='../img/placeholder.png'" />
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