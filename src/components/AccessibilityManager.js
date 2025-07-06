/**
 * Accessibility Manager for VS Code-style UI
 * Implements ARIA patterns and accessibility features
 */

export class AccessibilityManager {
    constructor() {
        this.announcements = [];
        this.focusManager = new FocusManager();
        this.screenReader = new ScreenReaderSupport();
        this.keyboardNavigation = new KeyboardNavigationManager();
        
        this.init();
    }

    init() {
        this.createAriaLiveRegion();
        this.setupKeyboardShortcuts();
        this.setupReducedMotion();
        this.setupHighContrast();
    }

    // Create ARIA live region for announcements
    createAriaLiveRegion() {
        this.liveRegion = document.createElement('div');
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        this.liveRegion.className = 'sr-only';
        this.liveRegion.style.cssText = `
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
        `;
        
        document.body.appendChild(this.liveRegion);
    }

    // Announce message to screen readers
    announce(message, priority = 'polite') {
        if (!message) return;

        this.liveRegion.setAttribute('aria-live', priority);
        this.liveRegion.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            this.liveRegion.textContent = '';
        }, 1000);

        console.log(`Screen reader announcement (${priority}): ${message}`);
    }

    // Setup global keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Skip navigation when in input fields
            if (this.isEditingContext(event.target)) {
                return;
            }

            const { key, ctrlKey, altKey, shiftKey } = event;

            // Application shortcuts
            if (ctrlKey && shiftKey) {
                switch (key.toUpperCase()) {
                    case 'E':
                        this.announce('탐색기로 이동');
                        break;
                    case 'F':
                        this.announce('검색으로 이동');
                        break;
                    case 'G':
                        this.announce('소스 제어로 이동');
                        break;
                }
            }

            // Accessibility shortcuts
            if (altKey) {
                switch (key) {
                    case '1':
                        event.preventDefault();
                        this.focusManager.focusActivityBar();
                        this.announce('액티비티 바에 포커스');
                        break;
                    case '2':
                        event.preventDefault();
                        this.focusManager.focusExplorer();
                        this.announce('탐색기에 포커스');
                        break;
                    case '3':
                        event.preventDefault();
                        this.focusManager.focusEditor();
                        this.announce('에디터에 포커스');
                        break;
                }
            }
        });
    }

    // Check if element is in editing context
    isEditingContext(element) {
        const editingElements = ['input', 'textarea', 'select'];
        const tagName = element.tagName.toLowerCase();
        
        return editingElements.includes(tagName) || 
               element.contentEditable === 'true' ||
               element.closest('[contenteditable="true"]');
    }

    // Setup reduced motion support
    setupReducedMotion() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        const handleReducedMotion = (mediaQuery) => {
            if (mediaQuery.matches) {
                document.documentElement.classList.add('reduced-motion');
                this.announce('동작 효과가 감소되었습니다');
            } else {
                document.documentElement.classList.remove('reduced-motion');
            }
        };

        handleReducedMotion(prefersReducedMotion);
        prefersReducedMotion.addEventListener('change', handleReducedMotion);
    }

    // Setup high contrast support
    setupHighContrast() {
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
        
        const handleHighContrast = (mediaQuery) => {
            if (mediaQuery.matches) {
                document.documentElement.classList.add('high-contrast');
                this.announce('고대비 모드가 활성화되었습니다');
            } else {
                document.documentElement.classList.remove('high-contrast');
            }
        };

        handleHighContrast(prefersHighContrast);
        prefersHighContrast.addEventListener('change', handleHighContrast);
    }

    // Get accessibility manager instance
    getFocusManager() {
        return this.focusManager;
    }

    getScreenReaderSupport() {
        return this.screenReader;
    }

    getKeyboardNavigation() {
        return this.keyboardNavigation;
    }

    // Cleanup
    destroy() {
        if (this.liveRegion && this.liveRegion.parentNode) {
            this.liveRegion.parentNode.removeChild(this.liveRegion);
        }
        
        this.focusManager.destroy();
        this.screenReader.destroy();
        this.keyboardNavigation.destroy();
    }
}

/**
 * Focus Management for accessible navigation
 */
export class FocusManager {
    constructor() {
        this.focusHistory = [];
        this.currentFocusedElement = null;
        this.focusTrap = null;
        
        this.init();
    }

    init() {
        this.setupFocusTracking();
        this.setupFocusTrap();
    }

    setupFocusTracking() {
        document.addEventListener('focusin', (event) => {
            this.currentFocusedElement = event.target;
            this.addToFocusHistory(event.target);
        });

        document.addEventListener('focusout', (event) => {
            // Store the last focused element
            if (event.target === this.currentFocusedElement) {
                this.lastFocusedElement = event.target;
            }
        });
    }

