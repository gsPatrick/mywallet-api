const express = require('express');
const router = express.Router();
const importController = require('./import.controller');
const { authMiddleware: protect } = require('../../middlewares/authMiddleware');

router.post('/ofx/preview', protect, importController.previewOFX);
router.post('/ofx/confirm', protect, importController.confirmImport);

module.exports = router;
