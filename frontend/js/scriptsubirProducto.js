// Archivo: /frontend/javascript/scriptsubirProducto.js

document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formularioProducto');
    const ENDPOINT_API = 'http://localhost:3000/api/productos/insertar'; 
    const inputUsuarioVendedor = document.getElementById('id_usuario_vendedor');

    // 1. Obtener el ID real de Firebase
    function verificarUsuario() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                inputUsuarioVendedor.value = user.uid;
            } else {
                alert("Debes estar logueado para publicar un producto.");
                window.location.href = "login.html"; // Redirigir si no está logueado
            }
        });
    }

    verificarUsuario();

    // 2. Manejo del Envío
    formulario.addEventListener('submit', async function(e) {
        e.preventDefault(); 

        const idVendedor = inputUsuarioVendedor.value;
        
        // Validación de seguridad básica
        if (!idVendedor) {
            alert('Error: No se detectó tu ID de usuario. Por favor, inicia sesión nuevamente.');
            return;
        }

        try {
            const formData = new FormData(formulario);

            // Verificación de imagen
            const imagen = formData.get('imagen');
            if (!imagen || imagen.size === 0) {
                alert('Debe seleccionar una imagen para el producto.');
                return;
            }

            // Mostrar un mensaje de "Subiendo..." en el botón
            const btnSubmit = formulario.querySelector('.btn-submit');
            const originalText = btnSubmit.textContent;
            btnSubmit.textContent = 'Publicando...';
            btnSubmit.disabled = true;

            const response = await fetch(ENDPOINT_API, {
                method: 'POST',
                body: formData 
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.mensaje || data.error || 'Error al publicar.');
            }

            // ÉXITO
            alert('¡Producto publicado con éxito!');
            formulario.reset();
            window.location.href = 'perfil.html'; // O a donde prefieras redirigir

        } catch (error) {
            console.error('Fallo en la publicación:', error);
            alert('Error: ' + error.message);
        } finally {
            // Restaurar botón
            const btnSubmit = formulario.querySelector('.btn-submit');
            btnSubmit.textContent = 'Publicar Artículo';
            btnSubmit.disabled = false;
        }
    });
});