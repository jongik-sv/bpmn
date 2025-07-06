/**
 * Tree Data Provider
 * Manages tree data structure similar to VS Code's TreeDataProvider interface
 */

// Tree Item Collapsible State enum
export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2
};

// Tree Item class
export class TreeItem {
    constructor(label, collapsibleState = TreeItemCollapsibleState.None) {
        this.label = label;
        this.id = this.generateId();
        this.collapsibleState = collapsibleState;
        this.iconPath = null;
        this.description = null;
        this.tooltip = null;
        this.contextValue = null;
        this.resourceUri = null;
        this.command = null;
        this.children = [];
        this.parent = null;
        this.isExpanded = collapsibleState === TreeItemCollapsibleState.Expanded;
    }

    generateId() {
        return `tree-item-${Math.random().toString(36).substr(2, 9)}`;
    }

    addChild(child) {
        child.parent = this;
        this.children.push(child);
        
        // Update collapsible state if this was a leaf node
        if (this.collapsibleState === TreeItemCollapsibleState.None) {
            this.collapsibleState = TreeItemCollapsibleState.Collapsed;
        }
        
        return child;
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
            child.parent = null;
            
            // Update collapsible state if no children left
            if (this.children.length === 0) {
                this.collapsibleState = TreeItemCollapsibleState.None;
                this.isExpanded = false;
            }
        }
    }

    toggle() {
        if (this.collapsibleState !== TreeItemCollapsibleState.None) {
            this.isExpanded = !this.isExpanded;
            this.collapsibleState = this.isExpanded ? 
                TreeItemCollapsibleState.Expanded : 
                TreeItemCollapsibleState.Collapsed;
        }
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

    getPath() {
        const path = [];
        let current = this;
        while (current) {
            path.unshift(current.label);
            current = current.parent;
        }
        return path.join('/');
    }
}

// File Tree Item (extends TreeItem)
export class FileTreeItem extends TreeItem {
    constructor(label, type = 'file', collapsibleState = TreeItemCollapsibleState.None) {
        super(label, collapsibleState);
        this.type = type; // 'file' or 'folder'
        this.extension = this.getFileExtension();
        this.iconPath = this.getIconForType();
        this.contextValue = type;
        this.size = type === 'file' ? Math.floor(Math.random() * 1000000) : null;
        this.lastModified = new Date();
    }

    getFileExtension() {
        if (this.type === 'folder') return null;
        const parts = this.label.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : null;
    }

    getIconForType() {
        if (this.type === 'folder') {
            return this.isExpanded ? 'folder-opened' : 'folder';
        }

        // File type icons based on extension
        const iconMap = {
            'js': 'symbol-method',
            'ts': 'symbol-method',
            'json': 'symbol-property',
            'html': 'symbol-color',
            'css': 'symbol-color',
            'md': 'symbol-text',
            'txt': 'symbol-text',
            'png': 'file-media',
            'jpg': 'file-media',
            'gif': 'file-media',
            'svg': 'file-media',
            'bpmn': 'symbol-misc'
        };

        return iconMap[this.extension] || 'file';
    }

    updateIcon() {
        this.iconPath = this.getIconForType();
    }

    formatSize() {
        if (this.type === 'folder' || !this.size) return '';
        
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = this.size;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
    }

    formatLastModified() {
        const now = new Date();
        const diffMs = now - this.lastModified;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return '오늘';
        if (diffDays === 1) return '어제';
        if (diffDays < 7) return `${diffDays}일 전`;
        
        return this.lastModified.toLocaleDateString('ko-KR');
    }
}

// Tree Data Provider class
export class TreeDataProvider {
    constructor() {
        this.root = null;
        this.onDidChangeTreeData = null; // Event emitter callback
        this.expandedNodes = new Set();
        this.selectedNodes = new Set();
        this.dragDropController = null;
    }

    // Core TreeDataProvider interface methods
    getChildren(element = null) {
        if (element === null || element === undefined) {
            return this.root ? this.root.children : [];
        }
        return element.children || [];
    }

    getTreeItem(element) {
        return element;
    }

    getParent(element) {
        return element.parent;
    }

    // Tree management methods
    setRoot(rootItem) {
        this.root = rootItem;
        this.refresh();
    }

    refresh(element = null) {
        console.log('🔄 TreeDataProvider refresh called, element:', element?.label || 'null');
        console.log('🔄 onDidChangeTreeData callback exists:', !!this.onDidChangeTreeData);
        if (this.onDidChangeTreeData) {
            console.log('🔄 Calling onDidChangeTreeData callback...');
            this.onDidChangeTreeData(element);
        } else {
            console.log('❌ No onDidChangeTreeData callback set!');
        }
    }

    // Node expansion methods
    expandNode(element) {
        console.log('🔼 Expanding node:', element.label, 'collapsibleState:', element.collapsibleState);
        if (element.collapsibleState !== TreeItemCollapsibleState.None) {
            element.isExpanded = true;
            element.collapsibleState = TreeItemCollapsibleState.Expanded;
            element.updateIcon && element.updateIcon();
            this.expandedNodes.add(element.id);
            console.log('🔼 Node expanded, calling refresh...');
            this.refresh(element);
        }
    }

