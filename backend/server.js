<<<<<<< Updated upstream:sandbox (1)/server.js

// Dependencias
=======
// =======================================================
// CONFIGURACIÓN DE FIREBASE ADMIN SDK
// =======================================================
const admin = require('firebase-admin');

// ¡IMPORTANTE! Reemplaza 'ruta/a/tu/archivo-de-credenciales.json'
// con la ruta real de tu clave de servicio descargada de la consola de Firebase.
const serviceAccount = require('./ruta/a/tu/archivo-de-credenciales.json'); 

admin.initializeApp({
 credential: admin.credential.cert(serviceAccount)
 // Puedes añadir databaseURL si usas Realtime Database, pero aquí no es necesario
});
console.log('✅ Firebase Admin SDK inicializado.');
// =======================================================
// CONFIGURACIÓN DE DEPENDENCIAS Y SERVIDOR EXPRESS
// =======================================================
>>>>>>> Stashed changes:backend/server.js
const express = require('express');
const mysql = require('mysql2/promise'); // Usaremos la versión con promesas para async/await
const cors = require('cors');
const multer = require('multer'); // Nuevo: Para manejar la carga de archivos
const path = require('path');   // Nuevo: Para manejar rutas de archivos

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Permite peticiones desde el Frontend
app.use(express.json()); // Permite que Express lea JSON en el body de las peticiones

// Nuevo: Servir archivos estáticos (para que el Frontend pueda ver las imágenes)
// Esto hace que http://localhost:3000/uploads/nombre_archivo.jpg funcione
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Configuración de la Base de Datos (Asegúrate de que coincida con tu XAMPP) ---
const dbConfig = {
    host: 'localhost',
    user: 'root', // Usuario por defecto de XAMPP
    password: '', // Contraseña por defecto de XAMPP
    database: 'teschibazar', // ¡Tu base de datos!
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool; // La conexión a la base de datos

// Función para inicializar la conexión
async function initializeDatabase() {
    try {
        pool = await mysql.createPool(dbConfig);
        const connection = await pool.getConnection();
        connection.release(); // Libera la conexión de vuelta al pool
        console.log('✅ Conexión a MySQL exitosa!');
    } catch (err) {
        console.error('❌ Error al conectar con MySQL:', err.message);
        process.exit(1); // Sale de la aplicación si no se puede conectar
    }
}

// --- Configuración de MULTER (Carga de Imágenes) ---

// 1. Configuración de Almacenamiento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Guarda los archivos en la carpeta 'uploads' (¡debe existir!)
        cb(null, path.join(__dirname, 'uploads')); 
    },
    filename: (req, file, cb) => {
        // Genera un nombre de archivo único para evitar colisiones
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// 2. Instancia de Multer
const upload = multer({ storage: storage });

// =================================================================
// RUTAS DE LA API
// =================================================================

// 🚀 RUTA 1: POST - Insertar un nuevo producto con imagen
// Usamos upload.single('imagen') donde 'imagen' debe ser el 'name' del input de archivo en el Frontend
app.post('/api/productos/insertar', upload.single('imagen'), async (req, res) => {
    // Los datos de texto están en req.body
    const { id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado } = req.body;

    // La información del archivo subido está en req.file
    const imagen_url = req.file ? '/uploads/' + req.file.filename : null; 

    // Validación mínima (¡ajustar según tus necesidades!)
    if (!id_usuario_vendedor || !nombre_producto || !precio || !imagen_url) {
        // Si la imagen o algún campo clave falta, responde con un error 400
        return res.status(400).json({ mensaje: 'Faltan datos requeridos (incluyendo la imagen).' });
    }

    // Consulta SQL: Ahora incluye la columna imagen_url
    const sql = "INSERT INTO productos (id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado, imagen_url) VALUES (?, ?, ?, ?, ?, ?, ?)";
    
    try {
        const [result] = await pool.query(sql, [id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado, imagen_url]);
        
        res.status(201).json({ 
            mensaje: 'Producto insertado con éxito', 
            id_producto: result.insertId,
            ruta_imagen: imagen_url
        });
    } catch (err) {
        console.error('Error al insertar producto:', err);
        // Borrar el archivo si la inserción en DB falla
        if (req.file) {
             const fs = require('fs');
             fs.unlinkSync(req.file.path); 
        }
        res.status(500).json({ error: 'Error interno del servidor al insertar producto.' });
    }
});


<<<<<<< Updated upstream:sandbox (1)/server.js
// 📚 RUTA 2: GET - Obtener todos los productos
app.get('/api/productos', async (req, res) => {
    const sql = "SELECT * FROM productos";
    
    try {
        const [rows] = await pool.query(sql); // rows contiene el resultado de la consulta
        res.json(rows);
    } catch (err) {
        console.error('Error al consultar productos:', err);
        res.status(500).json({ error: 'Error al obtener datos de la base de datos.' });
    }
});


// =================================================================
// INICIO DEL SERVIDOR
// =================================================================

// Inicializa la base de datos y luego inicia el servidor web
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Servidor Node.js corriendo en http://localhost:${port}`);
    });
=======
// =======================================================
// INICIAR SERVIDOR HTTP Y WEBSOCKETS (CHAT)
// =======================================================
const http = require('http'); // Módulo nativo de Node.js
const { Server } = require('socket.io'); // Importar Socket.IO

// 1. Crear el servidor HTTP usando Express
const server = http.createServer(app); 

// 2. Montar Socket.IO sobre el servidor HTTP
const io = new Server(server, {
  // Configuración de CORS para Socket.IO (necesario si el frontend corre en otro puerto)
  cors: {
    origin: "*", // Permite cualquier origen (puedes ajustarlo a tu frontend)
    methods: ["GET", "POST"]
  }
});

// Objeto global en memoria para registrar usuarios y sus sockets (el mapa de observadores)
const usuariosConectados = {}; 

// --- LÓGICA DE WEBSOCKETS (SOCKET.IO) ---
io.on('connection', (socket) => {
  console.log(`Un usuario se ha conectado: ${socket.id}`);

  // Evento para registrar el usuario al conectarse
  socket.on('client:registrar_usuario', (userId) => {
    usuariosConectados[userId] = socket.id;
    console.log(`Usuario ${userId} registrado con socket ${socket.id}`);
  });
  
  // Aquí irá la función principal del chat (El Sujeto/Observable)
  // socket.on('client:enviar_mensaje', async (data) => { ... });

  socket.on('disconnect', () => {
    // Eliminar el usuario de la lista al desconectarse
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

// Llama a la función de prueba de conexión y luego inicia el servidor combinado
testDbConnection().then(() => {
  server.listen(port, () => {
    console.log(`Servidor Express/Socket.IO corriendo en http://localhost:${port}`);
   });
>>>>>>> Stashed changes:backend/server.js
});