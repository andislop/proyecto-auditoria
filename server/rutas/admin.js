import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs'; // Para hashear contraseñas

// Importa la función de auditoría (asegúrate de que la ruta sea correcta)
import { registrarAuditoria } from './bitacora.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas.');
    process.exit(1); // Salir si no están configuradas
}
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();

// --- Rutas existentes para administrador por ID de login (mantendremos estas) ---

// Agrega esta nueva ruta para obtener los datos de un administrador por su ID de login
router.get('/administrador/:id_login', async (req, res) => {
    const { id_login } = req.params;
    try {
        const { data: adminData, error: adminError } = await supabase
            .from('administrador')
            .select(`
                nombre_completo,
                cedula,
                correo,
                id_login,
                activo,
                login(correo, rol) 
            `)
            .eq('id_login', id_login)
            .single();

        if (adminError) {
            console.error('Error al obtener datos del administrador:', adminError);
            return res.status(500).json({ error: 'Error interno del servidor al obtener los datos.' });
        }
        if (!adminData || !adminData.activo) { // Verificamos activo de la tabla administrador
            return res.status(404).json({ error: 'Administrador no encontrado o inactivo.' });
        }

        res.status(200).json(adminData);
    } catch (error) {
        console.error('Excepción al obtener datos del administrador:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Agrega esta ruta para actualizar los datos del administrador y el nombre de usuario (EXISTENTE)
router.put('/administrador/:id_login', async (req, res) => {
    const { id_login } = req.params;
    const {
        nombre_completo,
        correo,
        cedula, // Asumiendo que cedula también puede ser actualizada
        nombre_usuario // Esto viene de la tabla login, se asume que se pasa para actualizar el login
    } = req.body;

    try {
        // Actualizar la tabla 'administrador'
        const { error: adminError } = await supabase
            .from('administrador')
            .update({ nombre_completo, correo, cedula }) // Actualizamos cedula y correo aquí
            .eq('id_login', id_login);

        // Actualizar la tabla 'login' (si se proporciona nombre_usuario)
        let loginError = null;
        if (nombre_usuario) {
            const { error } = await supabase
                .from('login')
                .update({ nombre_usuario })
                .eq('id_login', id_login);
            loginError = error;
        }

        // Registrar acción en la bitácora
        await registrarAuditoria({
            id_login: id_login,
            modulo_afectado: 'Perfil de Usuario',
            accion_realizada: 'Actualización',
            descripcion_detallada: `Se actualizó el perfil del usuario con ID de login ${id_login}.`,
            registro_afectado_id: id_login.toString(),
        });
        
        if (adminError || loginError) {
            console.error('Error al actualizar el perfil:', adminError || loginError);
            return res.status(500).json({ error: 'Error al actualizar el perfil.' });
        }

        res.status(200).json({ message: 'Perfil actualizado exitosamente.' });

    } catch (error) {
        console.error('Excepción al actualizar perfil:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- Nuevas rutas para la gestión completa de administradores ---

// GET: Obtener todos los administradores (activos)
router.get('/administradores', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('administrador')
            .select(`
                id_administrador,
                cedula,
                nombre_completo,
                correo,
                id_login,
                activo 
            `)
           .order('id_administrador', { ascending: true })
            .eq('activo', true); // Filtrar por la columna 'activo' de la tabla 'administrador'

        if (error) {
            console.error('Error al obtener administradores:', error);
            return res.status(500).json({ error: 'Error interno del servidor al obtener administradores.' });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Excepción al obtener administradores:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// GET: Obtener un administrador por su id_administrador
router.get('/administradores/:id_administrador', async (req, res) => {
    const { id_administrador } = req.params;
    try {
        const { data, error } = await supabase
            .from('administrador')
            .select(`
                id_administrador,
                cedula,
                nombre_completo,
                correo,
                id_login,
                activo // Ahora activo está en la tabla administrador
            `)
            .eq('id_administrador', id_administrador)
            .eq('activo', true) // Filtrar por la columna 'activo' de la tabla 'administrador'
            .single();


        if (error) {
            console.error('Error al obtener administrador por ID:', error);
            return res.status(500).json({ error: 'Error interno del servidor al obtener el administrador.' });
        }
        if (!data) { // Si no se encuentra, o está inactivo
            return res.status(404).json({ error: 'Administrador no encontrado o inactivo.' });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Excepción al obtener administrador por ID:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// POST: Agregar un nuevo administrador
router.post('/administradores', async (req, res) => {
    const { cedula, nombre_completo, correo, password } = req.body;

    if (!cedula || !nombre_completo || !correo || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const client = supabase; // Usar el cliente Supabase para transacciones si fuera necesario

    try {
        // 1. Insertar en la tabla 'login' (solo correo, nombre_usuario, password, rol)
        const { data: loginData, error: loginError } = await client
            .from('login')
            .insert({
                correo: correo, // Usamos el correo como nombre_usuario para login si no se especifica
                contraseña: hashedPassword,
                estado_login: 'Activo',
                rol: 'Administrador'
            })
            .select()
            .single();

        if (loginError) {
            console.error('Error al insertar en la tabla login:', loginError);
            return res.status(500).json({ error: 'Error al crear la cuenta de login.' });
        }

        const id_login = loginData.id_login;

        // 2. Insertar en la tabla 'administrador' (incluyendo la columna 'activo')
        const { data: adminData, error: adminError } = await client
            .from('administrador')
            .insert({
                cedula: cedula,
                nombre_completo: nombre_completo,
                correo: correo, // El correo del administrador
                id_login: id_login,
                activo: true // Por defecto activo
            })
            .select()
            .single();

        if (adminError) {
            console.error('Error al insertar en la tabla administrador:', adminError);
            // Si falla la inserción del admin, intentar revertir la creación del login
            await client.from('login').delete().eq('id_login', id_login);
            return res.status(500).json({ error: 'Error al registrar el administrador.' });
        }

        // Registrar acción en la bitácora
        await registrarAuditoria({
            id_login: id_login,
            modulo_afectado: 'Administradores',
            accion_realizada: 'Creación',
            descripcion_detallada: `Se creó un nuevo administrador con ID de login ${id_login} y cédula ${cedula}.`,
            registro_afectado_id: adminData.id_administrador.toString(),
        });

        res.status(201).json({ message: 'Administrador creado exitosamente.', admin: adminData });
    } catch (error) {
        console.error('Excepción al crear administrador:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PUT: Actualizar un administrador por id_administrador
router.put('/administradores/:id_administrador', async (req, res) => {
    const { id_administrador } = req.params;
    const { cedula, nombre_completo, correo } = req.body;

    if (!cedula || !nombre_completo || !correo) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    try {
        // Primero, obtener el id_login asociado al id_administrador para la bitácora y el login
        const { data: adminLookup, error: lookupError } = await supabase
            .from('administrador')
            .select('id_login')
            .eq('id_administrador', id_administrador)
            .single();

        if (lookupError || !adminLookup) {
            console.error('Error al buscar id_login para actualizar admin:', lookupError);
            return res.status(404).json({ error: 'Administrador no encontrado.' });
        }

        const id_login = adminLookup.id_login;

        // Actualizar la tabla 'administrador' (incluyendo el correo)
        const { error: adminError } = await supabase
            .from('administrador')
            .update({ cedula, nombre_completo, correo })
            .eq('id_administrador', id_administrador);

        // Opcional: Actualizar el correo en la tabla 'login' si ha cambiado
        // Ya que login solo contiene correo y rol, es buena práctica mantenerlos sincronizados
        const { error: loginUpdateError } = await supabase
            .from('login')
            .update({ correo: correo })
            .eq('id_login', id_login);

        // Registrar acción en la bitácora
        await registrarAuditoria({
            id_login: id_login,
            modulo_afectado: 'Administradores',
            accion_realizada: 'Actualización',
            descripcion_detallada: `Se actualizó el administrador con ID ${id_administrador}.`,
            registro_afectado_id: id_administrador.toString(),
        });

        if (adminError || loginUpdateError) {
            console.error('Error al actualizar el administrador o el login:', adminError || loginUpdateError);
            return res.status(500).json({ error: 'Error al actualizar el administrador.' });
        }

        res.status(200).json({ message: 'Administrador actualizado exitosamente.' });
    } catch (error) {
        console.error('Excepción al actualizar administrador:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PUT: Eliminación lógica de un administrador por id_administrador
router.put('/administradores/eliminar-logico/:id_administrador', async (req, res) => {
    const { id_administrador } = req.params;
    const { mensajeEliminacion } = req.body; // Mensaje opcional para la auditoría

    try {
        // Primero, obtener el id_login asociado al id_administrador para la bitácora
        const { data: adminLookup, error: lookupError } = await supabase
            .from('administrador')
            .select('id_login')
            .eq('id_administrador', id_administrador)
            .single();

        if (lookupError || !adminLookup) {
            console.error('Error al buscar id_login para eliminación lógica:', lookupError);
            return res.status(404).json({ error: 'Administrador no encontrado.' });
        }

        const id_login = adminLookup.id_login;

        // Desactivar el administrador en la tabla 'administrador' (eliminación lógica)
        const { error: adminError } = await supabase
            .from('administrador')
            .update({ activo: false })
            .eq('id_administrador', id_administrador);

        // Registrar acción en la bitácora
        await registrarAuditoria({
            id_login: id_login,
            modulo_afectado: 'Administradores',
            accion_realizada: 'Eliminación Lógica',
            descripcion_detallada: `Se eliminó lógicamente al administrador con ID ${id_administrador}. Motivo: ${mensajeEliminacion || 'No especificado'}.`,
            registro_afectado_id: id_administrador.toString(),
        });

        if (adminError) {
            console.error('Error al eliminar lógicamente el administrador:', adminError);
            return res.status(500).json({ error: 'Error al realizar la eliminación lógica del administrador.' });
        }

        res.status(200).json({ message: 'Administrador eliminado lógicamente exitosamente.' });
    } catch (error) {
        console.error('Excepción al eliminar lógicamente el administrador:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

router.get("/user-profile/:id_login", async (req, res) => {
    const { id_login } = req.params;

    try {
        // Consulta la tabla 'administrador' para obtener el nombre_completo
        const { data: adminData, error: adminError } = await supabase
            .from('administrador')
            .select('nombre_completo')
            .eq('id_login', id_login)
            .single();

        if (adminError || !adminData) {
            console.error('Error al obtener nombre completo para /api/user-profile:', adminError || 'Datos del administrador no encontrados.');
            return res.status(404).json({ error: 'Información de usuario no encontrada o el administrador no existe.' });
        }

        // Devuelve el nombre_completo
        return res.json({ nombre_completo: adminData.nombre_completo });
    } catch (error) {
        console.error("Error en /api/user-profile:", error.message);
        return res.status(500).json({ error: 'Error interno del servidor al obtener el perfil del usuario.' });
    }
});


export default router;
