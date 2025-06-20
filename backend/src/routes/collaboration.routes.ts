import { Router } from 'express';
import { CollaborationController } from '../controllers/collaboration.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';

const router = Router();
const collaborationController = new CollaborationController();

// All routes require authentication
router.use(authenticateToken);

// Document collaboration
router.get('/documents/:documentId/users', collaborationController.getDocumentUsers);
router.get('/documents/:documentId/comments', collaborationController.getDocumentComments);
router.post('/documents/:documentId/comments', validate(schemas.createComment), collaborationController.addComment);
router.put('/comments/:commentId', collaborationController.updateComment);
router.get('/documents/:documentId/activities', collaborationController.getDocumentActivities);

// System stats
router.get('/stats', collaborationController.getCollaborationStats);

export default router;