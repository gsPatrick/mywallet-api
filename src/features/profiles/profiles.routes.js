/**
 * Profile Routes
 * ========================================
 * MULTI-CONTEXT PROFILE MANAGEMENT
 * ========================================
 */

const { Router } = require('express');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const profileService = require('./profiles.service');

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * GET /api/profiles
 * Listar todos os perfis do usuário
 */
router.get('/', async (req, res) => {
    try {
        const profiles = await profileService.getProfiles(req.user.id);
        res.json({
            success: true,
            profiles
        });
    } catch (error) {
        console.error('Error getting profiles:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar perfis'
        });
    }
});

/**
 * GET /api/profiles/default
 * Buscar perfil padrão
 */
router.get('/default', async (req, res) => {
    try {
        const profile = await profileService.getDefaultProfile(req.user.id);
        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Error getting default profile:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar perfil padrão'
        });
    }
});

/**
 * GET /api/profiles/check
 * Verificar se usuário tem perfis configurados
 */
router.get('/check', async (req, res) => {
    try {
        const hasProfiles = await profileService.hasProfiles(req.user.id);
        res.json({
            success: true,
            hasProfiles
        });
    } catch (error) {
        console.error('Error checking profiles:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar perfis'
        });
    }
});

/**
 * POST /api/profiles/setup
 * Setup inicial de perfis (onboarding)
 */
router.post('/setup', async (req, res) => {
    try {
        const { profileType, profiles, defaultProfileType, financialData } = req.body;

        if (!profileType) {
            return res.status(400).json({
                success: false,
                error: 'Tipo de perfil é obrigatório'
            });
        }

        const createdProfiles = await profileService.setupProfiles(req.user.id, {
            profileType,
            profiles,
            defaultProfileType,
            financialData
        });

        res.status(201).json({
            success: true,
            message: 'Perfis configurados com sucesso',
            profiles: createdProfiles
        });
    } catch (error) {
        console.error('═══════════════════════════════════════════════════');
        console.error('❌ [PROFILES SETUP] ERROR DETAILS:');
        console.error('   - Message:', error.message);
        console.error('   - Name:', error.name);
        console.error('   - Stack:', error.stack);
        console.error('═══════════════════════════════════════════════════');

        res.status(500).json({
            success: false,
            error: 'Erro ao configurar perfis',
            details: error.message,  // ← Retorna mensagem real para debug
            errorName: error.name
        });
    }
});

/**
 * POST /api/profiles
 * Criar novo perfil
 */
router.post('/', async (req, res) => {
    try {
        const { type, subtype, name, document, icon, color, settings } = req.body;

        if (!type || !name) {
            return res.status(400).json({
                success: false,
                error: 'Tipo e nome são obrigatórios'
            });
        }

        // Verificar se já existe perfil deste tipo
        const existing = await profileService.getProfiles(req.user.id);
        const hasType = existing.some(p => p.type === type);

        if (hasType) {
            return res.status(400).json({
                success: false,
                error: `Já existe um perfil do tipo ${type}`
            });
        }

        const profile = await profileService.createProfile({
            userId: req.user.id,
            type,
            subtype,
            name,
            document,
            icon: icon || (type === 'BUSINESS' ? '💼' : '👤'),
            color: color || (type === 'BUSINESS' ? '#10B981' : '#3B82F6'),
            settings: settings || {},
            isDefault: existing.length === 0 // Primeiro perfil é default
        });

        res.status(201).json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao criar perfil'
        });
    }
});

/**
 * PUT /api/profiles/:id
 * Atualizar perfil
 */
router.put('/:id', async (req, res) => {
    try {
        const { name, document, icon, color, settings } = req.body;

        const profile = await profileService.updateProfile(req.params.id, req.user.id, {
            name,
            document,
            icon,
            color,
            settings
        });

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erro ao atualizar perfil'
        });
    }
});

/**
 * PUT /api/profiles/:id/switch
 * Definir perfil como padrão/ativo
 */
router.put('/:id/switch', async (req, res) => {
    try {
        const profile = await profileService.setDefaultProfile(req.params.id, req.user.id);

        res.json({
            success: true,
            message: 'Perfil alterado com sucesso',
            profile
        });
    } catch (error) {
        console.error('Error switching profile:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao trocar perfil'
        });
    }
});

/**
 * GET /api/profiles/:id
 * Buscar perfil específico
 */
router.get('/:id', async (req, res) => {
    try {
        const profile = await profileService.getProfile(req.params.id, req.user.id);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Perfil não encontrado'
            });
        }

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar perfil'
        });
    }
});

module.exports = router;
