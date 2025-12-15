const express = require('express');
const router = express.Router();
const messagesController = require('./messages.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', messagesController.list);
router.post('/', messagesController.create);
router.put('/:id/read', messagesController.markAsRead);
router.get('/unread-count', messagesController.getUnreadCount);

module.exports = router;
