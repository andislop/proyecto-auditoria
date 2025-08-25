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

// =======================================================
// APIs SEPARADAS PARA PROYECTOS ELIMINADOS
// =======================================================

// API: Obtener proyectos de Servicio Comunitario eliminados
router.get('/proyectos-eliminados/servicio-comunitario', async (req, res) => {
    try {
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
            periodo: project.periodos?.periodo || '',
            nombre_proyecto: project.proyecto,
            carrera: project.carreras?.carrera || '',
            tutor: project.tutores ? { cedula: project.tutores.cedula, nombre_completo: project.tutores.nombre_completo } : null,
            estudiantes: project.integrantes_servicio_comunitario.map(i => i.estudiantes).filter(Boolean),
            mensaje_eliminacion: project.mensaje_eliminacion
        }));

        res.status(200).json(formattedSCProjects);

    } catch (error) {
        console.error('Error en la ruta /api/proyectos-eliminados/servicio-comunitario:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor al obtener proyectos de Servicio Comunitario eliminados.' });
    }
});

// API: Obtener proyectos de Trabajo de Grado eliminados
router.get('/proyectos-eliminados/trabajo-de-grado', async (req, res) => {
    try {
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
            periodo: project.periodos?.periodo || '',
            nombre_proyecto: project.proyecto, 
            carrera: project.carreras?.carrera || '',
            tutor: project.tutores ? { cedula: project.tutores.cedula, nombre_completo: project.tutores.nombre_completo } : null,
            estudiantes: project.estudiantes ? [{ cedula: project.estudiantes.cedula, nombre_completo: project.estudiantes.nombre_completo }] : [],
            mensaje_eliminacion: project.mensaje_eliminacion
        }));

        res.status(200).json(formattedTGProjects);

    } catch (error) {
        console.error('Error en la ruta /api/proyectos-eliminados/trabajo-de-grado:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor al obtener proyectos de Trabajo de Grado eliminados.' });
    }
});

// API: Obtener proyectos de Investigación eliminados
router.get('/proyectos-eliminados/proyectos-investigacion', async (req, res) => {
    try {
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
            tipo_proyecto: 'Proyecto de Investigación', 
            periodo: project.periodos?.periodo || '',
            nombre_proyecto: project.proyecto, 
            carrera: project.carreras?.carrera || '',
            tutor: null, 
            estudiantes: project.estudiantes ? [{ cedula: project.estudiantes.cedula, nombre_completo: project.estudiantes.nombre_completo }] : [],
            mensaje_eliminacion: project.mensaje_eliminacion
        }));

        res.status(200).json(formattedPIProjects);

    } catch (error) {
        console.error('Error en la ruta /api/proyectos-eliminados/proyectos-investigacion:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor al obtener proyectos de Investigación eliminados.' });
    }
});

// API: Obtener pasantías eliminadas
router.get('/proyectos-eliminados/pasantias', async (req, res) => {
    try {
        let { data: pasantiasProjects, error: pasError } = await supabase
            .from('pasantia')
            .select(`
                id_pasantia,
                titulo,
                estado,
                eliminado,
                mensaje_eliminado,
                carreras:id_carrera(carrera),
                periodos:id_periodo(periodo),
                tutores:id_tutor(cedula, nombre_completo),
                estudiantes:id_estudiante(cedula, nombre_completo)
            `)
            .eq('eliminado', true);

        if (pasError) {
            console.error('Error al obtener pasantías eliminadas:', pasError.message);
            throw new Error('Error al obtener pasantías eliminadas.');
        }

        const formattedPasProjects = pasantiasProjects.map(pasantia => ({
            id: pasantia.id_pasantia,
            tipo_proyecto: 'Pasantía', 
            periodo: pasantia.periodos?.periodo || '',
            nombre_proyecto: pasantia.titulo, 
            carrera: pasantia.carreras?.carrera || '',
            tutor: pasantia.tutores ? { cedula: pasantia.tutores.cedula, nombre_completo: pasantia.tutores.nombre_completo } : null,
            estudiantes: pasantia.estudiantes ? [{ cedula: pasantia.estudiantes.cedula, nombre_completo: pasantia.estudiantes.nombre_completo }] : [],
            mensaje_eliminado: pasantia.mensaje_eliminado,
        }));

        res.status(200).json(formattedPasProjects);

    } catch (error) {
        console.error('Error en la ruta /api/proyectos-eliminados/pasantias:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor al obtener pasantías eliminadas.' });
    }
});

// APIs para Restaurar proyectos (estos se mantienen igual, ya que funcionan por ID y tipo)
router.put('/proyectos-comunitarios/restaurar/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('servicio_comunitario')
            .update({ 
                eliminados: false, 
                mensaje_eliminacion: null, 
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

router.put('/trabajos-de-grado/restaurar/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('trabajo_grado')
            .update({ 
                eliminados: false, 
                mensaje_eliminacion: null, 
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

router.put('/proyectos-investigacion/restaurar/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('proyectos_investigacion')
            .update({ 
                eliminados: false, 
                mensaje_eliminacion: null
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

router.put('/pasantias/restaurar/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('pasantia')
            .update({ 
                eliminado: false, 
                mensaje_eliminado: null, 
            })
            .eq('id_pasantia', id);

        if (error) {
            console.error('Error al restaurar Pasantía:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al restaurar pasantía.' });
        }
        res.status(200).json({ message: 'Pasantía restaurada exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /pasantias/restaurar:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


export default router;
