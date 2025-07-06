import { supabase } from './supabase.js';

/**
 * 데이터베이스 관리 클래스
 */
export class DatabaseManager {
  constructor() {
    this.supabase = supabase;
    // 개발 중 강제 로컬 모드 (환경 변수로 제어 가능)
    this.forceLocalMode = localStorage.getItem('bpmn_force_local') === 'true';
    
    if (this.forceLocalMode) {
      console.log('🔧 Force local mode enabled - using localStorage');
    } else {
      console.log('🌐 Database mode enabled - using Supabase');
    }
  }

  /**
   * 데이터베이스 연결 테스트
   */
  async testConnection() {
    if (this.forceLocalMode) {
      console.log('🔧 Local mode - skipping database connection test');
      return false;
    }

    try {
      // profiles 테이블 존재 여부 확인
      const { data, error } = await this.supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true })
        .limit(1);
      
      if (error) {
        console.warn('Database schema not ready:', error.message);
        console.log('💡 데이터베이스 스키마를 설정해주세요:');
        console.log('   1. https://yigkpwxaemgcasxtopup.supabase.co/project/default/sql');
        console.log('   2. database/supabase-setup.sql 파일의 내용을 복사해서 실행');
        return false;
      }
      
      console.log('✅ Database connection and schema ready');
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
        role: 'owner',
        status: 'accepted'
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
          user_id: projectData.owner_id,
          status: 'accepted',
          invited_at: new Date().toISOString(),
          display_name: projectData.owner_name || 'Unknown User',
          email: projectData.owner_email || ''
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
    // 강제 로컬 모드이거나 데이터베이스 연결 실패 시 로컬 스토리지 사용
    if (this.forceLocalMode) {
      return this.getUserProjectsLocal(userId);
    }

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

      console.log('✅ Loaded projects from database:', data.length);
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

  /**
   * 프로젝트 다이어그램 목록 가져오기 (개선된 버전)
   */
  async getProjectDiagrams(projectId) {
    if (this.forceLocalMode) {
      return this.getProjectDiagramsLocal(projectId);
    }

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
        console.error('Error fetching project diagrams, using local fallback:', error);
        return this.getProjectDiagramsLocal(projectId);
      }

