import { EventEmitter } from 'events';

/**
 * VS Code 레이아웃의 이벤트 처리 클래스
 * 키보드 단축키, 글로벌 이벤트, 접근성 기능을 관리
 */
export class VSCodeEventHandler extends EventEmitter {
  constructor(layoutManager) {
    super();
    
    this.layoutManager = layoutManager;
    this.shortcuts = new Map();
    this.isInitialized = false;
    
    // 기본 단축키 설정
    this.setupDefaultShortcuts();
  }

  /**
   * 이벤트 핸들러 초기화
   */
  initialize() {
    if (this.isInitialized) return;

    this.setupGlobalEventListeners();
    this.setupViewShortcuts();
    this.setupAccessibility();
    this.isInitialized = true;
    
    this.emit('initialized');
  }

  /**
   * 기본 단축키 설정
   */
  setupDefaultShortcuts() {
    // 뷰 전환 단축키
    this.registerShortcut('Ctrl+Shift+E', () => {
      this.emit('viewChangeRequested', 'explorer');
    });
    
    this.registerShortcut('Ctrl+Shift+F', () => {
      this.emit('viewChangeRequested', 'search');
    });
    
    this.registerShortcut('Ctrl+Shift+G', () => {
      this.emit('viewChangeRequested', 'source-control');
    });
    
    this.registerShortcut('Ctrl+Shift+D', () => {
      this.emit('viewChangeRequested', 'run-debug');
    });
    
    this.registerShortcut('Ctrl+Shift+X', () => {
      this.emit('viewChangeRequested', 'extensions');
    });

    // 사이드바 토글
    this.registerShortcut('Ctrl+b', () => {
      this.emit('sidebarToggleRequested');
    });

    // 포커스 관리
    this.registerShortcut('Alt+1', () => {
      this.emit('focusRequested', 'activityBar');
    });
    
    this.registerShortcut('Alt+2', () => {
      this.emit('focusRequested', 'sidebar');
    });
    
    this.registerShortcut('Alt+3', () => {
      this.emit('focusRequested', 'editor');
    });

    // 파일 작업
    this.registerShortcut('Ctrl+n', () => {
      this.emit('fileOperationRequested', 'newFile');
    });
    
    this.registerShortcut('Ctrl+Shift+n', () => {
      this.emit('fileOperationRequested', 'newFolder');
    });
    
    this.registerShortcut('Ctrl+o', () => {
      this.emit('fileOperationRequested', 'openFile');
    });
    
    this.registerShortcut('Ctrl+s', () => {
      this.emit('fileOperationRequested', 'saveFile');
    });
  }

  /**
   * 글로벌 이벤트 리스너 설정
   */
  setupGlobalEventListeners() {
    // 키보드 이벤트
    document.addEventListener('keydown', (event) => {
      this.handleGlobalKeydown(event);
    });

    // 윈도우 리사이즈
    window.addEventListener('resize', () => {
      this.handleWindowResize();
    });

    // 포커스 관리
    document.addEventListener('focusin', (event) => {
      this.handleFocusChange(event);
    });
  }

  /**
   * 뷰 전환 단축키 설정
   */
  setupViewShortcuts() {
    const viewShortcuts = {
      'Ctrl+Shift+E': 'explorer',
      'Ctrl+Shift+F': 'search',
      'Ctrl+Shift+G': 'source-control',
      'Ctrl+Shift+D': 'run-debug',
      'Ctrl+Shift+X': 'extensions'
    };

    for (const [shortcut, viewId] of Object.entries(viewShortcuts)) {
      this.registerShortcut(shortcut, () => {
        this.emit('viewChangeRequested', viewId);
      });
    }
  }

