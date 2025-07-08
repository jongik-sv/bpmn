import { EventEmitter } from 'events';

/**
 * 다이어그램 관련 데이터베이스 작업 전담 클래스
 * 다이어그램 CRUD, 버전 관리, 협업 세션 관리
 */
export class DiagramRepository extends EventEmitter {
  constructor(connectionManager) {
    super();
    this.connectionManager = connectionManager;
    this.supabase = connectionManager.supabase;
  }

  /**
   * 프로젝트 다이어그램 목록 가져오기 (개선된 버전)
   */
  async getProjectDiagrams(projectId) {
    console.log('📄 Getting diagrams for project:', projectId);
    
    if (this.connectionManager.isLocalMode()) {
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
        .order('sort_order', { ascending: true });
      
      console.log('📄 Diagrams from DB (sorted by sort_order):', data?.map(d => ({ name: d.name, sort_order: d.sort_order, folder_id: d.folder_id })));

      if (error) {
        console.error('Error fetching project diagrams, using local fallback:', error);
        return this.getProjectDiagramsLocal(projectId);
      }

      this.emit('projectDiagramsFetched', { projectId, diagrams: data });
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
      const projectDiagrams = diagrams
        .filter(diagram => 
          diagram.project_id === projectId && diagram.is_active !== false
        )
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
      console.log('📄 Diagrams from Local (sorted by sort_order):', projectDiagrams?.map(d => ({ name: d.name, sort_order: d.sort_order, folder_id: d.folder_id })));
      console.log('✅ Loaded diagrams from local storage:', projectDiagrams.length);
      
      this.emit('projectDiagramsFetchedLocal', { projectId, diagrams: projectDiagrams });
      return { data: projectDiagrams, error: null };
      
    } catch (error) {
      console.error('Local diagrams fetch error:', error);
      this.emit('projectDiagramsFetchError', error);
      return { data: [], error };
    }
  }

