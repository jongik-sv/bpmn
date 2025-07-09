/**
 * Tree Data Provider - 트리 데이터 제공자 (리팩토링 버전)
 * 트리 구조 데이터 관리 및 제공 기능
 */

// 트리 아이템 축소 상태 열거형
export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2
};

/**
 * 기본 트리 아이템 클래스
 */
export class TreeItem {
    constructor(label, collapsibleState = TreeItemCollapsibleState.None) {
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.description = '';
        this.tooltip = '';
        this.iconPath = '';
        this.contextValue = '';
        this.resourceUri = '';
        this.command = null;
        this.children = [];
        this.parent = null;
        this.id = Math.random().toString(36).substr(2, 9);
    }

    addChild(child) {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.push(child);
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }

    getPath() {
        if (!this.parent) {
            return this.label;
        }
        return this.parent.getPath() + '/' + this.label;
    }

    findChild(predicate) {
        return this.children.find(predicate);
    }

    findDescendant(predicate) {
        for (const child of this.children) {
            if (predicate(child)) {
                return child;
            }
            const found = child.findDescendant(predicate);
            if (found) {
                return found;
            }
        }
        return null;
    }

    getDepth() {
        let depth = 0;
        let current = this.parent;
        while (current) {
            depth++;
            current = current.parent;
        }
        return depth;
    }

    isExpanded() {
        return this.collapsibleState === TreeItemCollapsibleState.Expanded;
    }

    isCollapsed() {
        return this.collapsibleState === TreeItemCollapsibleState.Collapsed;
    }

    expand() {
        if (this.collapsibleState === TreeItemCollapsibleState.Collapsed) {
            this.collapsibleState = TreeItemCollapsibleState.Expanded;
        }
    }

    collapse() {
        if (this.collapsibleState === TreeItemCollapsibleState.Expanded) {
            this.collapsibleState = TreeItemCollapsibleState.Collapsed;
        }
    }

    toggle() {
        if (this.isExpanded()) {
            this.collapse();
        } else if (this.isCollapsed()) {
            this.expand();
        }
    }
}

/**
 * 파일 트리 아이템 클래스
 */
export class FileTreeItem extends TreeItem {
    constructor(label, type, collapsibleState = TreeItemCollapsibleState.None) {
        super(label, collapsibleState);
        this.type = type; // 'file' | 'folder'
        this.extension = this.getExtension(label);
        this.iconPath = this.getIconPath(type, this.extension);
        this.contextValue = type;
        this.resourceUri = this.generateResourceUri(label, type);
        this.lastModified = new Date();
        this.size = 0;
        this.readonly = false;
    }

    getExtension(filename) {
        const lastDot = filename.lastIndexOf('.');
        return lastDot > -1 ? filename.substring(lastDot + 1) : '';
    }

    getIconPath(type, extension) {
        if (type === 'folder') {
            return '📁';
        }
        
        const iconMap = {
            'bpmn': '📋',
            'xml': '📄',
            'json': '🔧',
            'js': '📜',
            'css': '🎨',
            'html': '🌐',
            'txt': '📝',
            'md': '📚'
        };

        return iconMap[extension] || '📄';
    }

    generateResourceUri(label, type) {
        if (type === 'folder') {
            return `folder://${label}`;
        }
        return `file://${label}`;
    }

    isFile() {
        return this.type === 'file';
    }

    isFolder() {
        return this.type === 'folder';
    }

    canHaveChildren() {
        return this.type === 'folder';
    }

    getFileSize() {
        if (this.type === 'file') {
            return this.size;
        }
        
        // 폴더의 경우 하위 파일들의 크기 합계
        let totalSize = 0;
        for (const child of this.children) {
            if (child instanceof FileTreeItem) {
                totalSize += child.getFileSize();
            }
        }
        return totalSize;
    }

    getFileCount() {
        if (this.type === 'file') {
            return 1;
        }
        
        let count = 0;
        for (const child of this.children) {
            if (child instanceof FileTreeItem) {
                count += child.getFileCount();
            }
        }
        return count;
    }

