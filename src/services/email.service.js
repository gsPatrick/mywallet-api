/**
 * Email Service
 * ========================================
 * Gerenciamento de disparos de emails usando Resend
 * ========================================
 */

const { Resend } = require('resend');

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
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
                    <h1 style="color: #6366f1;">Olá, ${userName}!</h1>
                    <p style="font-size: 16px; line-height: 1.6;">Estamos muito felizes em ter você no <strong>MyWallet</strong>. Nossa missão é ajudar você a alcançar a liberdade financeira com tecnologia e gamificação.</p>
                    <p style="font-size: 16px; line-height: 1.6;">Aqui está o que você pode fazer agora:</p>
                    <ul style="font-size: 16px; line-height: 1.6;">
                        <li>Vincular suas contas e cartões</li>
                        <li>Configurar seus primeiros orçamentos</li>
                        <li>Definir suas metas financeiras</li>
                        <li>Acompanhar seus investimentos</li>
                    </ul>
                    <div style="margin-top: 30px; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
                        <p style="margin: 0; font-size: 14px;">Precisa de ajuda? Basta responder a este email ou entrar em contato com nosso suporte.</p>
                    </div>
                    <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">Bora organizar essa vida financeira!</p>
                    <p style="font-weight: bold; color: #6366f1;">Equipe MyWallet</p>
                </div>
            `,
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
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937; text-align: center;">
                    <h1 style="color: #6366f1;">Recuperação de Senha</h1>
                    <p style="font-size: 16px; line-height: 1.6;">Você solicitou a recuperação de senha da sua conta MyWallet.</p>
                    <p style="font-size: 16px; line-height: 1.6;">Use o código abaixo para prosseguir:</p>
                    <div style="margin: 30px auto; padding: 20px; background-color: #f3f4f6; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4f46e5; display: inline-block;">
                        ${otp}
                    </div>
                    <p style="font-size: 14px; color: #ef4444;">Este código expira em 10 minutos.</p>
                    <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">Se você não solicitou esta alteração, ignore este email com segurança.</p>
                    <p style="margin-top: 20px; font-weight: bold; color: #6366f1;">Equipe MyWallet</p>
                </div>
            `,
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
