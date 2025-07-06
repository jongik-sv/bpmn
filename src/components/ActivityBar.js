/**
 * VS Code Style Activity Bar Component
 * Manages activity items and view containers like Explorer, Search, etc.
 */
class ActivityBar {
    constructor(container) {
        this.container = container;
        this.activeView = 'explorer';
        this.activities = [
            {
                id: 'explorer',
                title: '탐색기 (Ctrl+Shift+E)',
                icon: 'codicon-files',
                shortcut: 'Ctrl+Shift+E'
            },
            {
                id: 'search',
                title: '검색 (Ctrl+Shift+F)',
                icon: 'codicon-search',
                shortcut: 'Ctrl+Shift+F'
            },
            {
                id: 'source-control',
                title: '소스 제어 (Ctrl+Shift+G)',
                icon: 'codicon-source-control',
                shortcut: 'Ctrl+Shift+G'
            },
            {
                id: 'run-debug',
                title: '실행 및 디버그 (Ctrl+Shift+D)',
                icon: 'codicon-debug-alt',
                shortcut: 'Ctrl+Shift+D'
            },
            {
                id: 'extensions',
                title: '확장 (Ctrl+Shift+X)',
                icon: 'codicon-extensions',
                shortcut: 'Ctrl+Shift+X'
            }
        ];
        
        this.onViewChange = null; // Callback for view changes
        this.init();
    }

    init() {
        this.render();
        this.attachEventListeners();
        this.setAccessibility();
    }

    render() {
        this.container.innerHTML = `
            <div class="activity-bar" role="toolbar" aria-label="기본 도구 모음" style="width: 48px; height: 100%; background-color: #2c2c2c; border-right: 1px solid #3e3e3e; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 100;">
                <div class="activity-bar-content" style="flex: 1; display: flex; flex-direction: column; align-items: center; padding-top: 8px;">
                    ${this.renderActivityItems()}
                </div>
                <div class="activity-bar-bottom" style="display: flex; flex-direction: column; align-items: center; padding-bottom: 8px;">
                    ${this.renderBottomActions()}
                </div>
            </div>
        `;
    }

    renderActivityItems() {
        return this.activities.map(activity => `
            <div class="activity-bar-item ${activity.id === this.activeView ? 'active' : ''}" 
                 data-activity="${activity.id}"
                 role="button"
                 tabindex="0"
                 aria-label="${activity.title}"
                 aria-pressed="${activity.id === this.activeView}"
                 title="${activity.title}"
                 style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; color: ${activity.id === this.activeView ? '#ffffff' : '#999999'}; transition: color 0.1s ease; border: none; background: none; outline: none; ${activity.id === this.activeView ? 'border-left: 2px solid #ffffff;' : ''}">
                <div class="activity-bar-icon" style="font-size: 18px; line-height: 1; color: inherit;">
                    ${this.getActivityIcon(activity.id)}
                </div>
                <div class="activity-bar-badge" style="display: none; position: absolute; top: 8px; right: 8px; min-width: 16px; height: 16px; border-radius: 8px; background-color: #007acc; color: #ffffff; font-size: 9px; font-weight: 600; display: flex; align-items: center; justify-content: center; padding: 0 4px; box-sizing: border-box;">
                    <span class="badge-content">3</span>
                </div>
            </div>
        `).join('');
    }
    
    getActivityIcon(activityId) {
        const iconMap = {
            'explorer': '📁',
            'search': '🔍', 
            'source-control': '🌿',
            'run-debug': '🐛',
            'extensions': '🧩'
        };
        return iconMap[activityId] || '❓';
    }

    renderBottomActions() {
        return `
            <div class="activity-bar-item" 
                 data-activity="accounts"
                 role="button"
                 tabindex="0"
                 aria-label="계정 관리"
                 title="계정 관리">
                <div class="activity-bar-icon" style="font-size: 16px; line-height: 1;">
                    👤
                </div>
            </div>
            <div class="activity-bar-item" 
                 data-activity="settings"
                 role="button"
                 tabindex="0"
                 aria-label="설정 관리"
                 title="설정 관리 (Ctrl+,)">
                <div class="activity-bar-icon" style="font-size: 16px; line-height: 1;">
                    ⚙️
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const activityItems = this.container.querySelectorAll('.activity-bar-item[data-activity]');
        
        activityItems.forEach(item => {
            // Click events
            item.addEventListener('click', (e) => {
                this.handleActivityClick(e, item);
            });

            // Keyboard events
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleActivityClick(e, item);
                }
            });

            // Focus events for accessibility
            item.addEventListener('focus', () => {
                item.classList.add('focused');
            });

            item.addEventListener('blur', () => {
                item.classList.remove('focused');
            });

            // Hover effects
            item.addEventListener('mouseenter', () => {
                this.showTooltip(item);
            });

            item.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    handleActivityClick(event, item) {
        const activityId = item.dataset.activity;
        
        // Skip if clicking on bottom actions for now
        if (['accounts', 'settings'].includes(activityId)) {
            console.log(`${activityId} clicked`);
            return;
        }

        // Update active state
        this.setActiveView(activityId);

        // Trigger view change callback
        if (this.onViewChange) {
            this.onViewChange(activityId, this.activeView);
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
                this.setActiveView(shortcuts[key.toUpperCase()]);
                
                if (this.onViewChange) {
                    this.onViewChange(shortcuts[key.toUpperCase()], this.activeView);
                }
            }
        }
    }

    setActiveView(viewId) {
        // Remove active class from all items
        const allItems = this.container.querySelectorAll('.activity-bar-item');
        allItems.forEach(item => {
            item.classList.remove('active');
            item.setAttribute('aria-pressed', 'false');
        });

        // Add active class to selected item
        const activeItem = this.container.querySelector(`[data-activity="${viewId}"]`);
        if (activeItem && this.activities.some(a => a.id === viewId)) {
            activeItem.classList.add('active');
            activeItem.setAttribute('aria-pressed', 'true');
            this.activeView = viewId;
        }
    }

    setAccessibility() {
        // Set ARIA navigation
        const activityItems = this.container.querySelectorAll('.activity-bar-item');
        activityItems.forEach((item, index) => {
            item.setAttribute('aria-setsize', activityItems.length);
            item.setAttribute('aria-posinset', index + 1);
        });
    }

    showTooltip(item) {
        // Simple tooltip implementation
        const tooltip = document.createElement('div');
        tooltip.className = 'activity-bar-tooltip';
        tooltip.textContent = item.getAttribute('title');
        
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

    // Public API
    getActiveView() {
        return this.activeView;
    }

    setOnViewChangeCallback(callback) {
        this.onViewChange = callback;
    }

    setBadge(activityId, count) {
        const item = this.container.querySelector(`[data-activity="${activityId}"]`);
        if (item) {
            const badge = item.querySelector('.activity-bar-badge');
            const badgeContent = badge.querySelector('.badge-content');
            
            if (count > 0) {
                badgeContent.textContent = count > 99 ? '99+' : count.toString();
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    destroy() {
        this.hideTooltip();
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
    }
}

export default ActivityBar;