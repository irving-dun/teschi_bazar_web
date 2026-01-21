const searchInput = document.getElementById('search-input');
const searchForm = document.getElementById('search-form');
const contenedorResultados = document.getElementById('contenedor-productos') || document.querySelector('.productos-grid');

let debounceTimeout = null;

// --- BUSQUEDA EN TIEMPO REAL ---
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimeout);

    // Si el usuario borra la búsqueda, podemos recargar los productos originales 
    // o simplemente limpiar. En este caso, si llega a 0, no hace nada.
    if (query.length === 0) return;

    debounceTimeout = setTimeout(() => {
        ejecutarBusqueda(query);
    }, 500);
});

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(debounceTimeout);
    ejecutarBusqueda(searchInput.value.trim());
});

async function ejecutarBusqueda(query) {
    if (query.length < 2) return;

    try {
        // Renderizamos un pequeño mensaje de "Buscando..." para feedback visual
        if (contenedorResultados) {
            contenedorResultados.innerHTML = '<p class="buscando-msg">Buscando productos...</p>';
        }

        // Usamos API_BASE_URL para consultar al backend de Render
        const response = await fetch(`${API_BASE_URL}/api/buscar?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Error en el servidor");
        
        const productos = await response.json();
        renderizarInterfazFusionada(productos, query);

    } catch (error) {
        console.error("Error al buscar:", error);
        if (contenedorResultados) {
            contenedorResultados.innerHTML = `<p style="color:red;">Error al realizar la búsqueda.</p>`;
        }
    }
}

function renderizarInterfazFusionada(productos, termino) {
    if (!contenedorResultados) return;
    contenedorResultados.innerHTML = ''; 

    if (productos.length === 0) {
        contenedorResultados.innerHTML = `<h3 class="no-results">No se encontraron resultados para "${termino}"</h3>`;
        return;
    }

    productos.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'producto-card'; 
        card.style.cursor = 'pointer';
        card.onclick = () => {
            window.location.href = `detalleProducto.html?id=${prod.id_producto}`;
        };

        // Lógica de Imagen consistente con el resto del sitio
        let urlImagenFinal = '../img/placeholder.png'; 
        
        if (prod.url_imagen) {
            urlImagenFinal = prod.url_imagen.startsWith('http') 
                ? prod.url_imagen 
                : `${API_BASE_URL}${prod.url_imagen}`;
        }

        card.innerHTML = `
            <div class="imagen-contenedor">
                <img src="${urlImagenFinal}" alt="${prod.nombre_producto}" onerror="this.src='../img/placeholder.png'" />
            </div>
            <div class="info-contenedor">
                <h3 class="titulo-producto">${prod.nombre_producto || 'Producto'}</h3>
                <p class="descripcion">${prod.descripcion || 'Sin descripción'}</p>
                <p class="precio">$${parseFloat(prod.precio).toFixed(2)} MXN</p>
            </div>
        `;
        contenedorResultados.appendChild(card);
    });
}