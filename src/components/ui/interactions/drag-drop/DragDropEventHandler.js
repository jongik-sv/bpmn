/**
 * Drag Drop Event Handler - 드래그 앤 드롭 이벤트 처리
 * DOM 이벤트를 관리하고 시각적 피드백을 제공
 */

class DragDropEventHandler {
    constructor(core) {
        this.core = core;
        this.draggedElements = new Set();
        this.dropTargets = new Set();
        this.expandTimeouts = new Map();
        
        this.init();
    }

    init() {
        // 전역 이벤트 리스너 설정
        this.setupGlobalEventListeners();
    }

    setupGlobalEventListeners() {
        // 드래그 종료 시 전역 정리
        document.addEventListener('dragend', (event) => {
            this.cleanupDragStates();
        });

        // 드롭 영역 외부에서 드롭 시 정리
        document.addEventListener('drop', (event) => {
            // 등록된 드롭 타겟이 아닌 경우 기본 동작 방지
            if (!this.isRegisteredDropTarget(event.target)) {
                event.preventDefault();
            }
        });

        // 드래그 오버 시 기본 동작 방지 (필요한 경우만)
        document.addEventListener('dragover', (event) => {
            if (this.shouldPreventDefault(event)) {
                event.preventDefault();
            }
        });
    }

    /**
     * 트리 아이템에 드래그 앤 드롭 이벤트 설정
     */
    setupTreeItemDragDrop(treeItem, element) {
        // 드래그 가능하도록 설정
        element.draggable = true;
        
        // 드래그 이벤트
        element.addEventListener('dragstart', (event) => {
            this.handleDragStart(event, treeItem, element);
        });

        element.addEventListener('dragend', (event) => {
            this.handleDragEnd(event, treeItem, element);
        });

        // 드롭 이벤트
        element.addEventListener('dragover', (event) => {
            this.handleDragOver(event, treeItem, element);
        });

        element.addEventListener('dragenter', (event) => {
            this.handleDragEnter(event, treeItem, element);
        });

        element.addEventListener('dragleave', (event) => {
            this.handleDragLeave(event, treeItem, element);
        });

        element.addEventListener('drop', (event) => {
            this.handleDrop(event, treeItem, element);
        });

        // 드롭 타겟으로 등록
        this.dropTargets.add(element);
    }

    /**
     * 드래그 시작 처리
     */
    handleDragStart(event, treeItem, element) {
        this.draggedElements.add(element);
        element.classList.add('dragging');

        // 드래그 이미지 설정
        const dragImage = this.core.createDragImage([treeItem]);
        event.dataTransfer.setDragImage(dragImage, 0, 0);

        // 드래그 데이터 처리
        this.core.handleDrag([treeItem], event.dataTransfer);

        // 이벤트 전파 방지
        event.stopPropagation();
    }

    /**
     * 드래그 종료 처리
     */
    handleDragEnd(event, treeItem, element) {
        this.draggedElements.delete(element);
        element.classList.remove('dragging');

        // 전역 드래그 상태 정리
        this.cleanupDragStates();

        event.stopPropagation();
    }

    /**
     * 드래그 오버 처리
     */
    handleDragOver(event, treeItem, element) {
        if (this.draggedElements.has(element)) return;

        const dropEffect = this.core.validateDrop(treeItem, event.dataTransfer);
        
        if (dropEffect !== 'none') {
            event.preventDefault();
            event.dataTransfer.dropEffect = dropEffect;
        }
    }

    /**
     * 드래그 진입 처리
     */
    handleDragEnter(event, treeItem, element) {
        if (this.draggedElements.has(element)) return;

        const dropEffect = this.core.validateDrop(treeItem, event.dataTransfer);
        
        if (dropEffect !== 'none') {
            element.classList.add('drag-over');
            
            // 폴더 자동 확장 처리
            if (treeItem.type === 'folder' && !treeItem.isExpanded) {
                this.scheduleAutoExpand(treeItem, element);
            }
        }
    }

