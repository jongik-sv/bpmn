/**
 * VS Code Style Context Menu
 * Implements right-click context menu for file explorer
 */

class ContextMenu {
    constructor() {
        this.currentItem = null;
        this.menuElement = null;
        this.onAction = null;
        
        this.init();
    }

    init() {
        this.createMenuElement();
        this.attachEventListeners();
    }

    createMenuElement() {
        // Create the context menu element if it doesn't exist
        this.menuElement = document.createElement('div');
        this.menuElement.className = 'context-menu';
        this.menuElement.style.cssText = `
            position: fixed;
            display: none;
            background-color: #2d2d30;
            border: 1px solid #464647;
            border-radius: 3px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            min-width: 160px;
            padding: 4px 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
            font-size: 13px;
            color: #cccccc;
        `;
        
        document.body.appendChild(this.menuElement);
    }

    show(item, x, y) {
        this.currentItem = item;
        this.menuElement.innerHTML = this.generateMenuItems(item);
        
        // Position the menu
        this.menuElement.style.left = x + 'px';
        this.menuElement.style.top = y + 'px';
        this.menuElement.style.display = 'block';
        
        // Adjust position if menu goes off-screen
        this.adjustPosition();
        
        // Focus the first menu item for keyboard navigation
        const firstItem = this.menuElement.querySelector('.context-menu-item');
        if (firstItem) {
            firstItem.focus();
        }
    }

    hide() {
        this.menuElement.style.display = 'none';
        this.currentItem = null;
    }

    generateMenuItems(item) {
        const items = [];
        
        // Different menu items based on item type
        if (item.type === 'folder') {
            items.push(
                this.createMenuItem('새 다이어그램', 'new-file', '📄'),
                this.createMenuItem('새 폴더', 'new-folder', '📁'),
                this.createSeparator(),
                this.createMenuItem('이름 바꾸기', 'rename', '✏️', 'F2'),
                this.createMenuItem('삭제', 'delete', '🗑️', 'Delete'),
                this.createSeparator(),
                this.createMenuItem('잘라내기', 'cut', '✂️', 'Ctrl+X'),
                this.createMenuItem('복사', 'copy', '📋', 'Ctrl+C'),
                this.createMenuItem('붙여넣기', 'paste', '📌', 'Ctrl+V', !this.hasClipboardContent()),
                this.createSeparator(),
                this.createMenuItem('모두 축소', 'collapse-all', '⬇️'),
                this.createMenuItem('새로 고침', 'refresh', '🔄')
            );
        } else {
            // File (diagram) menu items
            items.push(
                this.createMenuItem('열기', 'open', '📖', 'Enter'),
                this.createSeparator(),
                this.createMenuItem('이름 바꾸기', 'rename', '✏️', 'F2'),
                this.createMenuItem('삭제', 'delete', '🗑️', 'Delete'),
                this.createSeparator(),
                this.createMenuItem('잘라내기', 'cut', '✂️', 'Ctrl+X'),
                this.createMenuItem('복사', 'copy', '📋', 'Ctrl+C'),
                this.createSeparator(),
                this.createMenuItem('내보내기', 'export', '💾'),
                this.createMenuItem('속성', 'properties', '📋')
            );
        }
        
        return items.join('');
    }

    createMenuItem(label, action, icon = '', shortcut = '', disabled = false) {
        return `
            <div class="context-menu-item ${disabled ? 'disabled' : ''}" 
                 data-action="${action}"
                 tabindex="0"
                 style="
                    display: flex;
                    align-items: center;
                    padding: 6px 12px;
                    cursor: ${disabled ? 'default' : 'pointer'};
                    color: ${disabled ? '#666666' : '#cccccc'};
                    background-color: transparent;
                 "
                 onmouseover="this.style.backgroundColor = '${disabled ? 'transparent' : '#37373d'}'"
                 onmouseout="this.style.backgroundColor = 'transparent'">
                <span style="width: 16px; margin-right: 8px; text-align: center;">${icon}</span>
                <span style="flex: 1;">${label}</span>
                ${shortcut ? `<span style="color: #999999; font-size: 12px; margin-left: 8px;">${shortcut}</span>` : ''}
            </div>
        `;
    }

    createSeparator() {
        return `
            <div style="
                height: 1px;
                background-color: #464647;
                margin: 4px 0;
            "></div>
        `;
    }

    adjustPosition() {
        const rect = this.menuElement.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Adjust horizontal position
        if (rect.right > windowWidth) {
            this.menuElement.style.left = (windowWidth - rect.width - 10) + 'px';
        }
        
        // Adjust vertical position
        if (rect.bottom > windowHeight) {
            this.menuElement.style.top = (windowHeight - rect.height - 10) + 'px';
        }
    }

    hasClipboardContent() {
        // Check if there's something in clipboard (simplified)
        // In a real implementation, you might want to track cut/copy operations
        return false;
    }

    attachEventListeners() {
        // Click on menu items
        this.menuElement.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.context-menu-item');
            if (menuItem && !menuItem.classList.contains('disabled')) {
                const action = menuItem.dataset.action;
                this.executeAction(action);
                this.hide();
            }
        });

        // Keyboard navigation
        this.menuElement.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        // Hide menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.menuElement.contains(e.target)) {
                this.hide();
            }
        });

        // Hide menu when scrolling or resizing
        window.addEventListener('scroll', () => this.hide());
        window.addEventListener('resize', () => this.hide());

        // Hide menu on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });
    }

    handleKeyDown(e) {
        const menuItems = Array.from(this.menuElement.querySelectorAll('.context-menu-item:not(.disabled)'));
        const currentIndex = menuItems.indexOf(document.activeElement);
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % menuItems.length;
                menuItems[nextIndex].focus();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex === 0 ? menuItems.length - 1 : currentIndex - 1;
                menuItems[prevIndex].focus();
                break;
                
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (document.activeElement.classList.contains('context-menu-item')) {
                    document.activeElement.click();
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                this.hide();
                break;
        }
    }

    executeAction(action) {
        if (this.onAction && this.currentItem) {
            this.onAction(action, this.currentItem);
        }
    }

    setOnAction(callback) {
        this.onAction = callback;
    }

    destroy() {
        if (this.menuElement && this.menuElement.parentNode) {
            this.menuElement.parentNode.removeChild(this.menuElement);
        }
        this.onAction = null;
        this.currentItem = null;
    }
}

export default ContextMenu;