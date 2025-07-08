import { EventEmitter } from 'events';
import $ from 'jquery';

/**
 * BPMN 에디터와 다른 UI 컴포넌트 간의 통합을 담당하는 클래스
 * UI 상태 동기화, 헤더 및 브레드크럼 관리, 이벤트 리스너 설정
 */
export class BpmnUIIntegration extends EventEmitter {
  constructor(bpmnEditorCore) {
    super();
    
    this.editorCore = bpmnEditorCore;
    this.currentDiagram = null;
    this.currentProject = null;
    this.currentUser = null;
    
    // 에디터 이벤트 구독
    this.setupEditorEventListeners();
    this.setupEventListeners();
  }

  setupEditorEventListeners() {
    // 다이어그램 로드 시 UI 업데이트
    this.editorCore.on('diagramLoaded', (diagram) => {
      this.currentDiagram = diagram;
      this.updateBreadcrumb();
      this.updateEditorTitle();
      this.showEditorHeader();
    });
    
    // 다이어그램 닫기 시 UI 업데이트
    this.editorCore.on('diagramClosed', () => {
      this.currentDiagram = null;
      this.updateBreadcrumb();
      this.updateEditorTitle();
    });
    
    // 새 다이어그램 생성 시 UI 업데이트
    this.editorCore.on('newDiagramCreated', (diagram) => {
      this.currentDiagram = diagram;
      this.updateBreadcrumb();
      this.updateEditorTitle();
    });
  }

  /**
   * 현재 프로젝트 설정
   */
  setCurrentProject(project) {
    this.currentProject = project;
    this.updateBreadcrumb();
    this.emit('projectChanged', project);
  }

  /**
   * 현재 사용자 설정
   */
  setCurrentUser(user) {
    this.currentUser = user;
    this.emit('userChanged', user);
  }

  /**
   * 브레드크럼 업데이트
   */
  updateBreadcrumb() {
    // 기존 jQuery 브레드크럼 업데이트 (하위 호환성)
    const breadcrumb = $('#breadcrumb');
    
    if (this.currentProject && this.currentDiagram) {
      breadcrumb.text(`${this.currentProject.name} / ${this.currentDiagram.name}`);
    } else if (this.currentProject) {
      breadcrumb.text(this.currentProject.name);
    } else {
      breadcrumb.text('');
    }

    // VSCodeLayout 헤더 브레드크럼 업데이트
    if (window.vscodeLayout) {
      const breadcrumbData = [];
      
      if (this.currentProject) {
        breadcrumbData.push({
          id: this.currentProject.id,
          name: this.currentProject.name,
          icon: '📁'
        });
      }
      
      if (this.currentDiagram) {
        breadcrumbData.push({
          id: this.currentDiagram.id || this.currentDiagram.diagramId,
          name: this.currentDiagram.name,
          icon: '📄'
        });
      }
      
      window.vscodeLayout.updateBreadcrumb(breadcrumbData);
    }
    
    this.emit('breadcrumbUpdated', { project: this.currentProject, diagram: this.currentDiagram });
  }

  /**
   * 에디터 헤더 표시
   */
  showEditorHeader() {
    console.log('🎯 showEditorHeader called', {
      hasVscodeLayout: !!window.vscodeLayout,
      hasShowMethod: !!(window.vscodeLayout && window.vscodeLayout.showEditorHeader)
    });
    
    if (window.vscodeLayout) {
      window.vscodeLayout.showEditorHeader();
      console.log('✅ Editor header show command sent');
      this.emit('editorHeaderShown');
    } else {
      console.warn('❌ window.vscodeLayout not available');
    }
  }

  /**
   * 에디터 헤더 숨김
   */
  hideEditorHeader() {
    if (window.vscodeLayout) {
      window.vscodeLayout.hideEditorHeader();
      this.emit('editorHeaderHidden');
    }
  }

