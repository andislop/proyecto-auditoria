import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Volvemos a necesitar estas importaciones para la generación de PDF en el backend
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
                .select('id_estudiante')
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
            const { data: updatedStudent, error: updateStudentError } = await supabase
                .from('estudiante') 
                .update({ nombre_completo: estudiante.nombreCompletoEstudiante })
                .eq('id_estudiante', idEstudiante)
                .select('id_estudiante');

            if (updateStudentError) {
                console.error('Error al actualizar nombre del estudiante:', updateStudentError.message);
                throw new Error('Error al actualizar nombre del estudiante.');
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
                .select('id_estudiante')
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
            const { data: updatedStudent, error: updateStudentError } = await supabase
                .from('estudiante') 
                .update({ nombre_completo: estudiante.nombreCompletoEstudiante })
                .eq('id_estudiante', idEstudiante)
                .select('id_estudiante');

            if (updateStudentError) {
                console.error('Error al actualizar nombre del estudiante:', updateStudentError.message);
                throw new Error('Error al actualizar nombre del estudiante.');
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
                mensaje_restauracion: mensajeRestauracion || null // Guardar mensaje de restauración
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

// API para descargar PDF de comprobante de proyecto de investigación
router.get('/proyectos-investigacion/:id/descargar-pdf', async (req, res) => {
    const { id: projectId } = req.params;

    try {
        const { data: project, error } = await supabase
            .from('proyectos_investigacion')
            .select(`
                id_proyecto_investigacion,
                proyecto,
                estado,
                carreras:id_carrera(carrera),
                periodos:id_periodo(periodo),
                estudiantes:id_estudiante(cedula, nombre_completo, carreras:id_carrera(carrera))
            `)
            .eq('id_proyecto_investigacion', projectId)
            .single();

        if (error || !project) {
            console.error('Error al obtener el proyecto para PDF:', error?.message || 'Proyecto no encontrado.');
            return res.status(404).json({ error: 'Proyecto de investigación no encontrado.' });
        }

        // *** DIAGNÓSTICO: Imprime el objeto 'project' en la consola del servidor ***
        console.log('Datos del proyecto obtenidos para PDF:', JSON.stringify(project, null, 2));

        // Obtener la ruta absoluta del logo
        const logoPathLeft = path.join(__dirname, '../../public/assets/img/unefa.png');
        let logoDataUrlLeft = '';

        try {
            const logoBase64Left = fs.readFileSync(logoPathLeft, { encoding: 'base64' });
            logoDataUrlLeft = `data:image/png;base64,${logoBase64Left}`;
        } catch (readError) {
            console.warn(`Advertencia: No se pudo leer el logo en ${logoPathLeft}. Usando placeholder.`);
            // Usar una imagen base64 de placeholder si el logo no se encuentra
            logoDataUrlLeft = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABtklEQ4nO3bwU3DQBiA4f+XlXIKcAdwB3AH7gDuAK2gU5gJvQJqQTsJnYAn7gDuAK1gC9tL5M/Ld35P088JgY/AHz90J4iIiIiIiIiIiMh54L/A9u/Pnz8/y/L35+fnh1n5+/v79z/Q/vj8/f/A4C/v7/9jYDrXwB/f3/7GQFcfwL8/f3sBQBffwb8/f3sBQB8/xz8/v72A/C/yA/A80kYgR8hN0gC/MhOkAeRnxY4fQd+h9I98B3kKekGeR1JmB/yJpI2Z8QGZ+Q3lQd3Z/J+2/A1kjd7xAYZ6eHdkXfA95GUuYJvJXN2SHd0HdwI5J2m8R8p28iM7ov5AnkJSZxn8t3pXNyd3Y/kKekjTHxSvk1Oid3Yy7IfcE0xvk4A6f+c/2xN9E0xsXh4w1f3t7e/sDfgB+f397B8g+fwP8/f3tB8i+v/8P8Pf3tB8g+v/9P8LfbP9N/P379+8f/35+fr5d/X3/9/Pz80EAn5+f/+c/IiIiIiIiIiIiImIq/gEWm+7p21C7AAAAAElFTkSuQmCC';
        }

        // Obtener la ruta al binario de phantomjs-prebuilt
        // Esta línea puede necesitar ajustarse si phantomjs-prebuilt no se instala correctamente o si Vercel no lo soporta.
        const phantomjsPath = process.env.PHANTOMJS_PATH || path.join(__dirname, '../../node_modules/phantomjs-prebuilt/lib/phantom/bin/phantomjs');


        // Formatear estudiante para el PDF (similar a Trabajo de Grado, pero para UN solo estudiante)
        const estudianteDisplay = project.estudiantes
            ? `
                <tr>
                    <td>${project.estudiantes.cedula || 'N/A'}</td>
                    <td>${project.estudiantes.nombre_completo || 'N/A'}</td>
                    <td>${project.estudiantes.carreras ? project.estudiantes.carreras.carrera : 'N/A'}</td>
                </tr>
            `
            : '<tr><td colspan="3">No hay estudiante registrado.</td></tr>';

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Comprobante de Proyecto de Investigación</title>
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

                <h1 class="document-title">COMPROBANTE DE PROYECTO DE INVESTIGACIÓN</h1>

                <div class="section">
                    <h4>Datos del Proyecto</h4>
                    <div class="data-item"><strong>Nombre del Proyecto:</strong> ${project.proyecto || 'N/A'}</div>
                    <div class="data-item"><strong>Periodo:</strong> ${project.periodos ? project.periodos.periodo : 'N/A'}</div>
                    <div class="data-item"><strong>Carrera:</strong> ${project.carreras ? project.carreras.carrera : 'N/A'}</div>
                    <div class="data-item"><strong>Estado:</strong> ${project.estado || 'N/A'}</div>
                    <div class="data-item"><strong>Fecha de Generación:</strong> ${new Date().toLocaleDateString('es-ES') || 'N/A'}</div>
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
                'Content-Disposition': `attachment; filename="Comprobante_Proyecto_Investigacion_${projectId}.pdf"`
            });
            stream.pipe(res);
        });

    } catch (error) {
        console.error('Error en la ruta /proyectos-investigacion/:id/descargar-pdf:', error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    }
});


export default router;
