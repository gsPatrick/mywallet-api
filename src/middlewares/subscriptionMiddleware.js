/**
 * Subscription Middleware
 * ========================================
 * PAYWALL - BLOQUEIO DE INADIMPLENTES
 * ========================================
 */

/**
 * Middleware que verifica se usuário tem assinatura ativa
 * Retorna 403 se não tem acesso
 */
const requireActiveSubscription = async (req, res, next) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        // OWNER tem acesso total
        if (user.plan === 'OWNER') {
            return next();
        }

        // LIFETIME tem acesso permanente
        if (user.plan === 'LIFETIME' && user.subscriptionStatus === 'ACTIVE') {
            return next();
        }

        // Verificar se assinatura está ativa
        if (user.subscriptionStatus !== 'ACTIVE') {
            return res.status(403).json({
                error: 'SUBSCRIPTION_REQUIRED',
                message: 'Assinatura inativa. Por favor, assine um plano para continuar.',
                redirectTo: '/checkout'
            });
        }

        // Verificar expiração (para planos não-Lifetime)
        if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) {
            return res.status(403).json({
                error: 'SUBSCRIPTION_EXPIRED',
                message: 'Sua assinatura expirou. Por favor, renove para continuar.',
                redirectTo: '/checkout'
            });
        }

        next();
    } catch (error) {
        console.error('Erro no middleware de assinatura:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
};

/**
 * Middleware que verifica se usuário é OWNER (Admin)
 */
const requireOwner = async (req, res, next) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        if (user.plan !== 'OWNER') {
            return res.status(403).json({
                error: 'FORBIDDEN',
                message: 'Acesso restrito a administradores'
            });
        }

        next();
    } catch (error) {
        console.error('Erro no middleware owner:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
};

/**
 * Middleware que verifica se usuário é FREE (para mostrar upsell)
 */
const checkFreeUser = async (req, res, next) => {
    try {
        const user = req.user;
        req.isFreeUser = !user || user.plan === 'FREE' || user.subscriptionStatus !== 'ACTIVE';
        next();
    } catch (error) {
        next();
    }
};

module.exports = {
    requireActiveSubscription,
    requireOwner,
    checkFreeUser
};
