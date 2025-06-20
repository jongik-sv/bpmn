import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';

const router = Router();
const projectController = new ProjectController();

// All routes require authentication
router.use(authenticateToken);

// Project CRUD
router.get('/', projectController.getProjects);
router.post('/', validate(schemas.createProject), projectController.createProject);
router.get('/:id', projectController.getProject);
router.put('/:id', validate(schemas.updateProject), projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// Project sharing and members
router.get('/:id/members', projectController.getProjectMembers);
router.post('/:id/share', validate(schemas.inviteUsers), projectController.shareProject);
router.put('/:id/members/:userId', projectController.updateMemberRole);
router.delete('/:id/members/:userId', projectController.removeMember);

export default router;