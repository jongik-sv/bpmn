import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';

const router = Router();
const documentController = new DocumentController();

// All routes require authentication
router.use(authenticateToken);

// Project documents
router.get('/project/:projectId', documentController.getProjectDocuments);
router.post('/project/:projectId', validate(schemas.createDocument), documentController.createDocument);

// Document CRUD
router.get('/:id', documentController.getDocument);
router.put('/:id', validate(schemas.updateDocument), documentController.updateDocument);
router.delete('/:id', documentController.deleteDocument);

// Document snapshots
router.get('/:id/snapshots', documentController.getSnapshots);
router.post('/:id/snapshots', documentController.createSnapshot);
router.post('/:id/snapshots/:snapshotId/restore', documentController.restoreSnapshot);

// Document export
router.get('/:id/export', documentController.exportDocument);

export default router;