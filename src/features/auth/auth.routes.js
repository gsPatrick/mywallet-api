/**
 * Auth Routes
 * Rotas de autenticação
 */

const { Router } = require('express');
const authController = require('./auth.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { validate } = require('../../utils/validators');

const router = Router();

// Schemas de validação
const registerSchema = {
    body: {
        name: { required: true, minLength: 2 },
        email: { required: true, type: 'email' },
        password: { required: true, minLength: 6 }
    }
};

const loginSchema = {
    body: {
        email: { required: true, type: 'email' },
        password: { required: true }
    }
};

const changePasswordSchema = {
    body: {
        currentPassword: { required: true },
        newPassword: { required: true, minLength: 6 }
    }
};

// Rotas públicas
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);

// Rotas protegidas
router.get('/me', authMiddleware, authController.getMe);
router.put('/me', authMiddleware, authController.updateMe);
router.post('/change-password', authMiddleware, validate(changePasswordSchema), authController.changePassword);
router.put('/onboarding-complete', authMiddleware, authController.completeOnboarding);

module.exports = router;
