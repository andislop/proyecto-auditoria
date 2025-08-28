import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import session from 'express-session';
import auditoriaRoutes, { registrarAuditoria } from './server/rutas/bitacora.js'
const __dirname = path.dirname(fileURLToPath(import.meta.url));
//Supabase
import { createClient } from '@supabase/supabase-js'
//servidor
const app = express();
app.use(express.json());
dotenv.config();


//Configuración del control de sesiones 
const allowedOrigins = [
    'http://localhost:3000', // Para desarrollo local
    'https://proyecto-auditoria.vercel.app/' // Reemplaza con tu dominio real de Vercel para el frontend
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir solicitudes sin origen (como de herramientas Postman/curl o para archivos estáticos)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'La política de CORS para este sitio no permite el acceso desde el Origen especificado.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true, // Esto es crucial para permitir que las cookies se envíen
    optionsSuccessStatus: 200 // Algunas versiones de navegadores pueden necesitar esto
}));
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-super-secret-key-for-sessions', // Clave secreta para firmar el cookie de sesión. ¡Cámbiala en tu .env!
    resave: false, // Evita que la sesión se guarde si no se modificó
    saveUninitialized: false, // Evita que se guarden sesiones sin inicializar
    cookie: {
        maxAge: 3600000, // Duración del cookie de sesión en milisegundos (1 hora)
        httpOnly: true, // Previene el acceso de JavaScript a la cookie
        // secure: true si se está en producción (HTTPS), false en desarrollo (HTTP)
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // 'none' para cross-site en prod, 'lax' para mismo sitio en dev
    }
}));


// =======================================================
// MIDDLEWARE DE AUTENTICACIÓN
// =======================================================
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/');
    }
}

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
app.get("/home", isAuthenticated, (req, res) => res.sendFile(__dirname + "/public/views/home.html"));
app.get("/servicio-comunitario", isAuthenticated, (req, res) => res.sendFile(__dirname + "/public/views/servicio-comunitario.html"));
app.get("/proyectos-eliminados", isAuthenticated, (req, res) => res.sendFile(__dirname + "/public/views/proyectos-eliminados.html"));
app.get("/trabajo-de-grado", isAuthenticated, (req, res) => res.sendFile(__dirname + "/public/views/trabajo-de-grado.html"));
app.get("/proyectos", isAuthenticated, (req, res) => res.sendFile(__dirname + "/public/views/proyectos.html"));
app.get("/comprobante-proyecto-investigacion", isAuthenticated, (req, res) => res.sendFile(__dirname + "/public/views/comprobante-proyecto-investigacion.html"));
app.get("/pasantias", isAuthenticated, (req, res) => res.sendFile(__dirname + "/public/views/pasantias.html"));
app.get("/bitacora", isAuthenticated, (req, res) => res.sendFile(__dirname + "/public/views/bitacora.html"));
// Rutas sin autenticación
app.get("/registro", (req, res) => res.sendFile(__dirname + "/public/views/registro.html"));

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
app.post("/api/login", async (req, res) => {
    try {
        const { correo, contraseña } = req.body;

        // Verifica si el usuario existe en la tabla `login`
        const { data, error } = await supabase
            .from('login')
            .select(`
                id_login,
                correo,
                contraseña,
                rol
            `)
            .eq('correo', correo)
            .single();

        if (error || !data) {
            // =======================================================
            // REGISTRO DE AUDITORÍA: Intento de inicio de sesión fallido (usuario no encontrado)
            // =======================================================
            await registrarAuditoria({
                id_login: null, // No hay un id_login válido si el usuario no fue encontrado
                modulo_afectado: 'Autenticación',
                accion_realizada: 'Intento de Inicio de Sesión Fallido',
                descripcion_detallada: `Intento de inicio de sesión con correo "${correo}" fallido: Usuario no encontrado.`,
            });
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // Compara la contraseña con la encriptada
        const isPasswordValid = await bcrypt.compare(contraseña, data.contraseña);

        if (!isPasswordValid) {
            // =======================================================
            // REGISTRO DE AUDITORÍA: Intento de inicio de sesión fallido (contraseña incorrecta)
            // =======================================================
            await registrarAuditoria({
                id_login: data.id_login, // Tenemos el id_login, pero la contraseña falló
                modulo_afectado: 'Autenticación',
                accion_realizada: 'Intento de Inicio de Sesión Fallido',
                descripcion_detallada: `Intento de inicio de sesión para usuario con ID ${data.id_login} y correo "${correo}" fallido: Contraseña incorrecta.`,
            });
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // =======================================================
        // CREAMOS LA SESIÓN DEL USUARIO AQUÍ
        // =======================================================
        req.session.user = {
            id: data.id_login,
            correo: data.correo,
            rol: data.rol
        };

        // =======================================================
        // REGISTRO DE AUDITORÍA: Inicio de sesión exitoso
        // =======================================================
        await registrarAuditoria({
            id_login: data.id_login,
            modulo_afectado: 'Autenticación',
            accion_realizada: 'Inicio de Sesión Exitoso',
            descripcion_detallada: `Usuario con ID ${data.id_login}, correo "${data.correo}" y rol "${data.rol}" inició sesión exitosamente.`,
        });

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
        // =======================================================
        // REGISTRO DE AUDITORÍA: Error interno del servidor durante el login
        // (Considera si quieres registrar detalles del error aquí, pero ten cuidado con información sensible)
        // =======================================================
        await registrarAuditoria({
            id_login: null, // No sabemos quién intentó iniciar sesión
            modulo_afectado: 'Autenticación',
            accion_realizada: 'Error Interno del Servidor',
            descripcion_detallada: `Error crítico durante el proceso de login. Mensaje: ${error.message}.`,
        });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Ruta para cerrar sesión (NUEVO)
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: "Error al cerrar la sesión." });
        }
        res.status(200).json({ message: "Sesión cerrada exitosamente." });
    });
});

