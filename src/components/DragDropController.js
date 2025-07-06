/**
 * Drag and Drop Controller for VS Code-style Tree View
 * Implements TreeDragAndDropController API similar to VS Code
 */

export class DragDropController {
    constructor() {
        this.dropMimeTypes = ['application/vnd.code.tree.explorer'];
        this.dragMimeTypes = ['text/uri-list', 'application/vnd.code.tree.explorer'];
        this.onDidChangeTreeData = null;
    }

    // Handle drag start - prepare data for transfer
    handleDrag(source, dataTransfer) {
        if (!source || source.length === 0) return;

        // Set drag data
        const dragData = {
            items: source.map(item => ({
                id: item.id,
                label: item.label,
                type: item.type,
                path: item.getPath()
            })),
            sourceType: 'explorer'
        };

        // Set multiple MIME types for compatibility
        dataTransfer.setData('application/vnd.code.tree.explorer', JSON.stringify(dragData));
        dataTransfer.setData('text/plain', source.map(item => item.label).join(', '));
        
        // Set URI list for cross-application compatibility
        const uriList = source
            .filter(item => item.resourceUri)
            .map(item => item.resourceUri)
            .join('\n');
        
        if (uriList) {
            dataTransfer.setData('text/uri-list', uriList);
        }

        // Set drag effect
        dataTransfer.effectAllowed = 'copyMove';

        // Store reference for internal operations
        this.currentDragData = dragData;
        
        console.log('Drag started:', dragData);
    }

