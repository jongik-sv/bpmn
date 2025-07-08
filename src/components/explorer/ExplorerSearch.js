import { EventEmitter } from 'events';

/**
 * Explorer 검색 및 필터링 전담 클래스
 * 파일명 검색, 내용 검색, 전역 검색 기능 관리
 */
export class ExplorerSearch extends EventEmitter {
  constructor(explorerCore, dataProvider) {
    super();
    
    this.explorerCore = explorerCore;
    this.dataProvider = dataProvider;
    this.container = explorerCore.getContainer();
    
    // 검색 상태
    this.searchTerm = '';
    this.filterMode = false;
    this.isGlobalSearch = false;
    this.searchResults = [];
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.setupSearchUI();
    this.attachSearchEventListeners();
  }

  /**
   * 검색 UI 설정
   */
  setupSearchUI() {
    const searchContainer = this.container.querySelector('.explorer-search');
    const searchInput = this.container.querySelector('.search-input');
    const searchClear = this.container.querySelector('.search-clear');
    
    if (searchInput) {
      // 초기 상태에서는 검색 숨김
      if (searchContainer) {
        searchContainer.style.display = 'none';
      }
    }
    
    this.emit('searchUISetup');
  }

  /**
   * 검색 이벤트 리스너 연결
   */
  attachSearchEventListeners() {
    const searchInput = this.container.querySelector('.search-input');
    const searchClear = this.container.querySelector('.search-clear');
    
    if (searchInput) {
      // 검색어 입력
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value;
        if (this.isGlobalSearch) {
          this.performGlobalSearch(this.searchTerm);
        } else {
          this.performSearch(this.searchTerm);
        }
      });

