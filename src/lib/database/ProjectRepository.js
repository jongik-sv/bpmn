import { EventEmitter } from 'events';

/**
 * 프로젝트 관련 데이터베이스 작업 전담 클래스
 * 프로젝트 CRUD, 멤버 관리, 권한 처리
 */
export class ProjectRepository extends EventEmitter {
  constructor(connectionManager) {
    super();
    this.connectionManager = connectionManager;
    this.supabase = connectionManager.supabase;
  }

  /**
   * 프로젝트 생성
   */
  async createProject(projectData) {
    console.log('🎯 ProjectRepository.createProject called with:', projectData);
    console.log('🎯 Current mode:', this.connectionManager.isLocalMode() ? 'LOCAL' : 'DATABASE');
    
    // 강제 로컬 모드이거나 데이터베이스 연결 실패 시 로컬 스토리지 사용
    if (this.connectionManager.isLocalMode()) {
      console.log('🔧 Using forced local mode');
      return this.createProjectLocal(projectData);
    }
    
    try {
      // 먼저 테이블 존재 여부 확인
      const tableExists = await this.connectionManager.checkTableExists('projects');
      if (!tableExists) {
        console.warn('Projects table does not exist, using local storage');
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

      this.emit('projectCreated', data);
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
      this.emit('projectCreatedLocal', newProject);
      return { data: newProject, error: null };
      
    } catch (error) {
      console.error('Local project creation error:', error);
      this.emit('projectCreateError', error);
      return { data: null, error };
    }
  }

  /**
   * 사용자의 프로젝트 목록 가져오기
   */
  async getUserProjects(userId) {
    console.log('🔍 Getting user projects for:', userId);
    
    // 강제 로컬 모드이거나 데이터베이스 연결 실패 시 로컬 스토리지 사용
    if (this.connectionManager.isLocalMode()) {
      return this.getUserProjectsLocal(userId);
    }

    try {
      // First, get projects owned by the user (direct ownership)
      const { data: ownedProjects, error: ownedError } = await this.supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(display_name, email)
        `)
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false });

      if (ownedError) {
        console.error('Error fetching owned projects, using local fallback:', ownedError);
        return this.getUserProjectsLocal(userId);
      }

      // Get member project IDs first
      const { data: membershipData, error: membershipError } = await this.supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (membershipError) {
        console.warn('Error fetching memberships, using only owned projects:', membershipError);
        return { data: ownedProjects || [], error: null };
      }

      const memberProjectIds = membershipData?.map(m => m.project_id) || [];
      
      // If no member projects, return only owned projects
      if (memberProjectIds.length === 0) {
        console.log('✅ Loaded projects from database (owned only):', ownedProjects?.length || 0);
        this.emit('userProjectsLoaded', { projects: ownedProjects || [], source: 'database' });
        return { data: ownedProjects || [], error: null };
      }

      // Get member projects (excluding owned ones)
      const ownedProjectIds = ownedProjects?.map(p => p.id) || [];
      const memberOnlyIds = memberProjectIds.filter(id => !ownedProjectIds.includes(id));

      let memberProjects = [];
      if (memberOnlyIds.length > 0) {
        const { data: memberProjectsData, error: memberError } = await this.supabase
          .from('projects')
          .select(`
            *,
            owner:profiles!projects_owner_id_fkey(display_name, email)
          `)
          .in('id', memberOnlyIds)
          .order('updated_at', { ascending: false });

        if (memberError) {
          console.warn('Error fetching member projects:', memberError);
        } else {
          memberProjects = memberProjectsData || [];
        }
      }

      // Combine owned and member projects
      const allProjects = [...(ownedProjects || []), ...memberProjects];
      
      console.log('✅ Loaded projects from database:', allProjects.length, `(${ownedProjects?.length || 0} owned, ${memberProjects.length} member)`);
      this.emit('userProjectsLoaded', { projects: allProjects, source: 'database' });
      return { data: allProjects, error: null };
      
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
      this.emit('userProjectsLoaded', { projects: userProjects, source: 'local' });
      return { data: userProjects, error: null };
      
    } catch (error) {
      console.error('Local projects fetch error:', error);
      this.emit('userProjectsLoadError', error);
      return { data: [], error };
    }
  }

  /**
   * 프로젝트 업데이트
   */
  async updateProject(projectId, updates) {
    console.log('🔧 Updating project:', projectId, updates);
    
    if (this.connectionManager.isLocalMode()) {
      return this.updateProjectLocal(projectId, updates);
    }

    try {
      const { data, error } = await this.supabase
        .from('projects')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .select()
        .single();

      if (error) {
        console.error('Database project update error, using local fallback:', error);
        return this.updateProjectLocal(projectId, updates);
      }

      console.log('✅ Project updated in database:', data);
      this.emit('projectUpdated', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Project update error, using local fallback:', error);
      return this.updateProjectLocal(projectId, updates);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 업데이트
   */
  updateProjectLocal(projectId, updates) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        return { data: null, error: { message: 'Project not found' } };
      }
      
      projects[projectIndex] = {
        ...projects[projectIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      localStorage.setItem('bpmn_projects', JSON.stringify(projects));
      
      console.log('✅ Project updated locally:', projects[projectIndex]);
      this.emit('projectUpdatedLocal', projects[projectIndex]);
      return { data: projects[projectIndex], error: null };
      
    } catch (error) {
      console.error('Local project update error:', error);
      return { data: null, error };
    }
  }

  /**
   * 프로젝트 삭제
   */
  async deleteProject(projectId) {
    console.log('🗑️ Deleting project:', projectId);
    
    if (this.connectionManager.isLocalMode()) {
      return this.deleteProjectLocal(projectId);
    }

    try {
      const { data, error } = await this.supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .select();

      if (error) {
        console.error('Database project delete error, using local fallback:', error);
        return this.deleteProjectLocal(projectId);
      }

      console.log('✅ Project deleted from database:', data);
      this.emit('projectDeleted', { id: projectId });
      return { data, error: null };
      
    } catch (error) {
      console.error('Project deletion error, using local fallback:', error);
      return this.deleteProjectLocal(projectId);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 삭제
   */
  deleteProjectLocal(projectId) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      const updatedProjects = projects.filter(project => project.id !== projectId);
      
      localStorage.setItem('bpmn_projects', JSON.stringify(updatedProjects));
      
      console.log('✅ Project deleted locally:', projectId);
      this.emit('projectDeletedLocal', { id: projectId });
      return { data: { id: projectId }, error: null };
      
    } catch (error) {
      console.error('Local project deletion error:', error);
      return { data: null, error };
    }
  }

  /**
   * 특정 프로젝트 가져오기
   */
  async getProject(projectId) {
    if (this.connectionManager.isLocalMode()) {
      return this.getProjectLocal(projectId);
    }

    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(display_name, email),
          project_members(
            role,
            status,
            user:profiles(display_name, email)
          )
        `)
        .eq('id', projectId)
        .single();

      if (error) {
        console.error('Error fetching project, using local fallback:', error);
        return this.getProjectLocal(projectId);
      }

      this.emit('projectFetched', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Project fetch error, using local fallback:', error);
      return this.getProjectLocal(projectId);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 가져오기
   */
  getProjectLocal(projectId) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        return { data: null, error: { message: 'Project not found' } };
      }
      
      console.log('✅ Project fetched from local storage:', project);
      this.emit('projectFetchedLocal', project);
      return { data: project, error: null };
      
    } catch (error) {
      console.error('Local project fetch error:', error);
      return { data: null, error };
    }
  }