    addToFocusHistory(element) {
        this.focusHistory.push(element);
        
        // Keep only last 10 elements
        if (this.focusHistory.length > 10) {
            this.focusHistory.shift();
        }
    }

    focusActivityBar() {
        const activityBar = document.querySelector('.activity-bar-item.active');
        if (activityBar) {
            activityBar.focus();
            return true;
        }
        return false;
    }

    focusExplorer() {
        const explorer = document.querySelector('.tree-view');
        if (explorer) {
            explorer.focus();
            return true;
        }
        return false;
    }

    focusEditor() {
        const editor = document.querySelector('.bpmn-editor, .editor-container');
        if (editor) {
            editor.focus();
            return true;
        }
        return false;
    }

    // Focus trap for modals and dialogs
    setupFocusTrap() {
        this.focusTrap = {
            activate: (element) => {
                this.trapContainer = element;
                this.firstFocusableElement = this.getFirstFocusable(element);
                this.lastFocusableElement = this.getLastFocusable(element);
                
                element.addEventListener('keydown', this.handleTrapKeydown.bind(this));
                
                if (this.firstFocusableElement) {
                    this.firstFocusableElement.focus();
                }
            },
            
            deactivate: () => {
                if (this.trapContainer) {
                    this.trapContainer.removeEventListener('keydown', this.handleTrapKeydown);
                    this.trapContainer = null;
                }
            }
        };
    }

    handleTrapKeydown(event) {
        if (event.key !== 'Tab') return;

        if (event.shiftKey) {
            // Shift + Tab
            if (document.activeElement === this.firstFocusableElement) {
                event.preventDefault();
                this.lastFocusableElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === this.lastFocusableElement) {
                event.preventDefault();
                this.firstFocusableElement.focus();
            }
        }
    }

    getFirstFocusable(container) {
        const focusableElements = this.getFocusableElements(container);
        return focusableElements[0] || null;
    }

    getLastFocusable(container) {
        const focusableElements = this.getFocusableElements(container);
        return focusableElements[focusableElements.length - 1] || null;
    }

    getFocusableElements(container) {
        const selector = `
            button:not([disabled]),
            [href],
            input:not([disabled]),
            select:not([disabled]),
            textarea:not([disabled]),
            [tabindex]:not([tabindex="-1"]),
            [contenteditable="true"]
        `;
        
        return Array.from(container.querySelectorAll(selector))
            .filter(element => this.isVisible(element));
    }

    isVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
    }

    restoreFocus() {
        if (this.lastFocusedElement && this.isVisible(this.lastFocusedElement)) {
            this.lastFocusedElement.focus();
            return true;
        }
        return false;
    }

    destroy() {
        this.focusHistory = [];
        this.currentFocusedElement = null;
        this.lastFocusedElement = null;
        
        if (this.focusTrap) {
            this.focusTrap.deactivate();
        }
    }
}

/**
 * Screen Reader Support
 */
export class ScreenReaderSupport {
    constructor() {
        this.ariaDescriptions = new Map();
        this.liveRegions = new Map();
    }

    // Enhanced ARIA label generation
    generateAriaLabel(element, context = {}) {
        const { type, name, level, expanded, selected, position, total } = context;
        
        let label = name || element.textContent || '';
        
        // Add context information
        if (type) {
            label += `, ${type}`;
        }
        
        if (level !== undefined) {
            label += `, 레벨 ${level}`;
        }
        
        if (expanded !== undefined) {
            label += expanded ? ', 확장됨' : ', 축소됨';
        }
        
        if (selected !== undefined) {
            label += selected ? ', 선택됨' : ', 선택되지 않음';
        }
        
        if (position !== undefined && total !== undefined) {
            label += `, ${total} 중 ${position}번째`;
        }
        
        return label;
    }

    // Set ARIA descriptions for complex elements
    setAriaDescription(element, description) {
        const descId = `desc-${Math.random().toString(36).substr(2, 9)}`;
        
        let descElement = document.getElementById(descId);
        if (!descElement) {
            descElement = document.createElement('div');
            descElement.id = descId;
            descElement.className = 'sr-only';
            descElement.style.cssText = `
                position: absolute !important;
                width: 1px !important;
                height: 1px !important;
                padding: 0 !important;
                margin: -1px !important;
                overflow: hidden !important;
                clip: rect(0, 0, 0, 0) !important;
                white-space: nowrap !important;
                border: 0 !important;
            `;
            document.body.appendChild(descElement);
        }
        
        descElement.textContent = description;
        element.setAttribute('aria-describedby', descId);
        
        this.ariaDescriptions.set(element, descId);
    }

