//------------ CONFIGURACIÓN DE DEPENDENCIAS Y MÓDULOS ------------

require('dotenv').config(); // Carga las variables del archivo .env
const cloudinary = require('cloudinary').v2; // Importa Cloudinary

// Configuración de Cloudinary usando tus variables del .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// CÓDIGO TEMPORAL DE PRUEBA 
console.log("--- Verificando Configuración ---");
console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("DB URL existe:", process.env.DATABASE_URL ? "SÍ" : "NO");
console.log("---------------------------------");
//  Base del servidor y seguridad  
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const cors = require('cors');
//middleware inicial
app.use(cors()); 

//  Base de datos y servicios externos
const { Pool } = require('pg');
const admin = require('firebase-admin');

//  Manejo de archivos y rutas
const multer = require('multer');
const path = require('path');
const fs = require('fs');

//  Comunicacion en tiempo real
const { Server } = require('socket.io');

// Inicialización de la App
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

//------------ Configuración de RUTAS DE ARCHIVOS ------------
const UPLOADS_DIR = path.join(__dirname, '..', 'sandbox', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

//------------ CONFIGURACIÓN DE FIREBASE ADMIN SDK ------------
// 2. Configuración de Firebase usando Variables de Entorno
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : undefined,
};

// 3. Inicializar Firebase solo si no se ha inicializado antes
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(firebaseConfig),
        });
        console.log("✅ Firebase inicializado correctamente desde variables de entorno");
    } catch (error) {
        console.error("❌ Error al inicializar Firebase:", error.message);
    }
}
//------------ CONFIGURACIÓN DE MULTER (PROCESAMIENTO EN MEMORIA) ------------
const storage = multer.memoryStorage(); 
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB por imagen
});

//------------ CONFIGURACIÓN DE LA BASE DE DATOS (PostgreSQL) ------------
const DATABASE_URL_LOCAL = "postgresql://irving:yXev9G4u5zJjlXflwDddN9e4jM7kKot8@dpg-d5lg2bfgi27c738salog-a.virginia-postgres.render.com/teschibazar_ic6m";

const dbConfig = {
    connectionString: process.env.DATABASE_URL || DATABASE_URL_LOCAL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
};

let pool;
async function initializeDatabase() {
    try {
        pool = new Pool(dbConfig);
        const client = await pool.connect();
        client.release();
        console.log('✅ Conexión a PostgreSQL exitosa!');
    } catch (err) {
        console.error('Error al conectar con PostgreSQL:', err.message);
        process.exit(1);
    }
}

//------------ RUTAS DE LA API ------------

