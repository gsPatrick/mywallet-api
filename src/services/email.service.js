/**
 * Email Service
 * ========================================
 * Gerenciamento de disparos de emails usando Resend
 * ========================================
 */

const { Resend } = require('resend');
const { welcomeTemplate, otpTemplate } = require('../templates/emails');

// Configuração - Em produção usar variáveis de ambiente
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_bswpFLAA_2LkvCebTpnwBdbTAAt5AYyHu';
const resend = new Resend(RESEND_API_KEY);

const FROM_EMAIL = 'MyWallet <mywallet@codebypatrick.dev>';

/**
 * Envia email de boas-vindas
 */
const sendWelcomeEmail = async (toEmail, userName) => {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [toEmail],
            subject: 'Bem-vindo ao MyWallet! 🚀',
            html: welcomeTemplate(userName),
        });

        if (error) {
            console.error('❌ [EMAIL] Erro ao enviar boas-vindas:', error);
            return { success: false, error };
        }

        console.log('✅ [EMAIL] Boas-vindas enviado para:', toEmail);
        return { success: true, data };
    } catch (err) {
        console.error('❌ [EMAIL] Exception no envio de boas-vindas:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Envia OTP para recuperação de senha
 */
const sendOTPEmail = async (toEmail, otp) => {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [toEmail],
            subject: 'Código de Recuperação - MyWallet 🔐',
            html: otpTemplate(otp),
        });

        if (error) {
            console.error('❌ [EMAIL] Erro ao enviar OTP:', error);
            return { success: false, error };
        }

        console.log('✅ [EMAIL] OTP enviado para:', toEmail);
        return { success: true, data };
    } catch (err) {
        console.error('❌ [EMAIL] Exception no envio de OTP:', err);
        return { success: false, error: err.message };
    }
};

module.exports = {
    sendWelcomeEmail,
    sendOTPEmail
};