    // Create specialized live region
    createLiveRegion(id, priority = 'polite') {
        const liveRegion = document.createElement('div');
        liveRegion.id = id;
        liveRegion.setAttribute('aria-live', priority);
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        liveRegion.style.cssText = `
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
        `;
        
        document.body.appendChild(liveRegion);
        this.liveRegions.set(id, liveRegion);
        
        return liveRegion;
    }

    // Announce to specific live region
    announceToRegion(regionId, message) {
        const region = this.liveRegions.get(regionId);
        if (region) {
            region.textContent = message;
            
            setTimeout(() => {
                region.textContent = '';
            }, 1000);
        }
    }

    // Enhanced tree item ARIA setup
    setupTreeItemAria(element, item, context) {
        const { level, position, total, expanded, selected } = context;
        
        // Core ARIA attributes
        element.setAttribute('role', 'treeitem');
        element.setAttribute('aria-level', level);
        element.setAttribute('aria-setsize', total);
        element.setAttribute('aria-posinset', position);
        
        if (expanded !== undefined) {
            element.setAttribute('aria-expanded', expanded);
        }
        
        if (selected !== undefined) {
            element.setAttribute('aria-selected', selected);
        }
        
        // Generate comprehensive label
        const ariaLabel = this.generateAriaLabel(element, {
            type: item.type === 'folder' ? '폴더' : '파일',
            name: item.label,
            level,
            expanded,
            selected,
            position,
            total
        });
        
        element.setAttribute('aria-label', ariaLabel);
        
        // Add description for additional context
        if (item.description || item.size || item.lastModified) {
            let description = '';
            if (item.description) description += item.description + '. ';
            if (item.size) description += `크기: ${item.formatSize()}. `;
            if (item.lastModified) description += `수정일: ${item.formatLastModified()}.`;
            
            this.setAriaDescription(element, description.trim());
        }
    }

    // Cleanup
    destroy() {
        // Remove all ARIA descriptions
        this.ariaDescriptions.forEach((descId, element) => {
            const descElement = document.getElementById(descId);
            if (descElement) {
                descElement.remove();
            }
            element.removeAttribute('aria-describedby');
        });
        
        // Remove all live regions
        this.liveRegions.forEach(region => {
            if (region.parentNode) {
                region.parentNode.removeChild(region);
            }
        });
        
        this.ariaDescriptions.clear();
        this.liveRegions.clear();
    }
}

/**
 * Keyboard Navigation Manager
 */
export class KeyboardNavigationManager {
    constructor() {
        this.navigationModes = {
            TREE: 'tree',
            GRID: 'grid',
            LIST: 'list'
        };
        
        this.currentMode = this.navigationModes.TREE;
        this.roving = new RovingTabIndex();
    }

    // Setup keyboard navigation for tree view
    setupTreeNavigation(container) {
        container.addEventListener('keydown', (event) => {
            if (this.handleTreeKeydown(event)) {
                event.preventDefault();
                event.stopPropagation();
            }
        });
    }

    handleTreeKeydown(event) {
        const { key, ctrlKey, shiftKey, target } = event;
        const currentItem = target.closest('.tree-item');
        
        if (!currentItem) return false;

        switch (key) {
            case 'ArrowDown':
                return this.navigateToNext(currentItem, shiftKey);
            case 'ArrowUp':
                return this.navigateToPrevious(currentItem, shiftKey);
            case 'ArrowRight':
                return this.expandOrNavigateInto(currentItem);
            case 'ArrowLeft':
                return this.collapseOrNavigateOut(currentItem);
            case 'Home':
                return this.navigateToFirst(currentItem.closest('.tree-view'));
            case 'End':
                return this.navigateToLast(currentItem.closest('.tree-view'));
            case 'Enter':
            case ' ':
                return this.activateItem(currentItem);
            case '*':
                return this.expandAllSiblings(currentItem);
            default:
                return false;
        }
    }

    navigateToNext(currentItem, selectRange = false) {
        const nextItem = this.getNextTreeItem(currentItem);
        if (nextItem) {
            this.focusTreeItem(nextItem);
            if (selectRange) {
                // Handle range selection
                this.handleRangeSelection(currentItem, nextItem);
            }
            return true;
        }
        return false;
    }

    navigateToPrevious(currentItem, selectRange = false) {
        const prevItem = this.getPreviousTreeItem(currentItem);
        if (prevItem) {
            this.focusTreeItem(prevItem);
            if (selectRange) {
                this.handleRangeSelection(currentItem, prevItem);
            }
            return true;
        }
        return false;
    }

