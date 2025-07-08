/**
 * Activity Bar Event Handler - 이벤트 처리 전담
 * 클릭, 키보드, 포커스 이벤트를 관리
 */

class ActivityBarEventHandler {
    constructor(core) {
        this.core = core;
        this.onViewChange = null;
        this.currentTooltip = null;
        this.eventListeners = [];
        
        this.init();
    }

    init() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        const activityItems = this.core.getActivityItems();
        
        activityItems.forEach(item => {
            // Click events
            const clickHandler = (e) => this.handleActivityClick(e, item);
            item.addEventListener('click', clickHandler);
            this.eventListeners.push({ element: item, type: 'click', handler: clickHandler });

            // Keyboard events
            const keydownHandler = (e) => this.handleKeydown(e, item);
            item.addEventListener('keydown', keydownHandler);
            this.eventListeners.push({ element: item, type: 'keydown', handler: keydownHandler });

            // Focus events for accessibility
            const focusHandler = () => item.classList.add('focused');
            item.addEventListener('focus', focusHandler);
            this.eventListeners.push({ element: item, type: 'focus', handler: focusHandler });

            const blurHandler = () => item.classList.remove('focused');
            item.addEventListener('blur', blurHandler);
            this.eventListeners.push({ element: item, type: 'blur', handler: blurHandler });

            // Hover effects
            const mouseenterHandler = () => this.showTooltip(item);
            item.addEventListener('mouseenter', mouseenterHandler);
            this.eventListeners.push({ element: item, type: 'mouseenter', handler: mouseenterHandler });

            const mouseleaveHandler = () => this.hideTooltip();
            item.addEventListener('mouseleave', mouseleaveHandler);
            this.eventListeners.push({ element: item, type: 'mouseleave', handler: mouseleaveHandler });
        });

        // Keyboard shortcuts
        const shortcutHandler = (e) => this.handleKeyboardShortcuts(e);
        document.addEventListener('keydown', shortcutHandler);
        this.eventListeners.push({ element: document, type: 'keydown', handler: shortcutHandler });
    }

    handleActivityClick(event, item) {
        const activityId = item.dataset.activity;
        
        // Skip if clicking on bottom actions for now
        if (['accounts', 'settings'].includes(activityId)) {
            console.log(`${activityId} clicked`);
            return;
        }

        // Update active state
        this.core.setActiveView(activityId);

        // Trigger view change callback
        if (this.onViewChange) {
            this.onViewChange(activityId, this.core.getActiveView());
        }
    }

    handleKeydown(event, item) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleActivityClick(event, item);
        }
    }

    handleKeyboardShortcuts(event) {
        const { ctrlKey, shiftKey, key } = event;
        
        if (ctrlKey && shiftKey) {
            const shortcuts = {
                'E': 'explorer',
                'F': 'search',
                'G': 'source-control',
                'D': 'run-debug',
                'X': 'extensions'
            };

            if (shortcuts[key.toUpperCase()]) {
                event.preventDefault();
                this.core.setActiveView(shortcuts[key.toUpperCase()]);
                
                if (this.onViewChange) {
                    this.onViewChange(shortcuts[key.toUpperCase()], this.core.getActiveView());
                }
            }
        }
    }

    showTooltip(item) {
        // Simple tooltip implementation
        const tooltip = document.createElement('div');
        tooltip.className = 'activity-bar-tooltip';
        tooltip.textContent = item.getAttribute('title');
        tooltip.style.cssText = `
            position: fixed;
            background: #2d2d30;
            color: #cccccc;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
            border: 1px solid #454545;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transform: translateY(-50%);
        `;
        
        const rect = item.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 8}px`;
        tooltip.style.top = `${rect.top + (rect.height / 2)}px`;
        
        document.body.appendChild(tooltip);
        
        // Store reference for cleanup
        this.currentTooltip = tooltip;
    }

    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }

    setOnViewChangeCallback(callback) {
        this.onViewChange = callback;
    }

    destroy() {
        this.hideTooltip();
        
        // Remove all event listeners
        this.eventListeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this.eventListeners = [];
        
        this.onViewChange = null;
    }
}

export { ActivityBarEventHandler };