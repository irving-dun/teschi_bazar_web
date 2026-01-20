//------------ CONFIGURACIÓN DE DEPENDENCIAS Y MÓDULOS ------------
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

// INICIALIZACIÓN DE IO AL PRINCIPIO PARA EVITAR ERRORES DE REFERENCIA
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const port = process.env.PORT || 3000;

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
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : undefined,
};

if (!admin.apps.length) {
    try {
        admin.initializeApp({ credential: admin.credential.cert(firebaseConfig) });
        console.log("✅ Firebase inicializado");
    } catch (error) {
        console.error("❌ Error Firebase:", error.message);
    }
}

//------------ CONFIGURACIÓN DE MULTER ------------
const storage = multer.memoryStorage(); 
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

//------------ CONFIGURACIÓN DE LA BASE DE DATOS ------------
const DATABASE_URL_LOCAL = "postgresql://irving:yXev9G4u5zJjlXflwDddN9e4jM7kKot8@dpg-d5lg2bfgi27c738salog-a.virginia-postgres.render.com/teschibazar_ic6m";

const dbConfig = {
    connectionString: process.env.DATABASE_URL || DATABASE_URL_LOCAL,
    ssl: { rejectUnauthorized: false }
};

let pool;
async function initializeDatabase() {
    try {
        pool = new Pool(dbConfig);
        const client = await pool.connect();
        client.release();
        console.log('✅ PostgreSQL conectado');
    } catch (err) {
        console.error('❌ Error DB:', err.message);
        process.exit(1);
    }
}

//------------ RUTAS DE LA API ------------

app.get('/api/productos/:id', async (req, res) => {
    const sql = `
        SELECT p.*, i.url_imagen, c.nombre_categoria 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE p.id_producto = $1
    `;
    try {
        const result = await pool.query(sql, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No existe' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// RUTA: Insertar nuevo producto (CORREGIDA)
app.post('/api/productos/insertar', upload.array('imagen', 3), async (req, res) => {
    const {
        nombre_producto, descripcion, id_categoria,
        estado_producto, disponibilidad, precio,
        id_usuario_vendedor, nombre_vendedor, ubicacion_entrega
    } = req.body;

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        await client.query(
            `INSERT INTO usuarios (id_usuario, nombre) 
             VALUES ($1, $2) ON CONFLICT (id_usuario) DO NOTHING`,
            [id_usuario_vendedor, nombre_vendedor || "Usuario"]
        );

        // MODIFICACIÓN: Conversión de tipos para evitar Error 500
        const resProd = await client.query(
            `INSERT INTO productos (nombre_producto, descripcion, id_categoria, estado_producto, disponibilidad, precio, id_usuario_vendedor, ubicacion_entrega) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_producto`,
            [
                nombre_producto, 
                descripcion, 
                parseInt(id_categoria), 
                estado_producto.toLowerCase().trim(), // Para el ENUM
                parseInt(disponibilidad) || 1, 
                parseFloat(precio), 
                id_usuario_vendedor, 
                ubicacion_entrega
            ]
        );

        const id_producto = resProd.rows[0].id_producto;

        // Lógica para múltiples imágenes
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const uploadToCloudinary = () => {
                    return new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            { folder: 'teschibazar_productos' },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result.secure_url);
                            }
                        );
                        stream.end(file.buffer);
                    });
                };

                const url_img = await uploadToCloudinary();
                await client.query(
                    'INSERT INTO imagenes_producto (id_producto, url_imagen) VALUES ($1, $2)',
                    [id_producto, url_img]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, id: id_producto });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error al insertar:", err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

app.get('/api/productos/categoria/:id', async (req, res) => {
    const sql = `
        SELECT p.*, i.url_imagen 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        WHERE p.id_categoria = $1
        ORDER BY p.fecha_publicacion DESC
    `;
    try {
        const result = await pool.query(sql, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al filtrar.' });
    }
});

app.get('/api/productos', async (req, res) => {
    const sql = "SELECT * FROM productos ORDER BY fecha_publicacion DESC";
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener datos.' });
    }
});

app.get('/api/buscar', async (req, res) => {
    const { q } = req.query;
    const sql = `
        SELECT p.*, i.url_imagen 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        WHERE p.nombre_producto ILIKE $1 OR p.descripcion ILIKE $1
        ORDER BY p.fecha_publicacion DESC
    `;
    try {
        const result = await pool.query(sql, [`%${q}%`]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error en búsqueda.' });
    }
});

app.get('/api/notificaciones/:idUsuario', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM notificaciones WHERE id_usuario = $1 ORDER BY fecha_creacion DESC LIMIT 10',
            [req.params.idUsuario]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error notificaciones" });
    }
});

