import { EventEmitter } from 'events';

/**
 * 폴더 관련 데이터베이스 작업 전담 클래스
 * 폴더 CRUD, 계층 구조 관리, 드래그앤드롭 지원
 */
export class FolderRepository extends EventEmitter {
  constructor(connectionManager) {
    super();
    this.connectionManager = connectionManager;
    this.supabase = connectionManager.supabase;
  }

  /**
   * 폴더 생성
   */
  async createFolder(folderData) {
    console.log('🎯 FolderRepository.createFolder called with:', folderData);
    console.log('🎯 Current mode:', this.connectionManager.isLocalMode() ? 'LOCAL' : 'DATABASE');
    
    if (this.connectionManager.isLocalMode()) {
      console.log('Using local mode for folder creation');
      return this.createFolderLocal(folderData);
    }

    try {
      console.log('Creating folder in Supabase...');
      
      // Get the next sort_order for this parent folder
      const { data: existingFolders } = await this.supabase
        .from('folders')
        .select('sort_order')
        .eq('project_id', folderData.project_id)
        .eq('parent_id', folderData.parent_id || null)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = existingFolders && existingFolders.length > 0 
        ? existingFolders[0].sort_order + 1 
        : 0;

      const insertData = {
        project_id: folderData.project_id,
        parent_id: folderData.parent_id || null,
        name: folderData.name,
        created_by: folderData.created_by,
        sort_order: nextSortOrder
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

      console.log('✅ Folder created in database:', data);
      this.emit('folderCreated', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Create folder error, falling back to local:', error);
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
      
      // Calculate next sort_order for this parent folder
      const siblingsInSameParent = folders.filter(f => 
        f.project_id === folderData.project_id && 
        f.parent_id === (folderData.parent_id || null)
      );
      const maxSortOrder = siblingsInSameParent.length > 0 
        ? Math.max(...siblingsInSameParent.map(f => f.sort_order || 0))
        : -1;
      const nextSortOrder = maxSortOrder + 1;
      
      const newFolder = {
        id: 'folder-' + Date.now(),
        project_id: folderData.project_id,
        parent_id: folderData.parent_id || null,
        name: folderData.name,
        created_by: folderData.created_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        path: this.calculateFolderPath(folders, folderData.parent_id, folderData.name),
        sort_order: nextSortOrder
      };
      
      console.log('New folder object:', newFolder);
      
      folders.push(newFolder);
      localStorage.setItem('bpmn_folders', JSON.stringify(folders));
      
      console.log('✅ Folder created locally:', newFolder);
      this.emit('folderCreatedLocal', newFolder);
      return { data: newFolder, error: null };
      
    } catch (error) {
      console.error('Local folder creation error:', error);
      this.emit('folderCreateError', error);
      return { data: null, error };
    }
  }

  /**
   * 프로젝트 폴더 조회
   */
  async getProjectFolders(projectId) {
    console.log('📁 Getting folders for project:', projectId);
    
    if (this.connectionManager.isLocalMode()) {
      return this.getProjectFoldersLocal(projectId);
    }

    try {
      const { data, error } = await this.supabase
        .from('folders')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Get project folders error, using local fallback:', error);
        return this.getProjectFoldersLocal(projectId);
      }

      console.log('✅ Folders fetched from database:', data?.length || 0);
      this.emit('projectFoldersFetched', { projectId, folders: data });
      return { data, error: null };
      
    } catch (error) {
      console.error('Get project folders error, using local fallback:', error);
      return this.getProjectFoldersLocal(projectId);
    }
  }

  /**
   * 로컬 스토리지에서 프로젝트 폴더 조회
   */
  getProjectFoldersLocal(projectId) {
    try {
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      const projectFolders = folders
        .filter(folder => folder.project_id === projectId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
      console.log('📁 Folders from Local (sorted by sort_order):', projectFolders?.map(f => ({ name: f.name, sort_order: f.sort_order, parent_id: f.parent_id })));
      console.log('✅ Folders fetched from local storage:', projectFolders.length);
      
      this.emit('projectFoldersFetchedLocal', { projectId, folders: projectFolders });
      return { data: projectFolders, error: null };
      
    } catch (error) {
      console.error('Local folders fetch error:', error);
      this.emit('projectFoldersFetchError', error);
      return { data: [], error };
    }
  }

  /**
   * 폴더 업데이트 (드래그앤드롭용)
   */
  async updateFolder(folderId, updates) {
    console.log('🔧 FolderRepository.updateFolder called:', { folderId, updates });
    
    if (this.connectionManager.isLocalMode()) {
      console.log('🔧 Using local mode for folder update');
      return this.updateFolderLocal(folderId, updates);
    }

    try {
      console.log('🔧 Updating folder in Supabase...');
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

      console.log('✅ Folder updated in Supabase:', data);
      this.emit('folderUpdated', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Update folder error, falling back to local:', error);
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
      this.emit('folderUpdatedLocal', folders[folderIndex]);
      return { data: folders[folderIndex], error: null };
      
    } catch (error) {
      console.error('Local folder update error:', error);
      return { data: null, error };
    }
  }

  /**
   * 폴더 삭제
   */
  async deleteFolder(folderId) {
    console.log('🗑️ Deleting folder:', folderId);
    
    if (this.connectionManager.isLocalMode()) {
      return this.deleteFolderLocal(folderId);
    }

    try {
      const { data, error } = await this.supabase
        .from('folders')
        .delete()
        .eq('id', folderId)
        .select();

      if (error) {
        console.error('Delete folder error, using local fallback:', error);
        return this.deleteFolderLocal(folderId);
      }

      console.log('✅ Folder deleted from database');
      this.emit('folderDeleted', { id: folderId });
      return { data, error: null };
      
    } catch (error) {
      console.error('Folder deletion error, using local fallback:', error);
      return this.deleteFolderLocal(folderId);
    }
  }

  /**
   * 로컬 스토리지에서 폴더 삭제
   */
  deleteFolderLocal(folderId) {
    try {
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      
      // 하위 폴더들도 함께 삭제 (재귀적)
      const foldersToDelete = this.getAllSubfolders(folders, folderId);
      foldersToDelete.push(folderId);
      
      const updatedFolders = folders.filter(folder => !foldersToDelete.includes(folder.id));
      localStorage.setItem('bpmn_folders', JSON.stringify(updatedFolders));
      
      // 해당 폴더들의 다이어그램도 삭제
      const diagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');
      const updatedDiagrams = diagrams.filter(diagram => !foldersToDelete.includes(diagram.folder_id));
      localStorage.setItem('bpmn_diagrams', JSON.stringify(updatedDiagrams));
      
      console.log('✅ Folder and subfolders deleted locally:', foldersToDelete);
      this.emit('folderDeletedLocal', { id: folderId, deletedIds: foldersToDelete });
      return { data: { id: folderId, deletedIds: foldersToDelete }, error: null };
      
    } catch (error) {
      console.error('Local folder deletion error:', error);
      return { data: null, error };
    }
  }

  /**
   * 폴더 이름 변경
   */
  async renameFolder(folderId, newName) {
    console.log('📝 Renaming folder:', folderId, 'to:', newName);
    
    if (this.connectionManager.isLocalMode()) {
      return this.renameFolderLocal(folderId, newName);
    }

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

      console.log('✅ Folder renamed in database:', data);
      this.emit('folderRenamed', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Rename folder error, falling back to local:', error);
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
      
      const oldName = folders[folderIndex].name;
      folders[folderIndex] = {
        ...folders[folderIndex],
        name: newName,
        updated_at: new Date().toISOString()
      };
      
      // 경로도 업데이트 (필요한 경우)
      if (folders[folderIndex].path) {
        folders[folderIndex].path = folders[folderIndex].path.replace(oldName, newName);
      }
      
      localStorage.setItem('bpmn_folders', JSON.stringify(folders));
      
      console.log('✅ Folder renamed locally:', folders[folderIndex]);
      this.emit('folderRenamedLocal', folders[folderIndex]);
      return { data: folders[folderIndex], error: null };
      
    } catch (error) {
      console.error('Local folder rename error:', error);
      return { data: null, error };
    }
  }

  /**
   * 특정 폴더 가져오기
   */
  async getFolder(folderId) {
    if (this.connectionManager.isLocalMode()) {
      return this.getFolderLocal(folderId);
    }

    try {
      const { data, error } = await this.supabase
        .from('folders')
        .select(`
          *,
          parent:folders!folders_parent_id_fkey(name),
          created_by_profile:profiles!folders_created_by_fkey(display_name, email)
        `)
        .eq('id', folderId)
        .single();

      if (error) {
        console.error('Error fetching folder, using local fallback:', error);
        return this.getFolderLocal(folderId);
      }

      this.emit('folderFetched', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('Folder fetch error, using local fallback:', error);
      return this.getFolderLocal(folderId);
    }
  }

  /**
   * 로컬 스토리지에서 폴더 가져오기
   */
  getFolderLocal(folderId) {
    try {
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      const folder = folders.find(f => f.id === folderId);
      
      if (!folder) {
        return { data: null, error: { message: 'Folder not found' } };
      }
      
      console.log('✅ Folder fetched from local storage:', folder);
      this.emit('folderFetchedLocal', folder);
      return { data: folder, error: null };
      
    } catch (error) {
      console.error('Local folder fetch error:', error);
      return { data: null, error };
    }
  }

  /**
   * 폴더 이동 (부모 변경)
   */
  async moveFolder(folderId, newParentId) {
    console.log('📁 Moving folder:', folderId, 'to parent:', newParentId);
    
    const updates = {
      parent_id: newParentId
    };
    
    return await this.updateFolder(folderId, updates);
  }

  /**
   * 폴더 순서 업데이트
   */
  async updateFolderOrder(folders) {
    console.log('💾 Updating folder order for folders:', folders.map(f => ({ id: f.id, sort_order: f.sort_order })));
    
    if (this.connectionManager.isLocalMode()) {
      return this.updateFolderOrderLocal(folders);
    }

    try {
      const updates = folders.map(folder => 
        this.supabase
          .from('folders')
          .update({ 
            sort_order: folder.sort_order,
            updated_at: new Date().toISOString()
          })
          .eq('id', folder.id)
      );

      const results = await Promise.all(updates);
      
      // 에러 확인
      for (const result of results) {
        if (result.error) {
          console.error('Folder order update error:', result.error);
          return this.updateFolderOrderLocal(folders);
        }
      }

      console.log('✅ Folder order updated in database');
      this.emit('folderOrderUpdated', folders);
      return { success: true, error: null };
      
    } catch (error) {
      console.error('Folder order update error, using local fallback:', error);
      return this.updateFolderOrderLocal(folders);
    }
  }

  /**
   * 로컬 스토리지에서 폴더 순서 업데이트
   */
  updateFolderOrderLocal(folders) {
    try {
      const allFolders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');

      for (const folder of folders) {
        const folderIndex = allFolders.findIndex(f => f.id === folder.id);
        if (folderIndex !== -1) {
          allFolders[folderIndex].sort_order = folder.sort_order;
          allFolders[folderIndex].updated_at = new Date().toISOString();
        }
      }

      localStorage.setItem('bpmn_folders', JSON.stringify(allFolders));

      console.log('✅ Folder order updated locally');
      this.emit('folderOrderUpdatedLocal', folders);
      return { success: true, error: null };
      
    } catch (error) {
      console.error('Local folder order update error:', error);
      return { success: false, error };
    }
  }

  /**
   * 혼합 항목 순서 업데이트 (폴더 + 다이어그램)
   */
  async updateItemOrder(items) {
    console.log('💾 FolderRepository.updateItemOrder called with:', items);
    
    if (this.connectionManager.isLocalMode()) {
      console.log('💾 Using local mode for order update');
      return this.updateItemOrderLocal(items);
    }

    try {
      const updates = [];
      
      console.log('💾 Processing items for Supabase update...');
      for (const item of items) {
        console.log(`💾 Processing ${item.type} with ID ${item.folderId || item.diagramId} -> sort_order: ${item.sortOrder}`);
        
        if (item.type === 'folder') {
          const updateQuery = this.supabase
            .from('folders')
            .update({ 
              sort_order: item.sortOrder,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.folderId);
          updates.push(updateQuery);
          console.log(`💾 Added folder update: ID ${item.folderId} -> sort_order ${item.sortOrder}`);
        } else if (item.type === 'diagram') {
          const updateQuery = this.supabase
            .from('diagrams')
            .update({ 
              sort_order: item.sortOrder,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.diagramId);
          updates.push(updateQuery);
          console.log(`💾 Added diagram update: ID ${item.diagramId} -> sort_order ${item.sortOrder}`);
        }
      }

      // 모든 업데이트를 병렬로 실행
      const results = await Promise.all(updates);
      
      // 에러 확인
      for (const result of results) {
        if (result.error) {
          console.error('Order update error:', result.error);
          return this.updateItemOrderLocal(items);
        }
      }

      console.log('✅ Item order updated in database');
      this.emit('itemOrderUpdated', items);
      
      // 업데이트 후 실제 데이터 확인
      setTimeout(async () => {
        console.log('🔍 Verifying order updates in database...');
        for (const item of items) {
          if (item.type === 'folder') {
            const { data } = await this.supabase
              .from('folders')
              .select('id, name, sort_order')
              .eq('id', item.folderId)
              .single();
            console.log(`🔍 Folder ${data?.name}: expected ${item.sortOrder}, actual ${data?.sort_order}`);
          } else if (item.type === 'diagram') {
            const { data } = await this.supabase
              .from('diagrams')
              .select('id, name, sort_order')
              .eq('id', item.diagramId)
              .single();
            console.log(`🔍 Diagram ${data?.name}: expected ${item.sortOrder}, actual ${data?.sort_order}`);
          }
        }
      }, 500);
      
      return { success: true, error: null };

    } catch (error) {
      console.error('Item order update error, using local fallback:', error);
      return this.updateItemOrderLocal(items);
    }
  }

  /**
   * 로컬 스토리지에서 혼합 항목 순서 업데이트
   */
  updateItemOrderLocal(items) {
    try {
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      const diagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');

      for (const item of items) {
        if (item.type === 'folder') {
          const folderIndex = folders.findIndex(f => f.id === item.folderId);
          if (folderIndex !== -1) {
            folders[folderIndex].sort_order = item.sortOrder;
            folders[folderIndex].updated_at = new Date().toISOString();
          }
        } else if (item.type === 'diagram') {
          const diagramIndex = diagrams.findIndex(d => d.id === item.diagramId);
          if (diagramIndex !== -1) {
            diagrams[diagramIndex].sort_order = item.sortOrder;
            diagrams[diagramIndex].updated_at = new Date().toISOString();
          }
        }
      }

      localStorage.setItem('bpmn_folders', JSON.stringify(folders));
      localStorage.setItem('bpmn_diagrams', JSON.stringify(diagrams));

      console.log('✅ Item order updated locally');
      this.emit('itemOrderUpdatedLocal', items);
      return { success: true, error: null };

    } catch (error) {
      console.error('Local order update error:', error);
      return { success: false, error };
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
   * 모든 하위 폴더 ID 반환 (재귀적)
   */
  getAllSubfolders(folders, parentId) {
    const subfolders = [];
    const directChildren = folders.filter(f => f.parent_id === parentId);
    
    for (const child of directChildren) {
      subfolders.push(child.id);
      subfolders.push(...this.getAllSubfolders(folders, child.id));
    }
    
    return subfolders;
  }

  /**
   * 폴더 계층 구조 검증
   */
  validateFolderHierarchy(folders, folderId, newParentId) {
    if (!newParentId) return true; // 루트로 이동은 항상 가능
    
    // 자기 자신을 부모로 설정하는 것 방지
    if (folderId === newParentId) return false;
    
    // 순환 참조 방지 (자신의 하위 폴더를 부모로 설정하는 것 방지)
    const subfolders = this.getAllSubfolders(folders, folderId);
    return !subfolders.includes(newParentId);
  }

  /**
   * 폴더 통계 정보 반환
   */
  async getFolderStats(folderId) {
    if (this.connectionManager.isLocalMode()) {
      return this.getFolderStatsLocal(folderId);
    }

    try {
      // 하위 폴더 수
      const { data: subfolders, error: foldersError } = await this.supabase
        .from('folders')
        .select('id')
        .eq('parent_id', folderId);

      // 폴더 내 다이어그램 수
      const { data: diagrams, error: diagramsError } = await this.supabase
        .from('diagrams')
        .select('id')
        .eq('folder_id', folderId)
        .eq('is_active', true);

      if (foldersError || diagramsError) {
        return this.getFolderStatsLocal(folderId);
      }

      const stats = {
        subfolderCount: subfolders?.length || 0,
        diagramCount: diagrams?.length || 0,
        totalItems: (subfolders?.length || 0) + (diagrams?.length || 0)
      };

      this.emit('folderStatsFetched', { folderId, stats });
      return { data: stats, error: null };
      
    } catch (error) {
      console.error('Folder stats fetch error, using local fallback:', error);
      return this.getFolderStatsLocal(folderId);
    }
  }

  /**
   * 로컬 스토리지에서 폴더 통계 정보
   */
  getFolderStatsLocal(folderId) {
    try {
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      const diagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');
      
      const subfolderCount = folders.filter(f => f.parent_id === folderId).length;
      const diagramCount = diagrams.filter(d => d.folder_id === folderId && d.is_active !== false).length;
      
      const stats = {
        subfolderCount,
        diagramCount,
        totalItems: subfolderCount + diagramCount
      };

      this.emit('folderStatsLocal', { folderId, stats });
      return { data: stats, error: null };
      
    } catch (error) {
      console.error('Local folder stats error:', error);
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
    console.log('🗑️ FolderRepository destroyed');
  }
}