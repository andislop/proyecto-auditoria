import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import jsonwebtoken from 'jsonwebtoken'; // Importamos jsonwebtoken
import auditoriaRoutes, { registrarAuditoria } from './server/rutas/bitacora.js'
import cookieParser from 'cookie-parser'; // Necesario para leer cookies

const __dirname = path.dirname(fileURLToPath(import.meta.url));
//Supabase
import { createClient } from '@supabase/supabase-js'
//servidor
const app = express();
app.use(express.json());
app.use(cookieParser()); // Activar cookieParser para que Express lea req.cookies

dotenv.config(); // Cargar variables de entorno

// Configuración de CORS
const allowedOrigins = [
  'http://localhost:3000',          // Desarrollo local
  /^https:\/\/.*\.vercel\.app$/     // Producción y previews de Vercel (regex para cualquier subdominio)
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.some(o => (o instanceof RegExp ? o.test(origin) : o === origin))) {
      return callback(null, true);
    }

    const msg = 'La política de CORS no permite el acceso desde este origen.';
    return callback(new Error(msg), false);
  },
  credentials: true,               // Necesario para enviar cookies
  optionsSuccessStatus: 200
}));


// =======================================================
// MIDDLEWARES DE AUTENTICACIÓN Y SESIÓN (Basado en JWT)
// =======================================================

// Middleware de autenticación JWT
function requireLogin(req, res, next) {
    const token = req.cookies.acceso_token; // Leer la cookie que contiene el JWT
    if (/^\/api\/publicas\/proyectos-comunitarios\/\d+\/datos-pdf$/.test(req.path)) {
    return next();
  }
    if (/^\/api\/publicas\/proyectos-investigacion\/\d+\/datos-pdf$/.test(req.path)) {
        return next();
    }
    if (/^\/api\/publicas\/pasantias\/\d+\/datos-pdf$/.test(req.path)) {
        return next();
    }
    if (/^\/api\/publicas\/trabajos-de-grado\/\d+\/datos-pdf$/.test(req.path)) {
        return next();
    }
    if (/^\/api\/recuperar-password$/.test(req.path)) {
        return next();
    }

    if (!token) {
        console.log('[requireLogin] No se encontró token, redirigiendo a /');
        return res.redirect('/'); // No autorizado, redirigir al login
    }

    try {
        // Verificar el token con la clave secreta
        const decodedUser = jsonwebtoken.verify(token, process.env.JWT_SECRET);
        req.user = decodedUser; // Adjuntar el usuario decodificado a req.user // Agregado para depuración
        next(); // Continuar a la siguiente función middleware/ruta
    } catch (err) {
        console.error("[requireLogin] Error al verificar o decodificar token:", err.message);
        // Si el token es inválido o expiró, eliminar la cookie y redirigir
        res.clearCookie("acceso_token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 3600000 // 1 hora
        });
        return res.redirect('/');
    }
}

