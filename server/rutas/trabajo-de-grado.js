import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
// import pdf from 'html-pdf'; // Ya no se necesita html-pdf
import { fileURLToPath } from 'url';
// import fs from 'fs'; // Ya no se necesita fs si no leemos imágenes para PDF

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas en trabajo-de-grado.js');
}
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();

// =======================================================
// APIs PARA TRABAJO DE GRADO
// =======================================================

// API: Obtener todos los trabajos de grado (filtrando por eliminados = false)
router.get('/trabajos-de-grado', async (req, res) => {
    try {
        let { data: trabajos, error } = await supabase
            .from('trabajo_grado') 
            .select(`
                id_trabajo_grado,     
                proyecto, 
                estado,
                eliminados,
                mensaje_eliminacion,
                fecha, 
                periodos:id_periodo(id_periodo, periodo),
                carreras:id_carrera(id_carrera, carrera),
                tutores:id_tutor(id_tutor, cedula, nombre_completo),
                estudiantes:id_estudiante(id_estudiante, cedula, nombre_completo, carreras:id_carrera(carrera))
            `)
            .eq('eliminados', false);

        if (error) {
            console.error('Error al obtener trabajos de grado (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener trabajos de grado.' });
        }

        const formattedTrabajos = trabajos.map(trabajo => ({
            id_trabajo_grado: trabajo.id_trabajo_grado, 
            periodo: trabajo.periodos ? trabajo.periodos.periodo : null,
            id_periodo: trabajo.periodos ? trabajo.periodos.id_periodo : null,
            nombre_proyecto: trabajo.proyecto, 
            carrera: trabajo.carreras ? trabajo.carreras.carrera : null,
            id_carrera: trabajo.carreras ? trabajo.carreras.id_carrera : null,
            tutor: trabajo.tutores ? { id_tutor: trabajo.tutores.id_tutor, cedula: trabajo.tutores.cedula, nombre_completo: trabajo.tutores.nombre_completo } : null,
            estudiante: trabajo.estudiantes ? { 
                id_estudiante: trabajo.estudiantes.id_estudiante, 
                cedula: trabajo.estudiantes.cedula, 
                nombre_completo: trabajo.estudiantes.nombre_completo,
                carreras: trabajo.estudiantes.carreras ? { carrera: trabajo.estudiantes.carreras.carrera } : null
            } : null,
            estado: trabajo.estado,
            fecha: trabajo.fecha, 
            eliminados: trabajo.eliminados,
            mensaje_eliminacion: trabajo.mensaje_eliminacion
        }));

        res.status(200).json(formattedTrabajos);
    } catch (error) {
        console.error('Error en la ruta /trabajos-de-grado (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener trabajos de grado eliminados lógicamente
router.get('/trabajos-de-grado-eliminados', async (req, res) => {
    try {
        let { data: trabajos, error } = await supabase
            .from('trabajo_grado') 
            .select(`
                id_trabajo_grado,     
                proyecto, 
                estado,
                eliminados,
                mensaje_eliminacion,
                fecha, 
                periodos:id_periodo(id_periodo, periodo),
                carreras:id_carrera(id_carrera, carrera),
                tutores:id_tutor(id_tutor, cedula, nombre_completo),
                estudiantes:id_estudiante(id_estudiante, cedula, nombre_completo)
            `)
            .eq('eliminados', true);

        if (error) {
            console.error('Error al obtener trabajos de grado eliminados (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener trabajos de grado eliminados.' });
        }

        const formattedTrabajos = trabajos.map(trabajo => ({
            id_trabajo_grado: trabajo.id_trabajo_grado, 
            periodo: trabajo.periodos ? trabajo.periodos.periodo : null,
            id_periodo: trabajo.periodos ? trabajo.periodos.id_periodo : null,
            nombre_proyecto: trabajo.proyecto, 
            carrera: trabajo.carreras ? trabajo.carreras.carrera : null,
            id_carrera: trabajo.carreras ? trabajo.carreras.id_carrera : null,
            tutor: trabajo.tutores ? { id_tutor: trabajo.tutores.id_tutor, cedula: trabajo.tutores.cedula, nombre_completo: trabajo.tutores.nombre_completo } : null,
            estudiante: trabajo.estudiantes ? { id_estudiante: trabajo.estudiantes.id_estudiante, cedula: trabajo.estudiantes.cedula, nombre_completo: trabajo.estudiantes.nombre_completo } : null,
            estado: trabajo.estado,
            fecha: trabajo.fecha, 
            eliminados: trabajo.eliminados,
            mensaje_eliminacion: trabajo.mensaje_eliminacion
        }));

        res.status(200).json(formattedTrabajos);
    } catch (error) {
        console.error('Error en la ruta /trabajos-de-grado-eliminados (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Agregar nuevo trabajo de grado
router.post('/agregar-trabajo-de-grado', async (req, res) => {
    const {
        periodoId,
        nombreProyecto, 
        estudiante: { cedulaEstudiante, nombreCompletoEstudiante },
        carreraId,
        tutor: { cedulaTutor, nombreCompletoTutor },
        estado,
        fecha 
    } = req.body;

    if (!periodoId || !nombreProyecto || !cedulaEstudiante || !nombreCompletoEstudiante || !carreraId || !cedulaTutor || !nombreCompletoTutor || !estado || !fecha) { 
        return res.status(400).json({ error: 'Faltan campos obligatorios para el trabajo de grado.' });
    }

    try {
        let tutorIdToUse = null;
        // Lógica para manejar el tutor (buscar existente o insertar nuevo)
        let { data: existingTutor, error: tutorSearchError } = await supabase
            .from('tutor')
            .select('id_tutor, cedula, nombre_completo')
            .eq('cedula', cedulaTutor)
            .single();

        if (tutorSearchError && !tutorSearchError.details.includes('0 rows')) {
            console.error('Error al buscar tutor existente:', tutorSearchError.message);
            throw new Error('Error al verificar tutor existente.');
        }

        if (existingTutor) {
            tutorIdToUse = existingTutor.id_tutor;
            if (existingTutor.nombre_completo !== nombreCompletoTutor) {
                const { error: updateTutorError } = await supabase
                    .from('tutor')
                    .update({ nombre_completo: nombreCompletoTutor })
                    .eq('id_tutor', tutorIdToUse);
                if (updateTutorError) {
                    console.error('Error al actualizar nombre del tutor existente:', updateTutorError.message);
                }
            }
        } else {
            const { data: newTutor, error: insertTutorError } = await supabase
                .from('tutor')
                .insert([{ cedula: cedulaTutor, nombre_completo: nombreCompletoTutor }])
                .select('id_tutor')
                .single();

            if (insertTutorError) {
                console.error('Error al insertar nuevo tutor:', insertTutorError.message);
                throw new Error('Error al insertar nuevo tutor.');
            }
            tutorIdToUse = newTutor.id_tutor;
        }

        let estudianteIdToUse = null;
        // Lógica para manejar el estudiante (buscar existente o insertar nuevo)
        let { data: existingStudent, error: studentSearchError } = await supabase
            .from('estudiante')
            .select('id_estudiante, cedula, nombre_completo')
            .eq('cedula', cedulaEstudiante)
            .single();

        if (studentSearchError && !studentSearchError.details.includes('0 rows')) {
            console.error('Error al buscar estudiante existente:', studentSearchError.message);
            throw new Error('Error al verificar estudiante existente.');
        }

        if (existingStudent) {
            estudianteIdToUse = existingStudent.id_estudiante;
            if (existingStudent.nombre_completo !== nombreCompletoEstudiante) {
                const { error: updateStudentError } = await supabase
                    .from('estudiante')
                    .update({ nombre_completo: nombreCompletoEstudiante })
                    .eq('id_estudiante', estudianteIdToUse);
                if (updateStudentError) {
                    console.error('Error al actualizar nombre del estudiante existente:', updateStudentError.message);
                }
            }
        } else {
            const { data: newStudent, error: insertStudentError } = await supabase
                .from('estudiante')
                .insert([{ cedula: cedulaEstudiante, nombre_completo: nombreCompletoEstudiante, id_carrera: carreraId }])
                .select('id_estudiante')
                .single();

            if (insertStudentError) {
                console.error('Error al insertar nuevo estudiante:', insertStudentError.message);
                throw new Error('Error al insertar nuevo estudiante.');
            }
            estudianteIdToUse = newStudent.id_estudiante;
        }

        // Insertar el nuevo trabajo de grado
        const { data: newTrabajo, error: trabajoInsertError } = await supabase
            .from('trabajo_grado') 
            .insert([{
                id_periodo: periodoId,
                proyecto: nombreProyecto, 
                id_carrera: carreraId,
                id_tutor: tutorIdToUse,
                id_estudiante: estudianteIdToUse, 
                estado: estado,
                fecha: fecha, 
                eliminados: false,
                mensaje_eliminacion: null
            }])
            .select('id_trabajo_grado') 
            .single();

        if (trabajoInsertError) {
            console.error('Error al insertar trabajo de grado:', trabajoInsertError.message);
            throw new Error('Error al insertar trabajo de grado.');
        }

        res.status(201).json({ message: 'Trabajo de grado agregado exitosamente.', id_trabajo_grado: newTrabajo.id_trabajo_grado });

    } catch (error) {
        console.error('Error en la ruta /api/agregar-trabajo-de-grado:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor al agregar trabajo de grado.' });
    }
});

// API: Actualizar un trabajo de grado existente
router.put('/trabajos-de-grado/:id', async (req, res) => {
    const trabajoId = req.params.id; 
    const {
        periodoId,
        nombreProyecto, 
        estudiante: { cedulaEstudiante, nombreCompletoEstudiante },
        carreraId,
        tutor: { cedulaTutor, nombreCompletoTutor },
        estado,
        fecha 
    } = req.body;

    if (!periodoId || !nombreProyecto || !cedulaEstudiante || !nombreCompletoEstudiante || !carreraId || !cedulaTutor || !nombreCompletoTutor || !estado || !fecha) { 
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar el trabajo de grado.' });
    }

    try {
        let tutorIdToUse = null;
        // Lógica para manejar el tutor (buscar existente o insertar nuevo)
        let { data: existingTutor, error: tutorSearchError } = await supabase
            .from('tutor')
            .select('id_tutor, cedula, nombre_completo')
            .eq('cedula', cedulaTutor)
            .single();

        if (tutorSearchError && !tutorSearchError.details.includes('0 rows')) {
            console.error('Error al buscar tutor existente para actualización:', tutorSearchError.message);
            throw new Error('Error al verificar tutor existente para actualización.');
        }

        if (existingTutor) {
            tutorIdToUse = existingTutor.id_tutor;
            if (existingTutor.nombre_completo !== nombreCompletoTutor) {
                const { error: updateTutorError } = await supabase
                    .from('tutor')
                    .update({ nombre_completo: nombreCompletoTutor })
                    .eq('id_tutor', tutorIdToUse);
                if (updateTutorError) {
                    console.error('Error al actualizar nombre del tutor existente:', updateTutorError.message);
                }
            }
        } else {
            const { data: newTutor, error: insertTutorError } = await supabase
                .from('tutor')
                .insert([{ cedula: cedulaTutor, nombre_completo: nombreCompletoTutor }])
                .select('id_tutor')
                .single();

            if (insertTutorError) {
                console.error('Error al insertar nuevo tutor durante la edición:', insertTutorError.message);
                throw new Error('Error al insertar nuevo tutor durante la edición.');
            }
            tutorIdToUse = newTutor.id_tutor;
        }

        let estudianteIdToUse = null;
        // Lógica para manejar el estudiante (buscar existente o insertar nuevo)
        let { data: existingStudent, error: studentSearchError } = await supabase
            .from('estudiante')
            .select('id_estudiante, cedula, nombre_completo')
            .eq('cedula', cedulaEstudiante)
            .single();

        if (studentSearchError && !studentSearchError.details.includes('0 rows')) {
            console.error('Error al buscar estudiante existente para actualización:', studentSearchError.message);
            throw new Error('Error al verificar estudiante existente para actualización.');
        }

        if (existingStudent) {
            estudianteIdToUse = existingStudent.id_estudiante;
            if (existingStudent.nombre_completo !== nombreCompletoEstudiante) {
                const { error: updateStudentError } = await supabase
                    .from('estudiante')
                    .update({ nombre_completo: nombreCompletoEstudiante })
                    .eq('id_estudiante', estudianteIdToUse);
                if (updateStudentError) {
                    console.error('Error al actualizar nombre del estudiante existente durante la edición:', updateStudentError.message);
                }
            }
        } else {
            const { data: newStudent, error: insertStudentError } = await supabase
                .from('estudiante')
                .insert([{ cedula: cedulaEstudiante, nombre_completo: nombreCompletoEstudiante, id_carrera: carreraId }])
                .select('id_estudiante')
                .single();

            if (insertStudentError) {
                console.error('Error al insertar nuevo estudiante durante la edición:', insertStudentError.message);
                throw new Error('Error al insertar nuevo estudiante durante la edición.');
            }
            estudianteIdToUse = newStudent.id_estudiante;
        }

        // Actualizar el trabajo de grado
        const { error: trabajoUpdateError } = await supabase
            .from('trabajo_grado') 
            .update({
                id_periodo: periodoId,
                proyecto: nombreProyecto, 
                id_carrera: carreraId,
                id_tutor: tutorIdToUse,
                id_estudiante: estudianteIdToUse,
                estado: estado,
                fecha: fecha 
            })
            .eq('id_trabajo_grado', trabajoId); 

        if (trabajoUpdateError) {
            console.error('Error al actualizar trabajo de grado:', trabajoUpdateError.message);
            throw new Error('Error al actualizar el trabajo de grado.');
        }

        res.status(200).json({ message: 'Trabajo de grado actualizado exitosamente.' });

    } catch (error) {
        console.error('Error en la ruta PUT /api/trabajos-de-grado/:id:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor al actualizar trabajo de grado.' });
    }
});

// API: Eliminar lógicamente un trabajo de grado (marcarlo como eliminado)
router.put('/trabajos-de-grado/eliminar-logico/:id', async (req, res) => {
    const trabajoId = req.params.id; 
    const { mensajeEliminacion } = req.body;

    try {
        const { error } = await supabase
            .from('trabajo_grado') 
            .update({
                eliminados: true,
                mensaje_eliminacion: mensajeEliminacion || null
            })
            .eq('id_trabajo_grado', trabajoId); 

        if (error) {
            console.error('Error al marcar trabajo de grado como eliminado lógicamente:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al eliminar lógicamente el trabajo de grado.' });
        }

        res.status(200).json({ message: 'Trabajo de grado eliminado lógicamente exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /api/trabajos-de-grado/eliminar-logico/:id:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Restaurar un trabajo de grado eliminado lógicamente (marcarlo como no eliminado)
router.put('/trabajos-de-grado/restaurar/:id', async (req, res) => {
    const trabajoId = req.params.id; 

    try {
        const { error } = await supabase
            .from('trabajo_grado') 
            .update({
                eliminados: false,
                mensaje_eliminacion: null
            })
            .eq('id_trabajo_grado', trabajoId); 

        if (error) {
            console.error('Error al restaurar trabajo de grado:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al restaurar el trabajo de grado.' });
        }

        res.status(200).json({ message: 'Trabajo de grado restaurado exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /api/trabajos-de-grado/restaurar/:id:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener datos específicos para generar el PDF de un trabajo de grado
router.get('/trabajos-de-grado/:id/datos-pdf', async (req, res) => {
    const trabajoId = req.params.id;

    try {
        let { data: trabajo, error } = await supabase
            .from('trabajo_grado')
            .select(`
                proyecto,
                estado,
                fecha,
                periodos:id_periodo(periodo),
                carreras:id_carrera(carrera),
                tutores:id_tutor(cedula, nombre_completo),
                estudiante:id_estudiante(cedula, nombre_completo, carreras:id_carrera(carrera))
            `)
            .eq('id_trabajo_grado', trabajoId)
            .single();

        if (error && error.details.includes('0 rows')) {
            return res.status(404).json({ message: 'Trabajo de grado no encontrado.' });
        } else if (error) {
            console.error('Error al obtener trabajo de grado para PDF:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener datos del trabajo de grado.' });
        }

        if (!trabajo) {
            return res.status(404).json({ message: 'Trabajo de grado no encontrado.' });
        }

        // Formatear los datos para el frontend
        const responseData = {
            nombreProyecto: trabajo.proyecto,
            estado: trabajo.estado,
            fecha: trabajo.fecha,
            carrera: trabajo.carreras ? trabajo.carreras.carrera : null,
            periodo: trabajo.periodos ? trabajo.periodos.periodo : null,
            tutorCedula: trabajo.tutores ? trabajo.tutores.cedula : null,
            tutorNombre: trabajo.tutores ? trabajo.tutores.nombre_completo : null,
            estudiante: trabajo.estudiante ? {
                cedula: trabajo.estudiante.cedula,
                nombreCompleto: trabajo.estudiante.nombre_completo,
                carreraEstudiante: trabajo.estudiante.carreras ? trabajo.estudiante.carreras.carrera : 'N/A'
            } : null
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error en la ruta /trabajos-de-grado/:id/datos-pdf:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al obtener datos para PDF.' });
    }
});


export default router;