  /**
   * 다이어그램 생성 (개선된 버전)
   */
  async createDiagram(diagramData) {
    console.log('🎯 DiagramRepository.createDiagram called with:', diagramData);
    console.log('🎯 Current mode:', this.connectionManager.isLocalMode() ? 'LOCAL' : 'DATABASE');
    
    if (this.connectionManager.isLocalMode()) {
      console.log('🔧 Using forced local mode for diagram creation');
      return this.createDiagramLocal(diagramData);
    }

    try {
      // Get the next sort_order for this folder
      const { data: existingDiagrams } = await this.supabase
        .from('diagrams')
        .select('sort_order')
        .eq('project_id', diagramData.project_id)
        .eq('folder_id', diagramData.folder_id || null)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = existingDiagrams && existingDiagrams.length > 0 
        ? existingDiagrams[0].sort_order + 1 
        : 0;

      const { data, error } = await this.supabase
        .from('diagrams')
        .insert({
          project_id: diagramData.project_id,
          folder_id: diagramData.folder_id,
          name: diagramData.name,
          description: diagramData.description,
          bpmn_xml: diagramData.bpmn_xml || diagramData.content,
          created_by: diagramData.created_by,
          last_modified_by: diagramData.created_by,
          sort_order: nextSortOrder
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating diagram, using local fallback:', error);
        return this.createDiagramLocal(diagramData);
      }

      console.log('✅ Diagram created in database:', data);
      this.emit('diagramCreated', data);
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
      
      // Calculate next sort_order for this folder
      const siblingsInSameFolder = diagrams.filter(d => 
        d.project_id === diagramData.project_id && 
        d.folder_id === (diagramData.folder_id || null) &&
        d.is_active !== false
      );
      const maxSortOrder = siblingsInSameFolder.length > 0 
        ? Math.max(...siblingsInSameFolder.map(d => d.sort_order || 0))
        : -1;
      const nextSortOrder = maxSortOrder + 1;
      
      const newDiagram = {
        id: 'local_diagram_' + Date.now(),
        project_id: diagramData.project_id,
        folder_id: diagramData.folder_id,
        name: diagramData.name,
        description: diagramData.description,
        bpmn_xml: diagramData.bpmn_xml || diagramData.content,
        created_by: diagramData.created_by,
        last_modified_by: diagramData.created_by,
        version: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sort_order: nextSortOrder
      };
      
      diagrams.push(newDiagram);
      localStorage.setItem('bpmn_diagrams', JSON.stringify(diagrams));
      
      console.log('✅ Diagram created locally:', newDiagram);
      this.emit('diagramCreatedLocal', newDiagram);
      return { data: newDiagram, error: null };
      
    } catch (error) {
      console.error('Local diagram creation error:', error);
      this.emit('diagramCreateError', error);
      return { data: null, error };
    }
  }

  /**
   * 다이어그램 업데이트
   */
  async updateDiagram(diagramId, updates) {
    console.log('🔧 DiagramRepository.updateDiagram called:', { diagramId, updates });
    console.log('🔧 Current mode:', this.connectionManager.isLocalMode() ? 'LOCAL' : 'DATABASE');
    
    if (this.connectionManager.isLocalMode()) {
      console.log('🔧 Using local mode for diagram update');
      return this.updateDiagramLocal(diagramId, updates);
    }

    try {
      console.log('🔧 Updating diagram in Supabase...');
      
      // 버전 관리를 서버 트리거에 맡기고 클라이언트에서는 버전을 수동으로 증가시키지 않음
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      // version 필드는 제거 (서버 트리거가 처리)
      delete updateData.version;
      
      console.log('🔧 Update data:', updateData);
      
      const { data, error } = await this.supabase
        .from('diagrams')
        .update(updateData)
        .eq('id', diagramId)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase diagram update error:', error);
        
        // 409 Conflict 오류인 경우 특별 처리
        if (error.code === '23505' || error.details?.includes('already exists')) {
          console.log('🔄 Retrying update without version management...');
          
          // 버전 관련 필드를 완전히 제거하고 재시도
          const retryData = { ...updateData };
          delete retryData.version_number;
          delete retryData.version;
          
          const { data: retryResult, error: retryError } = await this.supabase
            .from('diagrams')
            .update(retryData)
            .eq('id', diagramId)
            .select()
            .single();
            
          if (retryError) {
            console.error('❌ Retry failed, using local fallback:', retryError);
            return this.updateDiagramLocal(diagramId, updates);
          }
          
          console.log('✅ Diagram updated in Supabase after retry:', retryResult);
          this.emit('diagramUpdated', retryResult);
          return { data: retryResult, error: null };
        }
        
        // 다른 오류의 경우 로컬 fallback 사용
        return this.updateDiagramLocal(diagramId, updates);
      }

      console.log('✅ Diagram updated in Supabase:', data);
      this.emit('diagramUpdated', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('❌ Diagram update error, using local fallback:', error);
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
      this.emit('diagramUpdatedLocal', diagrams[diagramIndex]);
      return { data: diagrams[diagramIndex], error: null };
      
    } catch (error) {
      console.error('Local diagram update error:', error);
      return { data: null, error };
    }
  }

  /**
   * 다이어그램 가져오기
   */
  async getDiagram(diagramId) {
    console.log('🔍 Getting diagram:', diagramId);
    
    if (this.connectionManager.isLocalMode()) {
      return this.getDiagramLocal(diagramId);
    }

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
        console.error('Error fetching diagram, using local fallback:', error);
        return this.getDiagramLocal(diagramId);
      }

      console.log('✅ Diagram fetched from database:', data);
      this.emit('diagramFetched', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Diagram fetch error, using local fallback:', error);
      return this.getDiagramLocal(diagramId);
    }
  }

  /**
   * 로컬 스토리지에서 다이어그램 가져오기
   */
  getDiagramLocal(diagramId) {
    try {
      const diagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');
      const diagram = diagrams.find(d => d.id === diagramId && d.is_active !== false);
      
      if (!diagram) {
        return { data: null, error: { message: 'Diagram not found' } };
      }
      
      console.log('✅ Diagram fetched from local storage:', diagram);
      this.emit('diagramFetchedLocal', diagram);
      return { data: diagram, error: null };
      
    } catch (error) {
      console.error('Local diagram fetch error:', error);
      return { data: null, error };
    }
  }

  /**
   * 다이어그램 삭제
   */
  async deleteDiagram(diagramId) {
    console.log('🗑️ Deleting diagram:', diagramId);
    
    if (this.connectionManager.isLocalMode()) {
      return this.deleteDiagramLocal(diagramId);
    }

    try {
      const { data, error } = await this.supabase
        .from('diagrams')
        .delete()
        .eq('id', diagramId)
        .select();

      if (error) {
        console.error('Supabase diagram delete error, falling back to local:', error);
        return this.deleteDiagramLocal(diagramId);
      }

      console.log('✅ Diagram deleted from database');
      this.emit('diagramDeleted', { id: diagramId });
      return { data, error: null };
      
    } catch (error) {
      console.error('Delete diagram error, falling back to local:', error);
      return this.deleteDiagramLocal(diagramId);
    }
  }

