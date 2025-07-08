/**
 * Drag Drop Controller - 모듈형 리팩토링 버전
 * 드래그 앤 드롭 핵심 기능과 이벤트 처리를 분리하여 완전한 드래그 앤 드롭 기능 제공
 */

import { DragDropCore } from './DragDropCore.js';
import { DragDropEventHandler } from './DragDropEventHandler.js';

class DragDropController {
    constructor() {
        // 핵심 모듈들 초기화
        this.core = new DragDropCore();
        this.eventHandler = new DragDropEventHandler(this.core);
        
        // 레거시 호환성을 위한 상태들
        this.onDidChangeTreeData = null;
        this.dropMimeTypes = ['application/vnd.code.tree.explorer'];
        this.dragMimeTypes = ['text/uri-list', 'application/vnd.code.tree.explorer'];
        
        this.init();
    }

    init() {
        try {
            // 모듈 간 이벤트 연결 설정
            this.setupModuleIntegration();
            
            console.log('✅ DragDropController initialized with modular architecture');
            
        } catch (error) {
            console.error('❌ DragDropController initialization failed:', error);
            throw error;
        }
    }

    /**
     * 모듈 간 통합 설정
     */
    setupModuleIntegration() {
        // 코어 → 외부 콜백 연결
        this.core.setOnDidChangeTreeData((element) => {
            if (this.onDidChangeTreeData) {
                this.onDidChangeTreeData(element);
            }
        });
    }

    // =============== 공개 API (하위 호환성 유지) ===============

    /**
     * 드래그 처리
     */
    handleDrag(source, dataTransfer) {
        return this.core.handleDrag(source, dataTransfer);
    }

    /**
     * 드롭 처리
     */
    async handleDrop(target, dataTransfer) {
        return this.core.handleDrop(target, dataTransfer);
    }

    /**
     * 드롭 검증
     */
    validateDrop(target, dataTransfer) {
        return this.core.validateDrop(target, dataTransfer);
    }

    /**
     * 드래그 이미지 생성
     */
    createDragImage(dragItems) {
        return this.core.createDragImage(dragItems);
    }

    /**
     * 트리 아이템에 드래그 앤 드롭 설정
     */
    setupTreeItemDragDrop(treeItem, element) {
        return this.eventHandler.setupTreeItemDragDrop(treeItem, element);
    }

    /**
     * 트리 아이템 드래그 앤 드롭 제거
     */
    removeTreeItemDragDrop(element) {
        return this.eventHandler.removeTreeItemDragDrop(element);
    }

    /**
     * 트리 변경 이벤트 핸들러 설정
     */
    setOnDidChangeTreeData(callback) {
        this.onDidChangeTreeData = callback;
    }

    /**
     * 현재 드래그 데이터 반환
     */
    getCurrentDragData() {
        return this.core.getCurrentDragData();
    }

    /**
     * 드래그 데이터 지우기
     */
    clearDragData() {
        return this.core.clearDragData();
    }

    /**
     * 마임 타입 반환
     */
    getDropMimeTypes() {
        return this.core.getDropMimeTypes();
    }

    getDragMimeTypes() {
        return this.core.getDragMimeTypes();
    }

    // =============== 고급 기능 접근 ===============

    /**
     * 코어 모듈 반환
     */
    getCoreModule() {
        return this.core;
    }

    /**
     * 이벤트 핸들러 모듈 반환
     */
    getEventHandlerModule() {
        return this.eventHandler;
    }

    // =============== 상태 정보 ===============

    /**
     * 전체 상태 정보 반환
     */
    getStatus() {
        return {
            currentDragData: this.core.getCurrentDragData(),
            dropMimeTypes: this.core.getDropMimeTypes(),
            dragMimeTypes: this.core.getDragMimeTypes(),
            hasCallback: !!this.onDidChangeTreeData
        };
    }

    // =============== 레거시 호환성 메서드들 ===============

    /**
     * 내부 드롭 처리 (하위 호환성)
     */
    async handleInternalDrop(target, dragData) {
        return this.core.handleInternalDrop(target, dragData);
    }

    /**
     * 외부 드롭 처리 (하위 호환성)
     */
    async handleExternalDrop(target, dataTransfer) {
        return this.core.handleExternalDrop(target, dataTransfer);
    }

    /**
     * 파일 드롭 처리 (하위 호환성)
     */
    async handleFilesDrop(target, files) {
        return this.core.handleFilesDrop(target, files);
    }

    /**
     * URI 리스트 드롭 처리 (하위 호환성)
     */
    async handleUriListDrop(target, uriList) {
        return this.core.handleUriListDrop(target, uriList);
    }

    /**
     * 이동 작업 수행 (하위 호환성)
     */
    async performMoveOperation(target, dragItems) {
        return this.core.performMoveOperation(target, dragItems);
    }

    /**
     * 조상 또는 자기 자신 확인 (하위 호환성)
     */
    isAncestorOrSelf(target, dragItem) {
        return this.core.isAncestorOrSelf(target, dragItem);
    }

    /**
     * 드롭 파일 처리 (하위 호환성)
     */
    async processDroppedFile(target, file) {
        return this.core.processDroppedFile(target, file);
    }

    /**
     * 드롭 URI 처리 (하위 호환성)
     */
    async processDroppedUri(target, uri) {
        return this.core.processDroppedUri(target, uri);
    }

    /**
     * 리소스 정리
     */
    dispose() {
        console.log('🗑️ Destroying DragDropController with all modules...');
        
        // 모듈들 정리
        if (this.eventHandler) {
            this.eventHandler.dispose();
        }
        
        if (this.core) {
            this.core.dispose();
        }
        
        // 레거시 상태 정리
        this.onDidChangeTreeData = null;
        this.dropMimeTypes = null;
        this.dragMimeTypes = null;
        
        // 참조 정리
        this.core = null;
        this.eventHandler = null;
        
        console.log('✅ DragDropController destroyed successfully');
    }
}

/**
 * Enhanced Tree Item with Drag and Drop support - 레거시 호환성
 */
class DraggableTreeItem {
    constructor(treeItem, element, dragDropController) {
        this.treeItem = treeItem;
        this.element = element;
        this.dragDropController = dragDropController;
        
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        // 새로운 모듈형 컨트롤러 사용
        this.dragDropController.setupTreeItemDragDrop(this.treeItem, this.element);
    }

    dispose() {
        this.dragDropController.removeTreeItemDragDrop(this.element);
    }
}

export { DragDropController, DraggableTreeItem };
export default DragDropController;