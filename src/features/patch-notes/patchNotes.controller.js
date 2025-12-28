const { PatchNote } = require('../../models');
const { logger } = require('../../config/logger');

const patchNotesController = {
    // Public: List all patch notes
    listPatchNotes: async (req, res, next) => {
        try {
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            const { count, rows } = await PatchNote.findAndCountAll({
                where: { isActive: true },
                order: [['releaseDate', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                total: count,
                pages: Math.ceil(count / limit),
                currentPage: parseInt(page),
                data: rows,
            });
        } catch (error) {
            logger.error('Error listing patch notes:', error);
            next(error);
        }
    },

    // Public: Get latest patch note
    getLatestPatchNote: async (req, res, next) => {
        try {
            const latest = await PatchNote.findOne({
                where: { isActive: true },
                order: [['releaseDate', 'DESC']],
            });

            if (!latest) {
                return res.status(404).json({ message: 'No patch notes found' });
            }

            return res.json(latest);
        } catch (error) {
            logger.error('Error fetching latest patch note:', error);
            next(error);
        }
    },

    // Admin: Create patch note
    createPatchNote: async (req, res, next) => {
        try {
            const { version, title, description, releaseDate, updates, bannerUrl } = req.body;

            // Basic validation
            if (!version || !title) {
                return res.status(400).json({ message: 'Version and Title are required' });
            }

            const newPatchNote = await PatchNote.create({
                version,
                title,
                description,
                releaseDate: releaseDate || new Date(),
                updates: updates || [],
                bannerUrl,
            });

            return res.status(201).json(newPatchNote);
        } catch (error) {
            logger.error('Error creating patch note:', error);
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ message: 'Version already exists' });
            }
            next(error);
        }
    },

    // Admin: Update patch note
    updatePatchNote: async (req, res, next) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const note = await PatchNote.findByPk(id);
            if (!note) {
                return res.status(404).json({ message: 'Patch note not found' });
            }

            await note.update(updateData);
            return res.json(note);
        } catch (error) {
            logger.error('Error updating patch note:', error);
            next(error);
        }
    },

    // Admin: Delete patch note
    deletePatchNote: async (req, res, next) => {
        try {
            const { id } = req.params;
            const note = await PatchNote.findByPk(id);

            if (!note) {
                return res.status(404).json({ message: 'Patch note not found' });
            }

            await note.destroy();
            return res.status(204).send();
        } catch (error) {
            logger.error('Error deleting patch note:', error);
            next(error);
        }
    }
};

module.exports = patchNotesController;