      // 키보드 이벤트
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.clearSearch();
        } else if (e.key === 'Enter') {
          this.performSearch(this.searchTerm);
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        this.clearSearch();
      });
    }
    
    this.emit('searchEventListenersAttached');
  }

  /**
   * 검색 토글
   */
  toggleSearch() {
    const searchContainer = this.container.querySelector('.explorer-search');
    const searchInput = this.container.querySelector('.search-input');
    
    if (!searchContainer || !searchInput) {
      console.warn('Search UI elements not found');
      return;
    }
    
    if (searchContainer.style.display === 'none') {
      searchContainer.style.display = 'block';
      searchInput.focus();
      this.isGlobalSearch = false;
      this.emit('searchShown');
    } else {
      searchContainer.style.display = 'none';
      this.clearSearch();
      this.emit('searchHidden');
    }
  }

  /**
   * 전역 검색 토글
   */
  toggleGlobalSearch() {
    console.log('🔍 Toggling global search (Ctrl+Shift+F)');
    
    const searchContainer = this.container.querySelector('.explorer-search');
    const searchInput = this.container.querySelector('.search-input');
    
    if (!searchContainer || !searchInput) {
      console.warn('Search UI elements not found');
      return;
    }
    
    // 검색 UI 표시
    if (searchContainer.style.display === 'none') {
      searchContainer.style.display = 'block';
    }
    
    // 전역 검색 모드 활성화
    this.isGlobalSearch = true;
    
    // 포커스 및 선택
    searchInput.focus();
    searchInput.select();
    
    // 힌트 표시
    this.showGlobalSearchHint();
    
    this.emit('globalSearchActivated');
  }

  /**
   * 전역 검색 힌트 표시
   */
  showGlobalSearchHint() {
    const searchInput = this.container.querySelector('.search-input');
    if (!searchInput) return;
    
    const originalPlaceholder = searchInput.placeholder;
    searchInput.placeholder = '전체 검색 (Ctrl+Shift+F) - 파일명과 내용 검색...';
    
    // 3초 후 원래 플레이스홀더로 복원
    setTimeout(() => {
      if (searchInput) {
        searchInput.placeholder = originalPlaceholder;
      }
    }, 3000);
  }

  /**
   * 기본 검색 수행
   */
  performSearch(searchTerm = this.searchTerm) {
    if (!searchTerm || !searchTerm.trim()) {
      this.clearSearch();
      return;
    }
    
    this.searchTerm = searchTerm.trim();
    this.filterMode = true;
    this.isGlobalSearch = false;
    
    console.log('🔍 Performing basic search for:', this.searchTerm);
    
    try {
      // 매칭되는 노드 찾기
      const matches = this.dataProvider.filterNodes(item => 
        item.label.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
      
      this.searchResults = matches;
      
      // 매칭된 항목들의 부모 폴더들 확장
      matches.forEach(item => {
        let parent = item.parent;
        while (parent) {
          this.dataProvider.expandNode(parent);
          parent = parent.parent;
        }
      });
      
      // 트리 새로고침
      this.explorerCore.refreshTree();
      
      console.log(`🔍 Basic search found ${matches.length} results`);
      this.emit('searchCompleted', { 
        searchTerm: this.searchTerm, 
        results: matches, 
        isGlobal: false 
      });
      
    } catch (error) {
      console.error('❌ Error performing basic search:', error);
      this.emit('searchError', error);
    }
  }

  /**
   * 전역 검색 수행
   */
  performGlobalSearch(searchTerm) {
    console.log('🔍 Performing global search for:', searchTerm);
    
    if (!searchTerm || searchTerm.trim() === '') {
      this.clearSearch();
      return;
    }

    const trimmedTerm = searchTerm.trim().toLowerCase();
    this.searchTerm = trimmedTerm;
    this.filterMode = true;
    this.isGlobalSearch = true;
    
    try {
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        console.log('❌ No project data available for search');
        return;
      }

      const { folders, diagrams } = appManager.currentProject;
      const results = [];

      // 폴더명에서 검색
      folders.forEach(folder => {
        if (folder.name.toLowerCase().includes(trimmedTerm)) {
          results.push({
            type: 'folder',
            item: folder,
            matchType: 'name'
          });
        }
      });

      // 다이어그램명과 내용에서 검색
      diagrams.forEach(diagram => {
        const nameMatch = diagram.name.toLowerCase().includes(trimmedTerm);
        const contentMatch = diagram.bpmn_xml && 
                           diagram.bpmn_xml.toLowerCase().includes(trimmedTerm);

        if (nameMatch || contentMatch) {
          results.push({
            type: 'diagram',
            item: diagram,
            matchType: nameMatch ? 'name' : 'content'
          });
        }
      });

      this.searchResults = results;
      console.log(`🔍 Global search found ${results.length} results`);
      
      if (results.length === 0) {
        console.log('📝 No search results found');
        // 기본 검색으로 폴백
        this.performSearch(searchTerm);
        return;
      }

      // 검색 결과가 포함된 폴더들 확장
      this.expandSearchResultFolders(results, folders);
      
      // 기본 검색도 수행하여 하이라이팅 적용
      this.performSearch(searchTerm);
      
      this.emit('globalSearchCompleted', { 
        searchTerm: trimmedTerm, 
        results: results, 
        isGlobal: true 
      });

    } catch (error) {
      console.error('❌ Error performing global search:', error);
      // 에러 시 기본 검색으로 폴백
      this.performSearch(searchTerm);
      this.emit('searchError', error);
    }
  }

  /**
   * 검색 결과가 포함된 폴더들 확장
   */
  expandSearchResultFolders(results, folders) {
    results.forEach(result => {
      const item = result.item;
      
      if (result.type === 'folder') {
        // 폴더 자체를 확장
        const treeNode = this.dataProvider.findNodeById(item.id);
        if (treeNode) {
          this.dataProvider.expandNode(treeNode);
        }
      } else if (result.type === 'diagram') {
        // 다이어그램의 부모 폴더 확장
        if (item.folder_id) {
          const parentFolder = folders.find(f => f.id === item.folder_id);
          if (parentFolder) {
            const treeNode = this.dataProvider.findNodeById(parentFolder.id);
            if (treeNode) {
              this.dataProvider.expandNode(treeNode);
            }
          }
        }
      }
    });
  }

  /**
   * 검색 지우기
   */
  clearSearch() {
    const searchInput = this.container.querySelector('.search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    this.searchTerm = '';
    this.filterMode = false;
    this.isGlobalSearch = false;
    this.searchResults = [];
    
    // 트리 새로고침
    this.explorerCore.refreshTree();
    
    this.emit('searchCleared');
  }

  /**
   * 검색어 하이라이팅
   */
  highlightSearchTerm(text) {
    if (!this.searchTerm || !this.filterMode) {
      return text;
    }
    
    const regex = new RegExp(`(${this.escapeRegExp(this.searchTerm)})`, 'gi');
    return text.replace(regex, '<mark style="background-color: #ffd700; color: #000;">$1</mark>');
  }

  /**
   * 정규표현식 이스케이프
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 검색 결과 필터링
   */
  filterSearchResults(items) {
    if (!this.filterMode || !this.searchTerm) {
      return items;
    }
    
    return items.filter(item => 
      item.label.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  /**
   * 다음 검색 결과로 이동
   */
  goToNextResult() {
    if (this.searchResults.length === 0) return;
    
    const currentItem = this.explorerCore.getFocusedItem();
    const currentIndex = this.searchResults.findIndex(item => item.id === currentItem?.id);
    
    const nextIndex = (currentIndex + 1) % this.searchResults.length;
    const nextItem = this.searchResults[nextIndex];
    
    if (nextItem) {
      this.explorerCore.setFocusedItem(nextItem);
      this.explorerCore.selectItem(nextItem, false);
      this.emit('searchResultNavigated', { direction: 'next', item: nextItem });
    }
  }

  /**
   * 이전 검색 결과로 이동
   */
  goToPreviousResult() {
    if (this.searchResults.length === 0) return;
    
    const currentItem = this.explorerCore.getFocusedItem();
    const currentIndex = this.searchResults.findIndex(item => item.id === currentItem?.id);
    
    const prevIndex = currentIndex <= 0 ? this.searchResults.length - 1 : currentIndex - 1;
    const prevItem = this.searchResults[prevIndex];
    
    if (prevItem) {
      this.explorerCore.setFocusedItem(prevItem);
      this.explorerCore.selectItem(prevItem, false);
      this.emit('searchResultNavigated', { direction: 'previous', item: prevItem });
    }
  }

  /**
   * 검색 결과 카운트 반환
   */
  getSearchResultsCount() {
    return {
      total: this.searchResults.length,
      current: this.getCurrentResultIndex() + 1
    };
  }

  /**
   * 현재 검색 결과 인덱스 반환
   */
  getCurrentResultIndex() {
    if (this.searchResults.length === 0) return -1;
    
    const currentItem = this.explorerCore.getFocusedItem();
    return this.searchResults.findIndex(item => item.id === currentItem?.id);
  }

  /**
   * 검색 모드인지 확인
   */
  isSearchMode() {
    return this.filterMode;
  }

  /**
   * 전역 검색 모드인지 확인
   */
  isGlobalSearchMode() {
    return this.isGlobalSearch;
  }

  /**
   * 현재 검색어 반환
   */
  getCurrentSearchTerm() {
    return this.searchTerm;
  }

  /**
   * 검색 결과 반환
   */
  getSearchResults() {
    return [...this.searchResults];
  }

  /**
   * 검색 상태 정보 반환
   */
  getSearchStatus() {
    return {
      isActive: this.filterMode,
      isGlobal: this.isGlobalSearch,
      searchTerm: this.searchTerm,
      resultsCount: this.searchResults.length,
      currentResultIndex: this.getCurrentResultIndex()
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 검색 상태 초기화
    this.searchTerm = '';
    this.filterMode = false;
    this.isGlobalSearch = false;
    this.searchResults = [];
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    // 참조 정리
    this.explorerCore = null;
    this.dataProvider = null;
    this.container = null;
    
    console.log('🗑️ ExplorerSearch destroyed');
  }
}