  /**
   * 협업 정보 업데이트 설정
   */
  updateCollaborationInfo(collaborationHandler) {
    if (collaborationHandler && window.vscodeLayout) {
      // 협업 상태 이벤트 리스너 설정
      collaborationHandler.on('awarenessChange', () => {
        this.updateConnectedUsersInHeader(collaborationHandler);
      });
      
      collaborationHandler.on('connectionChange', () => {
        this.updateConnectedUsersInHeader(collaborationHandler);
      });
      
      // 초기 접속자 정보 업데이트
      this.updateConnectedUsersInHeader(collaborationHandler);
    }
  }

  /**
   * 헤더의 접속자 정보 업데이트
   */
  updateConnectedUsersInHeader(collaborationHandler) {
    if (!collaborationHandler || !window.vscodeLayout) {
      return;
    }

    try {
      const connectedUsers = collaborationHandler.getConnectedUsers();
      window.vscodeLayout.updateConnectedUsers(connectedUsers);
      this.emit('connectedUsersUpdated', connectedUsers);
    } catch (error) {
      console.warn('Failed to update connected users in header:', error);
      this.emit('error', error);
    }
  }

  /**
   * 에디터 제목 업데이트
   */
  updateEditorTitle() {
    this.updateBreadcrumb();
    
    // 탭 제목도 업데이트
    if (this.currentDiagram) {
      document.title = `${this.currentDiagram.name} - BPMN 협업 에디터`;
    } else {
      document.title = 'BPMN 협업 에디터';
    }
    
    this.emit('titleUpdated', this.currentDiagram);
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 저장 버튼
    $(document).on('click', '#save-diagram', () => {
      this.emit('saveRequested');
    });

    // 내보내기 버튼들
    $(document).on('click', '.btn[href]', function(e) {
      if (!$(this).hasClass('active')) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
    // 키보드 단축키
    $(document).on('keydown', (event) => {
      this.handleKeyboardShortcuts(event);
    });
  }

  /**
   * 키보드 단축키 처리
   */
  handleKeyboardShortcuts(event) {
    // Ctrl+S: 저장
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      this.emit('saveRequested');
    }
    
    // Ctrl+E: 내보내기
    if (event.ctrlKey && event.key === 'e') {
      event.preventDefault();
      this.emit('exportRequested');
    }
    
    // Ctrl+N: 새 다이어그램
    if (event.ctrlKey && event.key === 'n') {
      event.preventDefault();
      this.emit('newDiagramRequested');
    }
    
    // Ctrl+O: 다이어그램 열기
    if (event.ctrlKey && event.key === 'o') {
      event.preventDefault();
      this.emit('openDiagramRequested');
    }
  }

  /**
   * 파일 작업 처리
   */
  handleFileOperations() {
    // 드래그앤드롭 파일 처리는 에디터 코어에서 처리됨
    // 여기서는 UI 관련 파일 작업만 처리
    
    // 파일 선택 대화상자
    $('#open-file-button').on('click', () => {
      this.showFileOpenDialog();
    });
    
    // 최근 파일 목록
    this.updateRecentFilesList();
  }

  /**
   * 파일 열기 대화상자 표시
   */
  showFileOpenDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bpmn,.xml';
    input.style.display = 'none';
    
    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        this.loadFileFromInput(file);
      }
      document.body.removeChild(input);
    });
    
    document.body.appendChild(input);
    input.click();
  }

  /**
   * 입력에서 파일 로드
   */
  loadFileFromInput(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const xml = e.target.result;
      if (this.editorCore.isValidBpmnXml(xml)) {
        this.emit('fileLoadRequested', {
          id: 'imported',
          name: file.name.replace(/\.[^/.]+$/, ''), // 확장자 제거
          content: xml
        });
      } else {
        if (window.appManager) {
          window.appManager.showNotification('유효하지 않은 BPMN 파일입니다.', 'error');
        }
      }
    };
    reader.readAsText(file);
  }

  /**
   * 최근 파일 목록 업데이트
   */
  updateRecentFilesList() {
    try {
      const recentFiles = this.getRecentFiles();
      const recentFilesContainer = $('#recent-files-list');
      
      if (recentFilesContainer.length > 0) {
        recentFilesContainer.empty();
        
        recentFiles.forEach(file => {
          const fileItem = $(`
            <div class="recent-file-item" data-file-id="${file.id}">
              <span class="file-icon">📄</span>
              <span class="file-name">${file.name}</span>
              <span class="file-date">${this.formatDate(file.lastOpened)}</span>
            </div>
          `);
          
          fileItem.on('click', () => {
            this.emit('recentFileSelected', file);
          });
          
          recentFilesContainer.append(fileItem);
        });
      }
    } catch (error) {
      console.warn('Failed to update recent files list:', error);
    }
  }

  /**
   * 최근 파일 목록 가져오기
   */
  getRecentFiles() {
    try {
      const stored = localStorage.getItem('bpmn-recent-files');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load recent files:', error);
    }
    return [];
  }

  /**
   * 최근 파일에 추가
   */
  addToRecentFiles(diagram) {
    try {
      let recentFiles = this.getRecentFiles();
      
      // 기존 항목 제거 (중복 방지)
      recentFiles = recentFiles.filter(file => file.id !== diagram.id);
      
      // 새 항목 추가 (맨 앞에)
      recentFiles.unshift({
        id: diagram.id,
        name: diagram.name,
        lastOpened: new Date().toISOString()
      });
      
      // 최대 10개만 유지
      recentFiles = recentFiles.slice(0, 10);
      
      localStorage.setItem('bpmn-recent-files', JSON.stringify(recentFiles));
      this.updateRecentFilesList();
      
      this.emit('recentFilesUpdated', recentFiles);
    } catch (error) {
      console.warn('Failed to add to recent files:', error);
    }
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return '오늘';
      } else if (diffDays === 1) {
        return '어제';
      } else if (diffDays < 7) {
        return `${diffDays}일 전`;
      } else {
        return date.toLocaleDateString('ko-KR');
      }
    } catch (error) {
      return '알 수 없음';
    }
  }

  /**
   * 알림 표시
   */
  showNotification(message, type = 'info') {
    if (window.appManager) {
      window.appManager.showNotification(message, type);
    } else {
      // Fallback 알림
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
    
    this.emit('notificationShown', { message, type });
  }

  /**
   * 로딩 상태 표시
   */
  showLoadingState(message = '로딩 중...') {
    const loadingOverlay = $('#loading-overlay');
    if (loadingOverlay.length === 0) {
      $('body').append(`
        <div id="loading-overlay" style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        ">
          <div style="
            background: white;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
          ">
            <div class="loading-spinner" style="
              width: 20px;
              height: 20px;
              border: 2px solid #f3f3f3;
              border-top: 2px solid #3498db;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            "></div>
            <span id="loading-message">${message}</span>
          </div>
        </div>
      `);
      
      // CSS 애니메이션 추가
      if (!$('#loading-animation-style').length) {
        $('head').append(`
          <style id="loading-animation-style">
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `);
      }
    } else {
      $('#loading-message').text(message);
      loadingOverlay.show();
    }
    
    this.emit('loadingShown', message);
  }

  /**
   * 로딩 상태 숨김
   */
  hideLoadingState() {
    $('#loading-overlay').fadeOut(300);
    this.emit('loadingHidden');
  }

  /**
   * UI 상태 정보 반환
   */
  getUIState() {
    return {
      currentProject: this.currentProject,
      currentDiagram: this.currentDiagram,
      currentUser: this.currentUser,
      isEditorHeaderVisible: window.vscodeLayout && window.vscodeLayout.isEditorHeaderVisible,
      recentFilesCount: this.getRecentFiles().length
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 이벤트 리스너 해제
    $(document).off('click', '#save-diagram');
    $(document).off('click', '.btn[href]');
    $(document).off('keydown');
    $(document).off('click', '#open-file-button');
    
    // 로딩 오버레이 제거
    $('#loading-overlay').remove();
    $('#loading-animation-style').remove();
    
    // 에디터 이벤트 리스너 해제
    this.editorCore.removeAllListeners('diagramLoaded');
    this.editorCore.removeAllListeners('diagramClosed');
    this.editorCore.removeAllListeners('newDiagramCreated');
    
    this.removeAllListeners();
    
    this.currentDiagram = null;
    this.currentProject = null;
    this.currentUser = null;
    
    console.log('🗑️ BpmnUIIntegration destroyed');
  }
}