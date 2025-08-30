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
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas en pasantias.js');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();


// =======================================================
// APIs PARA PASANTÍAS
// =======================================================

// API: Obtener todas las pasantías (no eliminadas)
router.get('/pasantias', async (req, res) => {
    try {
        let { data: pasantias, error } = await supabase
            .from('pasantia')
            .select(`
                id_pasantia,
                titulo,
                estado,
                fechaInicio,
                fechaFinal,
                eliminado,
                mensaje_eliminado,
                periodos:id_periodo(id_periodo, periodo),
                carreras:id_carrera(id_carrera, carrera),
                empresas:id_empresa(id_empresa, nombre_empresa),
                tutores:id_tutor(id_tutor, cedula, nombre_completo),
                estudiantes:id_estudiante(id_estudiante, cedula, nombre_completo, carreras:id_carrera(carrera))
            `)
            .eq('eliminado', false); // Solo pasantías no eliminadas lógicamente

        if (error) {
            console.error('Error al obtener pasantías:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener pasantías.' });
        }

        const formattedPasantias = pasantias.map(pasantia => ({
            id_pasantia: pasantia.id_pasantia,
            titulo: pasantia.titulo,
            estado: pasantia.estado,
            fechaInicio: pasantia.fechaInicio,
            fechaFinal: pasantia.fechaFinal,
            eliminado: pasantia.eliminado,
            mensaje_eliminado: pasantia.mensaje_eliminado,
            periodo: pasantia.periodos ? pasantia.periodos.periodo : null,
            id_periodo: pasantia.periodos ? pasantia.periodos.id_periodo : null,
            carrera: pasantia.carreras ? pasantia.carreras.carrera : null,
            id_carrera: pasantia.carreras ? pasantia.carreras.id_carrera : null,
            empresa: pasantia.empresas ? pasantia.empresas.nombre_empresa : null,
            id_empresa: pasantia.empresas ? pasantia.empresas.id_empresa : null,
            tutor: pasantia.tutores ? { id_tutor: pasantia.tutores.id_tutor, cedula: pasantia.tutores.cedula, nombre_completo: pasantia.tutores.nombre_completo } : null,
            estudiante: pasantia.estudiantes ? {
                id_estudiante: pasantia.estudiantes.id_estudiante,
                cedula: pasantia.estudiantes.cedula,
                nombre_completo: pasantia.estudiantes.nombre_completo,
                carreras: pasantia.estudiantes.carreras ? { carrera: pasantia.estudiantes.carreras.carrera } : null
            } : null
        }));

        res.status(200).json(formattedPasantias);

    } catch (error) {
        console.error('Error en la ruta /pasantias (Router):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener una pasantía por ID
router.get('/pasantias/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let { data: pasantia, error } = await supabase
            .from('pasantia')
            .select(`
                id_pasantia,
                titulo,
                estado,
                fechaInicio,
                fechaFinal,
                eliminado,
                mensaje_eliminado,
                id_periodo,
                id_carrera,
                id_empresa,
                id_tutor,
                id_estudiante,
                periodos:id_periodo(periodo),
                carreras:id_carrera(carrera),
                empresas:id_empresa(nombre_empresa),
                tutores:id_tutor(cedula, nombre_completo),
                estudiantes:id_estudiante(cedula, nombre_completo, carreras:id_carrera(carrera))
            `)
            .eq('id_pasantia', id)
            .single()
            .order('id_pasantia', { ascending: true });

        if (error && error.details.includes('0 rows')) {
            return res.status(404).json({ message: 'Pasantía no encontrada.' });
        } else if (error) {
            console.error('Error al obtener pasantía por ID:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor al obtener pasantía.' });
        }
        res.status(200).json(pasantia);
    } catch (error) {
        console.error('Error en la ruta /pasantias/:id:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Agregar nueva pasantía
router.post('/agregar-pasantia', async (req, res) => {
    const {
        periodoId,
        titulo,
        estudiante: { cedulaEstudiante, nombreCompletoEstudiante },
        carreraId,
        empresaId,
        tutor: { cedulaTutor, nombreCompletoTutor },
        estado,
        fechaInicio,
        fechaFinal
    } = req.body;

    if (!periodoId || !titulo || !cedulaEstudiante || !nombreCompletoEstudiante || !carreraId || !empresaId || !cedulaTutor || !nombreCompletoTutor || !estado || !fechaInicio || !fechaFinal) {
        // REGISTRO DE AUDITORÍA: Intento de agregar pasantía fallido (faltan campos)
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Intento de Agregar Pasantía Fallido',
            descripcion_detallada: `Intento fallido de agregar pasantía: Faltan campos obligatorios.`,
            registro_afectado_id: null,
        });
        return res.status(400).json({ error: 'Faltan campos obligatorios para la pasantía.' });
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

        let estudianteIdToUse = null;
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

        const { data: newPasantia, error: pasantiaInsertError } = await supabase
            .from('pasantia')
            .insert([{
                id_periodo: periodoId,
                titulo: titulo,
                id_estudiante: estudianteIdToUse,
                id_carrera: carreraId,
                id_empresa: empresaId,
                id_tutor: tutorIdToUse,
                estado: estado,
                fechaInicio: fechaInicio,
                fechaFinal: fechaFinal,
                eliminado: false,
                mensaje_eliminado: null
            }])
            .select('id_pasantia')
            .single();

        if (pasantiaInsertError) {
            console.error('Error al insertar pasantía:', pasantiaInsertError.message);
            throw new Error('Error al insertar pasantía.');
        }

        // REGISTRO DE AUDITORÍA: Pasantía agregada exitosamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Agregar Pasantía',
            descripcion_detallada: `Se agregó la pasantía "${titulo}" (ID: ${newPasantia.id_pasantia}).`,
            registro_afectado_id: newPasantia.id_pasantia.toString(),
        });

        res.status(201).json({ message: 'Pasantía agregada exitosamente.', id_pasantia: newPasantia.id_pasantia });

    } catch (error) {
        console.error('Error en la ruta /api/agregar-pasantia:', error.message);
        // REGISTRO DE AUDITORÍA: Error interno al agregar pasantía
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Error al Agregar Pasantía',
            descripcion_detallada: `Error interno del servidor al intentar agregar la pasantía. Mensaje: ${error.message}.`,
            registro_afectado_id: null,
        });
        res.status(500).json({ error: error.message || 'Error interno del servidor al agregar pasantía.' });
    }
});

