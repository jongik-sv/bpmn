/**
 * Project Manager Core - 프로젝트 관리 핵심 로직
 * 프로젝트 데이터 관리, CRUD 작업, 상태 관리를 담당
 */

class ProjectManagerCore {
    constructor() {
        this.currentUser = null;
        this.projects = [];
        this.currentProject = null;
        this.currentDiagram = null;
        this.listeners = new Map();
    }

    /**
     * 초기화
     */
    async initialize() {
        try {
            // 현재 사용자 로드
            this.currentUser = await this.getCurrentUser();
            if (!this.currentUser) {
                console.log('No user logged in for project manager');
                return;
            }

            // 사용자의 프로젝트 목록 로드
            await this.loadUserProjects();
            
            console.log('ProjectManagerCore initialized');
        } catch (error) {
            console.error('ProjectManagerCore initialization error:', error);
        }
    }

    /**
     * 현재 사용자 반환 (실제 구현에서는 auth 모듈 사용)
     */
    async getCurrentUser() {
        // 실제 구현에서는 import { getCurrentUser } from '../lib/supabase.js';
        return { id: 'user-1', name: 'Current User' };
    }

    /**
     * 사용자의 프로젝트 목록 로드
     */
    async loadUserProjects() {
        try {
            // 실제 구현에서는 dbManager.getUserProjects(this.currentUser.id);
            const mockProjects = [
                { id: 'project-1', name: 'Sample Project', description: 'Test project' }
            ];
            
            this.projects = mockProjects;
            console.log('Loaded projects:', this.projects);
            
            this.emit('projectsLoaded', this.projects);
        } catch (error) {
            console.error('Error loading projects:', error);
            this.emit('error', error);
        }
    }

    /**
     * 새 프로젝트 생성
     */
    async createProject(projectData) {
        try {
            const newProject = {
                id: Date.now().toString(),
                name: projectData.name,
                description: projectData.description,
                created_at: new Date().toISOString(),
                user_id: this.currentUser.id
            };

            // 실제 구현에서는 dbManager.createProject(newProject);
            this.projects.push(newProject);
            
            this.emit('projectCreated', newProject);
            return newProject;
        } catch (error) {
            console.error('Error creating project:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 프로젝트 업데이트
     */
    async updateProject(projectId, updateData) {
        try {
            const projectIndex = this.projects.findIndex(p => p.id === projectId);
            if (projectIndex === -1) {
                throw new Error('Project not found');
            }

            const updatedProject = {
                ...this.projects[projectIndex],
                ...updateData,
                updated_at: new Date().toISOString()
            };

            // 실제 구현에서는 dbManager.updateProject(projectId, updateData);
            this.projects[projectIndex] = updatedProject;
            
            this.emit('projectUpdated', updatedProject);
            return updatedProject;
        } catch (error) {
            console.error('Error updating project:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 프로젝트 삭제
     */
    async deleteProject(projectId) {
        try {
            const projectIndex = this.projects.findIndex(p => p.id === projectId);
            if (projectIndex === -1) {
                throw new Error('Project not found');
            }

            const deletedProject = this.projects[projectIndex];
            
            // 실제 구현에서는 dbManager.deleteProject(projectId);
            this.projects.splice(projectIndex, 1);
            
            if (this.currentProject?.id === projectId) {
                this.currentProject = null;
            }
            
            this.emit('projectDeleted', deletedProject);
            return deletedProject;
        } catch (error) {
            console.error('Error deleting project:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 프로젝트 로드
     */
    async loadProject(projectId) {
        try {
            const project = this.projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            // 실제 구현에서는 프로젝트 상세 정보 로드
            this.currentProject = project;
            
            this.emit('projectLoaded', project);
            return project;
        } catch (error) {
            console.error('Error loading project:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 다이어그램 로드
     */
    async loadDiagram(diagramId) {
        try {
            // 실제 구현에서는 dbManager.getDiagram(diagramId);
            const diagram = { id: diagramId, name: 'Sample Diagram' };
            
            this.currentDiagram = diagram;
            
            this.emit('diagramLoaded', diagram);
            return diagram;
        } catch (error) {
            console.error('Error loading diagram:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 이벤트 리스너 추가
     */
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(listener);
    }

    /**
     * 이벤트 리스너 제거
     */
    off(event, listener) {
        if (this.listeners.has(event)) {
            const listeners = this.listeners.get(event);
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 이벤트 발생
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            });
        }
    }

    /**
     * 상태 반환
     */
    getState() {
        return {
            currentUser: this.currentUser,
            projects: this.projects,
            currentProject: this.currentProject,
            currentDiagram: this.currentDiagram
        };
    }

    /**
     * 리소스 정리
     */
    destroy() {
        this.listeners.clear();
        this.currentUser = null;
        this.projects = [];
        this.currentProject = null;
        this.currentDiagram = null;
    }
}

export { ProjectManagerCore };