    getFolderCount() {
        if (this.type === 'file') {
            return 0;
        }
        
        let count = 1; // 자기 자신 포함
        for (const child of this.children) {
            if (child instanceof FileTreeItem && child.isFolder()) {
                count += child.getFolderCount();
            }
        }
        return count;
    }
}

/**
 * 트리 데이터 제공자 클래스
 */
class TreeDataProvider {
    constructor() {
        this.root = null;
        this.onDidChangeTreeData = null;
        this.dragDropController = null;
        this.searchFilter = '';
        this.sortOrder = 'name'; // 'name' | 'type' | 'modified'
        this.sortDirection = 'asc'; // 'asc' | 'desc'
    }

    setRoot(root) {
        this.root = root;
        this.refresh();
    }

    getRoot() {
        return this.root;
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            return this.root ? [this.root] : [];
        }
        
        let children = element.children || [];
        
        // 검색 필터 적용
        if (this.searchFilter) {
            children = children.filter(child => 
                child.label.toLowerCase().includes(this.searchFilter.toLowerCase())
            );
        }
        
        // 정렬 적용
        children = this.sortChildren(children);
        
        return children;
    }

    getParent(element) {
        return element.parent;
    }

    sortChildren(children) {
        return children.sort((a, b) => {
            let comparison = 0;
            
            // 폴더를 먼저 정렬
            if (a.type === 'folder' && b.type === 'file') {
                return -1;
            }
            if (a.type === 'file' && b.type === 'folder') {
                return 1;
            }
            
            switch (this.sortOrder) {
                case 'name':
                    comparison = a.label.localeCompare(b.label);
                    break;
                case 'type':
                    comparison = (a.extension || '').localeCompare(b.extension || '');
                    break;
                case 'modified':
                    comparison = (a.lastModified || new Date()) - (b.lastModified || new Date());
                    break;
            }
            
            return this.sortDirection === 'desc' ? -comparison : comparison;
        });
    }

    findNodeById(id) {
        if (!this.root) return null;
        
        const search = (node) => {
            if (node.id === id) {
                return node;
            }
            
            for (const child of node.children) {
                const found = search(child);
                if (found) return found;
            }
            
            return null;
        };
        
        return search(this.root);
    }

    findNodeByPath(path) {
        if (!this.root) return null;
        
        const pathParts = path.split('/');
        let current = this.root;
        
        for (const part of pathParts) {
            if (part === current.label) continue;
            
            current = current.findChild(child => child.label === part);
            if (!current) return null;
        }
        
        return current;
    }

    addNode(parentPath, node) {
        const parent = parentPath ? this.findNodeByPath(parentPath) : this.root;
        if (!parent) {
            throw new Error('Parent node not found');
        }
        
        if (parent.canHaveChildren && !parent.canHaveChildren()) {
            throw new Error('Parent cannot have children');
        }
        
        parent.addChild(node);
        this.refresh(parent);
        return node;
    }

    removeNode(nodePath) {
        const node = this.findNodeByPath(nodePath);
        if (!node) {
            throw new Error('Node not found');
        }
        
        const parent = node.parent;
        if (parent) {
            parent.removeChild(node);
            this.refresh(parent);
        }
        
        return node;
    }

    moveNode(fromPath, toPath) {
        const node = this.findNodeByPath(fromPath);
        const newParent = this.findNodeByPath(toPath);
        
        if (!node || !newParent) {
            throw new Error('Node or target not found');
        }
        
        if (newParent.canHaveChildren && !newParent.canHaveChildren()) {
            throw new Error('Target cannot have children');
        }
        
        const oldParent = node.parent;
        newParent.addChild(node);
        
        this.refresh(oldParent);
        this.refresh(newParent);
        
        return node;
    }

    setSearchFilter(filter) {
        this.searchFilter = filter;
        this.refresh();
    }

    setSortOrder(order, direction = 'asc') {
        this.sortOrder = order;
        this.sortDirection = direction;
        this.refresh();
    }

    setDragDropController(controller) {
        this.dragDropController = controller;
    }

    refresh(element = null) {
        if (this.onDidChangeTreeData) {
            this.onDidChangeTreeData(element);
        }
    }

    setOnDidChangeTreeData(callback) {
        this.onDidChangeTreeData = callback;
    }

    /**
     * 프로젝트 데이터를 트리 구조로 변환하여 설정
     */
    setProjectData(projectData) {
        if (!projectData) {
            console.warn('No project data provided to TreeDataProvider');
            return;
        }

        console.log('🔧 Setting project data in TreeDataProvider:', projectData.name);
        
        // 루트 노드 생성 (프로젝트명)
        const root = new FileTreeItem(projectData.name, 'folder', TreeItemCollapsibleState.Expanded);
        root.projectId = projectData.id;
        
        // 폴더와 다이어그램 데이터 가져오기
        const folders = projectData.folders || [];
        const diagrams = projectData.diagrams || [];
        
        // 폴더를 계층 구조로 정리
        const folderMap = new Map();
        folderMap.set(null, root); // null parent_id는 루트 노드
        
        // 모든 폴더를 먼저 생성 (부모 관계 무시하고)
        folders.forEach(folder => {
            const folderItem = new FileTreeItem(folder.name, 'folder', TreeItemCollapsibleState.Collapsed);
            folderItem.folderId = folder.id;
            folderItem.parentFolderId = folder.parent_id;
            folderItem.description = folder.description;
            folderItem.created_at = folder.created_at;
            folderItem.updated_at = folder.updated_at;
            folderMap.set(folder.id, folderItem);
        });
        
        // 폴더 계층 구조 설정
        folders.forEach(folder => {
            const folderItem = folderMap.get(folder.id);
            const parentItem = folderMap.get(folder.parent_id);
            
            if (parentItem && folderItem) {
                parentItem.addChild(folderItem);
            }
        });
        
        // 다이어그램을 해당 폴더에 추가
        diagrams.forEach(diagram => {
            const diagramItem = new FileTreeItem(diagram.name, 'file', TreeItemCollapsibleState.None);
            diagramItem.diagramId = diagram.id;
            diagramItem.folderId = diagram.folder_id;
            diagramItem.extension = 'bpmn';
            diagramItem.iconPath = '📋';
            diagramItem.description = diagram.description;
            diagramItem.created_at = diagram.created_at;
            diagramItem.updated_at = diagram.updated_at;
            diagramItem.size = diagram.bpmn_xml ? diagram.bpmn_xml.length : 0;
            diagramItem.diagramData = diagram; // 전체 다이어그램 데이터 저장
            
            // 해당 폴더에 추가 (folder_id가 null이면 루트에 추가)
            const parentFolder = folderMap.get(diagram.folder_id);
            if (parentFolder) {
                parentFolder.addChild(diagramItem);
            }
        });
        
        this.setRoot(root);
        console.log('✅ Project data converted to tree structure');
    }

    // 통계 정보
    getStatistics() {
        if (!this.root) {
            return {
                totalItems: 0,
                files: 0,
                folders: 0,
                totalSize: 0
            };
        }
        
        const stats = {
            totalItems: 0,
            files: 0,
            folders: 0,
            totalSize: 0
        };
        
        const traverse = (node) => {
            stats.totalItems++;
            
            if (node instanceof FileTreeItem) {
                if (node.isFile()) {
                    stats.files++;
                    stats.totalSize += node.size;
                } else if (node.isFolder()) {
                    stats.folders++;
                }
            }
            
            for (const child of node.children) {
                traverse(child);
            }
        };
        
        traverse(this.root);
        
        return stats;
    }

    dispose() {
        this.root = null;
        this.onDidChangeTreeData = null;
        this.dragDropController = null;
    }
}

export { TreeDataProvider };
export default TreeDataProvider;