// API: Actualizar una pasantía existente
router.put('/pasantias/:id', async (req, res) => {
    const pasantiaId = req.params.id;
    const {
        periodoId,
        titulo,
        estudiante: { cedulaEstudiante, nombreCompletoEstudiante },
        carreraId,
        empresaId,
        tutor: { cedulaTutor, nombreCompletoTutor },
        estado,
        fechaInicio,
        fechaFinal
    } = req.body;

    if (!periodoId || !titulo || !cedulaEstudiante || !nombreCompletoEstudiante || !carreraId || !empresaId || !cedulaTutor || !nombreCompletoTutor || !estado || !fechaInicio || !fechaFinal) {
        // REGISTRO DE AUDITORÍA: Intento de actualizar pasantía fallido (faltan campos)
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Intento de Actualizar Pasantía Fallido',
            descripcion_detallada: `Intento fallido de actualizar pasantía ID ${pasantiaId}: Faltan campos obligatorios.`,
            registro_afectado_id: pasantiaId.toString(),
        });
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar la pasantía.' });
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
                console.error('Error al insertar nuevo tutor durante la edición:', insertTutorError.message);
                throw new Error('Error al insertar nuevo tutor durante la edición.');
            }
            tutorIdToUse = newTutor.id_tutor;
        }

        let estudianteIdToUse = null;
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

        const { error: pasantiaUpdateError } = await supabase
            .from('pasantia')
            .update({
                id_periodo: periodoId,
                titulo: titulo,
                id_estudiante: estudianteIdToUse,
                id_carrera: carreraId,
                id_empresa: empresaId,
                id_tutor: tutorIdToUse,
                estado: estado,
                fechaInicio: fechaInicio,
                fechaFinal: fechaFinal
            })
            .eq('id_pasantia', pasantiaId);

        if (pasantiaUpdateError) {
            console.error('Error al actualizar pasantía:', pasantiaUpdateError.message);
            throw new Error('Error al actualizar la pasantía.');
        }

        // REGISTRO DE AUDITORÍA: Pasantía actualizada exitosamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Modificar Pasantía',
            descripcion_detallada: `Se actualizó la pasantía "${titulo}" (ID: ${pasantiaId}).`,
            registro_afectado_id: pasantiaId.toString(),
        });

        res.status(200).json({ message: 'Pasantía actualizada exitosamente.' });

    } catch (error) {
        console.error('Error en la ruta PUT /api/pasantias/:id:', error.message);
        // REGISTRO DE AUDITORÍA: Error interno al actualizar pasantía
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Error al Modificar Pasantía',
            descripcion_detallada: `Error interno del servidor al intentar actualizar la pasantía ID ${pasantiaId}. Mensaje: ${error.message}.`,
            registro_afectado_id: pasantiaId.toString(),
        });
        res.status(500).json({ error: error.message || 'Error interno del servidor al actualizar pasantía.' });
    }
});