  /**
   * 로컬 스토리지에서 다이어그램 삭제
   */
  deleteDiagramLocal(diagramId) {
    try {
      const diagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');
      const updatedDiagrams = diagrams.filter(diagram => diagram.id !== diagramId);
      
      localStorage.setItem('bpmn_diagrams', JSON.stringify(updatedDiagrams));
      
      console.log('✅ Diagram deleted locally:', diagramId);
      this.emit('diagramDeletedLocal', { id: diagramId });
      return { data: { id: diagramId }, error: null };
      
    } catch (error) {
      console.error('Local diagram deletion error:', error);
      return { data: null, error };
    }
  }

  /**
   * 다이어그램 복사
   */
  async copyDiagram(diagramId, newName) {
    console.log('📋 Copying diagram:', diagramId, 'with new name:', newName);
    
    // 원본 다이어그램 가져오기
    const { data: originalDiagram, error: fetchError } = await this.getDiagram(diagramId);
    
    if (fetchError || !originalDiagram) {
      return { data: null, error: fetchError || { message: 'Original diagram not found' } };
    }
    
    // 새 다이어그램 데이터 생성
    const newDiagramData = {
      project_id: originalDiagram.project_id,
      folder_id: originalDiagram.folder_id,
      name: newName,
      description: originalDiagram.description,
      bpmn_xml: originalDiagram.bpmn_xml,
      created_by: originalDiagram.created_by
    };
    
    return await this.createDiagram(newDiagramData);
  }

  /**
   * 협업 세션 생성/업데이트
   */
  async upsertCollaborationSession(sessionData) {
    if (this.connectionManager.isLocalMode()) {
      return this.upsertCollaborationSessionLocal(sessionData);
    }

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

      if (error) {
        console.error('Collaboration session upsert error, using local fallback:', error);
        return this.upsertCollaborationSessionLocal(sessionData);
      }

      this.emit('collaborationSessionUpserted', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Collaboration session upsert error, using local fallback:', error);
      return this.upsertCollaborationSessionLocal(sessionData);
    }
  }