    collapseNode(element) {
        console.log('🔽 Collapsing node:', element.label, 'collapsibleState:', element.collapsibleState);
        if (element.collapsibleState !== TreeItemCollapsibleState.None) {
            element.isExpanded = false;
            element.collapsibleState = TreeItemCollapsibleState.Collapsed;
            element.updateIcon && element.updateIcon();
            this.expandedNodes.delete(element.id);
            console.log('🔽 Node collapsed, calling refresh...');
            this.refresh(element);
        }
    }

    toggleNode(element) {
        console.log('🔄 Toggling node:', element.label, 'current state:', element.isExpanded);
        if (element.isExpanded) {
            console.log('🔽 Collapsing node:', element.label);
            this.collapseNode(element);
        } else {
            console.log('🔼 Expanding node:', element.label);
            this.expandNode(element);
        }
        console.log('✅ Toggle complete, new state:', element.isExpanded);
    }

    // Selection methods
    selectNode(element, multiSelect = false) {
        if (!multiSelect) {
            this.selectedNodes.clear();
        }
        this.selectedNodes.add(element.id);
        this.refresh();
    }

    deselectNode(element) {
        this.selectedNodes.delete(element.id);
        this.refresh();
    }

    isSelected(element) {
        return this.selectedNodes.has(element.id);
    }

    getSelectedNodes() {
        return Array.from(this.selectedNodes);
    }

    // Tree traversal methods
    findNodeById(id, root = this.root) {
        if (!root) return null;
        
        if (root.id === id) return root;
        
        for (const child of root.children) {
            const found = this.findNodeById(id, child);
            if (found) return found;
        }
        
        return null;
    }

    findNodeByPath(path, root = this.root) {
        if (!root || !path) return null;
        
        const parts = path.split('/').filter(p => p);
        let current = root;
        
        for (const part of parts) {
            const child = current.children.find(c => c.label === part);
            if (!child) return null;
            current = child;
        }
        
        return current;
    }

    getAllNodes(root = this.root) {
        if (!root) return [];
        
        const nodes = [root];
        for (const child of root.children) {
            nodes.push(...this.getAllNodes(child));
        }
        
        return nodes;
    }

    getVisibleNodes(root = this.root, includeRoot = false) {
        if (!root) return [];
        
        const visible = includeRoot ? [root] : [];
        
        if (root.isExpanded || includeRoot) {
            for (const child of root.children) {
                visible.push(child);
                if (child.isExpanded) {
                    visible.push(...this.getVisibleNodes(child, false));
                }
            }
        }
        
        return visible;
    }

    // Utility methods
    sortChildren(element, compareFn = null) {
        if (!compareFn) {
            // Default sort: folders first, then files alphabetically
            compareFn = (a, b) => {
                if (a.type === 'folder' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'folder') return 1;
                return a.label.localeCompare(b.label, 'ko-KR');
            };
        }
        
        element.children.sort(compareFn);
        this.refresh(element);
    }

    filterNodes(predicate, root = this.root) {
        if (!root) return [];
        
        const matches = [];
        
        if (predicate(root)) {
            matches.push(root);
        }
        
        for (const child of root.children) {
            matches.push(...this.filterNodes(predicate, child));
        }
        
        return matches;
    }

    // Event handling
    setOnDidChangeTreeData(callback) {
        console.log('📞 Setting onDidChangeTreeData callback:', !!callback);
        this.onDidChangeTreeData = callback;
        console.log('📞 Callback set, onDidChangeTreeData exists:', !!this.onDidChangeTreeData);
    }

    setDragDropController(controller) {
        this.dragDropController = controller;
    }

    // Sample data creation
    createSampleData() {
        const root = new FileTreeItem('workspace', 'folder', TreeItemCollapsibleState.Expanded);
        
        // Create sample folder structure
        const srcFolder = root.addChild(new FileTreeItem('src', 'folder', TreeItemCollapsibleState.Expanded));
        const componentsFolder = srcFolder.addChild(new FileTreeItem('components', 'folder', TreeItemCollapsibleState.Collapsed));
        const stylesFolder = srcFolder.addChild(new FileTreeItem('styles', 'folder', TreeItemCollapsibleState.Collapsed));
        
        // Add files to components
        componentsFolder.addChild(new FileTreeItem('ActivityBar.js', 'file'));
        componentsFolder.addChild(new FileTreeItem('Explorer.js', 'file'));
        componentsFolder.addChild(new FileTreeItem('TreeView.js', 'file'));
        
        // Add files to styles
        stylesFolder.addChild(new FileTreeItem('activity-bar.css', 'file'));
        stylesFolder.addChild(new FileTreeItem('explorer.css', 'file'));
        stylesFolder.addChild(new FileTreeItem('tree-view.css', 'file'));
        
        // Add root level files
        srcFolder.addChild(new FileTreeItem('main.js', 'file'));
        srcFolder.addChild(new FileTreeItem('app.css', 'file'));
        
        root.addChild(new FileTreeItem('package.json', 'file'));
        root.addChild(new FileTreeItem('README.md', 'file'));
        root.addChild(new FileTreeItem('.gitignore', 'file'));
        
        this.setRoot(root);
        return root;
    }
}

export default TreeDataProvider;