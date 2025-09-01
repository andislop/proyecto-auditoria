import express from 'express';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs'; // Importa bcryptjs para hashear contraseñas
import dotenv from 'dotenv';
import path from 'path'; // Importa path de forma estándar
import { fileURLToPath } from 'url'; // Necesario para convertir URL a path de sistema de archivos
import nodemailer from 'nodemailer'; // Importa nodemailer para enviar correos


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

// Configuración del transportador de Nodemailer
// Asegúrate de que estas variables de entorno están configuradas en tu archivo .env
const transporter = nodemailer.createTransport({ 
    service: 'gmail', // Puedes cambiarlo a 'hotmail', 'outlook', o un host SMTP específico
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, 
    }
});

router.post('/recuperar-password', async (req, res) => {
    try {
        const { correo } = req.body;

        if (!correo) {
            return res.status(400).json({ error: 'El campo de correo electrónico es obligatorio.' });
        }

        // 1. Verificar si el correo existe en la tabla de login
        const { data: user, error: userError } = await supabase
            .from('login') // Utiliza la tabla 'login' como indicaste
            .select('id_login, correo')
            .eq('correo', correo)
            .single();

        if (userError || !user) {
            // No se debe indicar al atacante si el correo existe o no por seguridad
            console.warn(`Intento de recuperación de contraseña para correo no registrado: ${correo}`);
            return res.status(200).json({ message: 'Si el correo electrónico está registrado, se enviará un código de recuperación.' });
        }

        // 2. Generar un código numérico de 6 dígitos y el tiempo de expiración
        const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expirationTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de validez

        // 3. Invalidar códigos anteriores para este correo antes de insertar uno nuevo
        // Esto evita que un mismo usuario tenga múltiples códigos activos
        await supabase
            .from('codigos_recuperacion')
            .update({ usado: true })
            .eq('correo', correo)
            .eq('usado', false);

        // 4. Guardar el nuevo código en la base de datos
        // Necesitas tener una tabla 'codigos_recuperacion' con las columnas 'correo', 'codigo', 'expiracion' y 'usado'
        const { error: insertError } = await supabase
            .from('codigos_recuperacion')
            .insert([{
                correo: correo,
                codigo: recoveryCode,
                expiracion: expirationTime.toISOString(),
                usado: false
            }]);

        if (insertError) {
            console.error('Error al insertar código de recuperación:', insertError);
            return res.status(500).json({ error: 'Error interno del servidor al guardar el código.' });
        }

        // 5. Opciones del correo electrónico con el nuevo diseño
        // Usamos la URL que me proporcionaste.
        const unefaLogoUrl = 'https://images.seeklogo.com/logo-png/14/2/unefa-logo-png_seeklogo-144842.png';

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.correo,
            subject: 'Código de recuperación de contraseña',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; padding: 20px; text-align: center;">
                    <div style="max-width: 600px; margin: 20px auto; background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                        <img src="${unefaLogoUrl}" alt="Logo de UNEFA" style="max-width: 150px; margin-bottom: 20px;">
                        <h2 style="color: #0d6efd;">Recuperación de Contraseña</h2>
                        <p>Hemos recibido una solicitud para restablecer tu contraseña. Usa el siguiente código para completar el proceso:</p>
                        <div style="background-color: #0d6efd; color: #fff; padding: 15px 25px; margin: 20px auto; border-radius: 8px; max-width: 250px;">
                            <strong style="font-size: 24px; letter-spacing: 5px;">${recoveryCode}</strong>
                        </div>
                        <p style="font-size: 14px; color: #777;">Este código expirará en 15 minutos.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #aaa;">Si no solicitaste esto, puedes ignorar este correo. Por favor, no respondas a este mensaje.</p>
                        <p style="font-size: 12px; color: #aaa; margin-top: 10px;">© 2024 UNEFA. Todos los derechos reservados.</p>
                    </div>
                </div>
            `,
        };

        // 6. Enviar el correo electrónico
        await transporter.sendMail(mailOptions);
        
        console.log(`Código de recuperación enviado a: ${user.correo}`);
        return res.status(200).json({ message: 'Código de recuperación enviado exitosamente.' });

    } catch (error) {
        console.error('Error en la API de recuperación de contraseña:', error);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- API para verificar el código ---
router.post('/verificar-codigo', async (req, res) => {
    try {
        const { correo, codigo } = req.body;

        // 1. Buscar el código en la base de datos
        const { data: codeData, error: codeError } = await supabase
            .from('codigos_recuperacion')
            .select('expiracion')
            .eq('correo', correo)
            .eq('codigo', codigo)
            .eq('usado', false)
            .single();

        if (codeError || !codeData) {
            console.warn(`Intento de verificación fallido para ${correo} con código ${codigo}.`);
            return res.status(400).json({ error: 'Código incorrecto o expirado.' });
        }

        // 2. Verificar si el código ha expirado
        const expirationDate = new Date(codeData.expiracion);
        if (expirationDate < new Date()) {
            // Marcar el código como usado si ha expirado
            await supabase.from('codigos_recuperacion').update({ usado: true }).eq('correo', correo).eq('codigo', codigo);
            return res.status(400).json({ error: 'El código ha expirado. Por favor, solicita uno nuevo.' });
        }

        // 3. Marcar el código como usado y responder con éxito
        const { error: updateError } = await supabase
            .from('codigos_recuperacion')
            .update({ usado: true })
            .eq('correo', correo)
            .eq('codigo', codigo);

        if (updateError) {
            console.error('Error al marcar el código como usado:', updateError);
            return res.status(500).json({ error: 'Error al procesar la solicitud.' });
        }

        res.status(200).json({ message: 'Código verificado correctamente.' });

    } catch (error) {
        console.error('Error en la API de verificación de código:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- API para resetear la contraseña ---
router.post('/resetear-password', async (req, res) => {
    try {
        const { correo, password } = req.body;

        // 1. Hashear la nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Actualizar la contraseña en la tabla 'login'
        const { error: updateError } = await supabase
            .from('login') // Tu tabla de usuarios
            .update({ contraseña: hashedPassword })
            .eq('correo', correo);

        if (updateError) {
            console.error('Error al actualizar la contraseña:', updateError);
            return res.status(500).json({ error: 'Error al actualizar la contraseña.' });
        }

        res.status(200).json({ message: 'Contraseña actualizada exitosamente.' });

    } catch (error) {
        console.error('Error en la API de reseteo de contraseña:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


router.post('/enviar-correo-activacion', async (req, res) => {
    try {
        const { correo } = req.body;

        if (!correo) {
            return res.status(400).json({ error: 'El campo de correo electrónico es obligatorio.' });
        }
                // 1. Verificar si el correo existe en la tabla de login
        const { data: user, error: userError } = await supabase
            .from('login') // Utiliza la tabla 'login' como indicaste
            .select('id_login, correo')
            .eq('correo', correo)
            .single();

        if (userError || !user) {
            // No se debe indicar al atacante si el correo existe o no por seguridad
            console.warn(`Intento de recuperación de contraseña para correo no registrado: ${correo}`);
            return res.status(200).json({ message: 'Si el correo electrónico está registrado, se enviará un código de recuperación.' });
        }

        // 1. Opciones del correo electrónico

        const unefaLogoUrl = 'https://images.seeklogo.com/logo-png/14/2/unefa-logo-png_seeklogo-144842.png';
        // Usamos el mismo estilo HTML que creamos antes, adaptándolo para este nuevo mensaje.
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.correo,
            subject: 'Cuenta Activada en Sistema de Gestión de Proyectos',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; padding: 20px; text-align: center;">
                    <div style="max-width: 600px; margin: 20px auto; background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                        <img src="${unefaLogoUrl}" alt="Logo de UNEFA" style="max-width: 150px; margin-bottom: 20px;">
                        <h2 style="color: #0d6efd;">¡Tu cuenta ha sido activada!</h2>
                        <p>Te informamos que tu solicitud para acceder al sistema de <strong>Gestión de Proyectos</strong> ha sido aprobada.</p>
                        <p>Ahora puedes iniciar sesión con tu correo y contraseña.</p>
                        <a href="https://proyecto-auditoria.vercel.app/" style="display: inline-block; padding: 10px 20px; margin-top: 20px; background-color: #0d6efd; color: #fff; text-decoration: none; border-radius: 5px;">Ir al sistema</a>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #aaa;">Si tienes alguna pregunta, por favor contacta al administrador.</p>
                    </div>
                </div>
            `,
        };

        // 2. Enviar el correo electrónico
        await transporter.sendMail(mailOptions);
        
        console.log(`Correo de activación enviado a: ${correo}`);
        return res.status(200).json({ message: 'Correo de activación enviado exitosamente.' });

    } catch (error) {
        console.error('Error en la API de envío de correo de activación:', error);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
