const searchInput = document.getElementById('search-input');
const searchForm = document.getElementById('search-form');
const contenedorResultados = document.getElementById('contenedor-productos') || document.querySelector('.productos-grid');

// CAMBIADO: URL de Render
const servidorUrl = "https://teschi-bazar-web.onrender.com"; 
let debounceTimeout = null;

// --- BUSQUEDA EN TIEMPO REAL ---
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimeout);

    if (query.length === 0) return;

    debounceTimeout = setTimeout(() => {
        ejecutarBusqueda(query);
    }, 500);
});

// --- BUSQUEDA POR BOTÓN O ENTER ---
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(debounceTimeout);
    ejecutarBusqueda(searchInput.value.trim());
});

// --- FUNCIÓN DE PETICIÓN ---
async function ejecutarBusqueda(query) {
    if (query.length < 2) return;

    try {
       
        const response = await fetch(`${servidorUrl}/api/buscar?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Error en el servidor");
        
        const productos = await response.json();
        renderizarInterfazFusionada(productos, query);

    } catch (error) {
        console.error("Error al buscar:", error);
    }
}

// --- FUNCIÓN DE INTERFAZ ---
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


        let urlImagenFinal = '/frontend/img/placeholder.png'; // Imagen por defecto
        
        if (prod.url_imagen) {
            // Si la imagen ya es un link completo (Cloudinary), se usa tal cual.
            // Si es una ruta relativa (/uploads/...), le pegamos la URL del servidor.
            urlImagenFinal = prod.url_imagen.startsWith('http') 
                ? prod.url_imagen 
                : `${servidorUrl}${prod.url_imagen}`;
        }

        card.innerHTML = `
            <div class="imagen-contenedor">
                <img src="${urlImagenFinal}" alt="${prod.nombre_producto}" onerror="this.src='/frontend/img/placeholder.png'" />
            </div>
            <div class="info-contenedor">
                <p class="descripcion">${prod.descripcion || 'Sin descripción'}</p>
                <h3 class="titulo-producto">${prod.nombre_producto || 'Producto'}</h3>
                <p class="precio">$${parseFloat(prod.precio).toFixed(2)}</p>
            </div>
        `;
        contenedorResultados.appendChild(card);
    });
}