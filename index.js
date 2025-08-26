import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
//Supabase
import { createClient } from '@supabase/supabase-js'
//servidor
const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();

//Rutas del backend
import servicio_comunitario from './server/rutas/servicio-comunitario.js';
import trabajo_de_grado from './server/rutas/trabajo-de-grado.js';
import proyectos_eliminados from './server/rutas/proyectos_eliminados.js';
import proyectos from './server/rutas/proyectos.js';
import pasantias from './server/rutas/pasantias.js';
import home from './server/rutas/home.js';

const PORT = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas.');
    process.exit(1); 
}
const supabase = createClient(supabaseUrl, supabaseKey)

app.listen(PORT);
console.log(`Server running on port ${PORT}`);

//Configuracion
app.use(express.static(__dirname + "/public"));

//Rutas
app.get("/", (req, res) => res.sendFile(__dirname + "/public/views/index.html"));
app.get("/home", (req, res) => res.sendFile(__dirname + "/public/views/home.html"));
app.get("/servicio-comunitario", (req, res) => res.sendFile(__dirname + "/public/views/servicio-comunitario.html"));
app.get("/registro", (req, res) => res.sendFile(__dirname + "/public/views/registro.html"));
app.get("/proyectos-eliminados", (req, res) => res.sendFile(__dirname + "/public/views/proyectos-eliminados.html"));
app.get("/trabajo-de-grado", (req, res) => res.sendFile(__dirname + "/public/views/trabajo-de-grado.html"));
app.get("/proyectos", (req, res) => res.sendFile(__dirname + "/public/views/proyectos.html"));
app.get("/comprobante-proyecto-investigacion", (req, res) => res.sendFile(__dirname + "/public/views/comprobante-proyecto-investigacion.html"));
app.get("/pasantias", (req, res) => res.sendFile(__dirname + "/public/views/pasantias.html"));
app.use('/api', servicio_comunitario);
app.use('/api', trabajo_de_grado);
app.use('/api', proyectos_eliminados);
app.use('/api', proyectos);
app.use('/api', pasantias);
app.use('/api', home);
//consulta
app.get('/usuarios', async (req, res) => {
    try {
        // CORRECCIÓN: Cambia 'usuarios' a 'users' para que coincida con el nombre de tu tabla en Supabase

        let { data: login, error } = await supabase
            .from('login')
            .select('*');


        if (error) {
            console.error('Error al obtener usuarios de Supabase:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener usuarios.' });
        }
        res.json(login);
    } catch (error) {
        console.error('Error en la ruta /usuarios:', error.message);
        res.status(500).send('Error interno del servidor.');
    }
});

