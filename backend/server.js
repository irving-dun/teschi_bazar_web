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
    try {
        const idVendedor = req.params.idVendedor;
        const query = `
            SELECT 
                p.id_pedido, p.id_comprador, p.total_pedido, p.estado_pedido, 
                p.fecha_entrega, p.hora_entrega, p.lugar_entrega,
                pr.nombre_producto,
                dp.cantidad
            FROM pedidos p
            JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
            JOIN productos pr ON dp.id_producto = pr.id_producto
            WHERE pr.id_usuario_vendedor = $1
            ORDER BY p.id_pedido DESC
        `;
        const result = await pool.query(query, [idVendedor]);
        res.json(result.rows);
    } catch (error) {
        console.error("Error en SQL:", error.message);
        res.status(500).json({ error: "Error al obtener pedidos" });
    }
});

// Ajustado para recibir los datos de tu función enviarPropuesta()
app.put('/api/pedidos/confirmar-cita', async (req, res) => {
    const { id_pedido, fecha, hora, lugar } = req.body;

    try {
        // 1. Actualizamos el pedido y usamos un JOIN para obtener el id_comprador 
        // y el nombre del producto en una sola consulta
        const consultaPedido = await pool.query(
            `SELECT p.id_comprador, pr.nombre_producto 
             FROM pedidos p
             JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
             JOIN productos pr ON dp.id_producto = pr.id_producto
             WHERE p.id_pedido = $1`, 
            [id_pedido]
        );

        if (consultaPedido.rows.length === 0) {
            return res.status(404).json({ error: "No se encontró el detalle del pedido." });
        }

        const { id_comprador, nombre_producto } = consultaPedido.rows[0];

        // 2. Ejecutamos la actualización de la cita
        await pool.query(
            `UPDATE pedidos 
             SET fecha_entrega = $1, hora_entrega = $2, lugar_entrega = $3, estado_pedido = 'confirmado' 
             WHERE id_pedido = $4`,
            [fecha, hora, lugar, id_pedido]
        );

        // 3. MENSAJE PERSONALIZADO: Ahora incluye el nombre del producto
        const mensajeComprador = `¡Cita agendada! Tu entrega de "${nombre_producto}" es el ${fecha} a las ${hora} en ${lugar}.`;

        // 4. Insertar en la tabla de notificaciones
        await pool.query(
            'INSERT INTO notificaciones (id_usuario, tipo_notificacion, mensaje, leida) VALUES ($1, $2, $3, $4)',
            [id_comprador, 'cita_confirmada', mensajeComprador, false]
        );

        // 5. Emitir por Socket.io para la alerta instantánea
        io.emit(`notificacion_${id_comprador}`, {
            mensaje: mensajeComprador,
            id_pedido: id_pedido
        });

        res.json({ success: true, message: "Comprador notificado con éxito." });

    } catch (error) {
        console.error("Error al procesar la cita:", error.message);
        res.status(500).json({ error: "Error interno del servidor" });
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

// ------------ RUTA ÚNICA PARA PETICIÓN DE COMPRA ------------
app.post('/api/pedidos/crear-peticion', async (req, res) => {
    const { id_comprador, id_producto, cantidad, total, metodo_pago, lugar_entrega } = req.body;

    const client = await pool.connect(); // Usamos un cliente para la transacción

    try {
        await client.query('BEGIN'); // Iniciamos la transacción

        // 1. Buscamos al vendedor del producto
        const productoInfo = await client.query(
            'SELECT id_usuario_vendedor, precio FROM productos WHERE id_producto = $1',
            [id_producto]
        );

        if (productoInfo.rows.length === 0) {
            throw new Error("Producto no encontrado");
        }

        const id_vendedor = productoInfo.rows[0].id_usuario_vendedor;
        const precio_unitario = productoInfo.rows[0].precio;

        // 2. Insertamos en la tabla 'pedidos' (Maestro)
        const queryPedido = `
            INSERT INTO pedidos (
                id_comprador, id_vendedor, total_pedido, estado_pedido, 
                metodo_pago, lugar_entrega, fecha_pedido
            ) VALUES ($1, $2, $3, 'pendiente', $4, $5, CURRENT_TIMESTAMP)
            RETURNING id_pedido
        `;
        const resPedido = await client.query(queryPedido, [
            id_comprador, id_vendedor, total, metodo_pago, lugar_entrega
        ]);

        const id_pedido_generado = resPedido.rows[0].id_pedido;

        // 3. Insertamos en 'detalle_pedido' (Detalle)
        const queryDetalle = `
            INSERT INTO detalle_pedido (
                id_pedido, id_producto, cantidad, precio_unitario
            ) VALUES ($1, $2, $3, $4)
        `;
        await client.query(queryDetalle, [
            id_pedido_generado, id_producto, cantidad || 1, precio_unitario
        ]);

        await client.query('COMMIT'); // Guardamos todos los cambios

        // 1. Obtenemos el nombre del producto (ya lo tenemos de la consulta inicial o hacemos una rápida)
        const nombreProductoRes = await client.query(
            'SELECT nombre_producto FROM productos WHERE id_producto = $1',
            [id_producto]
        );
        const nombreProducto = nombreProductoRes.rows[0].nombre_producto;

        const mensajeVendedor = `¡Nueva petición! Alguien quiere comprar tu ${nombreProducto}.`;

        // 2. Guardar en la tabla de notificaciones
        await pool.query(
            'INSERT INTO notificaciones (id_usuario, tipo_notificacion, mensaje, leida) VALUES ($1, $2, $3, $4)',
            [id_vendedor, 'nuevo_pedido', mensajeVendedor, false]
        );

        // 3. Emitir por Socket.io en tiempo real
        io.emit(`notificacion_${id_vendedor}`, {
            mensaje: mensajeVendedor,
            id_pedido: id_pedido_generado
        });

        res.status(201).json({
            success: true,
            id_pedido: id_pedido_generado
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Si algo falla, deshacemos todo
        console.error("Error en la transacción:", error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release(); // Liberamos el cliente
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



//------------ SERVIDOR Y SOCKET.IO------------
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

initializeDatabase().then(() => {
    server.listen(port, () => {
        console.log(`🚀 Servidor en puerto ${port}`);
    });
});