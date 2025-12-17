

// =======================================================
// CONFIGURACIÓN DE DEPENDENCIAS Y MÓDULOS
// =======================================================
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const fs = require('fs'); 

const app = express();
const port = process.env.PORT || 3000; 

// CÓDIGO A PEGAR (REEMPLAZANDO LAS LÍNEAS ANTERIORES)
// Middleware
app.use(cors());
app.use(express.json());

// --- Configuración de RUTAS DE ARCHIVOS ---
// Definir la ruta fuera de 'backend' y dentro de 'sandbox/uploads'
const UPLOADS_DIR = path.join(__dirname, '..', 'sandbox', 'uploads'); 

// Asegurarse de que el directorio existe
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware para servir las imágenes estáticas. La URL pública sigue siendo /uploads.
app.use('/uploads', express.static(UPLOADS_DIR));


// =======================================================
// CONFIGURACIÓN DE FIREBASE ADMIN SDK
// =======================================================

const serviceAccount = require('./adminsdk.json'); 

admin.initializeApp({
 credential: admin.credential.cert(serviceAccount)
});
console.log('✅ Firebase Admin SDK inicializado.');

// =======================================================
// UTILIDADES DE SEGURIDAD
// =======================================================

async function verificarTokenFirebase(idToken) {
 try {
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid;
 } catch (error) {
  console.error('Error al verificar el token de Firebase:', error.message);
  throw new Error("Token de autenticación inválido o expirado.");
 }
}

// =======================================================
// CONFIGURACIÓN DE LA BASE DE DATOS (PostgreSQL para Render)
// =======================================================

// ⚠️ NOTA DE SEGURIDAD:
// En producción (Render), se recomienda usar solo process.env.DATABASE_URL.
// Para el desarrollo local, puedes definir las credenciales directamente aquí.

// ----------------------------------------------------------------------------------------------------------------------------------------
// CÓMO OBTENER TU CADENA DE CONEXIÓN:
// 1. Ve a tu base de datos en Render.
// 2. Copia la "External Connection String" (Cadena de Conexión Externa).
//    Debe lucir algo así: postgresql://irving:TU_PASSWORD_SECRETA@dpg-d4vnjfhr0fns739p88l0-a.virginia-postgres.render.com:5432/teschibazar
// ----------------------------------------------------------------------------------------------------------------------------------------
const DATABASE_URL_LOCAL = "postgresql://irving:4jsZSjNG0ZaqCNw7zQQlvGjt7ibkbUMn@dpg-d4vnjfhr0fns739p88l0-a.virginia-postgres.render.com/teschibazar"; 
// ^^^ REEMPLAZA ESTA CADENA CON LA CADENA DE CONEXIÓN EXTERNA COMPLETA DE RENDER ^^^

const dbConfig = {
    connectionString: process.env.DATABASE_URL || DATABASE_URL_LOCAL,
    // Esta configuración es la más compatible para Render desde local
    ssl: {
        rejectUnauthorized: false
    },
    // Añadimos esto para que no se cierre la conexión antes de tiempo
    connectionTimeoutMillis: 5000, 
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
        // Ahora, si falla, es un error real de credenciales/conexión
        console.error('❌ Error al conectar con PostgreSQL:', err.message);
        process.exit(1); 
    }
}




const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });






// =================================================================
// UTILIDADES DE CHAT (PERSISTENCIA PostgreSQL)
// =================================================================

// Obtiene el vendedor de un producto
async function obtenerVendedor(idProducto) {
  const result = await pool.query(
    'SELECT id_usuario_vendedor FROM productos WHERE id_producto = $1',
    [idProducto]
  );
  if (result.rows.length === 0) throw new Error("Producto no encontrado.");
  return result.rows[0].id_usuario_vendedor;
}

// Obtiene o crea la conversación
async function obtenerOCrearConversacion(compradorId, vendedorId, productoId) {
  let result = await pool.query(
    `SELECT id_conversacion FROM conversaciones 
    WHERE id_comprador = $1 AND id_vendedor = $2 AND id_producto = $3`,
    [compradorId, vendedorId, productoId]
  );

  if (result.rows.length > 0) {
    return result.rows[0].id_conversacion;
  }

  const newResult = await pool.query(
    `INSERT INTO conversaciones (id_comprador, id_vendedor, id_producto) 
    VALUES ($1, $2, $3) RETURNING id_conversacion`,
    [compradorId, vendedorId, productoId]
  );
  return newResult.rows[0].id_conversacion;
}