    // Handle drop - process dropped data
    async handleDrop(target, dataTransfer) {
        const transferData = dataTransfer.getData('application/vnd.code.tree.explorer');
        
        if (!transferData) {
            // Handle external drops (files from OS)
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

    // Handle internal drops (within the tree)
    async handleInternalDrop(target, dragData) {
        if (!target || target.type !== 'folder') {
            console.warn('Drop target must be a folder');
            return false;
        }

        // Prevent dropping on self or child
        for (const dragItem of dragData.items) {
            if (this.isAncestorOrSelf(target, dragItem)) {
                console.warn('Cannot drop item on itself or its ancestor');
                return false;
            }
        }

        // Perform the move operation
        const success = await this.performMoveOperation(target, dragData.items);
        
        if (success && this.onDidChangeTreeData) {
            this.onDidChangeTreeData(target);
        }

        return success;
    }

    // Handle external drops (files from file system)
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

    // Handle dropped files from file system
    async handleFilesDrop(target, files) {
        if (!target || target.type !== 'folder') {
            console.warn('Files can only be dropped on folders');
            return false;
        }

        console.log(`Dropping ${files.length} files on:`, target.label);
        
        // Process each file
        for (const file of files) {
            await this.processDroppedFile(target, file);
        }

        if (this.onDidChangeTreeData) {
            this.onDidChangeTreeData(target);
        }

        return true;
    }

    // Handle URI list drops
    async handleUriListDrop(target, uriList) {
        const uris = uriList.split('\n').filter(uri => uri.trim());
        
        console.log(`Dropping ${uris.length} URIs on:`, target.label);
        
        // Process each URI
        for (const uri of uris) {
            await this.processDroppedUri(target, uri.trim());
        }

        if (this.onDidChangeTreeData) {
            this.onDidChangeTreeData(target);
        }

        return true;
    }

    // Process individual dropped file
    async processDroppedFile(target, file) {
        console.log(`Processing file: ${file.name} (${file.size} bytes)`);
        
        // Here you would implement the actual file processing logic
        // For example, copying the file to the target folder
        
        // Simulated async operation
        return new Promise(resolve => {
            setTimeout(() => {
                console.log(`File ${file.name} processed successfully`);
                resolve(true);
            }, 100);
        });
    }

    // Process individual dropped URI
    async processDroppedUri(target, uri) {
        console.log(`Processing URI: ${uri}`);
        
        // Here you would implement URI processing logic
        // For example, downloading from HTTP URIs or copying from file:// URIs
        
        return new Promise(resolve => {
            setTimeout(() => {
                console.log(`URI ${uri} processed successfully`);
                resolve(true);
            }, 100);
        });
    }

    // Perform move operation for internal drops
    async performMoveOperation(target, dragItems) {
        console.log(`Moving ${dragItems.length} items to:`, target.label);
        
        // Here you would implement the actual move logic
        // This would typically involve:
        // 1. Removing items from their current parent
        // 2. Adding them to the target folder
        // 3. Updating the file system if needed
        // 4. Refreshing the tree view
        
        // Simulated async operation
        return new Promise(resolve => {
            setTimeout(() => {
                console.log('Move operation completed successfully');
                resolve(true);
            }, 100);
        });
    }

    // Check if target is ancestor or same as dragged item
    isAncestorOrSelf(target, dragItem) {
        if (target.id === dragItem.id) {
            return true;
        }

        // Check if target path starts with drag item path
        const targetPath = target.getPath();
        const dragPath = dragItem.path;
        
        return targetPath.startsWith(dragPath + '/');
    }

    // Validate drop operation
    validateDrop(target, dataTransfer) {
        // Check if target accepts drops
        if (!target || target.type !== 'folder') {
            return 'none';
        }

        // Check if we have compatible data
        const hasExplorerData = dataTransfer.types.includes('application/vnd.code.tree.explorer');
        const hasFiles = dataTransfer.types.includes('Files');
        const hasUriList = dataTransfer.types.includes('text/uri-list');

        if (hasExplorerData || hasFiles || hasUriList) {
            return 'move';
        }

        return 'none';
    }

    // Get drag image for visual feedback
    createDragImage(dragItems) {
        const dragImage = document.createElement('div');
        dragImage.className = 'drag-image';
        dragImage.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            background: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            border: 1px solid var(--vscode-sideBar-border);
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 12px;
            font-family: var(--vscode-font-family);
            pointer-events: none;
            z-index: 1000;
        `;

        if (dragItems.length === 1) {
            dragImage.textContent = dragItems[0].label;
        } else {
            dragImage.textContent = `${dragItems.length} 개 항목`;
        }

        document.body.appendChild(dragImage);

        // Clean up after drag
        setTimeout(() => {
            if (dragImage.parentNode) {
                dragImage.parentNode.removeChild(dragImage);
            }
        }, 1000);

        return dragImage;
    }

    // Event handler setter
    setOnDidChangeTreeData(callback) {
        this.onDidChangeTreeData = callback;
    }

    // Cleanup
    dispose() {
        this.onDidChangeTreeData = null;
        this.currentDragData = null;
    }
}

/**
 * Enhanced Tree Item with Drag and Drop support
 */
export class DraggableTreeItem {
    constructor(treeItem, element, dragDropController) {
        this.treeItem = treeItem;
        this.element = element;
        this.dragDropController = dragDropController;
        this.isDragging = false;
        this.isDropTarget = false;
        
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        // Drag events
        this.element.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.element.addEventListener('dragend', this.handleDragEnd.bind(this));

        // Drop events
        this.element.addEventListener('dragover', this.handleDragOver.bind(this));
        this.element.addEventListener('dragenter', this.handleDragEnter.bind(this));
        this.element.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.element.addEventListener('drop', this.handleDrop.bind(this));
    }

    handleDragStart(event) {
        this.isDragging = true;
        this.element.classList.add('dragging');

        // Set drag image
        const dragImage = this.dragDropController.createDragImage([this.treeItem]);
        event.dataTransfer.setDragImage(dragImage, 0, 0);

        // Handle drag data
        this.dragDropController.handleDrag([this.treeItem], event.dataTransfer);

        // Prevent event bubbling
        event.stopPropagation();
    }

    handleDragEnd(event) {
        this.isDragging = false;
        this.element.classList.remove('dragging');

        // Clean up all drag states
        const allItems = document.querySelectorAll('.tree-item');
        allItems.forEach(item => {
            item.classList.remove('drag-over', 'drag-target');
        });

        event.stopPropagation();
    }

    handleDragOver(event) {
        if (this.isDragging) return;

        const dropEffect = this.dragDropController.validateDrop(this.treeItem, event.dataTransfer);
        
        if (dropEffect !== 'none') {
            event.preventDefault();
            event.dataTransfer.dropEffect = dropEffect;
        }
    }

    handleDragEnter(event) {
        if (this.isDragging) return;

        const dropEffect = this.dragDropController.validateDrop(this.treeItem, event.dataTransfer);
        
        if (dropEffect !== 'none') {
            this.isDropTarget = true;
            this.element.classList.add('drag-over');
            
            // Expand folder after hover delay
            if (this.treeItem.type === 'folder' && !this.treeItem.isExpanded) {
                this.expandTimeout = setTimeout(() => {
                    if (this.isDropTarget) {
                        // Auto-expand on drag hover
                        console.log('Auto-expanding folder:', this.treeItem.label);
                    }
                }, 800);
            }
        }
    }

    handleDragLeave(event) {
        // Check if we're actually leaving the element
        const rect = this.element.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;
        
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            this.isDropTarget = false;
            this.element.classList.remove('drag-over');
            
            if (this.expandTimeout) {
                clearTimeout(this.expandTimeout);
                this.expandTimeout = null;
            }
        }
    }

    async handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();

        this.isDropTarget = false;
        this.element.classList.remove('drag-over');

        if (this.expandTimeout) {
            clearTimeout(this.expandTimeout);
            this.expandTimeout = null;
        }

        // Handle the drop
        try {
            const success = await this.dragDropController.handleDrop(this.treeItem, event.dataTransfer);
            
            if (success) {
                // Visual feedback for successful drop
                this.element.classList.add('drop-success');
                setTimeout(() => {
                    this.element.classList.remove('drop-success');
                }, 300);
            }
        } catch (error) {
            console.error('Drop operation failed:', error);
            
            // Visual feedback for failed drop
            this.element.classList.add('drop-error');
            setTimeout(() => {
                this.element.classList.remove('drop-error');
            }, 300);
        }
    }

    // Cleanup
    dispose() {
        if (this.expandTimeout) {
            clearTimeout(this.expandTimeout);
        }
        
        // Remove event listeners
        this.element.removeEventListener('dragstart', this.handleDragStart);
        this.element.removeEventListener('dragend', this.handleDragEnd);
        this.element.removeEventListener('dragover', this.handleDragOver);
        this.element.removeEventListener('dragenter', this.handleDragEnter);
        this.element.removeEventListener('dragleave', this.handleDragLeave);
        this.element.removeEventListener('drop', this.handleDrop);
    }
}

export default DragDropController;