// API: Eliminar lógicamente una pasantía (marcarlo como eliminado)
router.put('/pasantias/eliminar-logico/:id', async (req, res) => {
    const pasantiaId = req.params.id;
    const { mensajeEliminacion } = req.body;

    try {
        const { error, data: oldPasantia } = await supabase
            .from('pasantia')
            .update({
                eliminado: true,
                mensaje_eliminado: mensajeEliminacion || null
            })
            .eq('id_pasantia', pasantiaId)
            .select('titulo') // Seleccionar el título para el log
            .single();

        if (error) {
            console.error('Error al marcar pasantía como eliminada lógicamente:', error.message);
            // REGISTRO DE AUDITORÍA: Error al intentar eliminar lógicamente pasantía
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Pasantías',
                accion_realizada: 'Error al Eliminar Pasantía (Lógico)',
                descripcion_detallada: `Error interno del servidor al intentar eliminar lógicamente la pasantía ID ${pasantiaId}. Mensaje: ${error.message}.`,
                registro_afectado_id: pasantiaId.toString(),
            });
            return res.status(500).json({ error: 'Error interno del servidor al eliminar lógicamente la pasantía.' });
        }

        // REGISTRO DE AUDITORÍA: Pasantía eliminada lógicamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Eliminar Pasantía (Lógico)',
            descripcion_detallada: `Se eliminó lógicamente la pasantía "${oldPasantia?.titulo || 'Desconocido'}" (ID: ${pasantiaId}). Mensaje: "${mensajeEliminacion || 'Sin mensaje'}".`,
            registro_afectado_id: pasantiaId.toString(),
        });

        res.status(200).json({ message: 'Pasantía eliminada lógicamente exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /api/pasantias/eliminar-logico/:id:', error.message);
        // REGISTRO DE AUDITORÍA: Error de excepción al eliminar lógicamente pasantía
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Error de Excepción al Eliminar Pasantía (Lógico)',
            descripcion_detallada: `Excepción al intentar eliminar lógicamente la pasantía ID ${pasantiaId}. Mensaje: ${error.message}.`,
            registro_afectado_id: pasantiaId.toString(),
        });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Restaurar una pasantía eliminada lógicamente (marcarlo como no eliminado)