    /**
     * 드래그 떠남 처리
     */
    handleDragLeave(event, treeItem, element) {
        // 실제로 요소를 떠났는지 확인
        const rect = element.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;
        
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            element.classList.remove('drag-over');
            this.cancelAutoExpand(treeItem);
        }
    }

    /**
     * 드롭 처리
     */
    async handleDrop(event, treeItem, element) {
        event.preventDefault();
        event.stopPropagation();

        element.classList.remove('drag-over');
        this.cancelAutoExpand(treeItem);

        // 드롭 처리
        try {
            const success = await this.core.handleDrop(treeItem, event.dataTransfer);
            
            if (success) {
                // 성공적인 드롭에 대한 시각적 피드백
                this.showDropFeedback(element, 'success');
            } else {
                this.showDropFeedback(element, 'error');
            }
        } catch (error) {
            console.error('Drop operation failed:', error);
            this.showDropFeedback(element, 'error');
        }
    }

    /**
     * 자동 확장 스케줄링
     */
    scheduleAutoExpand(treeItem, element) {
        // 기존 타임아웃 취소
        this.cancelAutoExpand(treeItem);
        
        // 새 타임아웃 설정
        const timeout = setTimeout(() => {
            if (element.classList.contains('drag-over')) {
                console.log('Auto-expanding folder:', treeItem.label);
                // 실제 확장 로직은 여기에 구현
                // 예: treeItem.expand();
            }
        }, 800);
        
        this.expandTimeouts.set(treeItem.id, timeout);
    }

    /**
     * 자동 확장 취소
     */
    cancelAutoExpand(treeItem) {
        const timeout = this.expandTimeouts.get(treeItem.id);
        if (timeout) {
            clearTimeout(timeout);
            this.expandTimeouts.delete(treeItem.id);
        }
    }

    /**
     * 드롭 피드백 표시
     */
    showDropFeedback(element, type) {
        const className = type === 'success' ? 'drop-success' : 'drop-error';
        element.classList.add(className);
        
        setTimeout(() => {
            element.classList.remove(className);
        }, 300);
    }

    /**
     * 드래그 상태 정리
     */
    cleanupDragStates() {
        // 모든 드래그 관련 CSS 클래스 제거
        const allItems = document.querySelectorAll('.tree-item');
        allItems.forEach(item => {
            item.classList.remove('dragging', 'drag-over', 'drag-target');
        });

        // 드래그 데이터 정리
        this.core.clearDragData();
        
        // 자동 확장 타임아웃 정리
        this.expandTimeouts.forEach(timeout => clearTimeout(timeout));
        this.expandTimeouts.clear();
    }

    /**
     * 등록된 드롭 타겟인지 확인
     */
    isRegisteredDropTarget(element) {
        return this.dropTargets.has(element) || 
               Array.from(this.dropTargets).some(target => target.contains(element));
    }

    /**
     * 기본 동작 방지 여부 결정
     */
    shouldPreventDefault(event) {
        // 등록된 드롭 영역이거나 파일 드래그인 경우 기본 동작 방지
        return this.isRegisteredDropTarget(event.target) || 
               event.dataTransfer.types.includes('Files');
    }

    /**
     * 트리 아이템 드래그 앤 드롭 제거
     */
    removeTreeItemDragDrop(element) {
        this.dropTargets.delete(element);
        this.draggedElements.delete(element);
        
        // 해당 요소의 모든 타임아웃 제거
        this.expandTimeouts.forEach((timeout, id) => {
            if (element.dataset.itemId === id) {
                clearTimeout(timeout);
                this.expandTimeouts.delete(id);
            }
        });
    }

    /**
     * 리소스 정리
     */
    dispose() {
        // 모든 타임아웃 정리
        this.expandTimeouts.forEach(timeout => clearTimeout(timeout));
        this.expandTimeouts.clear();
        
        // 컬렉션 정리
        this.draggedElements.clear();
        this.dropTargets.clear();
        
        // 전역 이벤트 리스너 제거 (필요한 경우)
        // document.removeEventListener('dragend', ...);
    }
}

export { DragDropEventHandler };