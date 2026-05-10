const baseLayout = require('./baseLayout');

/**
 * Template de Boas-vindas
 */
const welcomeTemplate = (userName) => baseLayout(`
    <h2 style="font-size: 24px; margin-bottom: 20px;">Olá, <span class="highlight">${userName}</span>! 👋</h2>
    <p style="font-size: 16px;">Seja muito bem-vindo ao <strong>MyWallet</strong>. Estamos entusiasmados em ajudar você a organizar sua vida financeira e alcançar seus objetivos.</p>
    
    <div class="divider"></div>
    
    <p style="font-size: 16px;">Com o MyWallet, você terá controle total sobre:</p>
    <ul style="padding-left: 20px;">
        <li>Seu patrimônio e investimentos</li>
        <li>Contas bancárias e cartões em um só lugar</li>
        <li>Orçamentos mensais e metas de economia</li>
        <li>Seu assistente financeiro no WhatsApp</li>
    </ul>
    
    <div style="text-align: center; margin-top: 30px;">
        <a href="https://mywallet.codebypatrick.dev/dashboard" class="button">Começar Agora</a>
    </div>
    
    <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">Se tiver qualquer dúvida, sinta-se à vontade para responder a este e-mail.</p>
`);

/**
 * Template de Recuperação de Senha (OTP)
 */
const otpTemplate = (otp) => baseLayout(`
    <h2 style="font-size: 24px; margin-bottom: 20px;">Recuperação de Senha 🔐</h2>
    <p style="font-size: 16px;">Você solicitou um código para redefinir sua senha no MyWallet.</p>
    
    <div style="margin: 40px 0; text-align: center;">
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 16px; border: 2px dashed #6366f1; display: inline-block;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1a1a2e;">${otp}</span>
        </div>
    </div>
    
    <p style="font-size: 14px; color: #ef4444; text-align: center;">Este código é válido por 15 minutos.</p>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #6c757d;">Se você não solicitou esta alteração, pode ignorar este e-mail. Sua conta continua segura.</p>
`);

module.exports = {
    welcomeTemplate,
    otpTemplate
};