//  RUTA: Obtener detalle de producto
app.get('/api/productos/:id', async (req, res) => {
    const idProducto = req.params.id;
    const sql = `
        SELECT p.*, i.url_imagen, c.nombre_categoria 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE p.id_producto = $1
    `;
    try {
        const result = await pool.query(sql, [idProducto]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No existe' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//  RUTA: Insertar nuevo producto
app.post('/api/productos/insertar', upload.single('imagen'), async (req, res) => {
    console.log("Recibiendo producto:", req.body.nombre_producto);

    const {
        nombre_producto, descripcion, id_categoria,
        estado_producto, disponibilidad, precio,
        id_usuario_vendedor, nombre_vendedor, ubicacion_entrega
    } = req.body;

// RUTA: Finalizar pedido (Confirmar entrega)
app.put('/api/pedidos/finalizar/:id', async (req, res) => {
    const idPedido = req.params.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Actualizamos el estado del pedido a 'entregado'
        // IMPORTANTE: Asegúrate de que 'entregado' exista en tu estado_pedido_enum
        const queryUpdate = `
            UPDATE pedidos 
            SET estado_pedido = 'entregado'::text::estado_pedido_enum 
            WHERE id_pedido = $1 
            RETURNING id_comprador
        `;
        const result = await client.query(queryUpdate, [idPedido]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Pedido no encontrado" });
        }

        // 2. Opcional: Descontar stock si no lo hiciste antes
        const detalle = await client.query(
            'SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = $1',
            [idPedido]
        );
        for (const fila of detalle.rows) {
            await client.query(
                'UPDATE productos SET disponibilidad = disponibilidad - $1 WHERE id_producto = $2',
                [fila.cantidad, fila.id_producto]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "¡Venta finalizada con éxito!" });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Error al finalizar:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


    // --- 1. PROCESAR IMAGEN ANTES DE LA DB --- // <--- MEJORA AQUÍ
    let url_imagen_cloudinary = null;

    try {
        if (req.file) {
            console.log("Subiendo imagen a Cloudinary...");
            url_imagen_cloudinary = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'teschibazar_productos' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                stream.end(req.file.buffer);
            });
            console.log("✅ Imagen en Cloudinary:", url_imagen_cloudinary);
        }

        // --- 2. INICIAR TRANSACCIÓN DB ---
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Registro de usuario
            await client.query(
                `INSERT INTO usuarios (id_usuario, nombre) 
                 VALUES ($1, $2) ON CONFLICT (id_usuario) DO NOTHING`,
                [id_usuario_vendedor, nombre_vendedor || "Usuario"]
            );

            // Registro del producto
            const resProd = await client.query(
                `INSERT INTO productos (nombre_producto, descripcion, id_categoria, estado_producto, disponibilidad, precio, id_usuario_vendedor, ubicacion_entrega) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_producto`,
                [nombre_producto, descripcion, id_categoria, estado_producto, disponibilidad, precio, id_usuario_vendedor, ubicacion_entrega]
            );

            const id_producto = resProd.rows[0].id_producto;

            // --- 3. GUARDAR URL YA OBTENIDA --- // <--- MEJORA AQUÍ
            if (url_imagen_cloudinary) {
                await client.query(
                    'INSERT INTO imagenes_producto (id_producto, url_imagen) VALUES ($1, $2)',
                    [id_producto, url_imagen_cloudinary]
                );
            }

            await client.query('COMMIT');
            console.log("✅ Todo guardado con éxito.");
            return res.status(200).json({ success: true, id: id_producto });

        } catch (dbError) {
            if (client) await client.query('ROLLBACK');
            throw dbError; // Lanza el error para que lo atrape el catch principal
        } finally {
            if (client) client.release();
        }

    } catch (err) {
        console.error("❌ Error en el proceso:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});
//  RUTA: Obtener productos por categoría
app.get('/api/productos/categoria/:id', async (req, res) => {
    const idCategoria = req.params.id;
    const sql = `
        SELECT p.*, i.url_imagen 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        WHERE p.id_categoria = $1
        ORDER BY p.fecha_publicacion DESC
    `;
    try {
        const result = await pool.query(sql, [idCategoria]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al filtrar.' });
    }
});

//  RUTA: Obtener todos los productos 
app.get('/api/productos', async (req, res) => {

    const sql = "SELECT * FROM productos ORDER BY fecha_publicacion DESC";
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener datos.' });
    }
});


// RUTA: Buscar productos por nombre o descripción
app.get('/api/buscar', async (req, res) => {
    const { q } = req.query; // 'q' es el término de búsqueda
    console.log("🔍 Petición de búsqueda recibida para:", q);

    if (!q) {
        return res.status(400).json({ error: 'Debes proporcionar un término de búsqueda.' });
    }

    // Buscamos coincidencias en nombre o descripción
    // El símbolo % es un comodín en SQL para buscar "cualquier texto"
    const sql = `
        SELECT p.*, i.url_imagen 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        WHERE p.nombre_producto ILIKE $1 OR p.descripcion ILIKE $1
        ORDER BY p.fecha_publicacion DESC
    `;

    try {
        const searchTerm = `%${q}%`;
        const result = await pool.query(sql, [searchTerm]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error en búsqueda:", err.message);
        res.status(500).json({ error: 'Error al procesar la búsqueda.' });
    }
});




app.post('/api/pedidos/crear-peticion', async (req, res) => {
    // Recibimos id_comprador y opcionalmente el nombre para el registro rápido
    const { id_comprador, nombre_comprador, id_producto, cantidad, total, metodo_pago, lugar_entrega } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. OBTENER INFO DEL PRODUCTO Y VENDEDOR
        const productoInfo = await client.query(
            'SELECT id_usuario_vendedor, precio, nombre_producto FROM productos WHERE id_producto = $1',
            [id_producto]
        );

        if (productoInfo.rows.length === 0) {
            throw new Error("Producto no encontrado");
        }

        const { id_usuario_vendedor, precio, nombre_producto } = productoInfo.rows[0];

        // 2. SOLUCIÓN AL ERROR DE FOREIGN KEY:
        // Registramos al comprador en la tabla local si no existe. 
        // Esto satisface la restricción 'fk_pedidos_comprador' de tu DB.
        await client.query(
            `INSERT INTO usuarios (id_usuario, nombre) 
             VALUES ($1, $2) 
             ON CONFLICT (id_usuario) DO NOTHING`,
            [id_comprador, nombre_comprador || "Usuario Bazar"]
        );

        // 3. INSERT EN 'PEDIDOS' (Orden exacto de tus columnas según las imágenes)
        // Columnas vistas: id_comprador, id_vendedor, fecha_pedido, estado_pedido, total_pedido, metodo_pago, lugar_entrega
        const queryPedido = `
            INSERT INTO pedidos (
                id_comprador, 
                id_vendedor, 
                fecha_pedido, 
                estado_pedido, 
                total_pedido, 
                metodo_pago, 
                lugar_entrega
            ) VALUES ($1, $2, CURRENT_TIMESTAMP, 'pendiente', $3, $4, $5)
            RETURNING id_pedido
        `;
        
        const resPedido = await client.query(queryPedido, [
            id_comprador, 
            id_usuario_vendedor, 
            total, 
            metodo_pago, 
            lugar_entrega
        ]);

        const id_pedido_generado = resPedido.rows[0].id_pedido;

        // 4. INSERT EN 'DETALLE_PEDIDO'
        const queryDetalle = `
            INSERT INTO detalle_pedido (
                id_pedido, id_producto, cantidad, precio_unitario
            ) VALUES ($1, $2, $3, $4)
        `;
        await client.query(queryDetalle, [
            id_pedido_generado, id_producto, cantidad || 1, precio
        ]);

        // 5. NOTIFICACIÓN AL VENDEDOR
        const mensajeVendedor = `¡Nueva petición! Alguien quiere comprar tu ${nombre_producto}.`;
        await client.query(
            'INSERT INTO notificaciones (id_usuario, tipo_notificacion, mensaje, leida) VALUES ($1, $2, $3, $4)',
            [id_usuario_vendedor, 'nuevo_pedido', mensajeVendedor, false]
        );

        await client.query('COMMIT');

        // Emitir por Socket.io si está configurado
        if (typeof io !== 'undefined') {
            io.emit(`notificacion_${id_usuario_vendedor}`, {
                mensaje: mensajeVendedor,
                id_pedido: id_pedido_generado
            });
        }

        res.status(201).json({ success: true, id_pedido: id_pedido_generado });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Error en la transacción:", error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (client) client.release();
    }
});

app.get('/api/vendedor/pedidos/todos/:idVendedor', async (req, res) => {
    try {
        const { idVendedor } = req.params;
        const query = `
            SELECT 
                p.id_pedido, 
                p.id_comprador, -- Ahora enviamos el UID directamente de la tabla pedidos
                p.total_pedido, 
                p.estado_pedido, 
                p.fecha_pedido,
                p.metodo_pago,
                p.lugar_entrega,
                p.notas_comprador,
                pr.nombre_producto,
                dp.cantidad,
                dp.precio_unitario
            FROM pedidos p
            INNER JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
            INNER JOIN productos pr ON dp.id_producto = pr.id_producto
            WHERE p.id_vendedor = $1
            ORDER BY p.id_pedido DESC
        `;
        const result = await pool.query(query, [idVendedor]);
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error en SQL:", error.message);
        res.status(500).json({ error: "Error al obtener datos de los pedidos" });
    }
});



// SECCION AGENDAR CITA (Sharon)

app.put('/api/pedidos/confirmar-cita', async (req, res) => {

    const { id_pedido, fecha, hora, lugar } = req.body;

    try {
        // 1. Obtener datos para la notificación
        const consulta = await pool.query(
            `SELECT p.id_comprador, pr.nombre_producto 
             FROM pedidos p
             JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
             JOIN productos pr ON dp.id_producto = pr.id_producto
             WHERE p.id_pedido = $1`, 
            [id_pedido]
        );

        if (consulta.rows.length === 0) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }

        const { id_comprador, nombre_producto } = consulta.rows[0];

        // 2. ACTUALIZACIÓN SEGURA
        // IMPORTANTE: Se usa ::text::estado_pedido_enum para forzar la compatibilidad
        const queryUpdate = `
            UPDATE pedidos 
            SET fecha_pedido = $1, 
                lugar_entrega = $2, 
                estado_pedido = 'agendado'::text::estado_pedido_enum 
            WHERE id_pedido = $3
        `;
        
        // Unificamos fecha y hora para guardarlo en fecha_pedido (que es timestamp)
        const fechaCompleta = `${fecha} ${hora}`; 

        await pool.query(queryUpdate, [fechaCompleta, lugar, id_pedido]);

        // 3. Notificación
        const mensajeComprador = `¡Cita agendada! Entrega de "${nombre_producto}" el ${fecha} a las ${hora} en ${lugar}.`;

        await pool.query(
            'INSERT INTO notificaciones (id_usuario, tipo_notificacion, mensaje, leida) VALUES ($1, $2, $3, $4)',
            [id_comprador, 'cita_confirmada', mensajeComprador, false]
        );

        if (typeof io !== 'undefined') {
            io.emit(`notificacion_${id_comprador}`, { mensaje: mensajeComprador, id_pedido });
        }

        res.json({ success: true, message: "Cita agendada correctamente" });

    } catch (error) {
        console.error("❌ Error detallado:", error.message);
        res.status(500).json({ error: "Error al procesar la cita: " + error.message });
    }
    
});







app.put('/api/pedidos/finalizar/:id', async (req, res) => {
    const idPedido = req.params.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Obtener detalles para descontar stock
        const detalle = await client.query(
            'SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = $1',
            [idPedido]
        );

        if (detalle.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "No se encontró el detalle del pedido." });
        }

        // 2. Descontar disponibilidad de productos
        for (const fila of detalle.rows) {
            await client.query(
                'UPDATE productos SET disponibilidad = disponibilidad - $1 WHERE id_producto = $2',
                [fila.cantidad, fila.id_producto]
            );
        }

        // 3. Actualizar estado a 'entregado' con casting de ENUM
        const queryUpdate = `
            UPDATE pedidos 
            SET estado_pedido = 'entregado'::text::estado_pedido_enum 
            WHERE id_pedido = $1
        `;
        await client.query(queryUpdate, [idPedido]);

        await client.query('COMMIT');
        res.json({ success: true, message: "¡Venta finalizada y stock actualizado!" });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Error al finalizar pedido:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


app.get('/api/notificaciones/:idUsuario', async (req, res) => {
    const { idUsuario } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM notificaciones WHERE id_usuario = $1 ORDER BY fecha_creacion DESC LIMIT 5',
            [idUsuario]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/productos-destacados', async (req, res) => {
    const sql = `
        SELECT 
            p.id_producto, 
            p.nombre_producto, 
            p.precio, 
            p.descripcion,
            i.url_imagen,
            COUNT(ped.id_pedido) as ventas -- Contamos solo los pedidos que cumplen el WHERE
        FROM productos p
        INNER JOIN imagenes_producto i ON p.id_producto = i.id_producto
        INNER JOIN detalle_pedido dp ON p.id_producto = dp.id_producto
        INNER JOIN pedidos ped ON dp.id_pedido = ped.id_pedido
        WHERE ped.estado_pedido = 'entregado' 
        GROUP BY p.id_producto, i.url_imagen
        ORDER BY ventas DESC
        LIMIT 12
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error("Error en destacados:", err.message);
        res.status(500).json({ error: 'Error al obtener destacados.' });
    }
});
//------------ SERVIDOR Y SOCKET.IO------------
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

initializeDatabase().then(() => {
    server.listen(port, () => {
        console.log(`🚀 Servidor en puerto ${port}`);
    });
});