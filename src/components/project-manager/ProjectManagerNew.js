/**
 * Project Manager - 모듈형 리팩토링 버전
 * 프로젝트 관리 기능을 모듈화하여 제공
 */

import { ProjectManagerCore } from './ProjectManagerCore.js';

class ProjectManager {
    constructor() {
        // 핵심 모듈 초기화
        this.core = new ProjectManagerCore();
        
        // 레거시 호환성을 위한 상태들
        this.currentUser = null;
        this.projects = [];
        this.currentProject = null;
        this.currentDiagram = null;
        this.listeners = new Map();
        
        this.init();
    }

    async init() {
        try {
            // 모듈 간 이벤트 연결 설정
            this.setupModuleIntegration();
            
            // 코어 초기화
            await this.core.initialize();
            
            console.log('✅ ProjectManager initialized with modular architecture');
            
        } catch (error) {
            console.error('❌ ProjectManager initialization failed:', error);
            throw error;
        }
    }

    /**
     * 모듈 간 통합 설정
     */
    setupModuleIntegration() {
        // 코어 → 상태 동기화
        this.core.on('projectsLoaded', (projects) => {
            this.projects = projects;
            this.emit('projectsLoaded', projects);
        });

        this.core.on('projectCreated', (project) => {
            this.emit('projectCreated', project);
        });

        this.core.on('projectUpdated', (project) => {
            this.emit('projectUpdated', project);
        });

        this.core.on('projectDeleted', (project) => {
            this.emit('projectDeleted', project);
        });

        this.core.on('projectLoaded', (project) => {
            this.currentProject = project;
            this.emit('projectLoaded', project);
        });

        this.core.on('diagramLoaded', (diagram) => {
            this.currentDiagram = diagram;
            this.emit('diagramLoaded', diagram);
        });

        this.core.on('error', (error) => {
            this.emit('error', error);
        });
    }

    // =============== 공개 API (하위 호환성 유지) ===============

    /**
     * 초기화
     */
    async initialize() {
        return this.core.initialize();
    }

    /**
     * 사용자 프로젝트 목록 로드
     */
    async loadUserProjects() {
        return this.core.loadUserProjects();
    }

    /**
     * 새 프로젝트 생성
     */
    async createProject(projectData) {
        return this.core.createProject(projectData);
    }

    /**
     * 프로젝트 업데이트
     */
    async updateProject(projectId, updateData) {
        return this.core.updateProject(projectId, updateData);
    }

    /**
     * 프로젝트 삭제
     */
    async deleteProject(projectId) {
        return this.core.deleteProject(projectId);
    }

    /**
     * 프로젝트 로드
     */
    async loadProject(projectId) {
        return this.core.loadProject(projectId);
    }

    /**
     * 다이어그램 로드
     */
    async loadDiagram(diagramId) {
        return this.core.loadDiagram(diagramId);
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

    // =============== 고급 기능 접근 ===============

    /**
     * 코어 모듈 반환
     */
    getCoreModule() {
        return this.core;
    }

    /**
     * 상태 반환
     */
    getState() {
        return this.core.getState();
    }

    // =============== 상태 정보 ===============

    /**
     * 전체 상태 정보 반환
     */
    getStatus() {
        return {
            core: this.core.getState(),
            legacy: {
                currentUser: this.currentUser,
                projects: this.projects,
                currentProject: this.currentProject,
                currentDiagram: this.currentDiagram,
                listenerCount: this.listeners.size
            }
        };
    }

    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ Destroying ProjectManager with all modules...');
        
        // 모듈 정리
        if (this.core) {
            this.core.destroy();
        }
        
        // 레거시 상태 정리
        this.listeners.clear();
        this.currentUser = null;
        this.projects = [];
        this.currentProject = null;
        this.currentDiagram = null;
        
        // 참조 정리
        this.core = null;
        
        console.log('✅ ProjectManager destroyed successfully');
    }
}

export default ProjectManager;