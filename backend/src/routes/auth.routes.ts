import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', validate(schemas.register), authController.register);
router.post('/login', validate(schemas.login), authController.login);

// Protected routes
router.use(authenticateToken);

router.get('/profile', authController.getProfile);
router.put('/profile', validate(schemas.updateProfile), authController.updateProfile);
router.post('/change-password', validate(schemas.changePassword), authController.changePassword);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/search', authController.searchUsers);

export default router;