// Guarda el mensaje y actualiza el timestamp (usa transacción)
async function guardarMensaje(conversacionId, remitenteId, contenido) {
  const client = await pool.connect(); 
  let nuevoMensaje = null;
  
  try {
    await client.query('BEGIN'); 

    const msgResult = await client.query(
      `INSERT INTO mensajes (id_conversacion, id_remitente, contenido) 
      VALUES ($1, $2, $3) RETURNING id_mensaje, fecha_envio`,
      [conversacionId, remitenteId, contenido]
    );
    
    await client.query(
      'UPDATE conversaciones SET ultimo_mensaje_at = CURRENT_TIMESTAMP WHERE id_conversacion = $1',
      [conversacionId]
    );

    await client.query('COMMIT'); 

    nuevoMensaje = { 
      id_mensaje: msgResult.rows[0].id_mensaje,
      id_conversacion: conversacionId,
      id_remitente: remitenteId,
      contenido: contenido,
      fecha_envio: msgResult.rows[0].fecha_envio
    };
    
    return nuevoMensaje;
    
  } catch (error) {
    await client.query('ROLLBACK'); 
    throw error; 
  } finally {
    client.release(); 
  }
}

// Obtiene el historial de mensajes para una conversación dada
async function obtenerMensajesPorConversacion(conversacionId) {
  const sql = `
 SELECT 
      id_mensaje, 
      id_remitente, 
      contenido, 
      fecha_envio,
      leido
    FROM mensajes
    WHERE id_conversacion = $1
    ORDER BY fecha_envio ASC;
  `;
  
  try {
    const result = await pool.query(sql, [conversacionId]);
    return result.rows;
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    throw new Error('No se pudo cargar el historial de mensajes.');
  }
}


// =================================================================
// RUTAS DE LA API (ADAPTADO A POSTGRESQL)
// =================================================================

// CÓDIGO A PEGAR (REEMPLAZANDO LA RUTA 1 COMPLETA)
// 🚀 RUTA 1: POST - Insertar un nuevo producto con imagen (Transaccional y seguro)
app.post('/api/productos/insertar', upload.single('imagen'), async (req, res) => {
    // Usamos los nombres de campos del HTML corregido: id_categoria, estado_producto, disponibilidad, ubicacion_entrega
    const { 
        id_usuario_vendedor, 
        nombre_producto, 
        descripcion, 
        precio, 
        id_categoria, 
        estado_producto, 
        disponibilidad, 
        ubicacion_entrega 
    } = req.body;
    
    // Obtener la URL pública de la imagen
    const imagen_url = req.file ? '/uploads/' + req.file.filename : null; 
    const client = await pool.connect();

    // Validación de campos requeridos
    if (!id_usuario_vendedor || !nombre_producto || !precio || !imagen_url || !id_categoria) {
        if (req.file) {
            fs.unlinkSync(req.file.path); 
        }
        return res.status(400).json({ mensaje: 'Faltan datos requeridos (usuario, nombre, precio, categoría o imagen).' });
    }

    try {
        await client.query('BEGIN'); // 1. Iniciar la transacción

        // 2. Inserción en la tabla PRODUCTOS
        const sqlProducto = `
            INSERT INTO productos 
            (id_usuario_vendedor, nombre_producto, descripcion, precio, id_categoria, estado_producto, disponibilidad, ubicacion_entrega) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING id_producto
        `;
        
        const resultProducto = await client.query(sqlProducto, [
            id_usuario_vendedor, 
            nombre_producto, 
            descripcion, 
            parseFloat(precio), 
            parseInt(id_categoria), 
            estado_producto, 
            parseInt(disponibilidad) || 1, 
            ubicacion_entrega
        ]);
        
        const id_producto = resultProducto.rows[0].id_producto;

        // 3. Inserción en la tabla IMAGENES_PRODUCTO
        const sqlImagen = `
            INSERT INTO imagenes_producto (id_producto, url_imagen, orden) 
            VALUES ($1, $2, 1)
        `;
        await client.query(sqlImagen, [id_producto, imagen_url]);

        await client.query('COMMIT'); // 4. Confirmar la transacción

        res.status(201).json({ 
            mensaje: 'Producto e imagen insertados con éxito', 
            id_producto: id_producto,
            ruta_imagen: imagen_url
        });

    } catch (err) {
        await client.query('ROLLBACK'); // 5. Revertir si hay error
        
        console.error('Error en la transacción al insertar producto:', err.message);
        
        // Si hay error, eliminar el archivo subido
        if (req.file) {
            fs.unlinkSync(req.file.path); 
        }

        res.status(500).json({ error: 'Error interno del servidor al insertar producto.', detail: err.message });
    } finally {
        client.release(); // 6. Liberar la conexión
    }
});

