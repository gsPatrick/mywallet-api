const express = require('express');
const router = express.Router();
const patchNotesController = require('./patchNotes.controller');
// Assuming we have an auth middleware, but for now strict public/admin separation might be handled by frontend or simple check.
// Using a placeholder middleware or proceeding without generic auth for public routes.

const { authMiddleware } = require('../../middlewares/authMiddleware');

// Public Routes
router.get('/', patchNotesController.listPatchNotes);
router.get('/latest', patchNotesController.getLatestPatchNote);
router.get('/:id', patchNotesController.getPatchNoteById);

// Admin Routes - Protected
// Note: Assuming 'authenticate' populates req.user. We should verify admin status in controller or separate middleware.
// For now, at least requiring authentication is a good step.
router.post('/', authMiddleware, patchNotesController.createPatchNote);
router.put('/:id', authMiddleware, patchNotesController.updatePatchNote);
router.delete('/:id', authMiddleware, patchNotesController.deletePatchNote);

module.exports = router;
