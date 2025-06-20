import { apiClient, handleApiError } from './api';
import { Project, CreateProjectForm, PaginatedResponse } from '@/types';

export class ProjectService {
  // Project CRUD operations
  async getProjects(params?: {
    page?: number;
    limit?: number;
    search?: string;
    visibility?: string;
    tags?: string[];
  }): Promise<PaginatedResponse<Project>> {
    try {
      const response = await apiClient.get<PaginatedResponse<Project>>('/projects', {
        params,
      });
      return response;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getProject(id: string): Promise<Project> {
    try {
      const response = await apiClient.get<{ project: Project }>(`/projects/${id}`);
      return response.project;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async createProject(data: CreateProjectForm): Promise<Project> {
    try {
      const response = await apiClient.post<{ project: Project }>('/projects', data);
      return response.project;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async updateProject(id: string, data: Partial<CreateProjectForm>): Promise<Project> {
    try {
      const response = await apiClient.put<{ project: Project }>(`/projects/${id}`, data);
      return response.project;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      await apiClient.delete(`/projects/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Project sharing
  async shareProject(id: string, data: {
    emails: string[];
    accessLevel: 'editor' | 'viewer';
    message?: string;
  }): Promise<void> {
    try {
      await apiClient.post(`/projects/${id}/share`, data);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getProjectCollaborators(id: string): Promise<any[]> {
    try {
      const response = await apiClient.get<{ collaborators: any[] }>(`/projects/${id}/collaborators`);
      return response.collaborators;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async removeCollaborator(projectId: string, userId: string): Promise<void> {
    try {
      await apiClient.delete(`/projects/${projectId}/collaborators/${userId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async updateCollaboratorRole(
    projectId: string,
    userId: string,
    role: 'editor' | 'viewer'
  ): Promise<void> {
    try {
      await apiClient.put(`/projects/${projectId}/collaborators/${userId}`, { role });
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Project templates
  async getProjectTemplates(): Promise<any[]> {
    try {
      const response = await apiClient.get<{ templates: any[] }>('/projects/templates');
      return response.templates;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async createProjectFromTemplate(templateId: string, data: {
    name: string;
    description?: string;
  }): Promise<Project> {
    try {
      const response = await apiClient.post<{ project: Project }>(
        `/projects/templates/${templateId}`,
        data
      );
      return response.project;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Project statistics
  async getProjectStats(id: string): Promise<any> {
    try {
      const response = await apiClient.get<{ stats: any }>(`/projects/${id}/stats`);
      return response.stats;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Project activity
  async getProjectActivity(id: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<any>> {
    try {
      const response = await apiClient.get<PaginatedResponse<any>>(
        `/projects/${id}/activity`,
        { params }
      );
      return response;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
}

// Export singleton instance
export const projectService = new ProjectService();