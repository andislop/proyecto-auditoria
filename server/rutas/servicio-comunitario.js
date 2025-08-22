import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path'; 
import pdf from 'html-pdf';
import { fileURLToPath } from 'url'; 
import fs from 'fs'; 

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

// API: Obtener todos los proyectos de servicio comunitario (no eliminados)
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
            .eq('eliminados', false); 

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

// API: Obtener proyectos eliminados lógicamente de servicio comunitario
router.get('/proyectos-comunitarios-eliminados', async (req, res) => {
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
            .eq('eliminados', true); // Solo proyectos eliminados

        if (error) {
            console.error('Error al obtener proyectos de servicio comunitario eliminados (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener proyectos eliminados.' });
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
        console.error('Error en la ruta /proyectos-comunitarios-eliminados (Router):', error.message);
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
        integrantes: newIntegrantes, // Array de { cedula, nombreCompleto } de los nuevos integrantes
        carreraId,
        tutor: { cedulaTutor, nombreCompletoTutor },
        fechaInicio,
        fechaFinal,
        estado,
        comunidad
    } = req.body;

    if (!periodoId || !nombreProyecto || !carreraId || !comunidad || !cedulaTutor || !nombreCompletoTutor || !fechaInicio || !fechaFinal || !estado || !newIntegrantes) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar el proyecto.' });
    }

    try {
        // --- Actualización o inserción del tutor ---
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

        // --- Actualización de los datos del proyecto ---
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

        // --- Lógica de actualización de integrantes (estudiantes) ---

        // 1. Obtener las relaciones de integrantes actuales del proyecto
        let { data: currentIntegrantesRelations, error: currentRelationsError } = await supabase
            .from('integrantes')
            .select('id_integrantes, id_estudiante, estudiantes:id_estudiante(cedula)') // También necesitamos la cédula del estudiante vinculado
            .eq('id_servicio', projectId);

        if (currentRelationsError) {
            console.error('Error al obtener relaciones de integrantes actuales:', currentRelationsError.message);
            throw new Error('Error al obtener relaciones de integrantes actuales.');
        }

        // Mapear las cédulas de los estudiantes actualmente vinculados al proyecto
        const currentStudentCedulas = new Set(currentIntegrantesRelations.map(rel => rel.estudiantes.cedula));
        // Mapear las cédulas de los nuevos estudiantes enviados en la solicitud
        const newStudentCedulas = new Set(newIntegrantes.map(i => i.cedula));
        
        const studentsToAddRelations = []; // Nuevas relaciones a insertar
        const relationsToRemoveIds = [];    // IDs de relaciones existentes a eliminar

        // Identificar estudiantes a añadir y actualizar si ya existen
        for (const newIntegrante of newIntegrantes) {
            let estudianteId = null;
            let { data: existingStudent, error: studentSearchError } = await supabase
                .from('estudiante')
                .select('id_estudiante, cedula, nombre_completo')
                .eq('cedula', newIntegrante.cedula)
                .single();

            if (studentSearchError && !studentSearchError.details.includes('0 rows')) {
                console.error('Error al buscar estudiante existente para nuevo integrante:', studentSearchError.message);
                throw new Error('Error al verificar estudiante existente para nuevo integrante.');
            }

            if (existingStudent) {
                estudianteId = existingStudent.id_estudiante;
                // Actualizar nombre si ha cambiado
                if (existingStudent.nombre_completo !== newIntegrante.nombreCompleto) {
                    const { error: updateStudentNameError } = await supabase
                        .from('estudiante')
                        .update({ nombre_completo: newIntegrante.nombreCompleto })
                        .eq('id_estudiante', estudianteId);
                    if (updateStudentNameError) {
                        console.error('Error al actualizar nombre del estudiante existente:', updateStudentNameError.message);
                    }
                }
            } else {
                // Insertar nuevo estudiante si no existe
                const { data: insertedStudent, error: insertStudentError } = await supabase
                    .from('estudiante')
                    .insert([{ cedula: newIntegrante.cedula, nombre_completo: newIntegrante.nombreCompleto, id_carrera: carreraId }])
                    .select('id_estudiante')
                    .single();

                if (insertStudentError) {
                    console.error('Error al insertar nuevo estudiante para integrante:', insertStudentError.message);
                    throw new Error('Error al insertar nuevo estudiante para integrante.');
                }
                estudianteId = insertedStudent.id_estudiante;
            }

            // Si el estudiante (por su cédula) no estaba ya vinculado al proyecto, añadirlo a la lista de inserción
            if (!currentStudentCedulas.has(newIntegrante.cedula)) {
                studentsToAddRelations.push({ id_servicio: projectId, id_estudiante: estudianteId });
            }
        }

        // Identificar relaciones a eliminar (estudiantes que estaban antes y ya no están en la lista `newIntegrantes`)
        for (const currentRelation of currentIntegrantesRelations) {
            const currentStudentCedula = currentRelation.estudiantes.cedula;
            
            // Si la cédula del estudiante actual no está en la lista de nuevos integrantes, 
            // marcamos esta relación para eliminación
            if (!newStudentCedulas.has(currentStudentCedula)) {
                 relationsToRemoveIds.push(currentRelation.id_integrantes);
            }
        }
        
        // Realizar la eliminación de relaciones antiguas
        if (relationsToRemoveIds.length > 0) {
            const { error: deleteRelationsError } = await supabase
                .from('integrantes')
                .delete()
                .in('id_integrantes', relationsToRemoveIds);

            if (deleteRelationsError) {
                console.error('Error al eliminar relaciones de integrantes antiguas:', deleteRelationsError.message);
                throw new Error('Error al eliminar relaciones de integrantes antiguas.');
            }
        }

        // Realizar la inserción de nuevas relaciones
        if (studentsToAddRelations.length > 0) {
            const { error: insertNewRelationsError } = await supabase
                .from('integrantes')
                .insert(studentsToAddRelations);

            if (insertNewRelationsError) {
                console.error('Error al insertar nuevas relaciones de integrantes:', insertNewRelationsError.message);
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
router.get('/proyectos-comunitarios/:id/descargar-pdf', async (req, res) => {
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

        // Obtener la ruta absoluta del logo (solo el izquierdo)
        const logoPathLeft = path.join(__dirname, '../../public/assets/img/unefa.png'); 
        
        let logoDataUrlLeft = '';

        try {
            const logoBase64Left = fs.readFileSync(logoPathLeft, { encoding: 'base64' });
            logoDataUrlLeft = `data:image/png;base64,${logoBase64Left}`;
        } catch (readError) {
            console.warn(`Advertencia: No se pudo leer el logo en ${logoPathLeft}. Usando placeholder.`);
            logoDataUrlLeft = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABtklEQVR4nO3bwU3DQBiA4f+XlXIKcAdwB3AH7gDuAK2gU5gJvQJqQTsJnYAn7gDuAK1gC9tL5M/Ld35P088JgY/AHz90J4iIiIiIiIiIiMh54L/A9u/Pnz8/y/L35+fnh1n5+/v79z/Q/vj8/f/A4C/v7/9jYDrXwB/f3/7GQFcfwL8/f3sBQBffwb8/f3sBQB8/xz8/v72A/C/yA/A80kYgR8hN0gC/MhOkAeRnxY4fQd+h9I98B3kKekGeR1JmB/yJpI2Z8QGZ+Q3lQd3Z/J+2/A1kjd7xAYZ6eHdkXfA95GUuYJvJXN2SHd0HdwI5J2m8R8p28iM7ov5AnkJSZxn8t3pXNyd3Y/kKekjTHxSvk1Oid3Yy7IfcE0xvk4A6f+c/2xN9E0xsXh4w1f3t7e/sDfgB+f397B8g+fwP8/f3tB8i+v/8P8Pf3tB8g+v/9P8LfbP9N/P379+8f/35+fr5d/X3/9/Pz80EAn5+f/+c/IiIiIiIiIiIiImIq/gEWm+7p21C7AAAAAElFTkSuQmCC';
        }


        // Obtener la ruta al binario de phantomjs-prebuilt de forma más robusta
        const phantomjsPath = fileURLToPath(import.meta.resolve('phantomjs-prebuilt/lib/phantom/bin/phantomjs'));

        // Formatear integrantes para la tabla del PDF
        const integrantesTableRows = project.integrantes_servicio_comunitario
            .map(i => i.estudiantes)
            .filter(Boolean)
            .map(e => `
                <tr>
                    <td>${e.cedula || 'N/A'}</td>
                    <td>${e.nombre_completo || 'N/A'}</td>
                    <td>${e.carreras ? e.carreras.carrera : 'N/A'}</td>
                </tr>
            `).join('');


        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Comprobante de Servicio Comunitario</title>
                <style>
                    body {
                        font-family: 'Arial', sans-serif; 
                        margin: 0; 
                        padding: 1cm; 
                        color: #333;
                        position: relative;
                        box-sizing: border-box; 
                    }
                    .header {
                        text-align: center; 
                        margin-bottom: 25px; 
                        position: relative; 
                        min-height: 100px; 
                        padding-left: 110px; 
                        padding-right: 0; 
                    }
                    .header .logo-left {
                        position: absolute; 
                        top: 0; 
                        left: 0; 
                        height: 90px; 
                        width: auto;
                        max-width: 90px; 
                        object-fit: contain; 
                    }
                    .header h1, .header h2, .header h3 {
                        margin: 0 auto; 
                        line-height: 1.1; 
                        padding: 1px 0; 
                        width: calc(100% - 110px); 
                    }
                    .header h1 { 
                        font-size: 15px; 
                        font-weight: normal; 
                    }
                    .header h2 { 
                        font-size: 14px; 
                        font-weight: normal; 
                    } 
                    .header h3 { 
                        font-size: 13px; 
                        font-weight: normal; 
                        margin-top: 4px; 
                    } 
                    .header .unefa-line {
                        font-size: 13px; 
                        font-weight: bold; 
                        margin-top: 8px; 
                    }
                    .header .nucleo-line {
                        font-size: 12px; 
                        font-weight: normal;
                        margin-top: 4px; 
                    }

                    .document-title {
                        text-align: center;
                        font-size: 20px; 
                        font-weight: bold;
                        margin: 25px 0 20px 0; 
                        color: #2a3e61; 
                    }
                    .section {
                        margin-bottom: 15px; 
                    }
                    .section h4 {
                        font-size: 14px; 
                        color: #2a3e61;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 5px;
                        margin-bottom: 10px; 
                    }
                    .data-item {
                        margin-bottom: 6px; 
                        font-size: 12px; 
                    }
                    .data-item strong {
                        display: inline-block;
                        width: 130px; 
                        color: #555;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px; 
                        font-size: 11px; 
                        page-break-inside: auto; 
                        break-after: auto; 
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 7px; 
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                        color: #2a3e61;
                    }
                    .signature-container {
                        page-break-inside: avoid; 
                        text-align: center;
                        margin-top: 100px; 
                    }
                    .signature-line {
                        display: block; 
                        border-top: 1px solid #000;
                        width: 250px; 
                        margin: 0 auto; 
                        margin-bottom: 8px; 
                    }
                    .signature-text {
                        font-size: 12px; 
                        display: block; 
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoDataUrlLeft}" alt="Logo UNEFA" class="logo-left">
                    <h1>REPÚBLICA BOLIVARIANA DE VENEZUELA</h1>
                    <h2>MINISTERIO DEL PODER POPULAR PARA LA DEFENSA</h2>
                    <h2>VICEMINISTERIO DE EDUCACIÓN PARA LA DEFENSA</h2>
                    <h2>UNIVERSIDAD NACIONAL EXPERIMENTAL POLITÉCNICA DE LA FUERZA ARMADA NACIONAL BOLIVARIANA</h2>
                    <h3 class="unefa-line">U.N.E.F.A.</h3>
                    <h3 class="nucleo-line">NÚCLEO: LARA BARQUISIMETO</h3>
                </div>

                <h1 class="document-title">COMPROBANTE DE SERVICIO COMUNITARIO</h1>

                <div class="section">
                    <h4>Datos del Proyecto</h4>
                    <div class="data-item"><strong>Nombre del Proyecto:</strong> ${project.proyecto || 'N/A'}</div>
                    <div class="data-item"><strong>Periodo:</strong> ${project.periodos ? project.periodos.periodo : 'N/A'}</div>
                    <div class="data-item"><strong>Carrera:</strong> ${project.carreras ? project.carreras.carrera : 'N/A'}</div>
                    <div class="data-item"><strong>Comunidad:</strong> ${project.comunidad || 'N/A'}</div>
                    <div class="data-item"><strong>Estado:</strong> ${project.estado || 'N/A'}</div>
                    <div class="data-item"><strong>Fecha Inicio:</strong> ${new Date(project.fecha_inicio).toLocaleDateString('es-ES') || 'N/A'}</div>
                    <div class="data-item"><strong>Fecha Final:</strong> ${new Date(project.fecha_final).toLocaleDateString('es-ES') || 'N/A'}</div>
                </div>

                <div class="section">
                    <h4>Datos del Tutor</h4>
                    <div class="data-item"><strong>Cédula:</strong> ${project.tutores ? project.tutores.cedula : 'N/A'}</div>
                    <div class="data-item"><strong>Nombre Completo:</strong> ${project.tutores ? project.tutores.nombre_completo : 'N/A'}</div>
                </div>

                <div class="section">
                    <h4>Integrantes del Proyecto</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Cédula</th>
                                <th>Nombre Completo</th>
                                <th>Carrera del Estudiante</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${integrantesTableRows || '<tr><td colspan="3">No hay integrantes registrados.</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div class="signature-container">
                    <div class="signature-line"></div>
                    <span class="signature-text">Firma del Administrador / Jefe de Área Académica</span>
                </div>
            </body>
            </html>
        `;

        const options = {
            format: 'Letter',
            orientation: 'portrait',
            border: { 
                top: "0cm", 
                right: "0cm",
                bottom: "0cm",
                left: "0cm"
            },
            base: `file:///${path.resolve(__dirname, '../../public')}/`, 
            phantomPath: phantomjsPath,
            header: {
                height: "0mm"
            },
            footer: {
                height: "0mm"
            }
        };

        pdf.create(htmlContent, options).toStream((err, stream) => {
            if (err) {
                console.error('Error al generar PDF:', err);
                return res.status(500).json({ error: 'Error al generar el PDF.' });
            }
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Comprobante_Servicio_Comunitario_${projectId}.pdf"`
            });
            stream.pipe(res);
        });

    } catch (error) {
        console.error('Error en la ruta /proyectos-comunitarios/:id/descargar-pdf:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al generar PDF.' });
    }
});


export default router;
