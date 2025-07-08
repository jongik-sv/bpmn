/**
 * BPMN Editor Header Component
 * 브레드크럼, 룸 접속자 정보, 대시보드 버튼을 포함하는 헤더
 */

class EditorHeader {
    constructor() {
        this.container = null;
        this.breadcrumbData = [];
        this.connectedUsers = [];
        this.onDashboardClick = null;
        
        this.init();
    }

    init() {
        this.createHeader();
        this.setupEventListeners();
    }

    createHeader() {
        this.container = document.createElement('div');
        this.container.className = 'editor-header';
        this.container.innerHTML = `
            <div class="editor-header-content">
                <!-- 왼쪽: Breadcrumb -->
                <div class="editor-header-left">
                    <nav class="breadcrumb" aria-label="현재 위치">
                        <ol class="breadcrumb-list">
                            <li class="breadcrumb-item">
                                <span class="breadcrumb-icon">🏠</span>
                                <span class="breadcrumb-text">프로젝트</span>
                            </li>
                        </ol>
                    </nav>
                </div>
                
                <!-- 오른쪽: 사용자 정보 & 버튼들 -->
                <div class="editor-header-right">
                    <!-- 룸 접속자 정보 -->
                    <div class="connected-users">
                        <div class="users-list">
                            <div class="user-indicator offline">
                                <span class="user-avatar">👤</span>
                                <span class="user-count">0</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 버튼들 -->
                    <div class="header-actions">
                        <button class="action-btn dashboard-btn" title="대시보드로 이동">
                            <span class="btn-icon">🏠</span>
                            <span class="btn-text">대시보드</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // 대시보드 버튼 클릭
        const dashboardBtn = this.container.querySelector('.dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', () => {
                if (this.onDashboardClick) {
                    this.onDashboardClick();
                }
            });
        }
    }

    /**
     * 브레드크럼 데이터 업데이트
     * @param {Array} breadcrumbData - 브레드크럼 데이터 배열
     */
    updateBreadcrumb(breadcrumbData) {
        this.breadcrumbData = breadcrumbData || [];
        this.renderBreadcrumb();
    }

    renderBreadcrumb() {
        const breadcrumbList = this.container.querySelector('.breadcrumb-list');
        if (!breadcrumbList) return;

        breadcrumbList.innerHTML = '';
        
        // 홈 아이템 (항상 표시)
        const homeItem = document.createElement('li');
        homeItem.className = 'breadcrumb-item';
        homeItem.innerHTML = `
            <button class="breadcrumb-link" data-action="home">
                <span class="breadcrumb-icon">🏠</span>
                <span class="breadcrumb-text">홈</span>
            </button>
        `;
        breadcrumbList.appendChild(homeItem);

        // 동적 브레드크럼 아이템들
        this.breadcrumbData.forEach((item, index) => {
            const separator = document.createElement('li');
            separator.className = 'breadcrumb-separator';
            separator.innerHTML = '<span class="separator-icon">›</span>';
            breadcrumbList.appendChild(separator);

            const breadcrumbItem = document.createElement('li');
            breadcrumbItem.className = 'breadcrumb-item';
            
            const isLast = index === this.breadcrumbData.length - 1;
            if (isLast) {
                breadcrumbItem.innerHTML = `
                    <span class="breadcrumb-current">
                        <span class="breadcrumb-icon">${item.icon || '📄'}</span>
                        <span class="breadcrumb-text">${this.escapeHtml(item.name)}</span>
                    </span>
                `;
            } else {
                breadcrumbItem.innerHTML = `
                    <button class="breadcrumb-link" data-action="navigate" data-id="${item.id}">
                        <span class="breadcrumb-icon">${item.icon || '📁'}</span>
                        <span class="breadcrumb-text">${this.escapeHtml(item.name)}</span>
                    </button>
                `;
            }
            
            breadcrumbList.appendChild(breadcrumbItem);
        });

        // 브레드크럼 클릭 이벤트 (이벤트 위임 사용)
        if (!breadcrumbList.dataset.listenerAdded) {
            breadcrumbList.addEventListener('click', (e) => {
                const link = e.target.closest('.breadcrumb-link');
                if (link) {
                    const action = link.dataset.action;
                    const id = link.dataset.id;
                    
                    if (action === 'home') {
                        this.onBreadcrumbClick?.('home');
                    } else if (action === 'navigate' && id) {
                        this.onBreadcrumbClick?.(id);
                    }
                }
            });
            breadcrumbList.dataset.listenerAdded = 'true';
        }
    }

    /**
     * HTML 이스케이프 처리
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 접속자 정보 업데이트
     * @param {Array} users - 접속자 배열
     */
    updateConnectedUsers(users) {
        this.connectedUsers = users || [];
        this.renderConnectedUsers();
    }

    renderConnectedUsers() {
        const usersList = this.container.querySelector('.users-list');
        if (!usersList) return;

        const userCount = this.connectedUsers.length;

        if (userCount === 0) {
            usersList.innerHTML = `
                <div class="user-indicator offline">
                    <span class="user-avatar">👤</span>
                    <span class="user-count">오프라인</span>
                </div>
            `;
        } else if (userCount === 1) {
            const user = this.connectedUsers[0];
            const userName = this.escapeHtml(user.name || 'Anonymous');
            const userAvatar = this.escapeHtml(user.avatar || '👤');
            
            usersList.innerHTML = `
                <div class="user-indicator online single">
                    <span class="user-avatar">${userAvatar}</span>
                    <span class="user-name">${userName}</span>
                </div>
            `;
        } else {
            // 다중 사용자 표시
            const displayUsers = this.connectedUsers.slice(0, 3); // 최대 3명까지 표시
            const remainingCount = Math.max(0, userCount - 3);
            
            let usersHtml = displayUsers.map(user => {
                const userName = this.escapeHtml(user.name || 'Anonymous');
                const userAvatar = this.escapeHtml(user.avatar || '👤');
                return `<span class="user-avatar" title="${userName}">${userAvatar}</span>`;
            }).join('');
            
            if (remainingCount > 0) {
                usersHtml += `<span class="user-more">+${remainingCount}</span>`;
            }
            
            usersList.innerHTML = `
                <div class="user-indicator online multiple">
                    <div class="user-avatars">${usersHtml}</div>
                    <span class="user-count">${userCount}명 접속</span>
                </div>
            `;
        }
    }

    /**
     * 헤더 컨테이너 반환
     */
    getContainer() {
        return this.container;
    }

    /**
     * 이벤트 핸들러 설정
     */
    setEventHandlers({ onDashboardClick, onBreadcrumbClick }) {
        this.onDashboardClick = onDashboardClick;
        this.onBreadcrumbClick = onBreadcrumbClick;
    }

    /**
     * 헤더 표시/숨김
     */
    setVisible(visible) {
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * 정리
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
}

export default EditorHeader;