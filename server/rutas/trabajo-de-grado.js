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
                estudiantes:id_estudiante(id_estudiante, cedula, nombre_completo)
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
            estudiante: trabajo.estudiantes ? { id_estudiante: trabajo.estudiantes.id_estudiante, cedula: trabajo.estudiantes.cedula, nombre_completo: trabajo.estudiantes.nombre_completo } : null,
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
                id_estudiante: estudianteIdToUse, // Corregido: 'estudianteIdTouse' a 'estudianteIdToUse'
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

// API: Generar PDF para un trabajo de grado
router.get('/trabajos-de-grado/:id/descargar-pdf', async (req, res) => {
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
                estudiantes:id_estudiante(cedula, nombre_completo, carreras:id_carrera(carrera))
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

        // Obtener la ruta absoluta del logo
        const logoPathLeft = path.join(__dirname, '../../public/assets/img/unefa.png');
        let logoDataUrlLeft = '';

        try {
            const logoBase64Left = fs.readFileSync(logoPathLeft, { encoding: 'base64' });
            logoDataUrlLeft = `data:image/png;base64,${logoBase64Left}`;
        } catch (readError) {
            console.warn(`Advertencia: No se pudo leer el logo en ${logoPathLeft}. Usando placeholder.`);
            logoDataUrlLeft = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABtklEQVR4nO3bwU3DQBiA4f+XlXIKcAdwB3AH7gDuAK2gU5gJvQJqQTsJnYAn7gDuAK1gC9tL5M/Ld35P088JgY/AHz90J4iIiIiIiIiIiMh54L/A9u/Pnz8/y/L35+fnh1n5+/v79z/Q/vj8/f/A4C/v7/9jYDrXwB/f3/7GQFcfwL8/f3sBQBffwb8/f3sBQB8/xz8/v72A/C/yA/A80kYgR8hN0gC/MhOkAeRnxY4fQd+h9I98B3kKekGeR1JmB/yJpI2Z8QGZ+Q3lQd3Z/J+2/A1kjd7xAYZ6eHdkXfA95GUuYJvJXN2SHd0HdwI5J2m8R8p28iM7ov5AnkJSZxn8t3pXNyd3Y/kKekjTHxSvk1Oid3Yy7IfcE0xvk4A6f+c/2xN9E0xsXh4w1f3t7e/sDfgB+f397B8g+fwP8/f3tB8i+v/8P8Pf3tB8g+v/9P8LfbP9N/P379+8f/35+fr5d/X3/9/Pz80EAn5+f/+c/IiIiIiIiIiIiImIq/gEWm+7p21C7AAAAAElFTkSuQmCC';
        }

        // Obtener la ruta al binario de phantomjs-prebuilt
        const phantomjsPath = fileURLToPath(import.meta.resolve('phantomjs-prebuilt/lib/phantom/bin/phantomjs'));

        // Formatear estudiante para el PDF
        const estudianteDisplay = trabajo.estudiantes
            ? `
                <tr>
                    <td>${trabajo.estudiantes.cedula || 'N/A'}</td>
                    <td>${trabajo.estudiantes.nombre_completo || 'N/A'}</td>
                    <td>${trabajo.estudiantes.carreras ? trabajo.estudiantes.carreras.carrera : 'N/A'}</td>
                </tr>
            `
            : '<tr><td colspan="3">No hay estudiante registrado.</td></tr>';

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Comprobante de Trabajo de Grado</title>
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
                        padding-left: 110px; /* Espacio para el logo izquierdo */
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
                        width: calc(100% - 110px); /* Ocupa el 100% del ancho disponible menos el padding-left del logo */
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
                        margin-top: 100px; /* Ajuste para bajar la firma */
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

                <h1 class="document-title">COMPROBANTE DE TRABAJO DE GRADO</h1>

                <div class="section">
                    <h4>Datos del Proyecto</h4>
                    <div class="data-item"><strong>Nombre del Proyecto:</strong> ${trabajo.proyecto || 'N/A'}</div>
                    <div class="data-item"><strong>Periodo:</strong> ${trabajo.periodos ? trabajo.periodos.periodo : 'N/A'}</div>
                    <div class="data-item"><strong>Carrera:</strong> ${trabajo.carreras ? trabajo.carreras.carrera : 'N/A'}</div>
                    <div class="data-item"><strong>Estado:</strong> ${trabajo.estado || 'N/A'}</div>
                    <div class="data-item"><strong>Fecha:</strong> ${new Date(trabajo.fecha).toLocaleDateString('es-ES') || 'N/A'}</div>
                </div>

                <div class="section">
                    <h4>Datos del Tutor</h4>
                    <div class="data-item"><strong>Cédula:</strong> ${trabajo.tutores ? trabajo.tutores.cedula : 'N/A'}</div>
                    <div class="data-item"><strong>Nombre Completo:</strong> ${trabajo.tutores ? trabajo.tutores.nombre_completo : 'N/A'}</div>
                </div>

                <div class="section">
                    <h4>Datos del Estudiante</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Cédula</th>
                                <th>Nombre Completo</th>
                                <th>Carrera del Estudiante</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${estudianteDisplay}
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
                'Content-Disposition': `attachment; filename="Comprobante_Trabajo_de_Grado_${trabajoId}.pdf"`
            });
            stream.pipe(res);
        });

    } catch (error) {
        console.error('Error en la ruta /trabajos-de-grado/:id/descargar-pdf:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al generar PDF.' });
    }
});

export default router;
