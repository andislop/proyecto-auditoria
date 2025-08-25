import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas en dashboard-api.js');
}
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();

// API para obtener el conteo de proyectos de Servicio Comunitario (no eliminados)
router.get('/dashboard/count/servicio-comunitario', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('servicio_comunitario')
            .select('*', { count: 'exact', head: true })
            .eq('eliminados', false); // Contar solo los no eliminados

        if (error) {
            console.error('Error al contar Servicio Comunitario:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener el conteo de Servicio Comunitario.' });
        }
        res.status(200).json({ count });
    } catch (error) {
        console.error('Error en la ruta /dashboard/count/servicio-comunitario:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API para obtener el conteo de Trabajos de Grado (no eliminados)
router.get('/dashboard/count/trabajo-de-grado', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('trabajo_grado')
            .select('*', { count: 'exact', head: true })
            .eq('eliminados', false); // Contar solo los no eliminados

        if (error) {
            console.error('Error al contar Trabajos de Grado:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener el conteo de Trabajos de Grado.' });
        }
        res.status(200).json({ count });
    } catch (error) {
        console.error('Error en la ruta /dashboard/count/trabajo-de-grado:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API para obtener el conteo de Proyectos de Investigación (no eliminados)
router.get('/dashboard/count/proyectos-investigacion', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('proyectos_investigacion')
            .select('*', { count: 'exact', head: true })
            .eq('eliminados', false); // Contar solo los no eliminados

        if (error) {
            console.error('Error al contar Proyectos de Investigación:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener el conteo de Proyectos de Investigación.' });
        }
        res.status(200).json({ count });
    } catch (error) {
        console.error('Error en la ruta /dashboard/count/proyectos-investigacion:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API para obtener el conteo de Pasantías (no eliminadas)
router.get('/dashboard/count/pasantias', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('pasantia')
            .select('*', { count: 'exact', head: true })
            .eq('eliminado', false); // Contar solo las no eliminadas

        if (error) {
            console.error('Error al contar Pasantías:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener el conteo de Pasantías.' });
        }
        res.status(200).json({ count });
    } catch (error) {
        console.error('Error en la ruta /dashboard/count/pasantias:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