      return { data, error: null };
    } catch (error) {
      console.error('Project diagrams fetch error, using local fallback:', error);
      return this.getProjectDiagramsLocal(projectId);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 다이어그램 가져오기
   */
  getProjectDiagramsLocal(projectId) {
    try {
      const diagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');
      const projectDiagrams = diagrams.filter(diagram => 
        diagram.project_id === projectId && diagram.is_active !== false
      );
      
      console.log('✅ Loaded diagrams from local storage:', projectDiagrams.length);
      return { data: projectDiagrams, error: null };
    } catch (error) {
      console.error('Local diagrams fetch error:', error);
      return { data: [], error };
    }
  }

  /**
   * 다이어그램 생성 (개선된 버전)
   */
  async createDiagram(diagramData) {
    if (this.forceLocalMode) {
      return this.createDiagramLocal(diagramData);
    }

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
        console.error('Error creating diagram, using local fallback:', error);
        return this.createDiagramLocal(diagramData);
      }

      console.log('✅ Diagram created in database:', data);
      return { data, error: null };
    } catch (error) {
      console.error('Diagram creation error, using local fallback:', error);
      return this.createDiagramLocal(diagramData);
    }
  }

  /**
   * 로컬 스토리지에서 다이어그램 생성
   */
  createDiagramLocal(diagramData) {
    try {
      const diagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');
      
      const newDiagram = {
        id: 'local_diagram_' + Date.now(),
        project_id: diagramData.project_id,
        folder_id: diagramData.folder_id,
        name: diagramData.name,
        description: diagramData.description,
        bpmn_xml: diagramData.bpmn_xml,
        created_by: diagramData.created_by,
        last_modified_by: diagramData.created_by,
        version: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      diagrams.push(newDiagram);
      localStorage.setItem('bpmn_diagrams', JSON.stringify(diagrams));
      
      console.log('✅ Diagram created locally:', newDiagram);
      return { data: newDiagram, error: null };
    } catch (error) {
      console.error('Local diagram creation error:', error);
      return { data: null, error };
    }
  }

  /**
   * 다이어그램 업데이트
   */
  async updateDiagram(diagramId, updates) {
    if (this.forceLocalMode) {
      return this.updateDiagramLocal(diagramId, updates);
    }

    try {
      const { data, error } = await this.supabase
        .from('diagrams')
        .update({
          ...updates,
          version: updates.version ? updates.version + 1 : undefined,
          updated_at: new Date().toISOString(),
          last_modified_by: updates.last_modified_by
        })
        .eq('id', diagramId)
        .select()
        .single();

      if (error) {
        console.error('Error updating diagram, using local fallback:', error);
        return this.updateDiagramLocal(diagramId, updates);
      }

      return { data, error: null };
    } catch (error) {
      console.error('Diagram update error, using local fallback:', error);
      return this.updateDiagramLocal(diagramId, updates);
    }
  }

  /**
   * 로컬 스토리지에서 다이어그램 업데이트
   */
  updateDiagramLocal(diagramId, updates) {
    try {
      const diagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');
      const diagramIndex = diagrams.findIndex(d => d.id === diagramId);
      
      if (diagramIndex === -1) {
        return { data: null, error: { message: 'Diagram not found' } };
      }
      
      diagrams[diagramIndex] = {
        ...diagrams[diagramIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      localStorage.setItem('bpmn_diagrams', JSON.stringify(diagrams));
      
      console.log('✅ Diagram updated locally:', diagrams[diagramIndex]);
      return { data: diagrams[diagramIndex], error: null };
    } catch (error) {
      console.error('Local diagram update error:', error);
      return { data: null, error };
    }
  }

  /**
   * 폴더 생성
   */
  async createFolder(folderData) {
    console.log('DatabaseManager.createFolder called with:', folderData);
    console.log('DatabaseManager state:', {
      hasSupabase: !!this.supabase,
      forceLocalMode: this.forceLocalMode,
      isConnected: this.isConnected
    });
    
    if (this.forceLocalMode) {
      console.log('Using local mode for folder creation');
      return this.createFolderLocal(folderData);
    }

    if (this.supabase) {
      try {
        console.log('Creating folder in Supabase...');
        const insertData = {
          project_id: folderData.project_id,
          parent_id: folderData.parent_id || null,
          name: folderData.name,
          created_by: folderData.created_by
        };
        console.log('Insert data:', insertData);

        const { data, error } = await this.supabase
          .from('folders')
          .insert(insertData)
          .select()
          .single();

        console.log('Supabase response:', { data, error });

        if (error) {
          console.error('Supabase folder creation error, falling back to local:', error);
          console.error('Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          return this.createFolderLocal(folderData);
        }

        return { data, error: null };
      } catch (error) {
        console.error('Create folder error, falling back to local:', error);
        return this.createFolderLocal(folderData);
      }
    } else {
      console.log('No Supabase connection, using local storage');
      return this.createFolderLocal(folderData);
    }
  }

  /**
   * 로컬 스토리지에 폴더 생성
   */
  createFolderLocal(folderData) {
    try {
      console.log('Creating folder locally with data:', folderData);
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      console.log('Existing folders:', folders);
      
      const newFolder = {
        id: 'folder-' + Date.now(),
        project_id: folderData.project_id,
        parent_id: folderData.parent_id || null,
        name: folderData.name,
        created_by: folderData.created_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        path: this.calculateFolderPath(folders, folderData.parent_id, folderData.name)
      };
      
      console.log('New folder object:', newFolder);
      
      folders.push(newFolder);
      localStorage.setItem('bpmn_folders', JSON.stringify(folders));
      
      console.log('✅ Folder created locally:', newFolder);
      return { data: newFolder, error: null };
    } catch (error) {
      console.error('Local folder creation error:', error);
      return { data: null, error };
    }
  }

  /**
   * 프로젝트 폴더 조회
   */
  async getProjectFolders(projectId) {
    if (this.forceLocalMode) {
      return this.getProjectFoldersLocal(projectId);
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('folders')
          .select('*')
          .eq('project_id', projectId)
          .order('path');

        if (error) {
          console.error('Get project folders error, using local fallback:', error);
          return this.getProjectFoldersLocal(projectId);
        }

        return { data, error: null };
      } catch (error) {
        console.error('Get project folders error, using local fallback:', error);
        return this.getProjectFoldersLocal(projectId);
      }
    } else {
      return this.getProjectFoldersLocal(projectId);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 폴더 조회
   */
  getProjectFoldersLocal(projectId) {
    try {
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      const projectFolders = folders.filter(folder => folder.project_id === projectId);
      
      return { data: projectFolders, error: null };
    } catch (error) {
      console.error('Local folders fetch error:', error);
      return { data: [], error };
    }
  }

  /**
   * 폴더 경로 계산 (로컬용)
   */
  calculateFolderPath(folders, parentId, folderName) {
    if (!parentId) {
      return folderName;
    }
    
    const parent = folders.find(f => f.id === parentId);
    if (!parent) {
      return folderName;
    }
    
    return parent.path + '/' + folderName;
  }

  /**
   * 폴더 삭제
   */
  async deleteFolder(folderId) {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('folders')
          .delete()
          .eq('id', folderId)
          .select();

        return { data, error };
      } catch (error) {
        console.error('Delete folder error:', error);
        return this.deleteFolderLocal(folderId);
      }
    } else {
      return this.deleteFolderLocal(folderId);
    }
  }

  /**
   * 로컬 스토리지에서 폴더 삭제
   */
  deleteFolderLocal(folderId) {
    try {
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      const updatedFolders = folders.filter(folder => folder.id !== folderId);
      
      localStorage.setItem('bpmn_folders', JSON.stringify(updatedFolders));
      
      return { data: { id: folderId }, error: null };
    } catch (error) {
      console.error('Local folder deletion error:', error);
      return { data: null, error };
    }
  }

  /**
   * 폴더 이름 변경
   */
  async renameFolder(folderId, newName) {
    if (this.forceLocalMode) {
      return this.renameFolderLocal(folderId, newName);
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('folders')
          .update({ 
            name: newName,
            updated_at: new Date().toISOString()
          })
          .eq('id', folderId)
          .select()
          .single();

        if (error) {
          console.error('Supabase folder rename error, falling back to local:', error);
          return this.renameFolderLocal(folderId, newName);
        }

        return { data, error: null };
      } catch (error) {
        console.error('Rename folder error, falling back to local:', error);
        return this.renameFolderLocal(folderId, newName);
      }
    } else {
      return this.renameFolderLocal(folderId, newName);
    }
  }

  /**
   * 로컬 스토리지에서 폴더 이름 변경
   */
  renameFolderLocal(folderId, newName) {
    try {
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      const folderIndex = folders.findIndex(f => f.id === folderId);
      
      if (folderIndex === -1) {
        return { data: null, error: { message: 'Folder not found' } };
      }
      
      folders[folderIndex] = {
        ...folders[folderIndex],
        name: newName,
        updated_at: new Date().toISOString()
      };
      
      localStorage.setItem('bpmn_folders', JSON.stringify(folders));
      
      console.log('✅ Folder renamed locally:', folders[folderIndex]);
      return { data: folders[folderIndex], error: null };
    } catch (error) {
      console.error('Local folder rename error:', error);
      return { data: null, error };
    }
  }

  /**
   * 폴더 업데이트 (드래그앤드롭용)
   */
  async updateFolder(folderId, updates) {
    if (this.forceLocalMode) {
      return this.updateFolderLocal(folderId, updates);
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('folders')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', folderId)
          .select()
          .single();

        if (error) {
          console.error('Supabase folder update error, falling back to local:', error);
          return this.updateFolderLocal(folderId, updates);
        }

        return { data, error: null };
      } catch (error) {
        console.error('Update folder error, falling back to local:', error);
        return this.updateFolderLocal(folderId, updates);
      }
    } else {
      return this.updateFolderLocal(folderId, updates);
    }
  }

  /**
   * 로컬 스토리지에서 폴더 업데이트
   */
  updateFolderLocal(folderId, updates) {
    try {
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      const folderIndex = folders.findIndex(f => f.id === folderId);
      
      if (folderIndex === -1) {
        return { data: null, error: { message: 'Folder not found' } };
      }
      
      folders[folderIndex] = {
        ...folders[folderIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      localStorage.setItem('bpmn_folders', JSON.stringify(folders));
      
      console.log('✅ Folder updated locally:', folders[folderIndex]);
      return { data: folders[folderIndex], error: null };
    } catch (error) {
      console.error('Local folder update error:', error);
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
export const createFolder = (folderData) => dbManager.createFolder(folderData);
export const getProjectFolders = (projectId) => dbManager.getProjectFolders(projectId);
export const deleteFolder = (folderId) => dbManager.deleteFolder(folderId);
export const renameFolder = (folderId, newName) => dbManager.renameFolder(folderId, newName);
export const updateFolder = (folderId, updates) => dbManager.updateFolder(folderId, updates);