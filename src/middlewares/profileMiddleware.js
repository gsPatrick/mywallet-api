/**
 * Profile Middleware
 * ========================================
 * MULTI-CONTEXT PROFILE ISOLATION
 * ========================================
 * 
 * - Intercepta o header x-profile-id
 * - Verifica se o Profile pertence ao User autenticado
 * - Injeta req.profileId para uso nos services
 * - Auto-seleciona perfil default se não especificado
 */

const { Profile } = require('../models');

/**
 * Middleware de isolamento de perfil
 * Deve ser usado após o authMiddleware
 */
const profileMiddleware = async (req, res, next) => {
    try {
        // Usuário deve estar autenticado
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não autenticado'
            });
        }

        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        // Se um profileId foi especificado
        if (profileId) {
            // Verificar se o profile pertence ao usuário
            const profile = await Profile.findOne({
                where: {
                    id: profileId,
                    userId: userId
                }
            });

            if (!profile) {
                return res.status(403).json({
                    success: false,
                    error: 'Perfil não encontrado ou não pertence a este usuário'
                });
            }

            // Injetar profileId no request
            req.profileId = profile.id;
            req.profile = profile;
            return next();
        }

        // Se nenhum profileId foi especificado, usar o perfil default
        const defaultProfile = await Profile.findOne({
            where: {
                userId: userId,
                isDefault: true
            }
        });

        if (defaultProfile) {
            req.profileId = defaultProfile.id;
            req.profile = defaultProfile;
            return next();
        }

        // Se não tem perfil default, buscar qualquer perfil
        const anyProfile = await Profile.findOne({
            where: { userId: userId }
        });

        if (anyProfile) {
            req.profileId = anyProfile.id;
            req.profile = anyProfile;
            return next();
        }

        // Usuário sem perfil - permitir continuar mas sem profileId
        // (útil para endpoints que criam perfis)
        req.profileId = null;
        req.profile = null;
        next();

    } catch (error) {
        console.error('Profile Middleware Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno ao processar contexto de perfil'
        });
    }
};

/**
 * Middleware opcional - requer que um perfil esteja definido
 */
const requireProfile = (req, res, next) => {
    if (!req.profileId) {
        return res.status(400).json({
            success: false,
            error: 'Nenhum perfil ativo. Complete o onboarding primeiro.'
        });
    }
    next();
};

module.exports = {
    profileMiddleware,
    requireProfile
};
