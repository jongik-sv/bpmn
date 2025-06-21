import { Request, Response } from 'express';
import { ProjectService } from '../services/project.service';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

export class ProjectController {
  private projectService: ProjectService;

  constructor() {
    this.projectService = new ProjectService();
  }

  createProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!._id;
      const projectData = req.body;

      const project = await this.projectService.createProject(userId, projectData);

      logger.info(`Project created: ${project.name} by ${req.user!.email}`);

      res.status(201).json({
        message: 'Project created successfully',
        project
      });
    } catch (error) {
      logger.error('Create project error:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  };

  getProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!._id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      logger.info(`Getting projects for user: ${userId}, page: ${page}, limit: ${limit}`);
      const result = await this.projectService.getUserProjects(userId, page, limit);
      logger.info(`Found ${result.projects.length} projects, total: ${result.total}`);

      res.json(result);
    } catch (error) {
      logger.error('Get projects error:', error);
      res.status(500).json({ error: 'Failed to get projects' });
    }
  };

  getProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      const project = await this.projectService.getProjectById(new Types.ObjectId(id), userId);

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json({ project });
    } catch (error) {
      logger.error('Get project error:', error);
      
      if (error instanceof Error && error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      
      res.status(500).json({ error: 'Failed to get project' });
    }
  };

  updateProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;
      const updateData = req.body;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      const project = await this.projectService.updateProject(
        new Types.ObjectId(id),
        userId,
        updateData
      );

      logger.info(`Project updated: ${project.name} by ${req.user!.email}`);

      res.json({
        message: 'Project updated successfully',
        project
      });
    } catch (error) {
      logger.error('Update project error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
        if (error.message === 'Project not found') {
          res.status(404).json({ error: 'Project not found' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to update project' });
    }
  };

  deleteProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      await this.projectService.deleteProject(new Types.ObjectId(id), userId);

      logger.info(`Project deleted: ${id} by ${req.user!.email}`);

      res.json({ message: 'Project deleted successfully' });
    } catch (error) {
      logger.error('Delete project error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Project not found') {
          res.status(404).json({ error: 'Project not found' });
          return;
        }
        if (error.message.includes('Only project owner')) {
          res.status(403).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to delete project' });
    }
  };

  getProjectMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      const members = await this.projectService.getProjectMembers(
        new Types.ObjectId(id),
        userId
      );

      res.json({ members });
    } catch (error) {
      logger.error('Get project members error:', error);
      
      if (error instanceof Error && error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      
      res.status(500).json({ error: 'Failed to get project members' });
    }
  };

  shareProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;
      const { emails, role = 'viewer', message } = req.body;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      const results = await this.projectService.shareProject(
        new Types.ObjectId(id),
        userId,
        emails,
        role,
        message
      );

      logger.info(`Project shared: ${id} with ${emails.length} users by ${req.user!.email}`);

      res.json({ results });
    } catch (error) {
      logger.error('Share project error:', error);
      
      if (error instanceof Error && error.message === 'Share permission denied') {
        res.status(403).json({ error: 'Share permission denied' });
        return;
      }
      
      res.status(500).json({ error: 'Failed to share project' });
    }
  };

  updateMemberRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, userId: memberId } = req.params;
      const userId = req.user!._id;
      const { role } = req.body;

      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(memberId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await this.projectService.updateMemberRole(
        new Types.ObjectId(id),
        userId,
        new Types.ObjectId(memberId),
        role
      );

      logger.info(`Member role updated in project ${id} by ${req.user!.email}`);

      res.json({ message: 'Member role updated successfully' });
    } catch (error) {
      logger.error('Update member role error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Share permission denied') {
          res.status(403).json({ error: 'Share permission denied' });
          return;
        }
        if (error.message === 'Member not found') {
          res.status(404).json({ error: 'Member not found' });
          return;
        }
        if (error.message === 'Cannot change owner role') {
          res.status(400).json({ error: 'Cannot change owner role' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to update member role' });
    }
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, userId: memberId } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(memberId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await this.projectService.removeMember(
        new Types.ObjectId(id),
        userId,
        new Types.ObjectId(memberId)
      );

      logger.info(`Member removed from project ${id} by ${req.user!.email}`);

      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      logger.error('Remove member error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Share permission denied') {
          res.status(403).json({ error: 'Share permission denied' });
          return;
        }
        if (error.message === 'Member not found') {
          res.status(404).json({ error: 'Member not found' });
          return;
        }
        if (error.message === 'Cannot remove owner') {
          res.status(400).json({ error: 'Cannot remove owner' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to remove member' });
    }
  };
}