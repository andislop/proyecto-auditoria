import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path'; // Importa path de forma estándar
import pdf from 'html-pdf'; // Si aún lo utilizas para la generación de PDFs
import { fileURLToPath } from 'url'; // Necesario para convertir URL a path de sistema de archivos
import fs from 'fs'; // Importamos el módulo 'fs' para leer archivos

// Importa la función de auditoría
import { registrarAuditoria } from './bitacora.js'; // ASEGÚRATE DE QUE LA RUTA SEA CORRECTA

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


// API: Obtener datos de un proyecto de investigación para PDF
router.get('/publicas/proyectos-investigacion/:id/datos-pdf', async (req, res) => {
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


// API: Obtener datos específicos para generar el PDF de un trabajo de grado
router.get('/publicas/trabajos-de-grado/:id/datos-pdf', async (req, res) => {
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
            // REGISTRO DE AUDITORÍA: Intento de generar PDF fallido (trabajo de grado no encontrado)
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Trabajo de Grado',
                accion_realizada: 'Intento de Descarga PDF Fallido',
                descripcion_detallada: `Intento fallido de generar PDF para trabajo de grado ID ${trabajoId}: Trabajo de grado no encontrado.`,
                registro_afectado_id: trabajoId.toString(),
            });
            return res.status(404).json({ message: 'Trabajo de grado no encontrado.' });
        } else if (error) {
            console.error('Error al obtener trabajo de grado para PDF:', error.message);
            // REGISTRO DE AUDITORÍA: Error al obtener datos de trabajo de grado para PDF
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Trabajo de Grado',
                accion_realizada: 'Error al Descargar PDF',
                descripcion_detallada: `Error interno del servidor al obtener datos para PDF del trabajo de grado ID ${trabajoId}. Mensaje: ${error.message}.`,
                registro_afectado_id: trabajoId.toString(),
            });
            return res.status(500).json({ error: 'Error interno del servidor al obtener datos del trabajo de grado.' });
        }

        if (!trabajo) {
            // REGISTRO DE AUDITORÍA: Intento de generar PDF fallido (trabajo de grado no encontrado, segunda verificación)
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Trabajo de Grado',
                accion_realizada: 'Intento de Descarga PDF Fallido',
                descripcion_detallada: `Intento fallido de generar PDF para trabajo de grado ID ${trabajoId}: Trabajo de grado no encontrado (segunda verificación).`,
                registro_afectado_id: trabajoId.toString(),
            });
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

        // REGISTRO DE AUDITORÍA: Datos para PDF de trabajo de grado descargados exitosamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Trabajo de Grado',
            accion_realizada: 'Descargar PDF (Datos)',
            descripcion_detallada: `Se descargaron los datos para el PDF del trabajo de grado "${trabajo.proyecto}" (ID: ${trabajoId}).`,
            registro_afectado_id: trabajoId.toString(),
        });

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error en la ruta /trabajos-de-grado/:id/datos-pdf:', error.message);
        // REGISTRO DE AUDITORÍA: Error de excepción al generar PDF
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Trabajo de Grado',
            accion_realizada: 'Error de Excepción al Descargar PDF',
            descripcion_detallada: `Excepción al intentar generar PDF para trabajo de grado ID ${trabajoId}. Mensaje: ${error.message}.`,
            registro_afectado_id: trabajoId.toString(),
        });
        res.status(500).json({ error: 'Error interno del servidor al obtener datos para PDF.' });
    }
});


//Pasantias
router.get('/publicas/pasantias/:id/datos-pdf', async (req, res) => {
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

//Servicio comunitario
router.get('/publicas/proyectos-comunitarios/:id/datos-pdf', async (req, res) => { // Cambiado a /datos-pdf para que el frontend obtenga los datos
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
            // REGISTRO DE AUDITORÍA: Intento de generar PDF fallido (proyecto no encontrado)
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Servicio Comunitario',
                accion_realizada: 'Intento de Descarga PDF Fallido',
                descripcion_detallada: `Intento fallido de generar PDF para proyecto ID ${projectId}: Proyecto no encontrado.`,
                registro_afectado_id: projectId.toString(),
            });
            return res.status(404).json({ message: 'Proyecto no encontrado.' });
        } else if (error) {
            console.error('Error al obtener proyecto para PDF:', error.message);
            // REGISTRO DE AUDITORÍA: Error al obtener datos de proyecto para PDF
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Servicio Comunitario',
                accion_realizada: 'Error al Descargar PDF',
                descripcion_detallada: `Error interno del servidor al obtener datos para PDF del proyecto ID ${projectId}. Mensaje: ${error.message}.`,
                registro_afectado_id: projectId.toString(),
            });
            return res.status(500).json({ error: 'Error interno del servidor al obtener datos del proyecto.' });
        }

        if (!project) {
            // REGISTRO DE AUDITORÍA: Intento de generar PDF fallido (proyecto no encontrado, segunda verificación)
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Servicio Comunitario',
                accion_realizada: 'Intento de Descarga PDF Fallido',
                descripcion_detallada: `Intento fallido de generar PDF para proyecto ID ${projectId}: Proyecto no encontrado (segunda verificación).`,
                registro_afectado_id: projectId.toString(),
            });
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

        // REGISTRO DE AUDITORÍA: Datos para PDF de servicio comunitario descargados exitosamente
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Servicio Comunitario',
            accion_realizada: 'Descargar PDF (Datos)',
            descripcion_detallada: `Se descargaron los datos para el PDF del proyecto "${project.proyecto}" (ID: ${projectId}).`,
            registro_afectado_id: projectId.toString(),
        });

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error en la ruta /proyectos-comunitarios/:id/datos-pdf:', error.message);
        // REGISTRO DE AUDITORÍA: Error de excepción al generar PDF
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Servicio Comunitario',
            accion_realizada: 'Error de Excepción al Descargar PDF',
            descripcion_detallada: `Excepción al intentar generar PDF para proyecto ID ${projectId}. Mensaje: ${error.message}.`,
            registro_afectado_id: projectId.toString(),
        });
        res.status(500).json({ error: 'Error interno del servidor al obtener datos para PDF.' });
    }
});


export default router;