// Middleware para obtener el id_login del usuario actual desde el JWT
// Este middleware ahora es más simple, ya que req.user ya debería estar disponible
function getUserIdFromSession(req, res, next) {
    // req.user ya debería contener el usuario decodificado por requireLogin
    req.currentUserIdLogin = req.user?.id || null; ; // Agregado para depuración
    next();
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

//Configuracion de la carpeta publica
app.use(express.static(__dirname + "/public"));

// Rutas
app.get("/", (req, res) => res.sendFile(__dirname + "/public/views/index.html"));
app.use('/api', publicas);
app.use('/api', recuperarContraseñas);
// =======================================================
// RUTAS PROTEGIDAS CON requireLogin y getUserIdFromSession
// =======================================================
app.get("/home", requireLogin, getUserIdFromSession, (req, res) => {
    console.log("Usuario actual ID en /home (ruta final):", req.currentUserIdLogin); // Debugging
    res.sendFile(path.join(__dirname, "/public/views/home.html"));
});
app.get("/proyectos-eliminados", requireLogin, getUserIdFromSession, (req, res) => res.sendFile(__dirname + "/public/views/proyectos-eliminados.html"));
app.get("/servicio-comunitario", requireLogin, getUserIdFromSession, (req, res) => res.sendFile(__dirname + "/public/views/servicio-comunitario.html"));
app.get("/trabajo-de-grado", requireLogin, getUserIdFromSession, (req, res) => res.sendFile(__dirname + "/public/views/trabajo-de-grado.html"));
app.get("/proyectos", requireLogin, getUserIdFromSession, (req, res) => res.sendFile(__dirname + "/public/views/proyectos.html"));
app.get("/comprobante-proyecto-investigacion", requireLogin, getUserIdFromSession, (req, res) => res.sendFile(__dirname + "/public/views/comprobante-proyecto-investigacion.html"));
app.get("/pasantias", requireLogin, getUserIdFromSession, (req, res) => res.sendFile(__dirname + "/public/views/pasantias.html"));
app.get("/bitacora", requireLogin, getUserIdFromSession, (req, res) => res.sendFile(__dirname + "/public/views/bitacora.html"));
app.get("/editar-perfil", requireLogin, getUserIdFromSession, (req, res) => res.sendFile(__dirname + "/public/views/editar-perfil.html"));
app.get("/admin", requireLogin, getUserIdFromSession, (req, res) => res.sendFile(__dirname + "/public/views/admin.html"));
// Rutas sin autenticación (registro y búsqueda)
app.get("/registro", (req, res) => res.sendFile(__dirname + "/public/views/registro.html"));
app.get("/recuperar-contrasenia", (req, res) => res.sendFile(__dirname + "/public/views/recuperar-contraseña.html"));


// Ruta para obtener información del usuario actual (útil para el frontend)
app.get("/api/me", (req, res) => {
    const token = req.cookies.acceso_token;
    if (!token) {
        return res.status(401).json({ error: "No hay sesión activa" });
    }

    try {
        const user = jsonwebtoken.verify(token, process.env.JWT_SECRET);
        return res.json({ user });
    } catch (error) {
        console.error("Error en /api/me:", error.message);
        // Si el token no es válido, asegúrate de que la cookie se borre en el cliente
        return res.status(401).json({ error: "Sesión inválida o expirada" });
    }
});


// Consulta de usuarios (ejemplo, si necesita autenticación, añade requireLogin)
app.get('/usuarios', async (req, res) => {
    try {
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

// Ruta de registro de usuarios
app.post('/api/register', async (req, res) => {
    try {
        const { cedula, nombreCompleto, correo, contraseña, rol } = req.body;

        // Validaciones... (tu código actual de validación está bien aquí)
        if (!cedula || !nombreCompleto || !correo || !contraseña || !rol) {
            return res.status(400).json({ error: 'Faltan campos obligatorios: cédula, nombre completo, correo, contraseña, rol.' });
        }
        const cedulaRegex = /^[0-9]{7,10}$/;
        if (!cedulaRegex.test(cedula)) {
            return res.status(400).json({ error: 'Formato de cédula inválido. Debe contener solo números y tener entre 7 y 10 dígitos.' });
        }
        const nombreRegex = /^[A-Za-z\sñÑáéíóúÁÉÍÓÚ]+$/;
        if (!nombreRegex.test(nombreCompleto)) {
            return res.status(400).json({ error: 'Formato de nombre completo inválido. Debe contener solo letras y espacios.' });
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._-])[A-Za-z\d@$!%*?&._-]{7,}$/;
        if (!passwordRegex.test(contraseña)) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 7 caracteres, incluyendo una mayúscula, una minúscula, un número y un carácter especial (ej. @$!%*?&._-).' });
        }

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

        const hashedPassword = await bcrypt.hash(contraseña, 10);

        const { data: loginData, error: loginError } = await supabase
            .from('login')
            .insert([
                { correo: correo, contraseña: hashedPassword, rol: rol, estado_login: 'Pendiente' }
            ])
            .select('id_login');

        if (loginError) {
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
            await supabase.from('login').delete().eq('id_login', idLogin); // ROLLBACK
            return res.status(500).json({ error: 'Error interno del servidor al registrar administrador. Se ha revertido el registro de usuario.' });
        }

        res.status(201).json({ message: 'Usuario y administrador registrados exitosamente.', user: loginData[0], admin: adminData[0] });

    } catch (error) {
        console.error('Error en la ruta /api/register:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Esta es la función corregida para tu servidor Node.js.
const ID_ADMIN_PRINCIPAL = parseInt(process.env.ff2); // Reemplaza con el ID real del administrador principal
app.get('/api/usuarios_pendientes', requireLogin, getUserIdFromSession, async (req, res) => {
try {
    // Consulta la tabla 'login' en Supabase y hace un JOIN IZQUIERDO (left join) con la tabla 'administrador'.
    // Esto asegura que todos los usuarios pendientes sean devueltos, incluso si no tienen una entrada en la tabla 'administrador'.
    const currentUserId = req.currentUserIdLogin;

        // VERIFICACIÓN CLAVE: Si el ID del usuario actual no coincide con el del administrador principal,
        // devolvemos un arreglo vacío y terminamos la ejecución.
        if (currentUserId !== ID_ADMIN_PRINCIPAL) {
            console.log(`Acceso denegado a usuarios pendientes para el usuario ${currentUserId}`);
            return res.status(200).json([]);
        }

    const { data, error } = await supabase
        .from('login')
        .select('id_login, correo, administrador!left(nombre_completo)')
        .eq('estado_login', 'Pendiente');

    if (error) {
        console.error('Error al obtener usuarios pendientes:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    // --- Paso de depuración: Imprime los datos originales para verificar la estructura ---
    // ----------------------------------------------------------------------------------

    // Formatea los datos para que el nombre completo sea una propiedad de primer nivel.
    // Se usa el operador de encadenamiento opcional (?.) para evitar errores si 'administrador' es nulo.
    const formattedData = data.map(user => {
        // Accede al primer elemento del array `administrador` antes de obtener `nombre_completo`
        const nombreCompleto = user.administrador && user.administrador.length > 0
            ? user.administrador[0].nombre_completo
            : 'Nombre no disponible';

        return {
            id_login: user.id_login,
            correo: user.correo,
            nombre_completo: nombreCompleto,
        };
    });

    // Envía la lista de usuarios formateada como respuesta.
    res.status(200).json(formattedData);
} catch (error) {
    console.error('Error en la ruta /api/usuarios_pendientes:', error.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
}
});

app.get('/api/usuarios_rechazados', requireLogin, getUserIdFromSession, async (req, res) => {
try {
    // Consulta la tabla 'login' en Supabase y hace un JOIN IZQUIERDO (left join) con la tabla 'administrador'.
    // Esto asegura que todos los usuarios rechazados sean devueltos, incluso si no tienen una entrada en la tabla 'administrador'.
     const currentUserId = req.currentUserIdLogin;

        // VERIFICACIÓN CLAVE: Si el ID del usuario actual no coincide con el del administrador principal,
        // devolvemos un arreglo vacío y terminamos la ejecución.
        if (currentUserId !== ID_ADMIN_PRINCIPAL) {
            console.log(`Acceso denegado a usuarios pendientes para el usuario ${currentUserId}`);
            return res.status(200).json([]);
        }
    const { data, error } = await supabase
        .from('login')
        .select('id_login, correo, administrador!left(nombre_completo)')
        .eq('estado_login', 'Rechazado');

    if (error) {
        console.error('Error al obtener usuarios rechazados:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    // --- Paso de depuración: Imprime los datos originales para verificar la estructura ---
    // ----------------------------------------------------------------------------------

    // Formatea los datos para que el nombre completo sea una propiedad de primer nivel.
    if (error) {
        console.error('Error al obtener usuarios rechazados:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    // --- Paso de depuración: Imprime los datos originales para verificar la estructura ---
    // ----------------------------------------------------------------------------------

    // Formatea los datos para que el nombre completo sea una propiedad de primer nivel.
    // Se usa el operador de encadenamiento opcional (?.) para evitar errores si 'administrador' es nulo.
    const formattedData = data.map(user => {
        // Accede al primer elemento del array `administrador` antes de obtener `nombre_completo`
        const nombreCompleto = user.administrador && user.administrador.length > 0
            ? user.administrador[0].nombre_completo
            : 'Nombre no disponible';

        return {
            id_login: user.id_login,
            correo: user.correo,
            nombre_completo: nombreCompleto,
        };
    });

    // Envía la lista de usuarios formateada como respuesta.
    res.status(200).json(formattedData);
} catch (error) {
    console.error('Error en la ruta /api/usuarios_pendientes:', error.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
}
});



// NUEVA RUTA: Aceptar un usuario
app.post('/api/accept_user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('login')
            .update({ estado_login: 'Activo' })
            .eq('id_login', id);
        
        if (error) {
            console.error('Error al aceptar usuario:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        res.status(200).json({ message: 'Usuario aceptado exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta /api/accept_user:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// NUEVA RUTA: Rechazar un usuario
app.post('/api/reject_user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('login')
            .update({ estado_login: 'Rechazado' })
            .eq('id_login', id);

        if (error) {
            console.error('Error al rechazar usuario:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        res.status(200).json({ message: 'Usuario rechazado exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta /api/reject_user:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Ruta de inicio de sesión de usuarios
// Ruta de inicio de sesión de usuarios
app.post("/api/login", async (req, res) => {
    try {
        const { correo, contraseña } = req.body;

        const { data, error } = await supabase
            .from('login')
            .select(`id_login, correo, contraseña, rol, estado_login`) // Incluimos estado_login en la selección
            .eq('correo', correo)
            .single();

        if (error || !data) {
            await registrarAuditoria({
                id_login: null,
                modulo_afectado: 'Autenticación',
                accion_realizada: 'Intento de Inicio de Sesión Fallido',
                descripcion_detallada: `Intento de inicio de sesión con correo "${correo}" fallido: Usuario no encontrado.`,
            });
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // --- Verificación del estado de la cuenta ---
        if (data.estado_login !== 'Activo') {
            await registrarAuditoria({
                id_login: data.id_login,
                modulo_afectado: 'Autenticación',
                accion_realizada: 'Intento de Inicio de Sesión Fallido',
                descripcion_detallada: `Intento de inicio de sesión para el usuario con ID ${data.id_login} y correo "${correo}" fallido: La cuenta no está activa. Estado actual: ${data.estado_login}.`,
            });
            return res.status(403).json({ error: 'Tu cuenta no ha sido activada aún. Por favor, contacta al administrador.' });
        }

        const isPasswordValid = await bcrypt.compare(contraseña, data.contraseña);

        if (!isPasswordValid) {
            await registrarAuditoria({
                id_login: data.id_login,
                modulo_afectado: 'Autenticación',
                accion_realizada: 'Intento de Inicio de Sesión Fallido',
                descripcion_detallada: `Intento de inicio de sesión para usuario con ID ${data.id_login} y correo "${correo}" fallido: Contraseña incorrecta.`,
            });
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // Generar JWT
        const token = jsonwebtoken.sign({
            id: data.id_login,
            correo: data.correo,
            rol: data.rol
        }, process.env.JWT_SECRET, {
            expiresIn: '1h' // El token expira en 1 hora
        });

        // Establecer la cookie JWT
        res.cookie("acceso_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 3600000
        });

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
        await registrarAuditoria({
            id_login: null,
            modulo_afectado: 'Autenticación',
            accion_realizada: 'Error Interno del Servidor',
            descripcion_detallada: `Error crítico durante el proceso de login. Mensaje: ${error.message}.`,
        });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});



// Ruta para cerrar sesión (Ahora limpia la cookie JWT)
app.post('/api/logout', (req, res) => {
    // Limpiar la cookie del token de acceso
    res.clearCookie("acceso_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    res.status(200).json({ message: "Sesión cerrada exitosamente." });
});


// Ruta de prueba para traer los administradores (si necesita protección, añadir requireLogin)
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
        const { data: scEstudiante, error: scError } = await supabase
            .from("servicio_comunitario")
            .select("id_servicio, proyecto, periodos: id_periodo(periodo), integrantes: integrantes!inner(id_estudiante!inner(cedula))")
            .eq("integrantes.id_estudiante.cedula", cedula);
        const { data: scTutor, error: scTutorError } = await supabase
            .from("servicio_comunitario")
            .select("id_servicio, proyecto, periodos: id_periodo(periodo), tutor:id_tutor!inner(cedula)")
            .eq("tutor.cedula", cedula);

        const servicioComunitario = [...(scEstudiante || []), ...(scTutor || [])].reduce((acc, current) => {
            const x = acc.find(item => item.id_servicio === current.id_servicio);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, []); // Eliminar duplicados si un mismo proyecto tiene al estudiante y al tutor con la misma cédula

        if (scError) console.error("Error servicio comunitario:", scError.message);
        if (scTutorError) console.error("Error servicio comunitario (tutor):", scTutorError.message);

        // Trabajo de Grado (Consulta mejorada para estudiante O tutor)
        const { data: tgByStudent, error: tgStudentError } = await supabase
            .from("trabajo_grado")
            .select("id_trabajo_grado, proyecto, periodos: id_periodo(periodo), estudiantes: id_estudiante!inner(cedula)")
            .eq("estudiantes.cedula", cedula);

        const { data: tgByTutor, error: tgTutorError } = await supabase
            .from("trabajo_grado")
            .select("id_trabajo_grado, proyecto, periodos: id_periodo(periodo), tutor:id_tutor!inner(cedula)")
            .eq("tutor.cedula", cedula);

        const trabajosGrado = [...(tgByStudent || []), ...(tgByTutor || [])].reduce((acc, current) => {
            const x = acc.find(item => item.id_trabajo_grado === current.id_trabajo_grado);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, []); // Eliminar duplicados si un mismo proyecto tiene al estudiante y al tutor con la misma cédula

        if (tgStudentError) console.error("Error trabajo de grado (estudiante):", tgStudentError.message);
        if (tgTutorError) console.error("Error trabajo de grado (tutor):", tgTutorError.message);


        // Proyectos de Investigación
        const { data: proyectosInvestigacion, error: piError } = await supabase
            .from("proyectos_investigacion")
            .select("id_proyecto_investigacion, proyecto, periodos: id_periodo(periodo), estudiante: id_estudiante!inner(cedula)")
            .eq("estudiante.cedula", cedula);


        if (piError) console.error("Error proyectos investigación:", piError.message);

        // Pasantías
        const { data: paEstudiante, error: paError } = await supabase
            .from("pasantia")
            .select("id_pasantia, titulo, periodos: id_periodo(periodo), estudiante: id_estudiante!inner(cedula)")
            .eq("estudiante.cedula", cedula);

        const { data: paTutor, error: paTutorError } = await supabase
            .from("pasantia")
            .select("id_pasantia, titulo, periodos: id_periodo(periodo), tutor:id_tutor!inner(cedula)")
            .eq("tutor.cedula", cedula);

        const pasantias = [...(paEstudiante || []), ...(paTutor || [])].reduce((acc, current) => {
            const x = acc.find(item => item.id_pasantia === current.id_pasantia);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, []); // Eliminar duplicados si un mismo proyecto tiene al estudiante y al tutor con la misma cédula

        if (paError) console.error("Error pasantías:", paError.message);
        if (paTutorError) console.error("Error pasantías (tutor):", paTutorError.message);

        // Respuesta agrupada
        res.json({
            servicioComunitario: servicioComunitario || [],
            trabajosGrado: trabajosGrado || [],
            proyectosInvestigacion: proyectosInvestigacion || [],
            pasantias: pasantias || [],
        });

    } catch (error) {
        console.error("Error en /api/buscar-proyectos:", error.message);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// Otras rutas
import servicio_comunitario from './server/rutas/servicio-comunitario.js';
import trabajo_de_grado from './server/rutas/trabajo-de-grado.js';
import proyectos_eliminados from './server/rutas/proyectos_eliminados.js';
import proyectos from './server/rutas/proyectos.js';
import pasantias from './server/rutas/pasantias.js';
import home from './server/rutas/home.js';
import bitacora from './server/rutas/bitacora.js'
import editar_perfil from './server/rutas/editar_perfil.js'
import admin from './server/rutas/admin.js'
import publicas from './server/rutas/publicas.js'
import recuperarContraseñas from './server/rutas/recuperar-contraseña.js';


app.use('/api', requireLogin, getUserIdFromSession);
app.use('/api', servicio_comunitario);
app.use('/api', trabajo_de_grado);
app.use('/api', proyectos_eliminados);
app.use('/api', proyectos);
app.use('/api', pasantias);
app.use('/api', home);
app.use('/api', bitacora);
app.use('/api', editar_perfil);
app.use('/api', admin);