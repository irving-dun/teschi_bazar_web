//------------ CONFIGURACIÓN DE DEPENDENCIAS Y MÓDULOS ------------
    //  Base del servidor y seguridad  
const express = require('express');
const cors = require('cors');
const http = require('http');

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
const app = express();
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
const serviceAccount = require('./adminsdk.json'); 
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
console.log('✅Firebase Admin SDK inicializado.');

//------------ CONFIGURACIÓN DE MULTER (PROCESAMIENTO DE IMÁGENES) ------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

//------------ CONFIGURACIÓN DE LA BASE DE DATOS (PostgreSQL) ------------
const DATABASE_URL_LOCAL = "postgresql://irving:4jsZSjNG0ZaqCNw7zQQlvGjt7ibkbUMn@dpg-d4vnjfhr0fns739p88l0-a.virginia-postgres.render.com/teschibazar"; 

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
    // 1. Agregamos un log para ver en la terminal que los datos llegaron
    console.log("Recibiendo producto:", req.body.nombre_producto);

    const { 
        nombre_producto, descripcion, id_categoria, 
        estado_producto, disponibilidad, precio, 
        id_usuario_vendedor, nombre_vendedor, ubicacion_entrega 
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Registro de usuario (ON CONFLICT evita errores si ya existe)
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

        // Registro de la imagen (si existe)
        if (req.file) {
            await client.query('INSERT INTO imagenes_producto (id_producto, url_imagen) VALUES ($1, $2)', 
                [id_producto, `/uploads/${req.file.filename}`]
            );
        }

        await client.query('COMMIT');
        
        // 2. Respuesta ultra-clara para el frontend
        console.log("✅ Producto guardado con éxito:", id_producto);
        return res.status(200).json({ success: true, mensaje: "¡Éxito!", id: id_producto });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error en el servidor:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    } finally {
        if (client) client.release();
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


// RUTA: Registrar un nuevo pedido basado en tu tabla existente
app.post('/api/pedidos/crear', async (req, res) => {
    const { id_comprador, id_vendedor, total_pedido, metodo_pago, id_producto } = req.body;

    try {
        // Ajustamos la consulta a los nombres de tus columnas según la imagen
        const sql = `
            INSERT INTO pedidos (id_comprador, id_vendedor, fecha_pedido, estado_pedido, total_pedido, metodo_pago)
            VALUES ($1, $2, CURRENT_TIMESTAMP, 'pendiente', $3, $4)
            RETURNING id_pedido
        `;
        
        const result = await pool.query(sql, [id_comprador, id_vendedor, total_pedido, metodo_pago]);

        // Opcional: Marcar el producto como no disponible para que ya no aparezca en las búsquedas
        await pool.query('UPDATE productos SET disponibilidad = false WHERE id_producto = $1', [id_producto]);

        res.json({ 
            success: true, 
            mensaje: "Pedido registrado en PostgreSQL", 
            id_pedido: result.rows[0].id_pedido 
        });
    } catch (err) {
        console.error("Error al registrar pedido:", err.message);
        res.status(500).json({ error: "Error interno al crear el pedido" });
    }
});


// RUTA: Obtener notificaciones de un usuario específico
app.get('/api/notificaciones/:idUsuario', async (req, res) => {
    const { idUsuario } = req.params;
    try {
        const sql = `
            SELECT * FROM notificaciones 
            WHERE id_usuario = $1 
            ORDER BY fecha_creacion DESC 
            LIMIT 10
        `;
        const result = await pool.query(sql, [idUsuario]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener notificaciones" });
    }
});

// RUTA: Crear notificación (Se llama internamente al realizar un pedido)
// Nota: Puedes integrarla dentro de tu ruta de /api/pedidos/crear
async function crearNotificacion(idUsuario, tipo, mensaje, url) {
    const sql = `
        INSERT INTO notificaciones (id_usuario, tipo_notificacion, mensaje, url_destino, leida)
        VALUES ($1, $2, $3, $4, false)
    `;
    await pool.query(sql, [idUsuario, tipo, mensaje, url]);
}


app.get('/api/vendedor/pedidos/todos/:idVendedor', async (req, res) => {
    const { idVendedor } = req.params;
    try {
        const sql = `
            SELECT id_pedido, id_comprador, total_pedido, estado_pedido, 
                   fecha_entrega, hora_entrega, lugar_entrega
            FROM pedidos 
            WHERE id_vendedor = $1
            ORDER BY fecha_pedido DESC
        `;
        const result = await pool.query(sql, [idVendedor]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/pedidos/confirmar-cita', async (req, res) => {
    const { id_pedido, fecha, hora, lugar } = req.body;
    try {
        // Actualizamos las columnas específicas de la entrega
        const sql = `
            UPDATE pedidos 
            SET estado_pedido = 'confirmado', 
                fecha_entrega = $1, 
                hora_entrega = $2, 
                lugar_entrega = $3
            WHERE id_pedido = $4
        `;
        await pool.query(sql, [fecha, hora, lugar, id_pedido]);
        res.json({ success: true, mensaje: "Cita confirmada en columnas específicas" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


app.put('/api/pedidos/finalizar/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("UPDATE pedidos SET estado_pedido = 'entregado' WHERE id_pedido = $1", [id]);
        res.json({ success: true, mensaje: "Venta finalizada con éxito" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// RUTA: Finalizar un pedido (Marcar como entregado)
app.put('/api/pedidos/finalizar/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `
            UPDATE pedidos 
            SET estado_pedido = 'entregado' 
            WHERE id_pedido = $1
        `;
        await pool.query(sql, [id]);
        res.json({ success: true, mensaje: "¡Venta finalizada con éxito!" });
    } catch (err) {
        console.error("Error al finalizar pedido:", err.message);
        res.status(500).json({ error: "No se pudo finalizar el pedido" });
    }
});

// Endpoint para procesar la compra
app.post('/api/pedidos/crear', async (req, res) => {
    const { id_comprador, id_vendedor, id_producto, cantidad, total_pedido } = req.body;

    const client = await pool.connect(); // Usando pg pool
    try {
        await client.query('BEGIN'); // Iniciar transacción

        // 1. Verificar y Descontar Stock (Solo si hay suficiente)
        const updateStockSql = `
            UPDATE productos 
            SET disponibilidad = disponibilidad - $1 
            WHERE id_producto = $2 AND disponibilidad >= $1
            RETURNING disponibilidad
        `;
        const resStock = await client.query(updateStockSql, [cantidad, id_producto]);

        if (resStock.rowCount === 0) {
            throw new Error("Stock insuficiente o el producto ya no existe.");
        }

        // 2. Insertar el pedido
        const insertPedidoSql = `
            INSERT INTO pedidos (id_comprador, id_vendedor, total_pedido, estado_pedido, fecha_pedido)
            VALUES ($1, $2, $3, 'completado', CURRENT_TIMESTAMP)
            RETURNING id_pedido
        `;
        await client.query(insertPedidoSql, [id_comprador, id_vendedor, total_pedido]);

        await client.query('COMMIT'); // Guardar cambios
        res.status(200).json({ success: true, mensaje: "Pedido procesado" });

    } catch (error) {
        await client.query('ROLLBACK'); // Cancelar todo si hay error
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});








//------------ SERVIDOR Y SOCKET.IO------------
const server = http.createServer(app); 
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

initializeDatabase().then(() => {
    server.listen(port, () => {
        console.log(`🚀 Servidor en puerto ${port}`);
    });
});