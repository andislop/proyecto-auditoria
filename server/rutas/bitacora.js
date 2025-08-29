import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas en auditoria-routes.js');
    process.exit(1); 
}
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();

// =======================================================
// UTILITY FUNCTION: Registrar una actividad en la bitácora
// =======================================================
/**
 * Registra una actividad en la tabla 'bitacora' de Supabase.
 * Ahora obtiene el nombre_usuario de la tabla 'administrador' si es necesario.
 * @param {object} logData - Objeto con los datos del log.
 * @param {string | number | null} logData.id_login - ID del usuario que realizó la acción (de tu tabla login). Puede ser null para intentos fallidos.
 * @param {string} logData.modulo_afectado - Módulo del sistema afectado (ej. 'Pasantías', 'Usuarios').
 * @param {string} logData.accion_realizada - Tipo de acción (ej. 'Agregar', 'Modificar', 'Eliminar', 'LOGIN').
 * @param {string} [logData.descripcion_detallada] - Descripción opcional más detallada.
 * @param {string} [logData.registro_afectado_id] - ID del registro en otra tabla (ej. id_pasantia, cedula).
 * @returns {Promise<boolean>} - True si el log fue registrado exitosamente, false en caso contrario.
 */
export async function registrarAuditoria(logData) {
    let { id_login, modulo_afectado, accion_realizada, descripcion_detallada, registro_afectado_id } = logData;
    let nombre_usuario_a_registrar = 'Desconocido'; // Valor por defecto

    const final_id_login = id_login;

    if (!modulo_afectado || !accion_realizada) {
        console.error('Error: Faltan campos obligatorios para registrar auditoría (modulo_afectado, accion_realizada).', logData);
        return false;
    }

    try {
        // PASO 1: Buscar el nombre_completo del usuario en la tabla 'administrador'
        if (final_id_login !== null && final_id_login !== 0) { 
            console.log(`[Auditoría] Intentando buscar nombre de administrador para id_login: ${final_id_login}`);
            const { data: adminData, error: adminError } = await supabase
                .from('administrador')
                .select('nombre_completo')
                .eq('id_login', final_id_login)
                .single();

            if (adminError && adminError.details.includes('0 rows')) {
                console.warn(`[Auditoría] Advertencia: No se encontró administrador para id_login: ${final_id_login}. Se registrará como 'Usuario Desconocido'.`);
            } else if (adminError) {
                console.error('[Auditoría] Error al buscar nombre de administrador para auditoría:', adminError);
            } else if (adminData && adminData.nombre_completo) {
                nombre_usuario_a_registrar = adminData.nombre_completo;
                console.log(`[Auditoría] Nombre de administrador encontrado: ${nombre_usuario_a_registrar}`);
            } else {
                console.warn(`[Auditoría] Administrador encontrado para id_login: ${final_id_login}, pero nombre_completo es nulo o vacío.`);
            }
        } else {
            nombre_usuario_a_registrar = 'Usuario Desconocido / No Registrado';
            console.log(`[Auditoría] id_login es nulo o 0. Se registrará como: ${nombre_usuario_a_registrar}`);
        }

        // PASO 2: Insertar el log en la tabla 'bitacora'
        // Se utiliza new Date().toISOString() para obtener la fecha y hora actual del servidor en formato UTC.
        // Este es el formato universal correcto para guardar fechas en una base de datos.
        const { data, error } = await supabase
            .from('bitacora')
            .insert([
                {
                    fecha_hora: new Date().toISOString(),
                    id_login: final_id_login,
                    nombre_usuario: nombre_usuario_a_registrar,
                    modulo_afectado: modulo_afectado,
                    accion_realizada: accion_realizada,
                    descripcion_detallada: descripcion_detallada,
                    registro_afectado_id: registro_afectado_id,
                }
            ]);

        if (error) {
            console.error('[Auditoría] Error al insertar log de auditoría en Supabase:', error);
            return false;
        }
        console.log(`[Auditoría] Log registrado exitosamente. Usuario: ${nombre_usuario_a_registrar}, id_login: ${final_id_login}, Fecha: ${new Date().toISOString()}`);
        return true;
    } catch (error) {
        console.error('[Auditoría] Excepción al registrar auditoría:', error);
        return false;
    }
}

// =======================================================
// API ROUTE: Obtener todos los registros de la bitácora
// =======================================================
router.get('/bitacora', async (req, res) => {
    try {
        let { data: logs, error } = await supabase
            .from('bitacora')
            .select(`
                id_bitacora,
                fecha_hora,
                id_login,
                nombre_usuario,
                modulo_afectado,
                accion_realizada,
                descripcion_detallada,
                registro_afectado_id
            `)
            .order('fecha_hora', { ascending: false }); // Ordenar por fecha más reciente primero

        if (error) {
            console.error('Error al obtener registros de bitácora de Supabase:', error);
            return res.status(500).json({ error: 'Error interno del servidor al obtener registros de auditoría.' });
        }

        res.status(200).json(logs);

    } catch (error) {
        console.error('Excepción al obtener registros de bitácora:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;

