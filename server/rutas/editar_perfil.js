import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path'; // Importa path de forma estándar
import pdf from 'html-pdf'; // Si aún lo utilizas para la generación de PDFs
import { fileURLToPath } from 'url'; // Necesario para convertir URL a path de sistema de archivos
import fs from 'fs'; // Importamos el módulo 'fs' para leer archivos

// Importa la función de auditoría
import { registrarAuditoria } from './bitacora.js'; // ASEGÚRATE DE QUE LA RUTA SEA CORRECTA

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas en servicio-comunitario.js');
}
const supabase = createClient(supabaseUrl, supabaseKey);


const router = express.Router();




// Agrega esta nueva ruta para obtener los datos de un administrador por su ID de login
// Agrega esta nueva ruta para obtener los datos de un administrador por su ID de login
// Ahora incluye la contraseña y los campos 'correo' y 'cedula'
router.get('/administrador/:id_login', async (req, res) => {
    const { id_login } = req.params;
    try {
        const { data: adminData, error: adminError } = await supabase
            .from('administrador')
            .select(`
                nombre_completo,
                correo,
                cedula, 
                id_login,
                login(contraseña)
            `)
            .eq('id_login', id_login)
            .single();

        if (adminError) {
            console.error('Error al obtener datos del administrador:', adminError);
            return res.status(500).json({ error: 'Error interno del servidor al obtener los datos.' });
        }
        if (!adminData) {
            return res.status(404).json({ error: 'Administrador no encontrado.' });
        }

        res.status(200).json(adminData);
    } catch (error) {
        console.error('Excepción al obtener datos del administrador:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Agrega esta ruta para actualizar los datos del administrador y el login
router.put('/administrador/:id_login', async (req, res) => {
    const { id_login } = req.params;
    const {
        nombre_completo,
        correo,
        cedula,
        contraseña // Viene del frontend, ya hasheada
    } = req.body;

    try {
        // Actualizar la tabla 'administrador'
        const { error: adminError } = await supabase
            .from('administrador')
            .update({ nombre_completo, correo, telefono, cedula })
            .eq('id_login', id_login);

        // Actualizar la tabla 'login' (solo si se proporciona una nueva contraseña)
        let loginError = null;
        if (contraseña) {
            const { error } = await supabase
                .from('login')
                .update({ contraseña })
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
// Ruta para obtener el ID del usuario logueado
router.get('/current-user-id', (req, res) => {
    // requireLogin y getUserIdFromSession ya han adjuntado el ID del usuario a req.currentUserIdLogin
    if (req.currentUserIdLogin) {
        res.status(200).json({ id_login: req.currentUserIdLogin });
    } else {
        res.status(404).json({ error: 'ID de usuario no encontrado en la sesión.' });
    }
});

export default router;