// 📚 RUTA 2: GET - Obtener todos los productos
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

// 💬 RUTA 3: GET - Obtener historial de mensajes de una conversación
app.get('/api/chat/:idConversacion', async (req, res) => {
  const idConversacion = parseInt(req.params.idConversacion);

  if (isNaN(idConversacion)) {
    return res.status(400).json({ error: 'El ID de la conversación debe ser un número válido.' });
  }

  try {
    // Mejorar: Añadir verificación de que el usuario que solicita es parte de la conversación
    const mensajes = await obtenerMensajesPorConversacion(idConversacion);
    
    res.json(mensajes);
  } catch (err) {
    console.error('Error al obtener historial de chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// =======================================================
// INICIAR SERVIDOR HTTP Y WEBSOCKETS (CHAT)
// =======================================================
const server = http.createServer(app); 

// Montar Socket.IO sobre el servidor HTTP
const io = new Server(server, {
 cors: {
  origin: "*",
  methods: ["GET", "POST"]
 }
});

const usuariosConectados = {}; 

// --- LÓGICA DE WEBSOCKETS (SOCKET.IO) ---
io.on('connection', (socket) => {
 console.log(`Un socket se ha conectado: ${socket.id}`);

 // 1. REGISTRO SEGURO (Usa el token para registrar el socket)
 socket.on('client:registrar_usuario', async ({ idToken, userId }) => {
  try {
   const uidVerificado = await verificarTokenFirebase(idToken);
   
   if (uidVerificado !== userId) {
    throw new Error("UID de token no coincide con el ID del usuario.");
   }

   usuariosConectados[uidVerificado] = socket.id;
   console.log(`✅ Usuario ${uidVerificado} registrado y verificado.`);

  } catch (error) {
   console.error(`❌ Fallo en registro de socket: ${error.message}`);
   socket.emit('server:auth_error', 'Autenticación fallida. Reconecte.');
   socket.disconnect(true);
  }
 });
 
 // 2. EL SUJETO/OBSERVABLE (El corazón del chat)
 socket.on('client:enviar_mensaje', async (data) => {
  try {
   const { idToken, remitenteId, productoId, contenido } = data; 
   
   // 2.1. SEGURIDAD: Re-verificar el remitente
   const uidVerificado = await verificarTokenFirebase(idToken);
   if (uidVerificado !== remitenteId) {
    throw new Error("Acceso denegado: Remitente falsificado.");
   }

   // 2.2. PERSISTENCIA: Guardar en PostgreSQL
   const vendedorId = await obtenerVendedor(productoId); 
   
   const mensajeGuardado = await guardarMensaje(
    await obtenerOCrearConversacion(remitenteId, vendedorId, productoId), 
    remitenteId, 
    contenido
   ); 

   // 2.3. NOTIFICACIÓN: A los Observadores (Vendedor y Comprador)
   const receptores = [vendedorId, remitenteId];
   
   receptores.forEach(userId => {
    const socketId = usuariosConectados[userId];
    if (socketId) {
     io.to(socketId).emit('server:nuevo_mensaje', mensajeGuardado);
    }
   });

  } catch (error) {
   console.error('Error en el Sujeto/Envío de mensaje:', error.message);
   socket.emit('server:error_mensaje', { error: 'No se pudo enviar el mensaje.' });
  }
 });

 // Lógica de desconexión
 socket.on('disconnect', () => {
  for (const userId in usuariosConectados) {
   if (usuariosConectados[userId] === socket.id) {
    delete usuariosConectados[userId];
    break;
   }
  }
  console.log(`Usuario desconectado: ${socket.id}`);
 });
});
// ------------------------------------------

// Inicializa la base de datos (pool) y luego inicia el servidor combinado (HTTP/Socket.IO)
initializeDatabase().then(() => {
 server.listen(port, () => {
  console.log(`Servidor Express/Socket.IO corriendo en http://localhost:${port}`);
 });
});