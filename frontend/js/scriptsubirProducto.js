// =================================================================
// Archivo: scriptSubirProducto.js
// Propósito: Manejar la lógica de envío del formulario al servidor Node.js
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener una referencia al formulario usando su ID
    const formulario = document.getElementById('formularioProducto');

    // 2. Escuchar el evento de envío (submit) del formulario
    formulario.addEventListener('submit', async (e) => {
        // Prevenir que el formulario recargue la página (comportamiento por defecto)
        e.preventDefault();

        // 3. Crear el objeto FormData
        // Esto es CLAVE. FormData recoge todos los inputs (incluyendo el archivo)
        // por su atributo 'name' y lo prepara para ser enviado como 'multipart/form-data'.
        const formData = new FormData(formulario);

        // =================================================================
        // ID TEMPORAL DE VENDEDOR
        // Esto es necesario porque la tabla 'productos' lo requiere,
        // y el ID real provendrá de la autenticación (que se implementará después).
        // Si ya tienes un ID de Firebase o un ID de sesión, ÚSALO AQUÍ.
        // =================================================================
        
        // Añadir el ID del vendedor al objeto FormData
        formData.append('id_usuario_vendedor', 'TESCHI001'); // ID temporal de prueba

        // 4. Configuración y URL de la API
        const API_URL = 'http://localhost:3000/api/productos/insertar';

        // 5. Realizar la petición POST usando fetch
        try {
            const respuesta = await fetch(API_URL, {
                method: 'POST',
                // *** IMPORTANTE: El cuerpo de la petición es el objeto FormData ***
                // No establecemos Content-Type, el navegador lo hace automáticamente.
                body: formData 
            });

            // Leer y parsear la respuesta del servidor (JSON)
            const data = await respuesta.json();

            if (respuesta.ok) {
                // Éxito: Status code 200-299
                console.log('🎉 Producto publicado con éxito:', data);
                alert('¡Artículo publicado con éxito! ID: ' + data.id_producto + '\nImagen guardada en: ' + data.ruta_imagen);
                
                // Limpiar el formulario después del éxito
                formulario.reset(); 
            } else {
                // Fallo del servidor (ej: 400, 500)
                console.error('❌ Error al publicar:', data.mensaje || data.error);
                alert('Error al publicar artículo: ' + (data.mensaje || 'Verifica la consola y el servidor Node.js.'));
            }

        } catch (error) {
            // Error de conexión (el servidor Node.js no está corriendo o hay un problema de red/CORS)
            console.error('Error de conexión con el Backend:', error);
            alert('Error de conexión. Asegúrate de que node server.js esté corriendo.');
        }
    });
    
    // Opcional: Lógica para el botón "Guardar Borrador"
    const btnGuardarBorrador = document.querySelector('.btn-save-draft');
    if (btnGuardarBorrador) {
        btnGuardarBorrador.addEventListener('click', () => {
            alert('Funcionalidad de Guardar Borrador aún no implementada.');
            // Aquí iría la lógica para guardar los datos localmente o en un endpoint de borrador
        });
    }
});