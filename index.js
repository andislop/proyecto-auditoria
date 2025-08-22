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
app.use('/api', servicio_comunitario);
app.use('/api', trabajo_de_grado);
app.use('/api', proyectos_eliminados);
app.use('/api', proyectos);
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
        const { correo, contraseña, rol } = req.body;

        // Validación básica
        if (!correo || !contraseña || !rol) {
            return res.status(400).json({ error: 'Faltan campos obligatorios: correo, contraseña, rol.' });
        }

         // Hashear la contraseña antes de guardarla en la base de datos
                const hashedPassword = await bcrypt.hash(contraseña, 10); 

                // Inserta el nuevo usuario en la tabla 'login'
                // Agregamos .select() para asegurar que nos devuelva los datos del registro
                const { data, error } = await supabase
                    .from('login')
                    .insert([
                        { correo: correo, contraseña: hashedPassword, rol: rol }
                    ])
                    .select(); // <--- AÑADE ESTO: Esto asegura que Supabase devuelva los datos del registro insertado

                if (error) {
                    // Manejo de errores específicos, por ejemplo, si el correo ya existe
                    if (error.code === '23505') { // Código de error para violaciones de unicidad en PostgreSQL
                        return res.status(409).json({ error: 'El correo ya está registrado.' });
                    }
                    console.error('Error al registrar usuario en Supabase:', error.message);
                    return res.status(500).json({ error: 'Error interno del servidor al registrar usuario.' });
                }

                // Verifica si data es null o vacío antes de intentar acceder a data[0]
                if (!data || data.length === 0) {
                    console.error('La inserción fue exitosa pero Supabase no devolvió datos.');
                    return res.status(500).json({ error: 'Registro exitoso pero no se pudieron obtener los datos del usuario.' });
                }

                // No devolver la contraseña hasheada en la respuesta
                res.status(201).json({ message: 'Usuario registrado exitosamente.', user: data[0] });

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