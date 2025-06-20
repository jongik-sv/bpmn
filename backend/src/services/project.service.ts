import { Types, ObjectId } from 'mongoose';
import { Project, IProject } from '../models/Project';
import { Permission } from '../models/Permission';
import { BpmnDocument } from '../models/Document';
import { ActivityLog } from '../models/ActivityLog';

export interface CreateProjectData {
  name: string;
  description?: string;
  visibility?: 'private' | 'public' | 'team';
  tags?: string[];
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  visibility?: 'private' | 'public' | 'team';
  tags?: string[];
  settings?: {
    allowComments?: boolean;
    allowExport?: boolean;
    autoSave?: boolean;
    autoSaveInterval?: number;
  };
}

export class ProjectService {
  async createProject(ownerId: Types.ObjectId, projectData: CreateProjectData): Promise<IProject> {
    // Create project
    const project = new Project({
      ...projectData,
      ownerId
    });

    await project.save();

    // Create owner permission
    const permission = new Permission({
      projectId: project._id,
      userId: ownerId,
      role: 'owner',
      permissions: {
        read: true,
        write: true,
        delete: true,
        share: true,
        comment: true
      },
      grantedBy: ownerId
    });

    await permission.save();

    // Log activity
    await this.logActivity(project._id, ownerId, 'project_created', {
      description: `Project "${project.name}" created`
    });

    return project;
  }