  /**
   * 접근성 기능 설정
   */
  setupAccessibility() {
    const container = this.layoutManager.getContainer();
    
    // ARIA 랜드마크 설정
    const activityBar = container.querySelector('.activity-bar-container');
    const sidebar = container.querySelector('.sidebar-container');
    const editor = container.querySelector('.editor-container');
    
    if (activityBar) {
      activityBar.setAttribute('role', 'navigation');
      activityBar.setAttribute('aria-label', '기본 네비게이션');
    }
    
    if (sidebar) {
      sidebar.setAttribute('role', 'complementary');
      sidebar.setAttribute('aria-label', '사이드바');
    }
    
    if (editor) {
      editor.setAttribute('role', 'main');
      editor.setAttribute('aria-label', '에디터');
    }

    // 키보드 네비게이션 설정
    this.setupKeyboardNavigation();
  }

  /**
   * 키보드 네비게이션 설정
   */
  setupKeyboardNavigation() {
    const container = this.layoutManager.getContainer();
    
    // 트리 뷰 키보드 네비게이션
    const treeView = container.querySelector('.tree-view');
    if (treeView) {
      this.setupTreeNavigation(treeView);
    }
  }

  /**
   * 트리 뷰 키보드 네비게이션 설정
   */
  setupTreeNavigation(treeElement) {
    treeElement.addEventListener('keydown', (event) => {
      const focusedItem = document.activeElement;
      if (!focusedItem || !focusedItem.closest('.tree-item')) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.focusNextTreeItem(focusedItem);
          break;
        
        case 'ArrowUp':
          event.preventDefault();
          this.focusPreviousTreeItem(focusedItem);
          break;
        
        case 'ArrowRight':
          event.preventDefault();
          this.expandTreeItem(focusedItem);
          break;
        
        case 'ArrowLeft':
          event.preventDefault();
          this.collapseTreeItem(focusedItem);
          break;
        
        case 'Enter':
        case ' ':
          event.preventDefault();
          this.activateTreeItem(focusedItem);
          break;
      }
    });
  }

  /**
   * 글로벌 키다운 이벤트 처리
   */
  handleGlobalKeydown(event) {
    const shortcutKey = this.getShortcutKey(event);
    const handler = this.shortcuts.get(shortcutKey);
    
    if (handler) {
      event.preventDefault();
      handler();
      return;
    }

    // 기타 글로벌 키보드 이벤트 처리
    this.handleSpecialKeys(event);
  }

  /**
   * 특수 키 처리
   */
  handleSpecialKeys(event) {
    // ESC 키로 포커스 리셋
    if (event.key === 'Escape') {
      this.emit('focusRequested', 'reset');
    }

    // F1 키로 명령 팔레트 (향후 구현)
    if (event.key === 'F1') {
      event.preventDefault();
      this.emit('commandPaletteRequested');
    }

    // Ctrl+Shift+P 명령 팔레트
    if (event.ctrlKey && event.shiftKey && event.key === 'P') {
      event.preventDefault();
      this.emit('commandPaletteRequested');
    }
  }

  /**
   * 윈도우 리사이즈 처리
   */
  handleWindowResize() {
    this.layoutManager.handleWindowResize();
    this.emit('windowResized');
  }

  /**
   * 포커스 변경 처리
   */
  handleFocusChange(event) {
    const target = event.target;
    const container = this.layoutManager.getContainer();
    
    // 포커스된 영역 감지
    let focusedArea = 'unknown';
    
    if (container.querySelector('.activity-bar-container').contains(target)) {
      focusedArea = 'activityBar';
    } else if (container.querySelector('.sidebar-container').contains(target)) {
      focusedArea = 'sidebar';
    } else if (container.querySelector('.editor-container').contains(target)) {
      focusedArea = 'editor';
    }
    
    this.emit('focusChanged', { target, area: focusedArea });
  }

  /**
   * 단축키 등록
   */
  registerShortcut(key, callback) {
    this.shortcuts.set(key, callback);
    this.emit('shortcutRegistered', key);
  }

  /**
   * 단축키 해제
   */
  unregisterShortcut(key) {
    const removed = this.shortcuts.delete(key);
    if (removed) {
      this.emit('shortcutUnregistered', key);
    }
    return removed;
  }

  /**
   * 단축키 문자열 생성
   */
  getShortcutKey(event) {
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
    if (event.shiftKey) parts.push('Shift');
    if (event.altKey) parts.push('Alt');
    
    // 특수 키 처리
    let key = event.key;
    if (key === ' ') key = 'Space';
    
    parts.push(key);
    return parts.join('+');
  }

  /**
   * 트리 아이템 네비게이션 헬퍼 메서드들
   */
  focusNextTreeItem(currentItem) {
    const treeItems = this.getVisibleTreeItems();
    const currentIndex = treeItems.indexOf(currentItem);
    const nextItem = treeItems[currentIndex + 1];
    
    if (nextItem) {
      nextItem.focus();
      this.emit('treeItemFocused', nextItem);
    }
  }

  focusPreviousTreeItem(currentItem) {
    const treeItems = this.getVisibleTreeItems();
    const currentIndex = treeItems.indexOf(currentItem);
    const previousItem = treeItems[currentIndex - 1];
    
    if (previousItem) {
      previousItem.focus();
      this.emit('treeItemFocused', previousItem);
    }
  }

  expandTreeItem(item) {
    const treeItem = item.closest('.tree-item');
    if (treeItem && treeItem.classList.contains('collapsible')) {
      treeItem.classList.add('expanded');
      this.emit('treeItemExpanded', treeItem);
    }
  }

  collapseTreeItem(item) {
    const treeItem = item.closest('.tree-item');
    if (treeItem && treeItem.classList.contains('expanded')) {
      treeItem.classList.remove('expanded');
      this.emit('treeItemCollapsed', treeItem);
    }
  }

  activateTreeItem(item) {
    item.click();
    this.emit('treeItemActivated', item);
  }

  getVisibleTreeItems() {
    const container = this.layoutManager.getContainer();
    return Array.from(container.querySelectorAll('.tree-item:not([style*="display: none"])'));
  }

  /**
   * 접근성 알림
   */
  announce(message) {
    this.emit('accessibilityAnnouncement', message);
  }

  /**
   * 포커스 관리 메서드들
   */
  focusActivityBar() {
    const container = this.layoutManager.getContainer();
    const activeItem = container.querySelector('.activity-bar-item.active');
    if (activeItem) {
      activeItem.focus();
      this.announce('액티비티 바에 포커스되었습니다');
      return true;
    }
    return false;
  }

  focusSidebar() {
    const currentView = this.layoutManager.getCurrentView();
    if (currentView === 'explorer') {
      return this.focusExplorer();
    } else {
      const container = this.layoutManager.getContainer();
      const currentViewContainer = container.querySelector(`[data-view="${currentView}"]`);
      if (currentViewContainer) {
        currentViewContainer.focus();
        this.announce(`${currentView} 뷰에 포커스되었습니다`);
        return true;
      }
    }
    return false;
  }

  focusExplorer() {
    const container = this.layoutManager.getContainer();
    const treeView = container.querySelector('.tree-view');
    if (treeView) {
      const firstItem = treeView.querySelector('.tree-item');
      if (firstItem) {
        firstItem.focus();
      } else {
        treeView.focus();
      }
      this.announce('탐색기에 포커스되었습니다');
      return true;
    }
    return false;
  }

  focusEditor() {
    const editorContent = this.layoutManager.getEditorContent();
    if (editorContent) {
      // 에디터 내 포커스 가능한 요소 찾기
      const focusable = editorContent.querySelector('[tabindex="0"], button, input, textarea, select');
      if (focusable) {
        focusable.focus();
      } else {
        editorContent.focus();
      }
      this.announce('에디터에 포커스되었습니다');
      return true;
    }
    return false;
  }

  /**
   * 이벤트 핸들러 상태 반환
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      shortcutsCount: this.shortcuts.size,
      currentView: this.layoutManager.getCurrentView()
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 이벤트 리스너 정리
    document.removeEventListener('keydown', this.handleGlobalKeydown);
    window.removeEventListener('resize', this.handleWindowResize);
    document.removeEventListener('focusin', this.handleFocusChange);
    
    // 등록된 단축키 정리
    this.shortcuts.clear();
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    this.isInitialized = false;
    this.layoutManager = null;
    
    console.log('🗑️ VSCodeEventHandler destroyed');
  }
}