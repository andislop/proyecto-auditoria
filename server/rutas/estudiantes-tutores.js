import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Importa la función de auditoría
import { registrarAuditoria } from './bitacora.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están definidas.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();


// =======================================================
// APIs PARA ESTUDIANTES
// =======================================================

// Obtener todos los estudiantes no eliminados
router.get('/estudiantes', async (req, res) => {
    try {
        const { data: estData, error: estError } = await supabase
            .from('estudiante')
            .select(`
                id_estudiante,
                nombre_completo,
                cedula,
                id_carrera,
                carreras:id_carrera(id_carrera, carrera)
            `)
            .eq('eliminados', false)
            .order('id_estudiante', { ascending: true });

        // VERIFICAR ERRORES AQUI
        if (estError) {
            console.error('Error al obtener los datos de los estudiantes:', estError);

            // REGISTRO DE AUDITORÍA: Error al obtener los datos de los estudiantes
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Estudiantes',
                accion_realizada: 'Error al obtener datos',
                descripcion_detallada: `Error al obtener la lista de estudiantes. Mensaje: ${estError.message}`,
                registro_afectado_id: null,
            });

            return res.status(500).json({ error: 'Error al obtener los datos de los estudiantes' });
        }

        // SI NO HAY ERRORES, FORMATEAR Y ENVIAR DATOS
        const formato = estData.map(estudiante => ({
            id_estudiante: estudiante.id_estudiante,
            nombre_completo: estudiante.nombre_completo,
            cedula: estudiante.cedula,
            carrera: estudiante.carreras ? estudiante.carreras.carrera : 'N/A'
        }));

        res.status(200).json(formato);

    } catch (error) {
        console.error('Error en la ruta /estudiantes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener un estudiante por ID
// Obtener un solo estudiante por ID
router.get('/estudiantes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: estData, error: estError } = await supabase
            .from('estudiante')
            .select(`
                id_estudiante,
                nombre_completo,
                cedula,
                id_carrera,
                carreras:id_carrera(id_carrera, carrera)
            `)
            .eq('id_estudiante', id)
            .single();

        if (estError) {
            console.error(`Error al obtener el estudiante con ID ${id}:`, estError);
            // REGISTRO DE AUDITORÍA: Error al obtener un estudiante
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Estudiantes',
                accion_realizada: 'Error al obtener un estudiante',
                descripcion_detallada: `Error al obtener el estudiante con ID ${id}. Mensaje: ${estError.message}`,
                registro_afectado_id: id,
            });
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }
        
        // CORRECCIÓN CLAVE: Devuelve el objeto directamente sin usar .map()
        res.status(200).json(estData);

    } catch (error) {
        console.error(`Error en la ruta /estudiantes/${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


// Crear un nuevo estudiante
router.post('/estudiantes', async (req, res) => {
    const { nombre_completo, cedula, id_carrera } = req.body;
    try {
        const { data, error } = await supabase
            .from('estudiante')
            .insert([{ nombre_completo, cedula, id_carrera, eliminados: false }])
            .order('id_estudiante', { ascending: true })
            .eq('eliminados', false)
            .select();

        if (error) {
            console.error('Error al crear un nuevo estudiante:', error);
            // REGISTRO DE AUDITORÍA: Error al crear un estudiante
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Estudiantes',
                accion_realizada: 'Error de Creación',
                descripcion_detallada: `Falló la creación del estudiante con cédula ${cedula}. Mensaje: ${error.message}`,
                registro_afectado_id: null,
            });
            return res.status(500).json({ error: 'Error al crear el estudiante' });
        }
        // REGISTRO DE AUDITORÍA: Estudiante creado con éxito
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Estudiantes',
            accion_realizada: 'Creación',
            descripcion_detallada: `Se creó un nuevo estudiante: ${nombre_completo} (Cédula: ${cedula})`,
            registro_afectado_id: data[0].id_estudiante,
        });
        res.status(201).json({ message: 'Estudiante creado con éxito', data });
    } catch (error) {
        console.error('Error en la ruta POST /estudiantes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar un estudiante
router.put('/estudiantes/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre_completo, cedula, id_carrera } = req.body;
    try {
        const { data, error } = await supabase
            .from('estudiante')
            .update({ nombre_completo, cedula, id_carrera })
            .eq('id_estudiante', id)
            .select();

        if (error) {
            console.error(`Error al actualizar el estudiante con ID ${id}:`, error);
            // REGISTRO DE AUDITORÍA: Error al actualizar un estudiante
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Estudiantes',
                accion_realizada: 'Error de Actualización',
                descripcion_detallada: `Falló la actualización del estudiante con ID ${id}. Mensaje: ${error.message}`,
                registro_afectado_id: id,
            });
            return res.status(500).json({ error: 'Error al actualizar el estudiante' });
        }
        // REGISTRO DE AUDITORÍA: Estudiante actualizado con éxito
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Estudiantes',
            accion_realizada: 'Actualización',
            descripcion_detallada: `Se actualizó el estudiante con ID ${id} a: ${nombre_completo} (Cédula: ${cedula})`,
            registro_afectado_id: id,
        });
        res.status(200).json({ message: 'Estudiante actualizado con éxito', data });
    } catch (error) {
        console.error(`Error en la ruta PUT /estudiantes/${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar un estudiante (lógicamente)
router.put('/estudiantes/eliminar-logico/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('estudiante')
            .update({ eliminados: true })
            .eq('id_estudiante', id)
            .select();

        if (error) {
            console.error(`Error al eliminar el estudiante con ID ${id}:`, error);
            // REGISTRO DE AUDITORÍA: Error al eliminar un estudiante
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Estudiantes',
                accion_realizada: 'Error de Eliminación Lógica',
                descripcion_detallada: `Falló la eliminación lógica del estudiante con ID ${id}. Mensaje: ${error.message}`,
                registro_afectado_id: id,
            });
            return res.status(500).json({ error: 'Error al eliminar el estudiante' });
        }
        // REGISTRO DE AUDITORÍA: Estudiante eliminado lógicamente con éxito
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Estudiantes',
            accion_realizada: 'Eliminación Lógica',
            descripcion_detallada: `Se eliminó lógicamente el estudiante con ID ${id}`,
            registro_afectado_id: id,
        });
        res.status(200).json({ message: 'Estudiante eliminado lógicamente con éxito', data });
    } catch (error) {
        console.error(`Error en la ruta DELETE /estudiantes/${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Asume que 'supabase' está configurado y accesible globalmente
router.get("/buscar-proyectos/:id", async (req, res) => {
    const { id } = req.params;

    try {
        // Objeto de condiciones reutilizable para todas las consultas
        const conditions = [
            { path: "integrantes.id_estudiante.id_estudiante", value: id },
            { path: "tutor.id_tutor", value: id }
        ];

        // Función auxiliar para realizar consultas de Supabase
        const fetchProjects = async (table, selectStatement) => {
            const promises = conditions.map(condition =>
                supabase
                    .from(table)
                    .select(selectStatement)
                    .eq(condition.path, condition.value)
            );
            const results = await Promise.all(promises);

            let allData = [];
            let errors = [];

            results.forEach(result => {
                if (result.data) {
                    allData.push(...result.data);
                }
                if (result.error) {
                    errors.push(result.error);
                }
            });

            if (errors.length > 0) {
                console.error(`Error en la tabla ${table}:`, errors);
            }

            // Eliminar duplicados
            const uniqueData = allData.reduce((acc, current) => {
                const isDuplicate = acc.some(item =>
                    item.id_servicio === current.id_servicio ||
                    item.id_trabajo_grado === current.id_trabajo_grado ||
                    item.id_proyecto_investigacion === current.id_proyecto_investigacion ||
                    item.id_pasantia === current.id_pasantia
                );
                if (!isDuplicate) {
                    acc.push(current);
                }
                return acc;
            }, []);

            return uniqueData;
        };

        // Consultas para cada tipo de proyecto
        const servicioComunitario = await fetchProjects(
            "servicio_comunitario",
            "id_servicio, proyecto, periodos:id_periodo(periodo), integrantes:integrantes!inner(id_estudiante:id_estudiante!inner(id_estudiante)), tutor:id_tutor!inner(id_tutor)"
        );

        const trabajosGrado = await fetchProjects(
            "trabajo_grado",
            "id_trabajo_grado, proyecto, periodos:id_periodo(periodo), estudiantes:id_estudiante!inner(id_estudiante), tutor:id_tutor!inner(id_tutor)"
        );

        const proyectosInvestigacion = await fetchProjects(
            "proyectos_investigacion",
            "id_proyecto_investigacion, proyecto, periodos:id_periodo(periodo), estudiante:id_estudiante!inner(id_estudiante)"
        );

        const pasantias = await fetchProjects(
            "pasantia",
            "id_pasantia, titulo, periodos:id_periodo(periodo), estudiante:id_estudiante!inner(id_estudiante), tutor:id_tutor!inner(id_tutor)"
        );

        res.json({
            servicioComunitario,
            trabajosGrado,
            proyectosInvestigacion,
            pasantias,
        });

    } catch (error) {
        console.error("Error en /api/buscar-proyectos:", error.message);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});


// Asume que 'supabase' está configurado y accesible globalmente
router.get("/buscar-proyectos/tutor/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const fetchProjects = async (table, selectStatement, fkName) => {
            const { data, error } = await supabase
                .from(table)
                .select(selectStatement)
                .eq(fkName, id); // Use the provided foreign key name

            if (error) {
                console.error(`Error en la tabla ${table}:`, error);
                return null;
            }
            return data;
        };

        const servicioComunitario = await fetchProjects(
            "servicio_comunitario",
            "id_servicio, proyecto, periodos:id_periodo(periodo), tutor:id_tutor!inner(id_tutor)",
            "tutor.id_tutor" // Foreign key path for this table
        );

        const trabajosGrado = await fetchProjects(
            "trabajo_grado",
            "id_trabajo_grado, proyecto, periodos:id_periodo(periodo), tutor:id_tutor!inner(id_tutor)",
            "tutor.id_tutor" // Change this if the path is different
        );

        const pasantias = await fetchProjects(
            "pasantia",
            "id_pasantia, titulo, periodos:id_periodo(periodo), tutor:id_tutor!inner(id_tutor)",
            "tutor.id_tutor" // Change this if the path is different
        );

        res.json({
            servicioComunitario: servicioComunitario || [],
            trabajosGrado: trabajosGrado || [],
            pasantias: pasantias || []
        });

    } catch (error) {
        console.error("Error en /api/buscar-proyectos:", error.message);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});
// =======================================================
// APIs PARA TUTORES
// =======================================================

// Obtener todos los tutores no eliminados
router.get('/tutores', async (req, res) => {
    try {
        const { data: tutorData, error: tutorError } = await supabase
            .from('tutor')
            .select(`
                id_tutor,
                nombre_completo,
                cedula
            `)
            .eq('eliminados', false)
            .order('id_tutor', { ascending: true });

        if (tutorError) {
            console.error('Error al obtener los datos de los tutores:', tutorError);
            // REGISTRO DE AUDITORÍA: Error al obtener los datos de los tutores
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Tutores',
                accion_realizada: 'Error al obtener datos',
                descripcion_detallada: `Error al obtener la lista de tutores. Mensaje: ${tutorError.message}`,
                registro_afectado_id: null,
            });
            return res.status(500).json({ error: 'Error al obtener los datos de los tutores' });
        }
        res.status(200).json(tutorData);
    } catch (error) {
        console.error('Error en la ruta /tutores:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener un tutor por ID
router.get('/tutores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: tutorData, error: tutorError } = await supabase
            .from('tutor')
            .select(`
                id_tutor,
                nombre_completo,
                cedula
            `)
            .eq('id_tutor', id)
            .single();

        if (tutorError) {
            console.error(`Error al obtener el tutor con ID ${id}:`, tutorError);
            // REGISTRO DE AUDITORÍA: Error al obtener un tutor
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Tutores',
                accion_realizada: 'Error al obtener un tutor',
                descripcion_detallada: `Error al obtener el tutor con ID ${id}. Mensaje: ${tutorError.message}`,
                registro_afectado_id: id,
            });
            return res.status(404).json({ error: 'Tutor no encontrado' });
        }
        res.status(200).json(tutorData);
    } catch (error) {
        console.error(`Error en la ruta /tutores/${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear un nuevo tutor
router.post('/tutores', async (req, res) => {
    const { nombre_completo, cedula } = req.body;
    try {
        const { data, error } = await supabase
            .from('tutor')
            .insert([{ nombre_completo, cedula, eliminados: false }])
            .select();

        if (error) {
            console.error('Error al crear un nuevo tutor:', error);
            // REGISTRO DE AUDITORÍA: Error al crear un tutor
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Tutores',
                accion_realizada: 'Error de Creación',
                descripcion_detallada: `Falló la creación del tutor con cédula ${cedula}. Mensaje: ${error.message}`,
                registro_afectado_id: null,
            });
            return res.status(500).json({ error: 'Error al crear el tutor' });
        }
        // REGISTRO DE AUDITORÍA: Tutor creado con éxito
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Tutores',
            accion_realizada: 'Creación',
            descripcion_detallada: `Se creó un nuevo tutor: ${nombre_completo} (Cédula: ${cedula})`,
            registro_afectado_id: data[0].id_tutor,
        });
        res.status(201).json({ message: 'Tutor creado con éxito', data });
    } catch (error) {
        console.error('Error en la ruta POST /tutores:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar un tutor
router.put('/tutores/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre_completo, cedula } = req.body;
    try {
        const { data, error } = await supabase
            .from('tutor')
            .update({ nombre_completo, cedula })
            .eq('id_tutor', id)
            .select();

        if (error) {
            console.error(`Error al actualizar el tutor con ID ${id}:`, error);
            // REGISTRO DE AUDITORÍA: Error al actualizar un tutor
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Tutores',
                accion_realizada: 'Error de Actualización',
                descripcion_detallada: `Falló la actualización del tutor con ID ${id}. Mensaje: ${error.message}`,
                registro_afectado_id: id,
            });
            return res.status(500).json({ error: 'Error al actualizar el tutor' });
        }
        // REGISTRO DE AUDITORÍA: Tutor actualizado con éxito
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Tutores',
            accion_realizada: 'Actualización',
            descripcion_detallada: `Se actualizó el tutor con ID ${id} a: ${nombre_completo} (Cédula: ${cedula})`,
            registro_afectado_id: id,
        });
        res.status(200).json({ message: 'Tutor actualizado con éxito', data });
    } catch (error) {
        console.error(`Error en la ruta PUT /tutores/${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar un tutor (lógicamente)
router.delete('/tutores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('tutor')
            .update({ eliminados: true })
            .eq('id_tutor', id)
            .select();

        if (error) {
            console.error(`Error al eliminar el tutor con ID ${id}:`, error);
            // REGISTRO DE AUDITORÍA: Error al eliminar un tutor
            await registrarAuditoria({
                id_login: req.currentUserIdLogin,
                modulo_afectado: 'Tutores',
                accion_realizada: 'Error de Eliminación Lógica',
                descripcion_detallada: `Falló la eliminación lógica del tutor con ID ${id}. Mensaje: ${error.message}`,
                registro_afectado_id: id,
            });
            return res.status(500).json({ error: 'Error al eliminar el tutor' });
        }
        // REGISTRO DE AUDITORÍA: Tutor eliminado lógicamente con éxito
        await registrarAuditoria({
            id_login: req.currentUserIdLogin,
            modulo_afectado: 'Tutores',
            accion_realizada: 'Eliminación Lógica',
            descripcion_detallada: `Se eliminó lógicamente el tutor con ID ${id}`,
            registro_afectado_id: id,
        });
        res.status(200).json({ message: 'Tutor eliminado lógicamente con éxito', data });
    } catch (error) {
        console.error(`Error en la ruta DELETE /tutores/${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
