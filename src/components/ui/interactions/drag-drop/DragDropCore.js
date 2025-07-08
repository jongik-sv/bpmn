/**
 * Drag Drop Core - 핵심 드래그 앤 드롭 로직
 * 드래그 데이터 처리, 드롭 검증, 마임 타입 관리를 담당
 */

class DragDropCore {
    constructor() {
        this.dropMimeTypes = ['application/vnd.code.tree.explorer'];
        this.dragMimeTypes = ['text/uri-list', 'application/vnd.code.tree.explorer'];
        this.currentDragData = null;
        this.onDidChangeTreeData = null;
    }

    /**
     * 드래그 시작 처리 - 전송용 데이터 준비
     */
    handleDrag(source, dataTransfer) {
        if (!source || source.length === 0) return;

        // 드래그 데이터 설정
        const dragData = {
            items: source.map(item => ({
                id: item.id,
                label: item.label,
                type: item.type,
                path: item.getPath()
            })),
            sourceType: 'explorer'
        };

        // 호환성을 위한 다중 MIME 타입 설정
        dataTransfer.setData('application/vnd.code.tree.explorer', JSON.stringify(dragData));
        dataTransfer.setData('text/plain', source.map(item => item.label).join(', '));
        
        // 크로스 애플리케이션 호환성을 위한 URI 리스트 설정
        const uriList = source
            .filter(item => item.resourceUri)
            .map(item => item.resourceUri)
            .join('\n');
        
        if (uriList) {
            dataTransfer.setData('text/uri-list', uriList);
        }

        // 드래그 효과 설정
        dataTransfer.effectAllowed = 'copyMove';

        // 내부 작업용 참조 저장
        this.currentDragData = dragData;
        
        console.log('Drag started:', dragData);
    }

    /**
     * 드롭 처리 - 드롭된 데이터 처리
     */
    async handleDrop(target, dataTransfer) {
        const transferData = dataTransfer.getData('application/vnd.code.tree.explorer');
        
        if (!transferData) {
            // 외부 드롭 처리 (OS에서 온 파일들)
            return this.handleExternalDrop(target, dataTransfer);
        }

        try {
            const dragData = JSON.parse(transferData);
            return await this.handleInternalDrop(target, dragData);
        } catch (error) {
            console.error('Failed to parse drag data:', error);
            return false;
        }
    }

    /**
     * 내부 드롭 처리 (트리 내부에서)
     */
    async handleInternalDrop(target, dragData) {
        if (!target || target.type !== 'folder') {
            console.warn('Drop target must be a folder');
            return false;
        }

        // 자기 자신이나 자식에 드롭하는 것 방지
        for (const dragItem of dragData.items) {
            if (this.isAncestorOrSelf(target, dragItem)) {
                console.warn('Cannot drop item on itself or its ancestor');
                return false;
            }
        }

        // 이동 작업 수행
        const success = await this.performMoveOperation(target, dragData.items);
        
        if (success && this.onDidChangeTreeData) {
            this.onDidChangeTreeData(target);
        }

        return success;
    }

    /**
     * 외부 드롭 처리 (파일 시스템에서 온 파일들)
     */
    async handleExternalDrop(target, dataTransfer) {
        const files = Array.from(dataTransfer.files || []);
        const uriList = dataTransfer.getData('text/uri-list');
        
        if (files.length > 0) {
            return await this.handleFilesDrop(target, files);
        }
        
        if (uriList) {
            return await this.handleUriListDrop(target, uriList);
        }

        return false;
    }

    /**
     * 파일 시스템 파일 드롭 처리
     */
    async handleFilesDrop(target, files) {
        if (!target || target.type !== 'folder') {
            console.warn('Files can only be dropped on folders');
            return false;
        }

        console.log(`Dropping ${files.length} files on:`, target.label);
        
        // 각 파일 처리
        for (const file of files) {
            await this.processDroppedFile(target, file);
        }

        if (this.onDidChangeTreeData) {
            this.onDidChangeTreeData(target);
        }

        return true;
    }

    /**
     * URI 리스트 드롭 처리
     */
    async handleUriListDrop(target, uriList) {
        const uris = uriList.split('\n').filter(uri => uri.trim());
        
        console.log(`Dropping ${uris.length} URIs on:`, target.label);
        
        // 각 URI 처리
        for (const uri of uris) {
            await this.processDroppedUri(target, uri.trim());
        }

        if (this.onDidChangeTreeData) {
            this.onDidChangeTreeData(target);
        }

        return true;
    }