    getNextTreeItem(currentItem) {
        const allItems = Array.from(currentItem.closest('.tree-view').querySelectorAll('.tree-item'));
        const currentIndex = allItems.indexOf(currentItem);
        return allItems[currentIndex + 1] || null;
    }

    getPreviousTreeItem(currentItem) {
        const allItems = Array.from(currentItem.closest('.tree-view').querySelectorAll('.tree-item'));
        const currentIndex = allItems.indexOf(currentItem);
        return allItems[currentIndex - 1] || null;
    }

    focusTreeItem(item) {
        if (item) {
            item.focus();
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    expandOrNavigateInto(currentItem) {
        const expandButton = currentItem.querySelector('.tree-item-expand');
        if (expandButton && currentItem.getAttribute('aria-expanded') === 'false') {
            expandButton.click();
            return true;
        } else {
            return this.navigateToNext(currentItem);
        }
    }

    collapseOrNavigateOut(currentItem) {
        const expandButton = currentItem.querySelector('.tree-item-expand');
        if (expandButton && currentItem.getAttribute('aria-expanded') === 'true') {
            expandButton.click();
            return true;
        } else {
            // Navigate to parent
            const level = parseInt(currentItem.getAttribute('aria-level'));
            if (level > 1) {
                const parentItem = this.findParentTreeItem(currentItem, level - 1);
                if (parentItem) {
                    this.focusTreeItem(parentItem);
                    return true;
                }
            }
        }
        return false;
    }

    findParentTreeItem(currentItem, targetLevel) {
        let item = currentItem.previousElementSibling;
        while (item) {
            const itemLevel = parseInt(item.getAttribute('aria-level'));
            if (itemLevel === targetLevel) {
                return item;
            }
            item = item.previousElementSibling;
        }
        return null;
    }

    navigateToFirst(container) {
        const firstItem = container.querySelector('.tree-item');
        if (firstItem) {
            this.focusTreeItem(firstItem);
            return true;
        }
        return false;
    }

    navigateToLast(container) {
        const items = container.querySelectorAll('.tree-item');
        const lastItem = items[items.length - 1];
        if (lastItem) {
            this.focusTreeItem(lastItem);
            return true;
        }
        return false;
    }

    activateItem(item) {
        item.click();
        return true;
    }

    expandAllSiblings(currentItem) {
        const level = parseInt(currentItem.getAttribute('aria-level'));
        const container = currentItem.closest('.tree-view');
        const items = container.querySelectorAll(`.tree-item[aria-level="${level}"]`);
        
        items.forEach(item => {
            const expandButton = item.querySelector('.tree-item-expand');
            if (expandButton && item.getAttribute('aria-expanded') === 'false') {
                expandButton.click();
            }
        });
        
        return true;
    }

    handleRangeSelection(fromItem, toItem) {
        // Implement range selection logic
        console.log('Range selection from', fromItem, 'to', toItem);
    }

    destroy() {
        this.roving.destroy();
    }
}

/**
 * Roving Tab Index implementation
 */
export class RovingTabIndex {
    constructor() {
        this.containers = new Set();
    }

    manage(container, itemSelector = '[tabindex]') {
        this.containers.add({ container, itemSelector });
        this.setupRoving(container, itemSelector);
    }

    setupRoving(container, itemSelector) {
        const items = container.querySelectorAll(itemSelector);
        
        // Set initial tab index
        items.forEach((item, index) => {
            item.tabIndex = index === 0 ? 0 : -1;
        });

        container.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                this.handleArrowNavigation(event, container, itemSelector);
            }
        });

        container.addEventListener('focus', (event) => {
            this.updateTabIndex(event.target, container, itemSelector);
        }, true);
    }

    handleArrowNavigation(event, container, itemSelector) {
        const items = Array.from(container.querySelectorAll(itemSelector));
        const currentIndex = items.indexOf(event.target);
        
        let nextIndex;
        if (event.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % items.length;
        } else {
            nextIndex = (currentIndex - 1 + items.length) % items.length;
        }
        
        const nextItem = items[nextIndex];
        if (nextItem) {
            this.updateTabIndex(nextItem, container, itemSelector);
            nextItem.focus();
            event.preventDefault();
        }
    }

    updateTabIndex(focusedItem, container, itemSelector) {
        const items = container.querySelectorAll(itemSelector);
        items.forEach(item => {
            item.tabIndex = item === focusedItem ? 0 : -1;
        });
    }

    destroy() {
        this.containers.clear();
    }
}

export default AccessibilityManager;