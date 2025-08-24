import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path'; // Importa path de forma estándar
import pdf from 'html-pdf';
import { fileURLToPath } from 'url'; // Necesario para convertir URL a path de sistema de archivos
import fs from 'fs'; // Importamos el módulo 'fs' para leer archivos

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

// =======================================================
// APIs PARA SERVICIO COMUNITARIO
// =======================================================

// API: Obtener todos los proyectos de servicio comunitario (ahora filtra por eliminado_logico = false)
router.get('/proyectos-comunitarios', async (req, res) => {
    try {
        let { data: proyectos, error } = await supabase
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
                carreras:id_carrera(id_carrera, carrera),
                periodos:id_periodo(id_periodo, periodo),
                tutores:id_tutor(id_tutor, cedula, nombre_completo),
                integrantes_servicio_comunitario:integrantes(
                    estudiantes:id_estudiante(id_estudiante, cedula, nombre_completo, id_carrera)
                )
            `)
            .eq('eliminados', false); // FIX: Filtrar solo proyectos no eliminados

        if (error) {
            console.error('Error al obtener proyectos de servicio comunitario (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener proyectos.' });
        }

        const formattedProjects = proyectos.map(proyecto => {
            const integrantes = proyecto.integrantes_servicio_comunitario
                .map(i => i.estudiantes)
                .filter(Boolean)
                .map(e => ({ id_estudiante: e.id_estudiante, cedula: e.cedula, nombre_completo: e.nombre_completo, id_carrera: e.id_carrera }));

            return {
                id_servicio: proyecto.id_servicio,
                periodo: proyecto.periodos ? proyecto.periodos.periodo : null,
                id_periodo: proyecto.periodos ? proyecto.periodos.id_periodo : null,
                nombre_proyecto: proyecto.proyecto,
                integrantes: integrantes,
                carrera: proyecto.carreras ? proyecto.carreras.carrera : null,
                id_carrera: proyecto.carreras ? proyecto.carreras.id_carrera : null,
                tutor: proyecto.tutores ? { id_tutor: proyecto.tutores.id_tutor, cedula: proyecto.tutores.cedula, nombre_completo: proyecto.tutores.nombre_completo } : null,
                fecha_inicio: proyecto.fecha_inicio,
                fecha_final: proyecto.fecha_final,
                estado: proyecto.estado,
                comunidad: proyecto.comunidad,
                eliminados: proyecto.eliminados,
                mensaje_eliminacion: proyecto.mensaje_eliminacion
            };
        });

        res.status(200).json(formattedProjects);
    } catch (error) {
        console.error('Error en la ruta /proyectos-comunitarios (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener proyectos eliminados lógicamente
router.get('/proyectos-eliminados', async (req, res) => {
    try {
        let { data: proyectos, error } = await supabase
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
                carreras:id_carrera(id_carrera, carrera),
                periodos:id_periodo(id_periodo, periodo),
                tutores:id_tutor(id_tutor, cedula, nombre_completo)
            `)
            .eq('eliminados', true); // Solo proyectos eliminados

        if (error) {
            console.error('Error al obtener proyectos eliminados (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener proyectos eliminados.' });
        }

        const formattedProjects = proyectos.map(proyecto => {
            return {
                id_servicio: proyecto.id_servicio,
                periodo: proyecto.periodos ? proyecto.periodos.periodo : null,
                id_periodo: proyecto.periodos ? proyecto.periodos.id_periodo : null,
                nombre_proyecto: proyecto.proyecto,
                carrera: proyecto.carreras ? proyecto.carreras.carrera : null,
                id_carrera: proyecto.carreras ? proyecto.carreras.id_carrera : null,
                tutor: proyecto.tutores ? { id_tutor: proyecto.tutores.id_tutor, cedula: proyecto.tutores.cedula, nombre_completo: proyecto.tutores.nombre_completo } : null,
                fecha_inicio: proyecto.fecha_inicio,
                fecha_final: proyecto.fecha_final,
                estado: proyecto.estado,
                comunidad: proyecto.comunidad,
                eliminados: proyecto.eliminados,
                mensaje_eliminacion: proyecto.mensaje_eliminacion
            };
        });

        res.status(200).json(formattedProjects);
    } catch (error) {
        console.error('Error en la ruta /proyectos-eliminados (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener todas las carreras
router.get('/carreras', async (req, res) => {
    try {
        let { data: carreras, error } = await supabase
            .from('carrera')
            .select('id_carrera, carrera');

        if (error) {
            console.error('Error al obtener carreras (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener carreras.' });
        }
        res.status(200).json(carreras);
    } catch (error) {
        console.error('Error en la ruta /carreras (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener todos los periodos
router.get('/periodos', async (req, res) => {
    try {
        let { data: periodos, error } = await supabase
            .from('periodo')
            .select('id_periodo, periodo');

        if (error) {
            console.error('Error al obtener periodos (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener periodos.' });
        }
        res.status(200).json(periodos);
    } catch (error) {
        console.error('Error en la ruta /periodos (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Buscar estudiante por cédula
router.get('/estudiante-por-cedula/:cedula', async (req, res) => {
    try {
        const { cedula } = req.params;
        let { data: estudiante, error } = await supabase
            .from('estudiante')
            .select('id_estudiante, cedula, nombre_completo')
            .eq('cedula', cedula)
            .single();

        if (error && error.details.includes('0 rows')) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        } else if (error) {
            console.error('Error al buscar estudiante por cédula (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        res.status(200).json(estudiante);
    } catch (error) {
        console.error('Error en la ruta /estudiante-por-cedula (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Buscar tutor por cédula
router.get('/tutor-por-cedula/:cedula', async (req, res) => {
    try {
        const { cedula } = req.params;
        let { data: tutor, error } = await supabase
            .from('tutor')
            .select('id_tutor, cedula, nombre_completo')
            .eq('cedula', cedula)
            .single();

        if (error && error.details.includes('0 rows')) {
            return res.status(404).json({ message: 'Tutor no encontrado.' });
        } else if (error) {
            console.error('Error al buscar tutor por cédula (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        res.status(200).json(tutor);
    } catch (error) {
        console.error('Error en la ruta /tutor-por-cedula (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Agregar nuevo proyecto de servicio comunitario
router.post('/agregar-proyecto-comunitario', async (req, res) => {
    const {
        periodoId,
        nombreProyecto,
        integrantes,
        carreraId,
        tutor: { cedulaTutor, nombreCompletoTutor },
        fechaInicio,
        fechaFinal,
        estado,
        comunidad
    } = req.body;

    if (!periodoId || !nombreProyecto || !carreraId || !comunidad || !cedulaTutor || !nombreCompletoTutor || !fechaInicio || !fechaFinal || !estado || !integrantes || integrantes.length === 0) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para el proyecto.' });
    }


    try {
        let tutorIdToUse = null;

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

        const { data: newProject, error: projectInsertError } = await supabase
            .from('servicio_comunitario')
            .insert([{
                id_periodo: periodoId,
                proyecto: nombreProyecto,
                comunidad: comunidad,
                estado: estado,
                fecha_inicio: fechaInicio,
                fecha_final: fechaFinal,
                id_carrera: carreraId,
                id_tutor: tutorIdToUse,
                eliminados: false,
                mensaje_eliminacion: null
            }])
            .select('id_servicio')
            .single();

        if (projectInsertError) {
            console.error('Error al insertar proyecto de servicio comunitario:', projectInsertError.message);
            throw new Error('Error al insertar proyecto.');
        }

        const idServicio = newProject.id_servicio;

        const integrantesToInsert = [];
        for (const integrante of integrantes) {
            let estudianteIdToUse = null;

            let { data: existingStudent, error: studentSearchError } = await supabase
                .from('estudiante')
                .select('id_estudiante, cedula, nombre_completo')
                .eq('cedula', integrante.cedula)
                .single();

            if (studentSearchError && !studentSearchError.details.includes('0 rows')) {
                console.error('Error al buscar estudiante existente:', studentSearchError.message);
                throw new Error('Error al verificar estudiante existente.');
            }

            if (existingStudent) {
                estudianteIdToUse = existingStudent.id_estudiante;
                if (existingStudent.nombre_completo !== integrante.nombreCompleto) {
                    const { error: updateStudentError } = await supabase
                        .from('estudiante')
                        .update({ nombre_completo: integrante.nombreCompleto })
                        .eq('id_estudiante', estudianteIdToUse);
                    if (updateStudentError) {
                        console.error('Error al actualizar nombre del estudiante existente:', updateStudentError.message);
                    }
                }
            } else {
                const { data: newStudent, error: insertStudentError } = await supabase
                    .from('estudiante')
                    .insert([{ cedula: integrante.cedula, nombre_completo: integrante.nombreCompleto, id_carrera: carreraId }])
                    .select('id_estudiante')
                    .single();

                if (insertStudentError) {
                    console.error('Error al insertar nuevo estudiante:', insertStudentError.message);
                    throw new Error('Error al insertar nuevo estudiante.');
                }
                estudianteIdToUse = newStudent.id_estudiante;
            }

            integrantesToInsert.push({ id_servicio: idServicio, id_estudiante: estudianteIdToUse });
        }

        if (integrantesToInsert.length > 0) {
            const { error: insertIntegrantesError } = await supabase
                .from('integrantes')
                .insert(integrantesToInsert);

            if (insertIntegrantesError) {
                console.error('Error al insertar integrantes:', insertIntegrantesError.message);
                throw new Error('Error al insertar integrantes del proyecto.');
            }
        }

        res.status(201).json({ message: 'Proyecto agregado exitosamente.', id_servicio: idServicio });

    } catch (error) {
        console.error('Error en la ruta /api/agregar-proyecto-comunitario:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor al agregar proyecto.' });
    }
});

// API: Actualizar un proyecto de servicio comunitario existente
router.put('/proyectos-comunitarios/:id', async (req, res) => {
    const projectId = req.params.id;
    const {
        periodoId,
        nombreProyecto,
        integrantes: newIntegrantes,
        carreraId,
        tutor: { cedulaTutor, nombreCompletoTutor },
        fechaInicio,
        fechaFinal,
        estado,
        comunidad
    } = req.body;

    if (!periodoId || !nombreProyecto || !carreraId || !comunidad || !cedulaTutor || !nombreCompletoTutor || !fechaInicio || !fechaFinal || !estado || !newIntegrantes || newIntegrantes.length === 0) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar el proyecto.' });
    }

    try {
        let tutorIdToUse = null;
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
                console.error('Error al insertar nuevo tutor:', insertTutorError.message);
                throw new Error('Error al insertar nuevo tutor.');
            }
            tutorIdToUse = newTutor.id_tutor;
        }

        const { error: projectUpdateError } = await supabase
            .from('servicio_comunitario')
            .update({
                id_periodo: periodoId,
                proyecto: nombreProyecto,
                comunidad: comunidad,
                estado: estado,
                fecha_inicio: fechaInicio,
                fecha_final: fechaFinal,
                id_carrera: carreraId,
                id_tutor: tutorIdToUse
            })
            .eq('id_servicio', projectId);

        if (projectUpdateError) {
            console.error('Error al actualizar proyecto de servicio comunitario:', projectUpdateError.message);
            throw new Error('Error al actualizar el proyecto.');
        }

        let { data: currentIntegrantes, error: currentIntegrantesError } = await supabase
            .from('integrantes')
            .select(`
                id_integrantes, 
                estudiantes:id_estudiante(id_estudiante, cedula, nombre_completo)
            `)
            .eq('id_servicio', projectId);

        if (currentIntegrantesError) {
            console.error('Error al obtener integrantes actuales para actualización:', currentIntegrantesError.message);
            throw new Error('Error al obtener integrantes actuales del proyecto.');
        }

        const currentStudentIds = new Set(currentIntegrantes.map(i => i.estudiantes.id_estudiante));
        const newStudentCedulas = new Set(newIntegrantes.map(i => i.cedula));

        const studentsToAdd = [];
        const studentIdsToRemove = [];

        for (const newIntegrante of newIntegrantes) {
            let estudianteId = newIntegrante.id;
            let existingStudentData = null;

            if (!estudianteId) {
                let { data: existingStudent, error: studentSearchError } = await supabase
                    .from('estudiante')
                    .select('id_estudiante, cedula, nombre_completo')
                    .eq('cedula', newIntegrante.cedula)
                    .single();
                
                if (studentSearchError && !studentSearchError.details.includes('0 rows')) {
                    console.error('Error al buscar estudiante por cédula durante la edición:', studentSearchError.message);
                    throw new Error('Error al verificar estudiante existente durante la edición.');
                }
                existingStudentData = existingStudent;
                if (existingStudent) {
                    estudianteId = existingStudent.id_estudiante;
                }
            } else {
                let { data: existingStudent, error: studentFetchError } = await supabase
                    .from('estudiante')
                    .select('id_estudiante, cedula, nombre_completo')
                    .eq('id_estudiante', estudianteId)
                    .single();
                
                if (studentFetchError) {
                    console.error('Error al buscar estudiante por ID durante la edición:', studentFetchError.message);
                    throw new Error('Error al verificar estudiante existente por ID durante la edición.');
                }
                existingStudentData = existingStudent;
            }

            if (!estudianteId) {
                const { data: insertedStudent, error: insertStudentError } = await supabase
                    .from('estudiante')
                    .insert([{ cedula: newIntegrante.cedula, nombre_completo: newIntegrante.nombreCompleto, id_carrera: carreraId }])
                    .select('id_estudiante')
                    .single();

                if (insertStudentError) {
                    console.error('Error al insertar nuevo estudiante durante la edición:', insertStudentError.message);
                    throw new Error('Error al insertar nuevo estudiante durante la edición.');
                }
                estudianteId = insertedStudent.id_estudiante;
            } else {
                if (existingStudentData && existingStudentData.nombre_completo !== newIntegrante.nombreCompleto) {
                    const { error: updateStudentNameError } = await supabase
                        .from('estudiante')
                        .update({ nombre_completo: newIntegrante.nombreCompleto })
                        .eq('id_estudiante', estudianteId);
                    if (updateStudentNameError) {
                        console.error('Error al actualizar nombre del estudiante existente durante la edición:', updateStudentNameError.message);
                    }
                }
            }

            if (!studentsToAdd.some(s => s.id_estudiante === estudianteId) && !currentStudentIds.has(estudianteId)) {
                studentsToAdd.push({ id_servicio: projectId, id_estudiante: estudianteId });
            }
        }

        for (const currentIntegrante of currentIntegrantes) {
            const currentCedula = currentIntegrante.estudiantes.cedula;
            if (!newIntegrantes.some(ni => ni.cedula === currentCedula)) { 
                studentIdsToRemove.push(currentIntegrante.estudiantes.id_estudiante);
            }
        }

        if (studentIdsToRemove.length > 0) {
            const { error: deleteIntegrantesError } = await supabase
                .from('integrantes')
                .delete()
                .eq('id_servicio', projectId)
                .in('id_estudiante', studentIdsToRemove);

            if (deleteIntegrantesError) {
                console.error('Error al eliminar relaciones de integrantes:', deleteIntegrantesError.message);
                throw new Error('Error al eliminar relaciones de integrantes.');
            }
        }

        if (studentsToAdd.length > 0) {
            const { error: insertNewIntegrantesError } = await supabase
                .from('integrantes')
                .insert(studentsToAdd);

            if (insertNewIntegrantesError) {
                console.error('Error al insertar nuevas relaciones de integrantes:', insertNewIntegrantesError.message);
                throw new Error('Error al insertar nuevas relaciones de integrantes.');
            }
        }

        res.status(200).json({ message: 'Proyecto actualizado exitosamente.' });

    } catch (error) {
        console.error('Error en la ruta PUT /api/proyectos-comunitarios/:id:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor al actualizar proyecto.' });
    }
});

// API: Eliminar lógicamente un proyecto (marcarlo como eliminado)
router.put('/proyectos-comunitarios/eliminar-logico/:id', async (req, res) => {
    const projectId = req.params.id;
    const { mensajeEliminacion } = req.body;

    try {
        const { error } = await supabase
            .from('servicio_comunitario')
            .update({
                eliminados: true,
                mensaje_eliminacion: mensajeEliminacion || null
            })
            .eq('id_servicio', projectId);

        if (error) {
            console.error('Error al marcar proyecto como eliminado lógicamente:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al eliminar lógicamente el proyecto.' });
        }

        res.status(200).json({ message: 'Proyecto eliminado lógicamente exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /api/proyectos-comunitarios/eliminar-logico/:id:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Restaurar un proyecto eliminado lógicamente (marcarlo como no eliminado)
router.put('/proyectos-comunitarios/restaurar/:id', async (req, res) => {
    const projectId = req.params.id;

    try {
        const { error } = await supabase
            .from('servicio_comunitario')
            .update({
                eliminados: false,
                mensaje_eliminacion: null
            })
            .eq('id_servicio', projectId);

        if (error) {
            console.error('Error al restaurar proyecto:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al restaurar el proyecto.' });
        }

        res.status(200).json({ message: 'Proyecto restaurado exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /api/proyectos-comunitarios/restaurar/:id:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// API: Generar PDF para un proyecto de servicio comunitario
router.get('/proyectos-comunitarios/:id/datos-pdf', async (req, res) => { // Cambiado a /datos-pdf para que el frontend obtenga los datos
    const projectId = req.params.id;

    try {
        let { data: project, error } = await supabase
            .from('servicio_comunitario')
            .select(`
                proyecto,
                comunidad,
                estado,
                fecha_inicio,
                fecha_final,
                carreras:id_carrera(carrera),
                periodos:id_periodo(periodo),
                tutores:id_tutor(cedula, nombre_completo),
                integrantes_servicio_comunitario:integrantes(
                    estudiantes:id_estudiante(cedula, nombre_completo, carreras:id_carrera(carrera))
                )
            `)
            .eq('id_servicio', projectId)
            .single();

        if (error && error.details.includes('0 rows')) {
            return res.status(404).json({ message: 'Proyecto no encontrado.' });
        } else if (error) {
            console.error('Error al obtener proyecto para PDF:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener datos del proyecto.' });
        }

        if (!project) {
            return res.status(404).json({ message: 'Proyecto no encontrado.' });
        }

        // Formatear los datos para el frontend (incluyendo la carrera de cada estudiante)
        const formattedIntegrantes = project.integrantes_servicio_comunitario
            .map(i => i.estudiantes)
            .filter(Boolean)
            .map(e => ({
                cedula: e.cedula,
                nombreCompleto: e.nombre_completo,
                carreraEstudiante: e.carreras ? e.carreras.carrera : 'N/A' // Obtener la carrera del estudiante
            }));

        const responseData = {
            nombreProyecto: project.proyecto,
            comunidad: project.comunidad,
            estado: project.estado,
            fechaInicio: project.fecha_inicio,
            fechaFinal: project.fecha_final,
            carrera: project.carreras ? project.carreras.carrera : null,
            periodo: project.periodos ? project.periodos.periodo : null,
            tutorCedula: project.tutores ? project.tutores.cedula : null,
            tutorNombre: project.tutores ? project.tutores.nombre_completo : null,
            integrantes: formattedIntegrantes
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error en la ruta /proyectos-comunitarios/:id/datos-pdf:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al obtener datos para PDF.' });
    }
});


export default router;
