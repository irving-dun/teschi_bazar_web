// =================================================================
// RUTAS DE LA API (ADAPTADO A POSTGRESQL)
// =================================================================

// 🚀 RUTA 1: POST - Insertar un nuevo producto con imagen (CORREGIDA con transacción)
app.post('/api/productos/insertar', upload.single('imagen'), async (req, res) => {
    // Nota: El campo 'categoria_id' en el body debería coincidir con 'id_categoria' en la tabla.
    const { id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado_producto, ubicacion_entrega } = req.body;
    const imagen_url = req.file ? '/uploads/' + req.file.filename : null; 
    
    // El campo 'categoria_id' del body se mapea a 'id_categoria' en la tabla productos
    if (!id_usuario_vendedor || !nombre_producto || !precio || !categoria_id || !estado_producto || !imagen_url) {
        if (req.file) {
             fs.unlinkSync(req.file.path); 
        }
        return res.status(400).json({ mensaje: 'Faltan datos requeridos (vendedor, nombre, precio, categoría, estado y imagen).' });
    }
    
    const client = await pool.connect(); 
    
    try {
        await client.query('BEGIN'); // Iniciar transacción

        // 1. Insertar el Producto
        // NOTA: Se cambió 'categoria_id' a 'id_categoria' para coincidir con el esquema de la BD.
        const productoSql = `
            INSERT INTO productos (id_usuario_vendedor, nombre_producto, descripcion, precio, id_categoria, estado_producto, ubicacion_entrega) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING id_producto`;
        const productoResult = await client.query(productoSql, [id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado_producto, ubicacion_entrega]);
        const id_producto_insertado = productoResult.rows[0].id_producto;

        // 2. Insertar la Imagen
        const imagenSql = `
            INSERT INTO imagenes_producto (id_producto, url_imagen, orden) 
            VALUES ($1, $2, $3)`;
        await client.query(imagenSql, [id_producto_insertado, imagen_url, 1]); // 'orden: 1' para la imagen principal

        await client.query('COMMIT'); // Confirmar transacción
        
        res.status(201).json({ 
            mensaje: 'Producto e imagen insertados con éxito', 
            id_producto: id_producto_insertado,
            ruta_imagen: imagen_url
        });
    } catch (err) {
        await client.query('ROLLBACK'); // Revertir transacción en caso de error
        console.error('Error al insertar producto (transacción):', err);
        if (req.file) {
            fs.unlinkSync(req.file.path); 
        }
        res.status(500).json({ error: 'Error interno del servidor al insertar producto.' });
    } finally {
        client.release(); 
    }
});

// 📚 RUTA 2: GET - Obtener todos los productos (SIN CAMBIOS)
app.get('/api/productos', async (req, res) => {
    const sql = "SELECT * FROM productos";
    
    try {
        const result = await pool.query(sql); 
        res.json(result.rows); 
    } catch (err) {
        console.error('Error al consultar productos:', err);
        res.status(500).json({ error: 'Error al obtener datos de la base de datos.' });
    }
});


// 📦 NUEVA RUTA: RUTA para obtener productos por ID de Categoría
app.get('/api/productos/categoria/:idCategoria', async (req, res) => {
    const idCategoria = parseInt(req.params.idCategoria);

    if (isNaN(idCategoria)) {
        return res.status(400).json({ error: 'El ID de la categoría debe ser un número válido.' });
    }
    
    // SQL para obtener productos y la URL de la primera imagen (JOIN y subconsulta)
    const sql = `
        SELECT
            p.id_producto,
            p.nombre_producto,
            p.descripcion,
            p.precio,
            p.estado_producto,
            c.nombre_categoria,
            (SELECT url_imagen FROM imagenes_producto WHERE id_producto = p.id_producto ORDER BY orden ASC LIMIT 1) AS url_imagen
        FROM 
            productos p
        JOIN 
            categorias c ON p.id_categoria = c.id_categoria
        WHERE 
            p.id_categoria = $1 AND p.disponibilidad > 0
        ORDER BY 
            p.fecha_publicacion DESC;
    `;
    
    try {
        const result = await pool.query(sql, [idCategoria]); 
        
        if (result.rows.length === 0) {
            return res.status(200).json([]); // Devolver un array vacío si no hay productos
        }
        res.json(result.rows); 
    } catch (err) {
        console.error(`Error al consultar productos por categoría ${idCategoria}:`, err);
        res.status(500).json({ error: 'Error al obtener datos de la base de datos.' });
    }
});


// 💬 RUTA 4: GET - Obtener historial de mensajes de una conversación (La ruta de chat original)
app.get('/api/chat/:idConversacion', async (req, res) => {
    // ... (El código de la ruta de chat se mantiene igual)
});

// ... (El resto del código de server.js se mantiene igual)