router.put('/pasantias/restaurar/:id', async (req, res) => {
    const pasantiaId = req.params.id;

    try {
        const { error, data: restoredPasantia } = await supabase
            .from('pasantia')
            .update({
                eliminado: false,
                mensaje_eliminado: null
            })
            .eq('id_pasantia', pasantiaId)
            .select('titulo') // Seleccionar el título para el log
            .single();

        if (error) {
            console.error('Error al restaurar pasantía:', error.message);
            // REGISTRO DE AUDITORÍA: Error al intentar restaurar pasantía
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Pasantías',
                accion_realizada: 'Error al Restaurar Pasantía',
                descripcion_detallada: `Error interno del servidor al intentar restaurar la pasantía ID ${pasantiaId}. Mensaje: ${error.error_message}.`,
                registro_afectado_id: pasantiaId.toString(),
            });
            return res.status(500).json({ error: 'Error interno del servidor al restaurar la pasantía.' });
        }

        // REGISTRO DE AUDITORÍA: Pasantía restaurada
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Restaurar Pasantía',
            descripcion_detallada: `Se restauró la pasantía "${restoredPasantia?.titulo || 'Desconocido'}" (ID: ${pasantiaId}).`,
            registro_afectado_id: pasantiaId.toString(),
        });

        res.status(200).json({ message: 'Pasantía restaurada exitosamente.' });
    } catch (error) {
        console.error('Error en la ruta PUT /pasantias/restaurar/:id:', error.message);
        // REGISTRO DE AUDITORÍA: Error de excepción al restaurar pasantía
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Error de Excepción al Restaurar Pasantía',
            descripcion_detallada: `Excepción al intentar restaurar la pasantía ID ${pasantiaId}. Mensaje: ${error.message}.`,
            registro_afectado_id: pasantiaId.toString(),
        });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API: Obtener datos específicos para generar el PDF de una pasantía
router.get('/pasantias/:id/datos-pdf', async (req, res) => {
    const pasantiaId = req.params.id;

    try {
        let { data: pasantia, error } = await supabase
            .from('pasantia')
            .select(`
                titulo,
                estado,
                fechaInicio,
                fechaFinal,
                periodos:id_periodo(periodo),
                carreras:id_carrera(carrera),
                empresas:id_empresa(nombre_empresa),
                tutores:id_tutor(cedula, nombre_completo),
                estudiantes:id_estudiante(cedula, nombre_completo, carreras:id_carrera(carrera))
            `)
            .eq('id_pasantia', pasantiaId)
            .single();

        if (error && error.details.includes('0 rows')) {
            // REGISTRO DE AUDITORÍA: Intento de generar PDF fallido (pasantía no encontrada)
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Pasantías',
                accion_realizada: 'Intento de Descarga PDF Fallido',
                descripcion_detallada: `Intento fallido de generar PDF para pasantía ID ${pasantiaId}: Pasantía no encontrada.`,
                registro_afectado_id: pasantiaId.toString(),
            });
            return res.status(404).json({ message: 'Pasantía no encontrada.' });
        } else if (error) {
            console.error('Error al obtener pasantía para PDF:', error.message);
            // REGISTRO DE AUDITORÍA: Error al obtener datos de pasantía para PDF
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Pasantías',
                accion_realizada: 'Error al Descargar PDF',
                descripcion_detallada: `Error interno del servidor al obtener datos para PDF de la pasantía ID ${pasantiaId}. Mensaje: ${error.message}.`,
                registro_afectado_id: pasantiaId.toString(),
            });
            return res.status(500).json({ error: 'Error interno del servidor al obtener datos de la pasantía.' });
        }

        if (!pasantia) {
            // REGISTRO DE AUDITORÍA: Intento de generar PDF fallido (pasantía no encontrada, segunda verificación)
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Pasantías',
                accion_realizada: 'Intento de Descarga PDF Fallido',
                descripcion_detallada: `Intento fallido de generar PDF para pasantía ID ${pasantiaId}: Pasantía no encontrada (segunda verificación).`,
                registro_afectado_id: pasantiaId.toString(),
            });
            return res.status(404).json({ message: 'Pasantía no encontrada.' });
        }

        // Formatear los datos para el frontend
        const responseData = {
            titulo: pasantia.titulo,
            estado: pasantia.estado,
            fechaInicio: pasantia.fechaInicio,
            fechaFinal: pasantia.fechaFinal,
            periodo: pasantia.periodos ? pasantia.periodos.periodo : null,
            carrera: pasantia.carreras ? pasantia.carreras.carrera : null,
            empresa: pasantia.empresas ? pasantia.empresas.nombre_empresa : null,
            tutorCedula: pasantia.tutores ? pasantia.tutores.cedula : null,
            tutorNombre: pasantia.tutores ? pasantia.tutores.nombre_completo : null,
            estudiante: pasantia.estudiantes ? {
                cedula: pasantia.estudiantes.cedula,
                nombreCompleto: pasantia.estudiantes.nombre_completo,
                carreraEstudiante: pasantia.estudiantes.carreras ? pasantia.estudiantes.carreras.carrera : 'N/A'
            } : null
        };

        // REGISTRO DE AUDITORÍA: Datos para PDF de pasantía descargados exitosamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Descargar PDF (Datos)',
            descripcion_detallada: `Se descargaron los datos para el PDF de la pasantía "${pasantia.titulo}" (ID: ${pasantiaId}).`,
            registro_afectado_id: pasantiaId.toString(),
        });

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error en la ruta /pasantias/:id/datos-pdf:', error.message);
        // REGISTRO DE AUDITORÍA: Error de excepción al generar PDF
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Pasantías',
            accion_realizada: 'Error de Excepción al Descargar PDF',
            descripcion_detallada: `Excepción al intentar generar PDF para pasantía ID ${pasantiaId}. Mensaje: ${error.message}.`,
            registro_afectado_id: pasantiaId.toString(),
        });
        res.status(500).json({ error: 'Error interno del servidor al obtener datos para PDF.' });
    }
});