    /**
     * 개별 드롭 파일 처리
     */
    async processDroppedFile(target, file) {
        console.log(`Processing file: ${file.name} (${file.size} bytes)`);
        
        // 실제 파일 처리 로직이 여기에 구현됨
        // 예: 타겟 폴더로 파일 복사
        
        return new Promise(resolve => {
            setTimeout(() => {
                console.log(`File ${file.name} processed successfully`);
                resolve(true);
            }, 100);
        });
    }

    /**
     * 개별 드롭 URI 처리
     */
    async processDroppedUri(target, uri) {
        console.log(`Processing URI: ${uri}`);
        
        // URI 처리 로직이 여기에 구현됨
        // 예: HTTP URI 다운로드 또는 file:// URI 복사
        
        return new Promise(resolve => {
            setTimeout(() => {
                console.log(`URI ${uri} processed successfully`);
                resolve(true);
            }, 100);
        });
    }

    /**
     * 내부 드롭용 이동 작업 수행
     */
    async performMoveOperation(target, dragItems) {
        console.log(`Moving ${dragItems.length} items to:`, target.label);
        
        // 실제 이동 로직이 여기에 구현됨
        // 일반적으로 다음을 포함:
        // 1. 현재 부모에서 아이템 제거
        // 2. 타겟 폴더에 추가
        // 3. 필요시 파일 시스템 업데이트
        // 4. 트리 뷰 새로고침
        
        return new Promise(resolve => {
            setTimeout(() => {
                console.log('Move operation completed successfully');
                resolve(true);
            }, 100);
        });
    }

    /**
     * 타겟이 드래그 아이템의 조상이거나 같은지 확인
     */
    isAncestorOrSelf(target, dragItem) {
        if (target.id === dragItem.id) {
            return true;
        }

        // 타겟 경로가 드래그 아이템 경로로 시작하는지 확인
        const targetPath = target.getPath();
        const dragPath = dragItem.path;
        
        return targetPath.startsWith(dragPath + '/');
    }

    /**
     * 드롭 작업 검증
     */
    validateDrop(target, dataTransfer) {
        // 타겟이 드롭을 받을 수 있는지 확인
        if (!target || target.type !== 'folder') {
            return 'none';
        }

        // 호환되는 데이터가 있는지 확인
        const hasExplorerData = dataTransfer.types.includes('application/vnd.code.tree.explorer');
        const hasFiles = dataTransfer.types.includes('Files');
        const hasUriList = dataTransfer.types.includes('text/uri-list');

        if (hasExplorerData || hasFiles || hasUriList) {
            return 'move';
        }

        return 'none';
    }

    /**
     * 드래그 이미지 생성
     */
    createDragImage(dragItems) {
        const dragImage = document.createElement('div');
        dragImage.className = 'drag-image';
        dragImage.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            background: #2d2d30;
            color: #cccccc;
            border: 1px solid #464647;
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            pointer-events: none;
            z-index: 1000;
        `;

        if (dragItems.length === 1) {
            dragImage.textContent = dragItems[0].label;
        } else {
            dragImage.textContent = `${dragItems.length} 개 항목`;
        }

        document.body.appendChild(dragImage);

        // 드래그 후 정리
        setTimeout(() => {
            if (dragImage.parentNode) {
                dragImage.parentNode.removeChild(dragImage);
            }
        }, 1000);

        return dragImage;
    }

    /**
     * 현재 드래그 데이터 반환
     */
    getCurrentDragData() {
        return this.currentDragData;
    }

    /**
     * 드래그 데이터 지우기
     */
    clearDragData() {
        this.currentDragData = null;
    }

    /**
     * 이벤트 핸들러 설정
     */
    setOnDidChangeTreeData(callback) {
        this.onDidChangeTreeData = callback;
    }

    /**
     * 마임 타입 반환
     */
    getDropMimeTypes() {
        return this.dropMimeTypes;
    }

    getDragMimeTypes() {
        return this.dragMimeTypes;
    }

    /**
     * 리소스 정리
     */
    dispose() {
        this.onDidChangeTreeData = null;
        this.currentDragData = null;
    }
}

export { DragDropCore };