  async getUserProjects(userId: Types.ObjectId, page: number = 1, limit: number = 20): Promise<{
    projects: IProject[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Get projects where user has permissions
    const userPermissions = await Permission.find({ userId })
      .select('projectId')
      .lean();

    const projectIds = userPermissions.map(p => p.projectId);

    const [projects, total] = await Promise.all([
      Project.find({ _id: { $in: projectIds } })
        .populate('ownerId', 'username displayName avatar')
        .sort({ lastAccessedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments({ _id: { $in: projectIds } })
    ]);

    return {
      projects,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getProjectById(projectId: Types.ObjectId, userId: Types.ObjectId): Promise<IProject | null> {
    // Check if user has permission
    const hasPermission = await this.checkPermission(projectId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    const project = await Project.findById(projectId)
      .populate('ownerId', 'username displayName avatar')
      .lean();

    if (project) {
      // Update last accessed time
      await Project.findByIdAndUpdate(projectId, {
        lastAccessedAt: new Date()
      });
    }

    return project;
  }

  async updateProject(projectId: Types.ObjectId, userId: Types.ObjectId, updateData: UpdateProjectData): Promise<IProject> {
    // Check if user has permission
    const hasPermission = await this.checkPermission(projectId, userId, 'write');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    const project = await Project.findByIdAndUpdate(
      projectId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!project) {
      throw new Error('Project not found');
    }

    // Log activity
    await this.logActivity(projectId, userId, 'project_updated', {
      description: `Project "${project.name}" updated`
    });

    return project;
  }

  async deleteProject(projectId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
    // Check if user is owner
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.ownerId.equals(userId)) {
      throw new Error('Only project owner can delete the project');
    }

    // Delete all related documents
    await BpmnDocument.deleteMany({ projectId });

    // Delete all permissions
    await Permission.deleteMany({ projectId });

    // Delete project
    await Project.findByIdAndDelete(projectId);

    // Log activity
    await this.logActivity(projectId, userId, 'project_deleted', {
      description: `Project "${project.name}" deleted`
    });
  }

  async getProjectMembers(projectId: Types.ObjectId, userId: Types.ObjectId): Promise<any[]> {
    // Check if user has permission
    const hasPermission = await this.checkPermission(projectId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    const members = await Permission.find({ projectId })
      .populate('userId', 'username displayName email avatar')
      .populate('grantedBy', 'username displayName')
      .sort({ grantedAt: -1 })
      .lean();

    return members;
  }

  async shareProject(projectId: Types.ObjectId, ownerId: Types.ObjectId, emails: string[], role: string, message?: string): Promise<any[]> {
    // Check if user has share permission
    const hasSharePermission = await this.checkPermission(projectId, ownerId, 'share');
    if (!hasSharePermission) {
      throw new Error('Share permission denied');
    }

    const results = [];

    for (const email of emails) {
      try {
        // Find user by email
        const { User } = await import('../models/User');
        const user = await User.findOne({ email });
        
        if (!user) {
          results.push({ email, status: 'user_not_found' });
          continue;
        }

        // Check if user already has permission
        const existingPermission = await Permission.findOne({
          projectId,
          userId: user._id
        });

        if (existingPermission) {
          results.push({ email, status: 'already_member' });
          continue;
        }

        // Create permission
        const permission = new Permission({
          projectId,
          userId: user._id,
          role,
          permissions: this.getRolePermissions(role),
          grantedBy: ownerId
        });

        await permission.save();

        // Log activity
        await this.logActivity(projectId, ownerId, 'permission_granted', {
          description: `${role} permission granted to ${user.displayName}`
        });

        results.push({ email, status: 'invited', userId: user._id });

      } catch (error) {
        results.push({ email, status: 'error', error: (error as Error).message });
      }
    }

    return results;
  }

  async updateMemberRole(projectId: Types.ObjectId, ownerId: Types.ObjectId, memberId: Types.ObjectId, newRole: string): Promise<void> {
    // Check if user has share permission
    const hasSharePermission = await this.checkPermission(projectId, ownerId, 'share');
    if (!hasSharePermission) {
      throw new Error('Share permission denied');
    }

    const permission = await Permission.findOne({
      projectId,
      userId: memberId
    });

    if (!permission) {
      throw new Error('Member not found');
    }

    // Cannot change owner role
    if (permission.role === 'owner') {
      throw new Error('Cannot change owner role');
    }

    permission.role = newRole as any;
    permission.permissions = this.getRolePermissions(newRole);
    await permission.save();

    // Log activity
    await this.logActivity(projectId, ownerId, 'permission_granted', {
      description: `Role changed to ${newRole} for member`
    });
  }

  async removeMember(projectId: Types.ObjectId, ownerId: Types.ObjectId, memberId: Types.ObjectId): Promise<void> {
    // Check if user has share permission
    const hasSharePermission = await this.checkPermission(projectId, ownerId, 'share');
    if (!hasSharePermission) {
      throw new Error('Share permission denied');
    }

    const permission = await Permission.findOne({
      projectId,
      userId: memberId
    });

    if (!permission) {
      throw new Error('Member not found');
    }

    // Cannot remove owner
    if (permission.role === 'owner') {
      throw new Error('Cannot remove owner');
    }

    await Permission.findByIdAndDelete(permission._id);

    // Log activity
    await this.logActivity(projectId, ownerId, 'permission_revoked', {
      description: 'Member removed from project'
    });
  }

  async checkPermission(projectId: Types.ObjectId, userId: Types.ObjectId, action: string): Promise<boolean> {
    const permission = await Permission.findOne({ projectId, userId });
    
    if (!permission) {
      return false;
    }

    // Check if permission is expired
    if (permission.expiresAt && new Date() > permission.expiresAt) {
      return false;
    }

    return permission.permissions[action as keyof typeof permission.permissions] || false;
  }

  private getRolePermissions(role: string) {
    const rolePermissions = {
      owner: {
        read: true,
        write: true,
        delete: true,
        share: true,
        comment: true
      },
      editor: {
        read: true,
        write: true,
        delete: false,
        share: false,
        comment: true
      },
      viewer: {
        read: true,
        write: false,
        delete: false,
        share: false,
        comment: true
      },
      commenter: {
        read: true,
        write: false,
        delete: false,
        share: false,
        comment: true
      }
    };

    return rolePermissions[role as keyof typeof rolePermissions] || rolePermissions.viewer;
  }

  private async logActivity(projectId: Types.ObjectId, userId: Types.ObjectId, action: string, details: any): Promise<void> {
    try {
      const activityLog = new ActivityLog({
        projectId,
        userId,
        action,
        details,
        ipAddress: '0.0.0.0', // Will be updated from request
        userAgent: 'server',
        timestamp: new Date()
      });

      await activityLog.save();
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.error('Failed to log activity:', error);
    }
  }
}