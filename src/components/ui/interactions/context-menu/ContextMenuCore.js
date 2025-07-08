/**
 * Context Menu Core - 핵심 렌더링 및 메뉴 구조 관리
 * 컨텍스트 메뉴의 생성, 표시, 위치 조정 기능을 담당
 */

class ContextMenuCore {
    constructor() {
        this.currentItem = null;
        this.menuElement = null;
        this.clipboardContent = null;
        
        this.init();
    }

    init() {
        this.createMenuElement();
    }

    createMenuElement() {
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
        const firstItem = this.menuElement.querySelector('.context-menu-item:not(.disabled)');
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
        return !!this.clipboardContent;
    }

    setClipboardContent(content) {
        this.clipboardContent = content;
    }

    getClipboardContent() {
        return this.clipboardContent;
    }

    clearClipboardContent() {
        this.clipboardContent = null;
    }

    getCurrentItem() {
        return this.currentItem;
    }

    getMenuElement() {
        return this.menuElement;
    }

    isVisible() {
        return this.menuElement.style.display !== 'none';
    }

    destroy() {
        if (this.menuElement && this.menuElement.parentNode) {
            this.menuElement.parentNode.removeChild(this.menuElement);
        }
        this.currentItem = null;
        this.clipboardContent = null;
        this.menuElement = null;
    }
}

export { ContextMenuCore };