/**
 * Activity Bar Core - 핵심 렌더링 및 상태 관리
 * VS Code 스타일 Activity Bar의 핵심 기능을 담당
 */

class ActivityBarCore {
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
        
        this.badges = new Map(); // 배지 상태 관리
        this.eventListeners = new Map(); // 이벤트 리스너 관리
        
        this.init();
    }

    init() {
        this.render();
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
        return this.activities.map(activity => {
            const badgeCount = this.badges.get(activity.id) || 0;
            return `
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
                    <div class="activity-bar-badge" style="display: ${badgeCount > 0 ? 'flex' : 'none'}; position: absolute; top: 8px; right: 8px; min-width: 16px; height: 16px; border-radius: 8px; background-color: #007acc; color: #ffffff; font-size: 9px; font-weight: 600; align-items: center; justify-content: center; padding: 0 4px; box-sizing: border-box;">
                        <span class="badge-content">${badgeCount > 99 ? '99+' : badgeCount}</span>
                    </div>
                </div>
            `;
        }).join('');
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

    setActiveView(viewId) {
        // Remove active class from all items
        const allItems = this.container.querySelectorAll('.activity-bar-item');
        allItems.forEach(item => {
            item.classList.remove('active');
            item.setAttribute('aria-pressed', 'false');
            item.style.color = '#999999';
            item.style.borderLeft = 'none';
        });

        // Add active class to selected item
        const activeItem = this.container.querySelector(`[data-activity="${viewId}"]`);
        if (activeItem && this.activities.some(a => a.id === viewId)) {
            activeItem.classList.add('active');
            activeItem.setAttribute('aria-pressed', 'true');
            activeItem.style.color = '#ffffff';
            activeItem.style.borderLeft = '2px solid #ffffff';
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

    setBadge(activityId, count) {
        this.badges.set(activityId, count);
        
        const item = this.container.querySelector(`[data-activity="${activityId}"]`);
        if (item) {
            const badge = item.querySelector('.activity-bar-badge');
            const badgeContent = badge.querySelector('.badge-content');
            
            if (count > 0) {
                badgeContent.textContent = count > 99 ? '99+' : count.toString();
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    getActiveView() {
        return this.activeView;
    }

    getActivities() {
        return this.activities;
    }

    getActivityItems() {
        return this.container.querySelectorAll('.activity-bar-item[data-activity]');
    }

    destroy() {
        this.badges.clear();
        this.eventListeners.clear();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export { ActivityBarCore };