app.get('/api/vendedor/pedidos/todos/:idVendedor', async (req, res) => {
    try {
        const query = `
            SELECT p.id_pedido, p.id_comprador, p.total_pedido, p.estado_pedido, 
                   p.fecha_entrega, p.hora_entrega, p.lugar_entrega, pr.nombre_producto, dp.cantidad
            FROM pedidos p
            JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
            JOIN productos pr ON dp.id_producto = pr.id_producto
            WHERE pr.id_usuario_vendedor = $1
            ORDER BY p.id_pedido DESC
        `;
        const result = await pool.query(query, [req.params.idVendedor]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error pedidos" });
    }
});

app.put('/api/pedidos/confirmar-cita', async (req, res) => {
    const { id_pedido, fecha, hora, lugar } = req.body;
    try {
        const consulta = await pool.query(
            `SELECT p.id_comprador, pr.nombre_producto 
             FROM pedidos p
             JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
             JOIN productos pr ON dp.id_producto = pr.id_producto
             WHERE p.id_pedido = $1`, [id_pedido]);

        const { id_comprador, nombre_producto } = consulta.rows[0];
        await pool.query(`UPDATE pedidos SET fecha_entrega=$1, hora_entrega=$2, lugar_entrega=$3, estado_pedido='confirmado' WHERE id_pedido=$4`, [fecha, hora, lugar, id_pedido]);

        const msg = `¡Cita agendada! Tu "${nombre_producto}" es el ${fecha} a las ${hora}.`;
        await pool.query('INSERT INTO notificaciones (id_usuario, tipo_notificacion, mensaje, leida) VALUES ($1, $2, $3, false)', [id_comprador, 'cita_confirmada', msg]);

        io.emit(`notificacion_${id_comprador}`, { mensaje: msg, id_pedido });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/pedidos/finalizar/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const detalle = await client.query('SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = $1', [req.params.id]);
        for (const fila of detalle.rows) {
            await client.query('UPDATE productos SET disponibilidad = disponibilidad - $1 WHERE id_producto = $2', [fila.cantidad, fila.id_producto]);
        }
        await client.query("UPDATE pedidos SET estado_pedido = 'entregado' WHERE id_pedido = $1", [req.params.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

app.post('/api/pedidos/crear-peticion', async (req, res) => {
    const { id_comprador, id_producto, cantidad, total, metodo_pago, lugar_entrega } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const prodInfo = await client.query('SELECT id_usuario_vendedor, precio, nombre_producto FROM productos WHERE id_producto = $1', [id_producto]);
        const { id_usuario_vendedor, precio, nombre_producto } = prodInfo.rows[0];

        const resPed = await client.query(`INSERT INTO pedidos (id_comprador, id_vendedor, total_pedido, estado_pedido, metodo_pago, lugar_entrega, fecha_pedido) VALUES ($1, $2, $3, 'pendiente', $4, $5, CURRENT_TIMESTAMP) RETURNING id_pedido`, [id_comprador, id_usuario_vendedor, total, metodo_pago, lugar_entrega]);
        const id_pedido = resPed.rows[0].id_pedido;

        await client.query(`INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)`, [id_pedido, id_producto, cantidad || 1, precio]);
        await client.query('COMMIT');

        const msgV = `¡Nueva petición! Alguien quiere tu ${nombre_producto}.`;
        await pool.query('INSERT INTO notificaciones (id_usuario, tipo_notificacion, mensaje, leida) VALUES ($1, $2, $3, false)', [id_usuario_vendedor, 'nuevo_pedido', msgV]);
        io.emit(`notificacion_${id_usuario_vendedor}`, { mensaje: msgV, id_pedido });

        res.status(201).json({ success: true, id_pedido });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally { client.release(); }
});

app.get('/api/productos-destacados', async (req, res) => {
    const sql = `
        SELECT p.id_producto, p.nombre_producto, p.precio, i.url_imagen, COUNT(ped.id_pedido) as ventas 
        FROM productos p
        INNER JOIN imagenes_producto i ON p.id_producto = i.id_producto
        INNER JOIN detalle_pedido dp ON p.id_producto = dp.id_producto
        INNER JOIN pedidos ped ON dp.id_pedido = ped.id_pedido
        WHERE ped.estado_pedido = 'entregado' GROUP BY p.id_producto, i.url_imagen ORDER BY ventas DESC LIMIT 12`;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error destacados' });
    }
});

initializeDatabase().then(() => {
    server.listen(port, () => console.log(`🚀 Servidor en puerto ${port}`));
});