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
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas en proyectos-investigacion.js');
}
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();

// =======================================================
// APIs PARA PROYECTOS DE INVESTIGACIÓN
// =======================================================

// API: Obtener todos los proyectos de investigación (no eliminados)
router.get('/proyectos-investigacion', async (req, res) => {
    try {
        let { data: proyectos, error } = await supabase
            .from('proyectos_investigacion')
            .select(`
                id_proyecto_investigacion,
                proyecto,
                estado,
                eliminados,
                mensaje_eliminacion,
                carreras:id_carrera(carrera),
                periodos:id_periodo(periodo),
                estudiantes:id_estudiante(cedula, nombre_completo, carreras:id_carrera(carrera)) // Se añadió la carrera del estudiante
            `)
            .eq('eliminados', false); // Solo proyectos no eliminados lógicamente

        if (error) {
            console.error('Error al obtener proyectos de investigación:', error.message);
            return res.status(500).json({ error: 'Error al obtener proyectos de investigación.' });
        }

        const formattedProjects = proyectos.map(project => {
            const estudianteDisplay = project.estudiantes ? `${project.estudiantes.cedula} - ${project.estudiantes.nombre_completo}` : 'N/A';
            const estudianteCarrera = project.estudiantes?.carreras?.carrera || 'N/A';

            return {
                ...project,
                estudiante: {
                    cedula: project.estudiantes?.cedula,
                    nombre_completo: project.estudiantes?.nombre_completo,
                    carrera: estudianteCarrera // Incluimos la carrera del estudiante
                },
                periodo: project.periodos?.periodo,
                carrera: project.carreras?.carrera, // Carrera del proyecto
                estudianteDisplay: estudianteDisplay
            };
        });

        res.status(200).json(formattedProjects);

    } catch (error) {
        console.error('Error en la ruta /proyectos-investigacion:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener un proyecto de investigación por ID
router.get('/proyectos-investigacion/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let { data: proyecto, error } = await supabase
            .from('proyectos_investigacion')
            .select(`
                id_proyecto_investigacion,
                proyecto,
                estado,
                eliminados,
                mensaje_eliminacion,
                id_carrera,
                id_periodo,
                id_estudiante,
                carreras:id_carrera(carrera),
                periodos:id_periodo(periodo),
                estudiantes:id_estudiante(cedula, nombre_completo, carreras:id_carrera(carrera)) // Se añadió la carrera del estudiante
            `)
            .eq('id_proyecto_investigacion', id)
            .single();

        if (error) {
            console.error('Error al obtener proyecto de investigación por ID:', error.message);
            return res.status(404).json({ error: 'Proyecto de investigación no encontrado.' });
        }
        res.status(200).json(proyecto);
    } catch (error) {
        console.error('Error en la ruta /proyectos-investigacion/:id:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// API: Agregar un nuevo proyecto de investigación
router.post('/agregar-proyecto-investigacion', async (req, res) => {
    const { periodoId, nombreProyecto, estudiante, carreraId, estado } = req.body;

    try {
        // Verificar si el estudiante existe, o crearlo si es necesario (similar a Servicio Comunitario)
        let idEstudiante = estudiante.idEstudiante; // Usar idEstudiante que viene del frontend
        if (!idEstudiante) {
            let { data: existingStudent, error: studentCheckError } = await supabase
                .from('estudiante') 
                .select('id_estudiante, nombre_completo') // Agregamos nombre_completo para la verificación
                .eq('cedula', estudiante.cedulaEstudiante)
                .single();

            if (studentCheckError && studentCheckError.code !== 'PGRST116') { // PGRST116: No rows found
                console.error('Error al buscar estudiante:', studentCheckError.message);
                throw new Error('Error al verificar estudiante.');
            }

            if (existingStudent) {
                idEstudiante = existingStudent.id_estudiante;
                // Si el estudiante existe, actualizar su nombre si ha cambiado
                if (existingStudent.nombre_completo !== estudiante.nombreCompletoEstudiante) {
                    const { error: updateStudentError } = await supabase
                        .from('estudiante') 
                        .update({ nombre_completo: estudiante.nombreCompletoEstudiante })
                        .eq('id_estudiante', idEstudiante);
                    if (updateStudentError) {
                        console.error('Error al actualizar nombre del estudiante existente:', updateStudentError.message);
                    }
                }
            } else {
                const { data: newStudent, error: newStudentError } = await supabase
                    .from('estudiante') 
                    .insert([{ cedula: estudiante.cedulaEstudiante, nombre_completo: estudiante.nombreCompletoEstudiante, id_carrera: carreraId }]) // Incluir id_carrera al crear estudiante
                    .select('id_estudiante')
                    .single();
                if (newStudentError) {
                    console.error('Error al crear estudiante:', newStudentError.message);
                    throw new Error('Error al crear estudiante.');
                }
                idEstudiante = newStudent.id_estudiante;
            }
        } else {
            // Si el estudiante ya tiene un ID, verificar si el nombre ha cambiado y actualizarlo
            const { error: updateStudentError } = await supabase
                .from('estudiante') 
                .update({ nombre_completo: estudiante.nombreCompletoEstudiante, id_carrera: carreraId }) // Asegurarse de actualizar la carrera también
                .eq('id_estudiante', idEstudiante);

            if (updateStudentError) {
                console.error('Error al actualizar nombre y/o carrera del estudiante:', updateStudentError.message);
                throw new Error('Error al actualizar nombre y/o carrera del estudiante.');
            }
        }

        // Insertar el nuevo proyecto de investigación
        const { data, error } = await supabase
            .from('proyectos_investigacion')
            .insert([
                {
                    id_periodo: periodoId,
                    proyecto: nombreProyecto,
                    id_estudiante: idEstudiante,
                    id_carrera: carreraId,
                    estado: estado,
                    eliminados: false,
                    mensaje_eliminacion: null // Asegurar que sea nulo al crear
                }
            ])
            .select('*');

        if (error) {
            console.error('Error al agregar proyecto de investigación:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al agregar proyecto.' });
        }
        res.status(201).json({ message: 'Proyecto de investigación agregado exitosamente.', project: data[0] });

    } catch (error) {
        console.error('Error en la ruta POST /agregar-proyecto-investigacion:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    }
});

// API: Actualizar un proyecto de investigación
router.put('/proyectos-investigacion/:id', async (req, res) => {
    const { id } = req.params;
    const { periodoId, nombreProyecto, estudiante, carreraId, estado } = req.body;

    try {
        // Verificar si el estudiante existe, o crearlo si es necesario
        let idEstudiante = estudiante.idEstudiante; // Usar idEstudiante que viene del frontend
        if (!idEstudiante) {
            let { data: existingStudent, error: studentCheckError } = await supabase
                .from('estudiante') 
                .select('id_estudiante, nombre_completo') // Agregamos nombre_completo para la verificación
                .eq('cedula', estudiante.cedulaEstudiante)
                .single();

            if (studentCheckError && studentCheckError.code !== 'PGRST116') { // PGRST116: No rows found
                console.error('Error al buscar estudiante:', studentCheckError.message);
                throw new Error('Error al verificar estudiante.');
            }

            if (existingStudent) {
                idEstudiante = existingStudent.id_estudiante;
                // Si el estudiante existe, actualizar su nombre si ha cambiado
                if (existingStudent.nombre_completo !== estudiante.nombreCompletoEstudiante) {
                    const { error: updateStudentError } = await supabase
                        .from('estudiante') 
                        .update({ nombre_completo: estudiante.nombreCompletoEstudiante })
                        .eq('id_estudiante', idEstudiante);
                    if (updateStudentError) {
                        console.error('Error al actualizar nombre del estudiante existente:', updateStudentError.message);
                    }
                }
            } else {
                const { data: newStudent, error: newStudentError } = await supabase
                    .from('estudiante') 
                    .insert([{ cedula: estudiante.cedulaEstudiante, nombre_completo: estudiante.nombreCompletoEstudiante, id_carrera: carreraId }]) // Incluir id_carrera al crear estudiante
                    .select('id_estudiante')
                    .single();
                if (newStudentError) {
                    console.error('Error al crear estudiante:', newStudentError.message);
                    throw new Error('Error al crear estudiante.');
                }
                idEstudiante = newStudent.id_estudiante;
            }
        } else {
            // Si el estudiante ya tiene un ID, verificar si el nombre ha cambiado y actualizarlo
            const { error: updateStudentError } = await supabase
                .from('estudiante') 
                .update({ nombre_completo: estudiante.nombreCompletoEstudiante, id_carrera: carreraId }) // Asegurarse de actualizar la carrera también
                .eq('id_estudiante', idEstudiante);

            if (updateStudentError) {
                console.error('Error al actualizar nombre y/o carrera del estudiante:', updateStudentError.message);
                throw new Error('Error al actualizar nombre y/o carrera del estudiante.');
            }
        }

        // Actualizar el proyecto de investigación
        const { data, error } = await supabase
            .from('proyectos_investigacion')
            .update({
                id_periodo: periodoId,
                proyecto: nombreProyecto,
                id_estudiante: idEstudiante,
                id_carrera: carreraId,
                estado: estado
            })
            .eq('id_proyecto_investigacion', id)
            .select('*');

        if (error) {
            console.error('Error al actualizar proyecto de investigación:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al actualizar proyecto.' });
        }
        res.status(200).json({ message: 'Proyecto de investigación actualizado exitosamente.', project: data[0] });

    } catch (error) {
        console.error('Error en la ruta PUT /proyectos-investigacion/:id:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    }
});

// API: Eliminación lógica de un proyecto de investigación
router.put('/proyectos-investigacion/eliminar-logico/:id', async (req, res) => {
    const { id } = req.params;
    const { mensajeEliminacion } = req.body;

    try {
        const { data, error } = await supabase
            .from('proyectos_investigacion')
            .update({ eliminados: true, mensaje_eliminacion: mensajeEliminacion || null })
            .eq('id_proyecto_investigacion', id);

        if (error) {
            console.error('Error al eliminar lógicamente el proyecto de investigación:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al eliminar lógicamente el proyecto.' });
        }
        res.status(200).json({ message: 'Proyecto de investigación eliminado lógicamente exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /proyectos-investigacion/eliminar-logico:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Restaurar proyecto de investigación (marcar como no eliminado)
router.put('/proyectos-investigacion/restaurar/:id', async (req, res) => {
    const { id } = req.params;
    const { mensajeRestauracion } = req.body; // Opcional

    try {
        const { data, error } = await supabase
            .from('proyectos_investigacion')
            .update({ 
                eliminados: false, 
                mensaje_eliminacion: null, // Limpiar el mensaje de eliminación
                // mensaje_restauracion: mensajeRestauracion || null // Guardar mensaje de restauración - No existe en la tabla
            })
            .eq('id_proyecto_investigacion', id);

        if (error) {
            console.error('Error al restaurar proyecto de investigación:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al restaurar proyecto.' });
        }
        res.status(200).json({ message: 'Proyecto de investigación restaurado exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /proyectos-investigacion/restaurar:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener datos específicos para generar el PDF de un proyecto de investigación
router.get('/proyectos-investigacion/:id/datos-pdf', async (req, res) => {
    const projectId = req.params.id;

    try {
        let { data: project, error } = await supabase
            .from('proyectos_investigacion')
            .select(`
                proyecto,
                estado,
                carreras:id_carrera(carrera),
                periodos:id_periodo(periodo),
                estudiantes:id_estudiante(cedula, nombre_completo, carreras:id_carrera(carrera))
            `)
            .eq('id_proyecto_investigacion', projectId)
            .single();

        if (error && error.details.includes('0 rows')) {
            return res.status(404).json({ message: 'Proyecto de investigación no encontrado.' });
        } else if (error) {
            console.error('Error al obtener proyecto de investigación para PDF:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener datos del proyecto de investigación.' });
        }

        if (!project) {
            return res.status(404).json({ message: 'Proyecto de investigación no encontrado.' });
        }

        // Formatear los datos para el frontend
        const responseData = {
            nombreProyecto: project.proyecto,
            estado: project.estado,
            carrera: project.carreras ? project.carreras.carrera : null,
            periodo: project.periodos ? project.periodos.periodo : null,
            estudiante: project.estudiantes ? {
                cedula: project.estudiantes.cedula,
                nombreCompleto: project.estudiantes.nombre_completo,
                carreraEstudiante: project.estudiantes.carreras ? project.estudiantes.carreras.carrera : 'N/A'
            } : null
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error en la ruta /proyectos-investigacion/:id/datos-pdf:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al obtener datos para PDF.' });
    }
});


export default router;
