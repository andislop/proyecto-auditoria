import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Importa la función de auditoría
import { registrarAuditoria } from './bitacora.js'; // ASEGÚRATE DE QUE LA RUTA SEA CORRECTA

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas en proyectos-investigacion.js');
    process.exit(1); 
}
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();

// Middleware para obtener el id_login del usuario actual desde la sesión (ejemplo)
const getUserIdFromSession = (req, res, next) => {
    req.currentUserIdLogin = req.session?.user?.id || null; 
    next();
};

router.use(getUserIdFromSession); // Aplica el middleware a todas las rutas de este router

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
                carreras:id_carrera(id_carrera, carrera),
                periodos:id_periodo(id_periodo, periodo),
                estudiantes:id_estudiante(id_estudiante, cedula, nombre_completo, id_carrera)
            `)
            .eq('eliminados', false); // Filtrar solo proyectos no eliminados

        if (error) {
            console.error('Error al obtener proyectos de investigación (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener proyectos.' });
        }

        const formattedProjects = proyectos.map(proyecto => {
            return {
                id_proyecto_investigacion: proyecto.id_proyecto_investigacion,
                periodo: proyecto.periodos ? proyecto.periodos.periodo : null,
                id_periodo: proyecto.periodos ? proyecto.periodos.id_periodo : null,
                proyecto: proyecto.proyecto,
                estudiante: proyecto.estudiantes ? { 
                    id_estudiante: proyecto.estudiantes.id_estudiante, 
                    cedula: proyecto.estudiantes.cedula, 
                    nombre_completo: proyecto.estudiantes.nombre_completo,
                    id_carrera: proyecto.estudiantes.id_carrera
                } : null,
                carrera: proyecto.carreras ? proyecto.carreras.carrera : null,
                id_carrera: proyecto.carreras ? proyecto.carreras.id_carrera : null,
                estado: proyecto.estado,
                eliminados: proyecto.eliminados,
                mensaje_eliminacion: proyecto.mensaje_eliminacion
            };
        });

        res.status(200).json(formattedProjects);
    } catch (error) {
        console.error('Error en la ruta /proyectos-investigacion (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener proyectos eliminados lógicamente
router.get('/proyectos-investigacion-eliminados', async (req, res) => {
    try {
        let { data: proyectos, error } = await supabase
            .from('proyectos_investigacion')
            .select(`
                id_proyecto_investigacion,
                proyecto,
                estado,
                eliminados,
                mensaje_eliminacion,
                carreras:id_carrera(id_carrera, carrera),
                periodos:id_periodo(id_periodo, periodo),
                estudiantes:id_estudiante(id_estudiante, cedula, nombre_completo, id_carrera)
            `)
            .eq('eliminados', true); // Solo proyectos eliminados

        if (error) {
            console.error('Error al obtener proyectos de investigación eliminados (Router):', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener proyectos eliminados.' });
        }

        const formattedProjects = proyectos.map(proyecto => {
            return {
                id_proyecto_investigacion: proyecto.id_proyecto_investigacion,
                periodo: proyecto.periodos ? proyecto.periodos.periodo : null,
                id_periodo: proyecto.periodos ? proyecto.periodos.id_periodo : null,
                proyecto: proyecto.proyecto,
                estudiante: proyecto.estudiantes ? { 
                    id_estudiante: proyecto.estudiantes.id_estudiante, 
                    cedula: proyecto.estudiantes.cedula, 
                    nombre_completo: proyecto.estudiantes.nombre_completo,
                    id_carrera: proyecto.estudiantes.id_carrera
                } : null,
                carrera: proyecto.carreras ? proyecto.carreras.carrera : null,
                id_carrera: proyecto.carreras ? proyecto.carreras.id_carrera : null,
                estado: proyecto.estado,
                eliminados: proyecto.eliminados,
                mensaje_eliminacion: proyecto.mensaje_eliminacion
            };
        });

        res.status(200).json(formattedProjects);
    } catch (error) {
        console.error('Error en la ruta /proyectos-investigacion-eliminados (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Agregar nuevo proyecto de investigación
router.post('/agregar-proyecto-investigacion', async (req, res) => {
    const {
        periodoId,
        nombreProyecto,
        estudiante: { cedulaEstudiante, nombreCompletoEstudiante, idEstudiante },
        carreraId,
        estado
    } = req.body;

    if (!periodoId || !nombreProyecto || !cedulaEstudiante || !nombreCompletoEstudiante || !carreraId || !estado) {
        // REGISTRO DE AUDITORÍA: Intento de agregar proyecto de investigación fallido (faltan campos)
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Intento de Agregar Proyecto Fallido',
            descripcion_detallada: `Intento fallido de agregar proyecto de investigación: Faltan campos obligatorios.`,
            registro_afectado_id: null,
        });
        return res.status(400).json({ error: 'Faltan campos obligatorios para el proyecto de investigación.' });
    }

    try {
        let studentIdToUse = idEstudiante;

        if (!studentIdToUse) { // Si no viene con ID, buscar o insertar estudiante
            let { data: existingStudent, error: studentSearchError } = await supabase
                .from('estudiante')
                .select('id_estudiante, nombre_completo')
                .eq('cedula', cedulaEstudiante)
                .single();

            if (studentSearchError && !studentSearchError.details.includes('0 rows')) {
                console.error('Error al buscar estudiante existente:', studentSearchError.message);
                throw new Error('Error al verificar estudiante existente.');
            }

            if (existingStudent) {
                studentIdToUse = existingStudent.id_estudiante;
                if (existingStudent.nombre_completo !== nombreCompletoEstudiante) {
                    const { error: updateStudentError } = await supabase
                        .from('estudiante')
                        .update({ nombre_completo: nombreCompletoEstudiante })
                        .eq('id_estudiante', studentIdToUse);
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
                studentIdToUse = newStudent.id_estudiante;
            }
        } else { // Si viene con ID, solo actualizar si el nombre ha cambiado
            const { data: existingStudent, error: studentFetchError } = await supabase
                .from('estudiante')
                .select('nombre_completo')
                .eq('id_estudiante', studentIdToUse)
                .single();
            
            if (studentFetchError && !studentFetchError.details.includes('0 rows')) {
                console.error('Error al buscar estudiante por ID existente:', studentFetchError.message);
                throw new Error('Error al verificar estudiante existente por ID.');
            }
            
            if (existingStudent && existingStudent.nombre_completo !== nombreCompletoEstudiante) {
                const { error: updateStudentError } = await supabase
                    .from('estudiante')
                    .update({ nombre_completo: nombreCompletoEstudiante })
                    .eq('id_estudiante', studentIdToUse);
                if (updateStudentError) {
                    console.error('Error al actualizar nombre del estudiante existente:', updateStudentError.message);
                }
            }
        }


        const { data: newProject, error: projectInsertError } = await supabase
            .from('proyectos_investigacion')
            .insert([{
                id_periodo: periodoId,
                proyecto: nombreProyecto,
                id_estudiante: studentIdToUse,
                id_carrera: carreraId,
                estado: estado,
                eliminados: false,
                mensaje_eliminacion: null
            }])
            .select('id_proyecto_investigacion')
            .single();

        if (projectInsertError) {
            console.error('Error al insertar proyecto de investigación:', projectInsertError.message);
            throw new Error('Error al insertar proyecto de investigación.');
        }

        const idProyectoInvestigacion = newProject.id_proyecto_investigacion;

        // REGISTRO DE AUDITORÍA: Proyecto de investigación agregado exitosamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Agregar Proyecto',
            descripcion_detallada: `Se agregó el proyecto de investigación "${nombreProyecto}" (ID: ${idProyectoInvestigacion}).`,
            registro_afectado_id: idProyectoInvestigacion.toString(),
        });

        res.status(201).json({ message: 'Proyecto de investigación agregado exitosamente.', id_proyecto_investigacion: idProyectoInvestigacion });

    } catch (error) {
        console.error('Error en la ruta /api/agregar-proyecto-investigacion:', error.message);
        // REGISTRO DE AUDITORÍA: Error interno al agregar proyecto de investigación
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Error al Agregar Proyecto',
            descripcion_detallada: `Error interno del servidor al intentar agregar el proyecto de investigación. Mensaje: ${error.message}.`,
            registro_afectado_id: null,
        });
        res.status(500).json({ error: error.message || 'Error interno del servidor al agregar proyecto de investigación.' });
    }
});

// API: Actualizar un proyecto de investigación existente
router.put('/proyectos-investigacion/:id', async (req, res) => {
    const projectId = req.params.id;
    const {
        periodoId,
        nombreProyecto,
        estudiante: { cedulaEstudiante, nombreCompletoEstudiante, idEstudiante },
        carreraId,
        estado
    } = req.body;

    if (!periodoId || !nombreProyecto || !cedulaEstudiante || !nombreCompletoEstudiante || !carreraId || !estado) {
        // REGISTRO DE AUDITORÍA: Intento de actualizar proyecto de investigación fallido (faltan campos)
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Intento de Actualizar Proyecto Fallido',
            descripcion_detallada: `Intento fallido de actualizar proyecto de investigación ID ${projectId}: Faltan campos obligatorios.`,
            registro_afectado_id: projectId.toString(),
        });
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar el proyecto de investigación.' });
    }

    try {
        let studentIdToUse = idEstudiante;

        if (!studentIdToUse) { // Si no viene con ID, buscar o insertar estudiante
            let { data: existingStudent, error: studentSearchError } = await supabase
                .from('estudiante')
                .select('id_estudiante, nombre_completo')
                .eq('cedula', cedulaEstudiante)
                .single();

            if (studentSearchError && !studentSearchError.details.includes('0 rows')) {
                console.error('Error al buscar estudiante existente:', studentSearchError.message);
                throw new Error('Error al verificar estudiante existente.');
            }

            if (existingStudent) {
                studentIdToUse = existingStudent.id_estudiante;
                if (existingStudent.nombre_completo !== nombreCompletoEstudiante) {
                    const { error: updateStudentError } = await supabase
                        .from('estudiante')
                        .update({ nombre_completo: nombreCompletoEstudiante })
                        .eq('id_estudiante', studentIdToUse);
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
                studentIdToUse = newStudent.id_estudiante;
            }
        } else { // Si viene con ID, solo actualizar si el nombre ha cambiado
            const { data: existingStudent, error: studentFetchError } = await supabase
                .from('estudiante')
                .select('nombre_completo')
                .eq('id_estudiante', studentIdToUse)
                .single();
            
            if (studentFetchError && !studentFetchError.details.includes('0 rows')) {
                console.error('Error al buscar estudiante por ID existente:', studentFetchError.message);
                throw new Error('Error al verificar estudiante existente por ID.');
            }
            
            if (existingStudent && existingStudent.nombre_completo !== nombreCompletoEstudiante) {
                const { error: updateStudentError } = await supabase
                    .from('estudiante')
                    .update({ nombre_completo: nombreCompletoEstudiante })
                    .eq('id_estudiante', studentIdToUse);
                if (updateStudentError) {
                    console.error('Error al actualizar nombre del estudiante existente:', updateStudentError.message);
                }
            }
        }

        const { error: projectUpdateError } = await supabase
            .from('proyectos_investigacion')
            .update({
                id_periodo: periodoId,
                proyecto: nombreProyecto,
                id_estudiante: studentIdToUse,
                id_carrera: carreraId,
                estado: estado
            })
            .eq('id_proyecto_investigacion', projectId);

        if (projectUpdateError) {
            console.error('Error al actualizar proyecto de investigación:', projectUpdateError.message);
            throw new Error('Error al actualizar proyecto de investigación.');
        }

        // REGISTRO DE AUDITORÍA: Proyecto de investigación actualizado exitosamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Modificar Proyecto',
            descripcion_detallada: `Se actualizó el proyecto de investigación "${nombreProyecto}" (ID: ${projectId}).`,
            registro_afectado_id: projectId.toString(),
        });

        res.status(200).json({ message: 'Proyecto de investigación actualizado exitosamente.' });

    } catch (error) {
        console.error('Error en la ruta PUT /api/proyectos-investigacion/:id:', error.message);
        // REGISTRO DE AUDITORÍA: Error interno al actualizar proyecto de investigación
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Error al Modificar Proyecto',
            descripcion_detallada: `Error interno del servidor al intentar actualizar el proyecto de investigación ID ${projectId}. Mensaje: ${error.message}.`,
            registro_afectado_id: projectId.toString(),
        });
        res.status(500).json({ error: error.message || 'Error interno del servidor al actualizar proyecto de investigación.' });
    }
});

// API: Eliminar lógicamente un proyecto de investigación (marcarlo como eliminado)
router.put('/proyectos-investigacion/eliminar-logico/:id', async (req, res) => {
    const projectId = req.params.id;
    const { mensajeEliminacion } = req.body;

    try {
        const { error, data: oldProject } = await supabase
            .from('proyectos_investigacion')
            .update({
                eliminados: true,
                mensaje_eliminacion: mensajeEliminacion || null
            })
            .eq('id_proyecto_investigacion', projectId)
            .select('proyecto') // Seleccionar el nombre del proyecto para el log
            .single();

        if (error) {
            console.error('Error al marcar proyecto de investigación como eliminado lógicamente:', error.message);
            // REGISTRO DE AUDITORÍA: Error al intentar eliminar lógicamente proyecto
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Proyectos de Investigación',
                accion_realizada: 'Error al Eliminar Proyecto (Lógico)',
                descripcion_detallada: `Error interno del servidor al intentar eliminar lógicamente el proyecto de investigación ID ${projectId}. Mensaje: ${error.message}.`,
                registro_afectado_id: projectId.toString(),
            });
            return res.status(500).json({ error: 'Error interno del servidor al eliminar lógicamente el proyecto de investigación.' });
        }
        
        // REGISTRO DE AUDITORÍA: Proyecto de investigación eliminado lógicamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Eliminar Proyecto (Lógico)',
            descripcion_detallada: `Se eliminó lógicamente el proyecto de investigación "${oldProject?.proyecto || 'Desconocido'}" (ID: ${projectId}). Mensaje: "${mensajeEliminacion || 'Sin mensaje'}".`,
            registro_afectado_id: projectId.toString(),
        });

        res.status(200).json({ message: 'Proyecto de investigación eliminado lógicamente exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /api/proyectos-investigacion/eliminar-logico/:id:', error.message);
        // REGISTRO DE AUDITORÍA: Error de excepción al eliminar lógicamente proyecto
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Error de Excepción al Eliminar Proyecto (Lógico)',
            descripcion_detallada: `Excepción al intentar eliminar lógicamente el proyecto de investigación ID ${projectId}. Mensaje: ${error.message}.`,
            registro_afectado_id: projectId.toString(),
        });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Restaurar un proyecto eliminado lógicamente (marcarlo como no eliminado)
router.put('/proyectos-investigacion/restaurar/:id', async (req, res) => {
    const projectId = req.params.id;

    try {
        const { error, data: restoredProject } = await supabase
            .from('proyectos_investigacion')
            .update({
                eliminados: false,
                mensaje_eliminacion: null
            })
            .eq('id_proyecto_investigacion', projectId)
            .select('proyecto') // Seleccionar el nombre del proyecto para el log
            .single();

        if (error) {
            console.error('Error al restaurar proyecto de investigación:', error.message);
            // REGISTRO DE AUDITORÍA: Error al intentar restaurar proyecto
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Proyectos de Investigación',
                accion_realizada: 'Error al Restaurar Proyecto',
                descripcion_detallada: `Error interno del servidor al intentar restaurar el proyecto de investigación ID ${projectId}. Mensaje: ${error.message}.`,
                registro_afectado_id: projectId.toString(),
            });
            return res.status(500).json({ error: 'Error interno del servidor al restaurar el proyecto de investigación.' });
        }

        // REGISTRO DE AUDITORÍA: Proyecto de investigación restaurado
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Restaurar Proyecto',
            descripcion_detallada: `Se restauró el proyecto de investigación "${restoredProject?.proyecto || 'Desconocido'}" (ID: ${projectId}).`,
            registro_afectado_id: projectId.toString(),
        });

        res.status(200).json({ message: 'Proyecto de investigación restaurado exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /api/proyectos-investigacion/restaurar/:id:', error.message);
        // REGISTRO DE AUDITORÍA: Error de excepción al restaurar proyecto
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Error de Excepción al Restaurar Proyecto',
            descripcion_detallada: `Excepción al intentar restaurar el proyecto de investigación ID ${projectId}. Mensaje: ${error.message}.`,
            registro_afectado_id: projectId.toString(),
        });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// API: Obtener datos de un proyecto de investigación para PDF
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
            // REGISTRO DE AUDITORÍA: Intento de generar PDF fallido (proyecto no encontrado)
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Proyectos de Investigación',
                accion_realizada: 'Intento de Descarga PDF Fallido',
                descripcion_detallada: `Intento fallido de generar PDF para proyecto de investigación ID ${projectId}: Proyecto no encontrado.`,
                registro_afectado_id: projectId.toString(),
            });
            return res.status(404).json({ message: 'Proyecto de investigación no encontrado.' });
        } else if (error) {
            console.error('Error al obtener proyecto de investigación para PDF:', error.message);
            // REGISTRO DE AUDITORÍA: Error al obtener datos de proyecto para PDF
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Proyectos de Investigación',
                accion_realizada: 'Error al Descargar PDF',
                descripcion_detallada: `Error interno del servidor al obtener datos para PDF del proyecto de investigación ID ${projectId}. Mensaje: ${error.message}.`,
                registro_afectado_id: projectId.toString(),
            });
            return res.status(500).json({ error: 'Error interno del servidor al obtener datos del proyecto de investigación.' });
        }

        if (!project) {
            // REGISTRO DE AUDITORÍA: Intento de generar PDF fallido (proyecto no encontrado, segunda verificación)
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Proyectos de Investigación',
                accion_realizada: 'Intento de Descarga PDF Fallido',
                descripcion_detallada: `Intento fallido de generar PDF para proyecto de investigación ID ${projectId}: Proyecto no encontrado (segunda verificación).`,
                registro_afectado_id: projectId.toString(),
            });
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

        // REGISTRO DE AUDITORÍA: Datos para PDF de proyecto de investigación descargados exitosamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Descargar PDF (Datos)',
            descripcion_detallada: `Se descargaron los datos para el PDF del proyecto de investigación "${project.proyecto}" (ID: ${projectId}).`,
            registro_afectado_id: projectId.toString(),
        });

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error en la ruta /proyectos-investigacion/:id/datos-pdf:', error.message);
        // REGISTRO DE AUDITORÍA: Error de excepción al generar PDF
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Proyectos de Investigación',
            accion_realizada: 'Error de Excepción al Descargar PDF',
            descripcion_detallada: `Excepción al intentar generar PDF para proyecto de investigación ID ${projectId}. Mensaje: ${error.message}.`,
            registro_afectado_id: projectId.toString(),
        });
        res.status(500).json({ error: 'Error interno del servidor al obtener datos para PDF.' });
    }
});

export default router;
