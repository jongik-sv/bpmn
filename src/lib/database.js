import { supabase } from './supabase.js';

/**
 * 데이터베이스 관리 클래스
 */
export class DatabaseManager {
  constructor() {
    this.supabase = supabase;
    // 개발 중 강제 로컬 모드 (환경 변수로 제어 가능)
    this.forceLocalMode = process.env.NODE_ENV === 'development' && localStorage.getItem('bpmn_force_local') === 'true';
    
    if (this.forceLocalMode) {
      console.log('🔧 Force local mode enabled');
    }
  }

  /**
   * 데이터베이스 연결 테스트
   */
  async testConnection() {
    try {
      // 간단한 연결 테스트 - auth.users 테이블 확인 (항상 존재함)
      const { data, error } = await this.supabase.auth.getSession();
      
      if (error && error.message !== 'Auth session missing!') {
        console.warn('Database connection issue:', error.message);
        return false;
      }
      
      console.log('✅ Database connection successful');
      
      // profiles 테이블 존재 여부 확인 (선택적)
      try {
        await this.supabase
          .from('profiles')
          .select('count', { count: 'exact', head: true })
          .limit(1);
        console.log('✅ Database schema ready');
      } catch (schemaError) {
        console.log('⚠️ Database connected but custom schema not set up yet');
      }
      
      return true;
    } catch (error) {
      console.error('Database connection error:', error);
      return false;
    }
  }