//Rutas del login 
// Ruta de registro de usuarios
app.post('/api/register', async (req, res) => {
    try {
        const { cedula, nombreCompleto, correo, contraseña, rol } = req.body;

        // --- 1. Validación de campos vacíos ---
        if (!cedula || !nombreCompleto || !correo || !contraseña || !rol) {
            return res.status(400).json({ error: 'Faltan campos obligatorios: cédula, nombre completo, correo, contraseña, rol.' });
        }

        // --- 2. Validación de formato de Cédula (solo números, 7-10 dígitos) ---
        const cedulaRegex = /^[0-9]{7,10}$/;
        if (!cedulaRegex.test(cedula)) {
            return res.status(400).json({ error: 'Formato de cédula inválido. Debe contener solo números y tener entre 7 y 10 dígitos.' });
        }

        // --- 3. Validación de formato de Nombre Completo (solo letras y espacios) ---
        const nombreRegex = /^[A-Za-z\sñÑáéíóúÁÉÍÓÚ]+$/;
        if (!nombreRegex.test(nombreCompleto)) {
            return res.status(400).json({ error: 'Formato de nombre completo inválido. Debe contener solo letras y espacios.' });
        }

        // --- 4. Validación de la fortaleza de la Contraseña ---
        // Al menos 7 caracteres, una mayúscula, una minúscula, un número y un carácter especial.
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._-])[A-Za-z\d@$!%*?&._-]{7,}$/;
        if (!passwordRegex.test(contraseña)) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 7 caracteres, incluyendo una mayúscula, una minúscula, un número y un carácter especial (ej. @$!%*?&._-).' });
        }

        // --- 5. Verificar si la Cédula ya existe en la tabla 'administrador' ---
        const { data: existingCedula, error: cedulaCheckError } = await supabase
            .from('administrador')
            .select('cedula')
            .eq('cedula', cedula);

        if (cedulaCheckError) {
            console.error('Error al verificar cédula en Supabase:', cedulaCheckError.message);
            return res.status(500).json({ error: 'Error interno del servidor al verificar cédula.' });
        }
        if (existingCedula && existingCedula.length > 0) {
            return res.status(409).json({ error: 'Esta cédula ya está registrada en el sistema.' });
        }

        // --- 6. Verificar si el Correo ya existe en la tabla 'login' (Supabase ya maneja UNIQUE, pero es bueno tener una verificación previa) ---
        // Aunque Supabase devolverá un error 23505, esta verificación puede dar un mensaje más directo.
        const { data: existingCorreoLogin, error: correoLoginCheckError } = await supabase
            .from('login')
            .select('correo')
            .eq('correo', correo);

        if (correoLoginCheckError) {
            console.error('Error al verificar correo en tabla login (pre-insert):', correoLoginCheckError.message);
            return res.status(500).json({ error: 'Error interno del servidor al verificar correo.' });
        }
        if (existingCorreoLogin && existingCorreoLogin.length > 0) {
            return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
        }

        // --- 7. Hashear la contraseña ---
        const hashedPassword = await bcrypt.hash(contraseña, 10);

        // --- 8. Insertar en la tabla 'login' ---
        const { data: loginData, error: loginError } = await supabase
            .from('login')
            .insert([
                { correo: correo, contraseña: hashedPassword, rol: rol }
            ])
            .select('id_login');

        if (loginError) {
            // Este error ya no debería ocurrir si el chequeo previo de correo fue exitoso
            // pero lo mantenemos para cualquier caso inesperado.
            if (loginError.code === '23505') {
                return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
            }
            console.error('Error al registrar usuario en tabla login:', loginError.message);
            return res.status(500).json({ error: 'Error interno del servidor al registrar usuario en login.' });
        }

        if (!loginData || loginData.length === 0) {
            console.error('La inserción en login fue exitosa pero Supabase no devolvió datos.');
            return res.status(500).json({ error: 'Registro exitoso en login pero no se pudieron obtener los datos.' });
        }

        const idLogin = loginData[0].id_login;

        // --- 9. Insertar en la tabla 'administrador' ---
        const { data: adminData, error: adminError } = await supabase
            .from('administrador')
            .insert([
                {
                    cedula: cedula,
                    nombre_completo: nombreCompleto,
                    correo: correo,
                    id_login: idLogin
                }
            ])
            .select();

        if (adminError) {
            console.error('Error al registrar administrador en Supabase:', adminError.message);
            // Si la inserción en 'administrador' falla, se recomienda hacer un "rollback"
            // eliminando el registro de 'login' para evitar inconsistencias.
            await supabase.from('login').delete().eq('id_login', idLogin); // ROLLBACK
            return res.status(500).json({ error: 'Error interno del servidor al registrar administrador. Se ha revertido el registro de usuario.' });
        }

        res.status(201).json({ message: 'Usuario y administrador registrados exitosamente.', user: loginData[0], admin: adminData[0] });

    } catch (error) {
        console.error('Error en la ruta /api/register:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});



// Ruta de inicio de sesión de usuarios
app.post('/api/login', async (req, res) => {
    try {
        const { correo, contraseña } = req.body;

        // Validación básica
        if (!correo || !contraseña) {
            return res.status(400).json({ error: 'Faltan campos: correo y contraseña.' });
        }

        // Busca al usuario por correo electrónico en la tabla 'login'
        const { data, error } = await supabase
            .from('login')
            .select('id_login, correo, contraseña, rol') // Selecciona las columnas que necesitas
            .eq('correo', correo)
            .single(); // Espera un solo resultado

        if (error && error.details.includes('0 rows')) {
            // Si no se encuentra el usuario, Supabase devuelve un error con '0 rows' en details
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        } else if (error) {
            console.error('Error al buscar usuario en Supabase:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
        }

        if (!data) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // Compara la contraseña proporcionada con la contraseña hasheada de la base de datos
        const isPasswordValid = await bcrypt.compare(contraseña, data.contraseña);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // Si las credenciales son válidas, puedes devolver el rol del usuario
        // y cualquier otra información que necesites en el frontend
        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            user: {
                id_login: data.id_login,
                correo: data.correo,
                rol: data.rol
            }
        });

    } catch (error) {
        console.error('Error en la ruta /api/login:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

//Ruta de prueba para traer los estudiantes
app.get('/api/estudiantes', async (req, res) => {
    try{
        let { data: estudiante, error } = await supabase
            .from('estudiante')
            .select('*');

        if (error) {
            console.error('Error al obtener estudiantes de Supabase:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener estudiantes.' });
        }

        res.status(200).json(estudiante);
    } catch (error) {
        console.error('Error en la ruta /estudiantes:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});