  /**
   * 로컬 스토리지에서 협업 세션 업서트
   */
  upsertCollaborationSessionLocal(sessionData) {
    try {
      const sessions = JSON.parse(localStorage.getItem('bpmn_collaboration_sessions') || '[]');
      const existingIndex = sessions.findIndex(s => 
        s.diagram_id === sessionData.diagram_id && s.user_id === sessionData.user_id
      );
      
      const sessionRecord = {
        diagram_id: sessionData.diagram_id,
        user_id: sessionData.user_id,
        session_data: sessionData.session_data || {},
        last_activity: new Date().toISOString(),
        is_active: true,
        id: `local_session_${sessionData.diagram_id}_${sessionData.user_id}`
      };
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = sessionRecord;
      } else {
        sessions.push(sessionRecord);
      }
      
      localStorage.setItem('bpmn_collaboration_sessions', JSON.stringify(sessions));
      
      console.log('✅ Collaboration session upserted locally:', sessionRecord);
      this.emit('collaborationSessionUpsertedLocal', sessionRecord);
      return { data: sessionRecord, error: null };
      
    } catch (error) {
      console.error('Local collaboration session upsert error:', error);
      return { data: null, error };
    }
  }

  /**
   * 활성 협업 세션 가져오기
   */
  async getActiveCollaborationSessions(diagramId) {
    if (this.connectionManager.isLocalMode()) {
      return this.getActiveCollaborationSessionsLocal(diagramId);
    }

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

      if (error) {
        console.error('Active collaboration sessions fetch error, using local fallback:', error);
        return this.getActiveCollaborationSessionsLocal(diagramId);
      }

      this.emit('activeCollaborationSessionsFetched', { diagramId, sessions: data });
      return { data: data || [], error: null };
      
    } catch (error) {
      console.error('Active collaboration sessions fetch error, using local fallback:', error);
      return this.getActiveCollaborationSessionsLocal(diagramId);
    }
  }

  /**
   * 로컬 스토리지에서 활성 협업 세션 가져오기
   */
  getActiveCollaborationSessionsLocal(diagramId) {
    try {
      const sessions = JSON.parse(localStorage.getItem('bpmn_collaboration_sessions') || '[]');
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const activeSessions = sessions.filter(session => 
        session.diagram_id === diagramId && 
        session.is_active && 
        new Date(session.last_activity) > fiveMinutesAgo
      );
      
      console.log('✅ Active collaboration sessions from local storage:', activeSessions.length);
      this.emit('activeCollaborationSessionsFetchedLocal', { diagramId, sessions: activeSessions });
      return { data: activeSessions, error: null };
      
    } catch (error) {
      console.error('Local active collaboration sessions fetch error:', error);
      return { data: [], error };
    }
  }

  /**
   * 활동 로그 생성
   */
  async createActivityLog(logData) {
    if (this.connectionManager.isLocalMode()) {
      return this.createActivityLogLocal(logData);
    }

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

      if (error) {
        console.error('Activity log creation error, using local fallback:', error);
        return this.createActivityLogLocal(logData);
      }

      this.emit('activityLogCreated', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Activity log creation error, using local fallback:', error);
      return this.createActivityLogLocal(logData);
    }
  }

  /**
   * 로컬 스토리지에서 활동 로그 생성
   */
  createActivityLogLocal(logData) {
    try {
      const logs = JSON.parse(localStorage.getItem('bpmn_activity_logs') || '[]');
      
      const newLog = {
        id: 'local_log_' + Date.now(),
        project_id: logData.project_id,
        diagram_id: logData.diagram_id,
        user_id: logData.user_id,
        action: logData.action,
        entity_type: logData.entity_type,
        entity_id: logData.entity_id,
        details: logData.details || {},
        created_at: new Date().toISOString()
      };
      
      logs.push(newLog);
      
      // 로그가 너무 많아지지 않도록 최근 1000개만 유지
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }
      
      localStorage.setItem('bpmn_activity_logs', JSON.stringify(logs));
      
      console.log('✅ Activity log created locally:', newLog);
      this.emit('activityLogCreatedLocal', newLog);
      return { data: newLog, error: null };
      
    } catch (error) {
      console.error('Local activity log creation error:', error);
      return { data: null, error };
    }
  }

  /**
   * 다이어그램 순서 업데이트
   */
  async updateDiagramOrder(diagrams) {
    console.log('💾 Updating diagram order for diagrams:', diagrams.map(d => ({ id: d.id, sort_order: d.sort_order })));
    
    if (this.connectionManager.isLocalMode()) {
      return this.updateDiagramOrderLocal(diagrams);
    }

    try {
      const updates = diagrams.map(diagram => 
        this.supabase
          .from('diagrams')
          .update({ 
            sort_order: diagram.sort_order,
            updated_at: new Date().toISOString()
          })
          .eq('id', diagram.id)
      );

      const results = await Promise.all(updates);
      
      // 에러 확인
      for (const result of results) {
        if (result.error) {
          console.error('Diagram order update error:', result.error);
          return this.updateDiagramOrderLocal(diagrams);
        }
      }

      console.log('✅ Diagram order updated in database');
      this.emit('diagramOrderUpdated', diagrams);
      return { success: true, error: null };
      
    } catch (error) {
      console.error('Diagram order update error, using local fallback:', error);
      return this.updateDiagramOrderLocal(diagrams);
    }
  }

  /**
   * 로컬 스토리지에서 다이어그램 순서 업데이트
   */
  updateDiagramOrderLocal(diagrams) {
    try {
      const allDiagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');

      for (const diagram of diagrams) {
        const diagramIndex = allDiagrams.findIndex(d => d.id === diagram.id);
        if (diagramIndex !== -1) {
          allDiagrams[diagramIndex].sort_order = diagram.sort_order;
          allDiagrams[diagramIndex].updated_at = new Date().toISOString();
        }
      }

      localStorage.setItem('bpmn_diagrams', JSON.stringify(allDiagrams));

      console.log('✅ Diagram order updated locally');
      this.emit('diagramOrderUpdatedLocal', diagrams);
      return { success: true, error: null };
      
    } catch (error) {
      console.error('Local diagram order update error:', error);
      return { success: false, error };
    }
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.connectionManager = null;
    this.supabase = null;
    this.removeAllListeners();
    console.log('🗑️ DiagramRepository destroyed');
  }
}