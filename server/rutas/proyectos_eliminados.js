import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas en proyectos-eliminados.js');
}
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();

// API: Obtener todos los proyectos eliminados (Servicio Comunitario y Trabajo de Grado)
router.get('/proyectos-eliminados', async (req, res) => {
    try {
        // Obtener proyectos de Servicio Comunitario eliminados lógicamente
        let { data: servicioComunitarioProjects, error: scError } = await supabase
            .from('servicio_comunitario')
            .select(`
                id_servicio,
                proyecto,
                comunidad,
                estado,
                fecha_inicio,
                fecha_final,
                eliminados,
                mensaje_eliminacion,
                carreras:id_carrera(carrera),
                periodos:id_periodo(periodo),
                tutores:id_tutor(cedula, nombre_completo),
                integrantes_servicio_comunitario:integrantes(
                    estudiantes:id_estudiante(cedula, nombre_completo)
                )
            `)
            .eq('eliminados', true);

        if (scError) {
            console.error('Error al obtener proyectos de Servicio Comunitario eliminados:', scError.message);
            throw new Error('Error al obtener proyectos de Servicio Comunitario eliminados.');
        }

        const formattedSCProjects = servicioComunitarioProjects.map(project => ({
            id: project.id_servicio,
            tipo_proyecto: 'Servicio Comunitario',
            periodo: project.periodos?.periodo || 'N/A',
            nombre_proyecto: project.proyecto,
            carrera: project.carreras?.carrera || 'N/A',
            tutor: project.tutores ? { cedula: project.tutores.cedula, nombre_completo: project.tutores.nombre_completo } : null,
            // Los proyectos de servicio comunitario tienen multiples integrantes
            estudiantes: project.integrantes_servicio_comunitario.map(i => i.estudiantes).filter(Boolean).map(e => ({ cedula: e.cedula, nombre_completo: e.nombre_completo })),
            mensaje_eliminacion: project.mensaje_eliminacion
        }));

        // Obtener proyectos de Trabajo de Grado eliminados lógicamente
        let { data: trabajoGradoProjects, error: tgError } = await supabase
            .from('trabajo_grado')
            .select(`
                id_trabajo_grado,
                proyecto,
                estado,
                fecha,
                eliminados,
                mensaje_eliminacion,
                carreras:id_carrera(carrera),
                periodos:id_periodo(periodo),
                tutores:id_tutor(cedula, nombre_completo),
                estudiantes:id_estudiante(cedula, nombre_completo)
            `)
            .eq('eliminados', true);

        if (tgError) {
            console.error('Error al obtener proyectos de Trabajo de Grado eliminados:', tgError.message);
            throw new Error('Error al obtener proyectos de Trabajo de Grado eliminados.');
        }

        const formattedTGProjects = trabajoGradoProjects.map(project => ({
            id: project.id_trabajo_grado,
            tipo_proyecto: 'Trabajo de Grado',
            periodo: project.periodos?.periodo || 'N/A',
            nombre_proyecto: project.proyecto, 
            carrera: project.carreras?.carrera || 'N/A',
            tutor: project.tutores ? { cedula: project.tutores.cedula, nombre_completo: project.tutores.nombre_completo } : null,
            // Los trabajos de grado tienen un solo estudiante
            estudiantes: project.estudiantes ? [{ cedula: project.estudiantes.cedula, nombre_completo: project.estudiantes.nombre_completo }] : [],
            mensaje_eliminacion: project.mensaje_eliminacion
        }));

        // *** NUEVO: Obtener proyectos de Investigación eliminados lógicamente ***
        let { data: proyectosInvestigacion, error: piError } = await supabase
            .from('proyectos_investigacion')
            .select(`
                id_proyecto_investigacion,
                proyecto,
                estado,
                eliminados,
                mensaje_eliminacion,
                carreras:id_carrera(carrera),
                periodos:id_periodo(periodo),
                estudiantes:id_estudiante(cedula, nombre_completo)
            `)
            .eq('eliminados', true);

        if (piError) {
            console.error('Error al obtener proyectos de Investigación eliminados:', piError.message);
            throw new Error('Error al obtener proyectos de Investigación eliminados.');
        }

        const formattedPIProjects = proyectosInvestigacion.map(project => ({
            id: project.id_proyecto_investigacion,
            tipo_proyecto: 'Proyecto de Investigación', // Nuevo tipo
            periodo: project.periodos?.periodo || 'N/A',
            nombre_proyecto: project.proyecto, 
            carrera: project.carreras?.carrera || 'N/A',
            tutor: null, // Proyectos de Investigación no tienen tutor
            estudiantes: project.estudiantes ? [{ cedula: project.estudiantes.cedula, nombre_completo: project.estudiantes.nombre_completo }] : [],
            mensaje_eliminacion: project.mensaje_eliminacion
        }));

        const allDeletedProjects = [...formattedSCProjects, ...formattedTGProjects, ...formattedPIProjects]; // Unir los tres tipos

        res.status(200).json(allDeletedProjects);

    } catch (error) {
        console.error('Error en la ruta /api/proyectos-eliminados:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor al obtener proyectos eliminados.' });
    }
});

// API: Restaurar proyecto de Servicio Comunitario (marcar como no eliminado)
router.put('/proyectos-comunitarios/restaurar/:id', async (req, res) => {
    const { id } = req.params;
    const { mensajeRestauracion } = req.body; // Opcional

    try {
        const { data, error } = await supabase
            .from('servicio_comunitario')
            .update({ 
                eliminados: false, 
                mensaje_eliminacion: null, // Limpiar el mensaje de eliminación
                mensaje_restauracion: mensajeRestauracion || null // Guardar mensaje de restauración
            })
            .eq('id_servicio', id);

        if (error) {
            console.error('Error al restaurar proyecto de Servicio Comunitario:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al restaurar proyecto.' });
        }
        res.status(200).json({ message: 'Proyecto de Servicio Comunitario restaurado exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /proyectos-comunitarios/restaurar:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Restaurar proyecto de Trabajo de Grado (marcar como no eliminado)
router.put('/trabajos-de-grado/restaurar/:id', async (req, res) => {
    const { id } = req.params;
    const { mensajeRestauracion } = req.body; // Opcional

    try {
        const { data, error } = await supabase
            .from('trabajo_grado')
            .update({ 
                eliminados: false, 
                mensaje_eliminacion: null, // Limpiar el mensaje de eliminación
                mensaje_restauracion: mensajeRestauracion || null // Guardar mensaje de restauración
            })
            .eq('id_trabajo_grado', id);

        if (error) {
            console.error('Error al restaurar proyecto de Trabajo de Grado:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al restaurar proyecto.' });
        }
        res.status(200).json({ message: 'Proyecto de Trabajo de Grado restaurado exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /trabajos-de-grado/restaurar:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// *** NUEVO: API: Restaurar proyecto de Investigación (marcar como no eliminado) ***
router.put('/proyectos-investigacion/restaurar/:id', async (req, res) => {
    const { id } = req.params;
    const { mensajeRestauracion } = req.body; // Opcional

    try {
        const { data, error } = await supabase
            .from('proyectos_investigacion')
            .update({ 
                eliminados: false, 
                mensaje_eliminacion: null, 
                mensaje_restauracion: mensajeRestauracion || null 
            })
            .eq('id_proyecto_investigacion', id);

        if (error) {
            console.error('Error al restaurar proyecto de Investigación:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al restaurar proyecto.' });
        }
        res.status(200).json({ message: 'Proyecto de Investigación restaurado exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /proyectos-investigacion/restaurar:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


export default router;
