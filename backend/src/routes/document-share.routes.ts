import { Router } from 'express';
import { DocumentShareController } from '../controllers/document-share.controller';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';

const router = Router();
const shareController = new DocumentShareController();

// Document sharing routes (authenticated)
router.use('/documents/:id/share', authenticateToken);
router.post('/documents/:id/share', validate(schemas.createShare), shareController.createShare);
router.get('/documents/:id/share', shareController.getDocumentShares);
router.put('/documents/:id/share/:shareId', shareController.updateShare);
router.delete('/documents/:id/share/:shareId', shareController.deleteShare);
router.get('/documents/:id/share/stats', shareController.getShareStats);

// Public share access routes (optional auth)
router.use('/share/:shareToken', optionalAuth);
router.post('/share/:shareToken/access', shareController.accessSharedDocument);
router.post('/share/:shareToken/verify', shareController.verifyShareAccess);
router.post('/share/:shareToken/log', shareController.logShareAction);

export default router;