  /**
   * 프로젝트 멤버 추가
   */
  async addProjectMember(memberData) {
    if (this.connectionManager.isLocalMode()) {
      return this.addProjectMemberLocal(memberData);
    }

    try {
      const { data, error } = await this.supabase
        .from('project_members')
        .insert({
          project_id: memberData.project_id,
          user_id: memberData.user_id,
          role: memberData.role || 'viewer',
          invited_by: memberData.invited_by,
          status: memberData.status || 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Database member add error, using local fallback:', error);
        return this.addProjectMemberLocal(memberData);
      }

      console.log('✅ Project member added to database:', data);
      this.emit('projectMemberAdded', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Add project member error, using local fallback:', error);
      return this.addProjectMemberLocal(memberData);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 멤버 추가
   */
  addProjectMemberLocal(memberData) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      const projectIndex = projects.findIndex(p => p.id === memberData.project_id);
      
      if (projectIndex === -1) {
        return { data: null, error: { message: 'Project not found' } };
      }
      
      if (!projects[projectIndex].project_members) {
        projects[projectIndex].project_members = [];
      }
      
      const newMember = {
        project_id: memberData.project_id,
        user_id: memberData.user_id,
        role: memberData.role || 'viewer',
        invited_by: memberData.invited_by,
        status: memberData.status || 'pending',
        invited_at: new Date().toISOString(),
        display_name: memberData.display_name || 'Unknown User',
        email: memberData.email || ''
      };
      
      projects[projectIndex].project_members.push(newMember);
      localStorage.setItem('bpmn_projects', JSON.stringify(projects));
      
      console.log('✅ Project member added locally:', newMember);
      this.emit('projectMemberAddedLocal', newMember);
      return { data: newMember, error: null };
      
    } catch (error) {
      console.error('Local project member add error:', error);
      return { data: null, error };
    }
  }

  /**
   * 프로젝트 멤버 목록 가져오기
   */
  async getProjectMembers(projectId) {
    if (this.connectionManager.isLocalMode()) {
      return this.getProjectMembersLocal(projectId);
    }

    try {
      const { data, error } = await this.supabase
        .from('project_members')
        .select(`
          *,
          user:profiles(display_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching project members, using local fallback:', error);
        return this.getProjectMembersLocal(projectId);
      }

      this.emit('projectMembersFetched', { projectId, members: data });
      return { data, error: null };
      
    } catch (error) {
      console.error('Project members fetch error, using local fallback:', error);
      return this.getProjectMembersLocal(projectId);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 멤버 가져오기
   */
  getProjectMembersLocal(projectId) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        return { data: [], error: { message: 'Project not found' } };
      }
      
      const members = project.project_members || [];
      console.log('✅ Project members fetched from local storage:', members.length);
      this.emit('projectMembersFetchedLocal', { projectId, members });
      return { data: members, error: null };
      
    } catch (error) {
      console.error('Local project members fetch error:', error);
      return { data: [], error };
    }
  }

  /**
   * 프로젝트 멤버 역할 업데이트
   */
  async updateProjectMemberRole(projectId, userId, newRole) {
    if (this.connectionManager.isLocalMode()) {
      return this.updateProjectMemberRoleLocal(projectId, userId, newRole);
    }

    try {
      const { data, error } = await this.supabase
        .from('project_members')
        .update({ 
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Database member role update error, using local fallback:', error);
        return this.updateProjectMemberRoleLocal(projectId, userId, newRole);
      }

      console.log('✅ Project member role updated in database:', data);
      this.emit('projectMemberRoleUpdated', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Member role update error, using local fallback:', error);
      return this.updateProjectMemberRoleLocal(projectId, userId, newRole);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 멤버 역할 업데이트
   */
  updateProjectMemberRoleLocal(projectId, userId, newRole) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        return { data: null, error: { message: 'Project not found' } };
      }
      
      if (!projects[projectIndex].project_members) {
        return { data: null, error: { message: 'No members found' } };
      }
      
      const memberIndex = projects[projectIndex].project_members.findIndex(m => m.user_id === userId);
      if (memberIndex === -1) {
        return { data: null, error: { message: 'Member not found' } };
      }
      
      projects[projectIndex].project_members[memberIndex].role = newRole;
      projects[projectIndex].project_members[memberIndex].updated_at = new Date().toISOString();
      
      localStorage.setItem('bpmn_projects', JSON.stringify(projects));
      
      const updatedMember = projects[projectIndex].project_members[memberIndex];
      console.log('✅ Project member role updated locally:', updatedMember);
      this.emit('projectMemberRoleUpdatedLocal', updatedMember);
      return { data: updatedMember, error: null };
      
    } catch (error) {
      console.error('Local member role update error:', error);
      return { data: null, error };
    }
  }

  /**
   * 프로젝트 멤버 제거
   */
  async removeProjectMember(projectId, userId) {
    if (this.connectionManager.isLocalMode()) {
      return this.removeProjectMemberLocal(projectId, userId);
    }

    try {
      const { data, error } = await this.supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Database member remove error, using local fallback:', error);
        return this.removeProjectMemberLocal(projectId, userId);
      }

      console.log('✅ Project member removed from database');
      this.emit('projectMemberRemoved', { projectId, userId });
      return { data, error: null };
      
    } catch (error) {
      console.error('Remove project member error, using local fallback:', error);
      return this.removeProjectMemberLocal(projectId, userId);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 멤버 제거
   */
  removeProjectMemberLocal(projectId, userId) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        return { data: null, error: { message: 'Project not found' } };
      }
      
      if (!projects[projectIndex].project_members) {
        return { data: null, error: { message: 'No members found' } };
      }
      
      const originalLength = projects[projectIndex].project_members.length;
      projects[projectIndex].project_members = projects[projectIndex].project_members.filter(m => m.user_id !== userId);
      
      if (projects[projectIndex].project_members.length === originalLength) {
        return { data: null, error: { message: 'Member not found' } };
      }
      
      localStorage.setItem('bpmn_projects', JSON.stringify(projects));
      
      console.log('✅ Project member removed locally');
      this.emit('projectMemberRemovedLocal', { projectId, userId });
      return { data: { projectId, userId }, error: null };
      
    } catch (error) {
      console.error('Local member remove error:', error);
      return { data: null, error };
    }
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.connectionManager = null;
    this.supabase = null;
    this.removeAllListeners();
    console.log('🗑️ ProjectRepository destroyed');
  }
}