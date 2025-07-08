/**
 * Context Menu Event Handler - 이벤트 처리 전담
 * 클릭, 키보드 네비게이션, 외부 클릭 처리를 담당
 */

class ContextMenuEventHandler {
    constructor(core) {
        this.core = core;
        this.onAction = null;
        this.eventListeners = [];
        
        this.init();
    }

    init() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        const menuElement = this.core.getMenuElement();
        
        // Click on menu items
        const clickHandler = (e) => this.handleMenuClick(e);
        menuElement.addEventListener('click', clickHandler);
        this.eventListeners.push({ element: menuElement, type: 'click', handler: clickHandler });

        // Keyboard navigation
        const keydownHandler = (e) => this.handleKeyDown(e);
        menuElement.addEventListener('keydown', keydownHandler);
        this.eventListeners.push({ element: menuElement, type: 'keydown', handler: keydownHandler });

        // Hide menu when clicking outside
        const outsideClickHandler = (e) => this.handleOutsideClick(e);
        document.addEventListener('click', outsideClickHandler);
        this.eventListeners.push({ element: document, type: 'click', handler: outsideClickHandler });

        // Hide menu when scrolling or resizing
        const scrollHandler = () => this.core.hide();
        window.addEventListener('scroll', scrollHandler);
        this.eventListeners.push({ element: window, type: 'scroll', handler: scrollHandler });

        const resizeHandler = () => this.core.hide();
        window.addEventListener('resize', resizeHandler);
        this.eventListeners.push({ element: window, type: 'resize', handler: resizeHandler });

        // Hide menu on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.core.hide();
            }
        };
        document.addEventListener('keydown', escapeHandler);
        this.eventListeners.push({ element: document, type: 'keydown', handler: escapeHandler });
    }

    handleMenuClick(e) {
        const menuItem = e.target.closest('.context-menu-item');
        if (menuItem && !menuItem.classList.contains('disabled')) {
            const action = menuItem.dataset.action;
            this.executeAction(action);
            this.core.hide();
        }
    }

    handleKeyDown(e) {
        const menuElement = this.core.getMenuElement();
        const menuItems = Array.from(menuElement.querySelectorAll('.context-menu-item:not(.disabled)'));
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
                this.core.hide();
                break;
        }
    }

    handleOutsideClick(e) {
        const menuElement = this.core.getMenuElement();
        if (this.core.isVisible() && !menuElement.contains(e.target)) {
            this.core.hide();
        }
    }

    executeAction(action) {
        const currentItem = this.core.getCurrentItem();
        if (this.onAction && currentItem) {
            // Handle clipboard actions
            if (action === 'cut' || action === 'copy') {
                this.core.setClipboardContent({
                    action: action,
                    item: currentItem
                });
            } else if (action === 'paste') {
                const clipboardContent = this.core.getClipboardContent();
                if (clipboardContent) {
                    this.onAction(action, currentItem, clipboardContent);
                    // Clear clipboard after paste if it was a cut operation
                    if (clipboardContent.action === 'cut') {
                        this.core.clearClipboardContent();
                    }
                }
                return;
            }
            
            this.onAction(action, currentItem);
        }
    }

    setOnAction(callback) {
        this.onAction = callback;
    }

    destroy() {
        // Remove all event listeners
        this.eventListeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this.eventListeners = [];
        
        this.onAction = null;
    }
}

export { ContextMenuEventHandler };