import { create } from 'zustand';
import { Project, CreateProjectForm, PaginatedResponse } from '@/types';
import { projectService } from '@/services/project.service';
import toast from 'react-hot-toast';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };

  // Actions
  fetchProjects: (page?: number) => Promise<void>;
  createProject: (data: CreateProjectForm) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  setCurrentProject: (project: Project | null) => void;
  getProject: (id: string) => Promise<Project | null>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  pagination: {
    page: 1,
    totalPages: 1,
    total: 0,
  },

  fetchProjects: async (page = 1) => {
    set({ isLoading: true });
    try {
      const response = await projectService.getProjects({ page, limit: 12 });
      set({
        projects: response.items,
        pagination: {
          page: response.page,
          totalPages: response.totalPages,
          total: response.total,
        },
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.message || '프로젝트를 불러오는데 실패했습니다');
    }
  },

  createProject: async (data: CreateProjectForm) => {
    try {
      const project = await projectService.createProject(data);
      const { projects } = get();
      set({ projects: [project, ...projects] });
      toast.success('프로젝트가 생성되었습니다');
      return project;
    } catch (error: any) {
      toast.error(error.message || '프로젝트 생성에 실패했습니다');
      return null;
    }
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    try {
      const updatedProject = await projectService.updateProject(id, data);
      const { projects, currentProject } = get();
      
      set({
        projects: projects.map(p => p._id === id ? updatedProject : p),
        currentProject: currentProject?._id === id ? updatedProject : currentProject,
      });
      
      toast.success('프로젝트가 업데이트되었습니다');
      return true;
    } catch (error: any) {
      toast.error(error.message || '프로젝트 업데이트에 실패했습니다');
      return false;
    }
  },

  deleteProject: async (id: string) => {
    try {
      await projectService.deleteProject(id);
      const { projects, currentProject } = get();
      
      set({
        projects: projects.filter(p => p._id !== id),
        currentProject: currentProject?._id === id ? null : currentProject,
      });
      
      toast.success('프로젝트가 삭제되었습니다');
      return true;
    } catch (error: any) {
      toast.error(error.message || '프로젝트 삭제에 실패했습니다');
      return false;
    }
  },

  setCurrentProject: (project: Project | null) => {
    set({ currentProject: project });
  },

  getProject: async (id: string) => {
    try {
      const project = await projectService.getProject(id);
      set({ currentProject: project });
      return project;
    } catch (error: any) {
      toast.error(error.message || '프로젝트를 불러오는데 실패했습니다');
      return null;
    }
  },
}));