  /**
   * 사용자 프로필 생성/업데이트
   */
  async upsertProfile(profile) {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .upsert({
          id: profile.id,
          email: profile.email,
          display_name: profile.display_name || profile.email.split('@')[0],
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting profile:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Profile upsert error:', error);
      return { data: null, error };
    }
  }

  /**
   * 프로젝트 생성
   */
  async createProject(projectData) {
    console.log('Creating project with data:', projectData);
    
    // 강제 로컬 모드이거나 데이터베이스 연결 실패 시 로컬 스토리지 사용
    if (this.forceLocalMode) {
      console.log('🔧 Using forced local mode');
      return this.createProjectLocal(projectData);
    }
    
    try {
      // 먼저 테이블 존재 여부 확인
      const { data: testData, error: testError } = await this.supabase
        .from('projects')
        .select('count', { count: 'exact', head: true })
        .limit(1);
        
      if (testError) {
        console.warn('Projects table does not exist, using local storage:', testError.message);
        return this.createProjectLocal(projectData);
      }

      // 데이터베이스에 프로젝트 생성 시도
      const { data, error } = await this.supabase
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          owner_id: projectData.owner_id,
          settings: projectData.settings || {}
        })
        .select()
        .single();

      if (error) {
        console.warn('Database insert failed, using local storage:', error.message);
        return this.createProjectLocal(projectData);
      }

      console.log('Project created successfully in database:', data);

      // 프로젝트 생성자를 owner로 추가
      await this.addProjectMember({
        project_id: data.id,
        user_id: projectData.owner_id,
        role: 'owner'
      });

      return { data, error: null };
      
    } catch (error) {
      console.warn('Project creation failed, falling back to local storage:', error.message);
      return this.createProjectLocal(projectData);
    }
  }

  /**
   * 로컬 스토리지 fallback - 프로젝트 생성
   */
  createProjectLocal(projectData) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      
      const newProject = {
        id: 'local_' + Date.now(),
        name: projectData.name,
        description: projectData.description,
        owner_id: projectData.owner_id,
        settings: projectData.settings || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        project_members: [{
          role: 'owner',
          user_id: projectData.owner_id
        }]
      };
      
      projects.push(newProject);
      localStorage.setItem('bpmn_projects', JSON.stringify(projects));
      
      console.log('✅ Project created locally:', newProject);
      return { data: newProject, error: null };
      
    } catch (error) {
      console.error('Local project creation error:', error);
      return { data: null, error };
    }
  }

  /**
   * 사용자의 프로젝트 목록 가져오기
   */
  async getUserProjects(userId) {
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select(`
          *,
          project_members!inner(role),
          owner:profiles!projects_owner_id_fkey(display_name, email)
        `)
        .eq('project_members.user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching user projects, using local fallback:', error);
        return this.getUserProjectsLocal(userId);
      }

      return { data, error: null };
    } catch (error) {
      console.error('User projects fetch error, using local fallback:', error);
      return this.getUserProjectsLocal(userId);
    }
  }

  /**
   * 로컬 스토리지에서 사용자 프로젝트 가져오기
   */
  getUserProjectsLocal(userId) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      
      // 사용자가 멤버인 프로젝트만 필터링
      const userProjects = projects.filter(project => 
        project.owner_id === userId || 
        project.project_members?.some(member => member.user_id === userId)
      );
      
      console.log('✅ Loaded projects from local storage:', userProjects.length);
      return { data: userProjects, error: null };
      
    } catch (error) {
      console.error('Local projects fetch error:', error);
      return { data: [], error };
    }
  }

  /**
   * 프로젝트 멤버 추가
   */
  async addProjectMember(memberData) {
    try {
      const { data, error } = await this.supabase
        .from('project_members')
        .insert({
          project_id: memberData.project_id,
          user_id: memberData.user_id,
          role: memberData.role || 'viewer',
          invited_by: memberData.invited_by
        })
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Add project member error:', error);
      return { data: null, error };
    }
  }

  /**
   * 다이어그램 생성
   */
  async createDiagram(diagramData) {
    try {
      const { data, error } = await this.supabase
        .from('diagrams')
        .insert({
          project_id: diagramData.project_id,
          folder_id: diagramData.folder_id,
          name: diagramData.name,
          description: diagramData.description,
          bpmn_xml: diagramData.bpmn_xml,
          created_by: diagramData.created_by,
          last_modified_by: diagramData.created_by
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating diagram:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Diagram creation error:', error);
      return { data: null, error };
    }
  }

  /**
   * 다이어그램 업데이트
   */
  async updateDiagram(diagramId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('diagrams')
        .update({
          ...updates,
          version: updates.version ? updates.version + 1 : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', diagramId)
        .select()
        .single();

      if (error) {
        console.error('Error updating diagram:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Diagram update error:', error);
      return { data: null, error };
    }
  }

  /**
   * 프로젝트의 다이어그램 목록 가져오기
   */
  async getProjectDiagrams(projectId) {
    try {
      const { data, error } = await this.supabase
        .from('diagrams')
        .select(`
          *,
          created_by_profile:profiles!diagrams_created_by_fkey(display_name, email),
          last_modified_by_profile:profiles!diagrams_last_modified_by_fkey(display_name, email),
          folder:folders(name)
        `)
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching project diagrams:', error);
        return { data: [], error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Project diagrams fetch error:', error);
      return { data: [], error };
    }
  }

  /**
   * 다이어그램 가져오기
   */
  async getDiagram(diagramId) {
    try {
      const { data, error } = await this.supabase
        .from('diagrams')
        .select(`
          *,
          project:projects(*),
          created_by_profile:profiles!diagrams_created_by_fkey(display_name, email),
          last_modified_by_profile:profiles!diagrams_last_modified_by_fkey(display_name, email)
        `)
        .eq('id', diagramId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching diagram:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Diagram fetch error:', error);
      return { data: null, error };
    }
  }

  /**
   * 협업 세션 생성/업데이트
   */
  async upsertCollaborationSession(sessionData) {
    try {
      const { data, error } = await this.supabase
        .from('collaboration_sessions')
        .upsert({
          diagram_id: sessionData.diagram_id,
          user_id: sessionData.user_id,
          session_data: sessionData.session_data || {},
          last_activity: new Date().toISOString(),
          is_active: true
        })
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Collaboration session upsert error:', error);
      return { data: null, error };
    }
  }

  /**
   * 활성 협업 세션 가져오기
   */
  async getActiveCollaborationSessions(diagramId) {
    try {
      const { data, error } = await this.supabase
        .from('collaboration_sessions')
        .select(`
          *,
          user:profiles(display_name, email, avatar_url)
        `)
        .eq('diagram_id', diagramId)
        .eq('is_active', true)
        .gte('last_activity', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // 5분 이내

      return { data: data || [], error };
    } catch (error) {
      console.error('Active collaboration sessions fetch error:', error);
      return { data: [], error };
    }
  }

  /**
   * 활동 로그 생성
   */
  async createActivityLog(logData) {
    try {
      const { data, error } = await this.supabase
        .from('activity_logs')
        .insert({
          project_id: logData.project_id,
          diagram_id: logData.diagram_id,
          user_id: logData.user_id,
          action: logData.action,
          entity_type: logData.entity_type,
          entity_id: logData.entity_id,
          details: logData.details || {}
        });

      return { data, error };
    } catch (error) {
      console.error('Activity log creation error:', error);
      return { data: null, error };
    }
  }
}

// 싱글톤 인스턴스
export const dbManager = new DatabaseManager();

// 편의 함수들
export const testDatabaseConnection = () => dbManager.testConnection();
export const createProject = (projectData) => dbManager.createProject(projectData);
export const getUserProjects = (userId) => dbManager.getUserProjects(userId);
export const createDiagram = (diagramData) => dbManager.createDiagram(diagramData);
export const updateDiagram = (diagramId, updates) => dbManager.updateDiagram(diagramId, updates);
export const getDiagram = (diagramId) => dbManager.getDiagram(diagramId);
export const getProjectDiagrams = (projectId) => dbManager.getProjectDiagrams(projectId);