// =======================================================
// CONFIGURACIÓN DE DEPENDENCIAS Y SERVIDOR EXPRESS
// =======================================================
const express = require('express');
const mysql = require('mysql2/promise'); // Módulo de conexión a MySQL
const cors = require('cors'); // Para permitir peticiones desde el Frontend

const app = express();
const port = 3000; // El puerto donde correrá el servidor Node.js

// Middleware
app.use(cors()); // Habilita la comunicación entre tu frontend (localhost) y este backend (localhost:3000)
app.use(express.json()); // Permite a la API leer datos JSON enviados en el cuerpo (body) de las solicitudes POST

// =======================================================
// CONFIGURACIÓN DE LA BASE DE DATOS
// =======================================================
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Contraseña vacía por defecto de XAMPP
    database: 'teschibazar' // Nombre de tu base de datos
};

// Función para probar la conexión al inicio
async function testDbConnection() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión a MySQL exitosa!');
        await connection.end();
    } catch (error) {
        console.error('❌ Error al conectar a MySQL. Asegúrate de que XAMPP-MySQL esté corriendo.', error.message);
        process.exit(1); // Detiene el proceso si falla la conexión a la DB
    }
}

// =======================================================
// 1. API DE LECTURA (GET /api/productos) - Migrado de api_productos.php
// =======================================================
app.get('/api/productos', async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        // Ejecuta la consulta para obtener todos los productos
        const [rows] = await connection.execute('SELECT * FROM productos');
        
        // Envía el resultado como JSON
        res.json(rows); 
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener productos.' });
    } finally {
        if (connection) connection.end(); // Siempre cierra la conexión
    }
});

// =======================================================
// 2. API DE INSERCIÓN (POST /api/productos/insertar) - Migrado de api_insertar_producto.php
// =======================================================
app.post('/api/productos/insertar', async (req, res) => {
    let connection;
    
    // Desestructuración de los datos requeridos del body
    const { vendedor_uid, nombre, descripcion, precio, categoria_id, estado } = req.body;

    // Validación de datos
    if (!vendedor_uid || !nombre || !descripcion || !precio || !categoria_id || !estado) {
        return res.status(400).json({ error: 'Faltan datos requeridos.' });
    }

    try {
        connection = await mysql.createConnection(dbConfig);
        
        const sql = `
            INSERT INTO productos 
            (id_usuario_vendedor, nombre_producto, descripcion, precio, id_categoria, estado_producto, disponibilidad, fecha_publicacion) 
            VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
        `;

        // Ejecución de la consulta con Prepared Statements
        const [result] = await connection.execute(
            sql,
            [vendedor_uid, nombre, descripcion, precio, categoria_id, estado]
        );
        
        // Éxito: devolver el ID del producto insertado
        res.status(201).json({ 
            success: true, 
            mensaje: "Producto registrado con éxito!", 
            id_producto: result.insertId 
        });

    } catch (error) {
        console.error('Error al registrar producto:', error);
        res.status(500).json({ 
            success: false, 
            error: "Error interno del servidor al registrar producto." 
        });
    } finally {
        if (connection) connection.end(); 
    }
});


// =======================================================
// INICIAR SERVIDOR
// =======================================================

// Llama a la función de prueba de conexión y luego inicia el servidor
testDbConnection().then(() => {
    app.listen(port, () => {
        console.log(`Servidor Node.js corriendo en http://localhost:${port}`);
    });
});