// =======================================================
// APIs GENÉRICAS PARA DROPDOWNS Y BÚSQUEDA DE PERSONAS (EXISTENTES)
// Se asume que estas rutas ya existen o se crearán en un archivo de rutas general.
// Si ya las tienes en otro archivo, NO NECESITAS DUPLICARLAS aquí.
// Pero las incluyo para que tengas el contexto completo si decides ponerlas todas juntas.
// =======================================================

// API para obtener todos los periodos
router.get('/periodos', async (req, res) => {
    try {
        let { data: periodos, error } = await supabase
            .from('periodo')
            .select('*');

        if (error) {
            console.error('Error al obtener periodos:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        res.status(200).json(periodos);
    } catch (error) {
        console.error('Error en la ruta /api/periodos:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API para obtener todas las carreras
router.get('/carreras', async (req, res) => {
    try {
        let { data: carreras, error } = await supabase
            .from('carrera')
            .select('*');

        if (error) {
            console.error('Error al obtener carreras:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        res.status(200).json(carreras);
    } catch (error) {
        console.error('Error en la ruta /api/carreras:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API para obtener todas las empresas
router.get('/empresas', async (req, res) => {
    try {
        let { data: empresas, error } = await supabase
            .from('empresa')
            .select('*');

        if (error) {
            console.error('Error al obtener empresas:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        res.status(200).json(empresas);
    }
    catch (error) {
        console.error('Error en la ruta /api/empresas:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API para obtener un estudiante por cédula
router.get('/estudiante-por-cedula/:cedula', async (req, res) => {
    const { cedula } = req.params;
    try {
        let { data: estudiante, error } = await supabase
            .from('estudiante')
            .select('id_estudiante, cedula, nombre_completo')
            .eq('cedula', cedula)
            .single();

        if (error && error.details.includes('0 rows')) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        } else if (error) {
            console.error('Error al buscar estudiante por cédula:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        res.status(200).json(estudiante);
    } catch (error) {
        console.error('Error en la ruta /api/estudiante-por-cedula/:cedula:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// API para obtener un tutor por cédula
router.get('/tutor-por-cedula/:cedula', async (req, res) => {
    const { cedula } = req.params;
    try {
        let { data: tutor, error } = await supabase
            .from('tutor')
            .select('id_tutor, cedula, nombre_completo')
            .eq('cedula', cedula)
            .single();

        if (error && error.details.includes('0 rows')) {
            return res.status(404).json({ message: 'Tutor no encontrado.' });
        } else if (error) {
            console.error('Error al buscar tutor por cédula:', error.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        res.status(200).json(tutor);
    } catch (error) {
        console.error('Error en la ruta /api/tutor-por-cedula/:cedula:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
