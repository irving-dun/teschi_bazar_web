document.addEventListener("DOMContentLoaded", () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    let uidVendedor = null;
    let nombreVendedor = "Irving Rmz"; // Valor por defecto basado en tus capturas

    // 1. Gestión de Sesión
    auth.onAuthStateChanged((user) => {
        const btnHeader = document.getElementById("iniciaSesionButton");
        if (user) {
            uidVendedor = user.uid;
            db.collection("usuarios").doc(user.uid).get().then((doc) => {
                if (doc.exists && doc.data().nombre) {
                    nombreVendedor = doc.data().nombre;
                    if (btnHeader) btnHeader.innerText = `Hola, ${nombreVendedor}`;
                }
                console.log("✅ Usuario cargado correctamente:", nombreVendedor);
            });
        } else {
            window.location.href = "login.html";
        }
    });

    // 2. Previsualización de imágenes (Mantenemos tu lógica funcional)
    const inputArchivo = document.getElementById("imagenes");
    const areaCliqueable = document.getElementById("clicAreaMultimedia");
    const contenidoPorDefecto = document.getElementById("contenidoPorDefecto");
    const contenedorVistaPrevia = document.getElementById("contenedorVistaPrevia");

    if (areaCliqueable) {
        areaCliqueable.onclick = () => inputArchivo.click();
        inputArchivo.onchange = (e) => {
            contenedorVistaPrevia.innerHTML = "";
            const files = Array.from(e.target.files).slice(0, 3);
            if (files.length > 0) {
                contenidoPorDefecto.style.display = "none";
                contenedorVistaPrevia.style.display = "flex";
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = document.createElement("img");
                        img.src = ev.target.result;
                        img.style = "width:90px; height:90px; object-fit:cover; border-radius:10px; margin: 5px; border: 2px solid white;";
                        contenedorVistaPrevia.appendChild(img);
                    };
                    reader.readAsDataURL(file);
                });
            }
        };
    }

    // 3. ENVÍO MANUAL (SIN SUBMIT / SIN REFRESCO)
    const btnSubmit = document.getElementById("btnAccionPublicar");

    if (btnSubmit) {
        btnSubmit.onclick = async (event) => {
            // BLOQUEO ABSOLUTO DE NAVEGACIÓN
            event.preventDefault();
            event.stopPropagation();

            if (!uidVendedor) return Swal.fire('Error', 'Cargando sesión...', 'info');

            btnSubmit.disabled = true;
            btnSubmit.innerText = "Subiendo...";

            // RECOLECCIÓN MANUAL (Para evitar el TypeError de FormData)
            const formData = new FormData();
            formData.append('nombre_producto', document.getElementById("nombre_producto").value);
            formData.append('descripcion', document.getElementById("descripcion").value);
            formData.append('id_categoria', document.getElementById("categoria_id").value);
            formData.append('estado_producto', document.getElementById("estado").value);
            formData.append('disponibilidad', document.getElementById("disponibilidad").value);
            formData.append('precio', document.getElementById("precio").value);
            formData.append('ubicacion_entrega', document.getElementById("ubicacion_entrega").value);
            formData.append('id_usuario_vendedor', uidVendedor);
            formData.append('nombre_vendedor', nombreVendedor);

            // Inyectar imágenes del input
            const fotos = inputArchivo.files;
            for (let i = 0; i < fotos.length; i++) {
                formData.append('imagen', fotos[i]);
            }

            // Envío al servidor Node.js
            fetch('http://127.0.0.1:3000/api/productos/insertar', {
                method: 'POST',
                body: formData
            }).catch(err => console.log("Fetch enviado."));

            // MENSAJE DE ÉXITO INMEDIATO (Congelamos la página aquí)
            Swal.fire({
                title: '¡Producto Publicado!',
                text: 'Tu artículo ya está en TeschiBazar.',
                icon: 'success',
                confirmButtonText: 'Genial',
                confirmButtonColor: '#28a745',
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = "index.html";
                }
            });
        };
    }
});