//Ruta de prueba para traer los administradores
app.get('/api/administrador', async (req, res) => {
    try{
        let { data: administrador, error } = await supabase
            .from('administrador')
            .select('*');

        if (error) {
            console.error('Error al obtener administradores de Supabase:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener administradores.' });
        }

        res.status(200).json(administrador);
    } catch (error) {
        console.error('Error en la ruta /administrador:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Ruta para buscar proyectos por cédula
app.get("/api/buscar-proyectos/:cedula", async (req, res) => {
    const { cedula } = req.params;

    try {
        // Servicio Comunitario
        // Se une a la tabla 'integrantes' y luego a 'estudiante' para filtrar por la cédula.
        const { data: servicioComunitario, error: scError } = await supabase
            .from("servicio_comunitario")
            .select("id_servicio, proyecto, periodos: id_periodo(periodo), integrantes: integrantes!inner(id_estudiante!inner(cedula))")
            .eq("integrantes.id_estudiante.cedula", cedula);

        if (scError) console.error("Error servicio comunitario:", scError.message);

        // Trabajo de Grado
        const { data: trabajosGrado, error: tgError } = await supabase
            .from("trabajo_grado")
            .select("id_trabajo_grado, proyecto, periodos: id_periodo(periodo), estudiantes: id_estudiante(cedula), tutor:id_tutor(cedula)")
            .eq("estudiantes.cedula", cedula || "tutor.cedula", cedula);
            //Acomodar el tema de que no se muestren todos los datos y solo se muestre los datos relacionados
            //al estudiante o tutor

        if (tgError) console.error("Error trabajo de grado:", tgError.message);

        // Proyectos de Investigación
        const { data: proyectosInvestigacion, error: piError } = await supabase
            .from("proyectos_investigacion")
            .select("id_proyecto_investigacion, proyecto, periodos: id_periodo(periodo), estudiante: id_estudiante(cedula)")
            .eq("estudiante.cedula", cedula);

        if (piError) console.error("Error proyectos investigación:", piError.message);

        // Pasantías
        const { data: pasantias, error: paError } = await supabase
            .from("pasantia")
            .select("id_pasantia, titulo, periodos: id_periodo(periodo), estudiante: id_estudiante(cedula)")
            .eq("estudiante.cedula", cedula);

        if (paError) console.error("Error pasantías:", paError.message);

        // Respuesta agrupada
        res.json({
            servicioComunitario: servicioComunitario || [],
            trabajosGrado: trabajosGrado || [],
            proyectosInvestigacion: proyectosInvestigacion || [],
            pasantias: pasantias || [],
        });

    } catch (error) {
        console.error("Error en /buscar-proyectos:", error.message);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});



//Otras rutas
import servicio_comunitario from './server/rutas/servicio-comunitario.js';
import trabajo_de_grado from './server/rutas/trabajo-de-grado.js';
import proyectos_eliminados from './server/rutas/proyectos_eliminados.js';
import proyectos from './server/rutas/proyectos.js';
import pasantias from './server/rutas/pasantias.js';
import home from './server/rutas/home.js';
import bitacora from './server/rutas/bitacora.js'
app.use('/api', servicio_comunitario);
app.use('/api', trabajo_de_grado);
app.use('/api', proyectos_eliminados);
app.use('/api', proyectos);
app.use('/api', pasantias);
app.use('/api', home);
app.use('/api', bitacora);