/**
 * Editor Header Core - 핵심 헤더 렌더링 및 상태 관리
 * 브레드크럼, 사용자 정보, 액션 버튼 등의 핵심 기능을 담당
 */

class EditorHeaderCore {
    constructor() {
        this.container = null;
        this.breadcrumbData = [];
        this.connectedUsers = [];
        this.isVisible = false;
        
        this.init();
    }

    init() {
        this.createHeader();
    }

    createHeader() {
        this.container = document.createElement('div');
        this.container.className = 'editor-header';
        this.container.style.cssText = `
            display: none;
            background-color: #2d2d30;
            border-bottom: 1px solid #3e3e3e;
            padding: 8px 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
            font-size: 13px;
            color: #cccccc;
            min-height: 40px;
        `;
        
        this.container.innerHTML = `
            <div class="editor-header-content" style="display: flex; align-items: center; justify-content: space-between;">
                <!-- 왼쪽: Breadcrumb -->
                <div class="editor-header-left" style="flex: 1;">
                    <nav class="breadcrumb" aria-label="현재 위치">
                        <ol class="breadcrumb-list" style="display: flex; align-items: center; margin: 0; padding: 0; list-style: none;">
                            <li class="breadcrumb-item">
                                <span class="breadcrumb-icon">🏠</span>
                                <span class="breadcrumb-text">프로젝트</span>
                            </li>
                        </ol>
                    </nav>
                </div>
                
                <!-- 오른쪽: 사용자 정보 & 버튼들 -->
                <div class="editor-header-right" style="display: flex; align-items: center; gap: 12px;">
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
                        <button class="action-btn dashboard-btn" title="대시보드로 이동" style="
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            padding: 6px 12px;
                            background-color: #0e639c;
                            color: #ffffff;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 13px;
                            transition: background-color 0.2s;
                        " onmouseover="this.style.backgroundColor='#1177bb'" onmouseout="this.style.backgroundColor='#0e639c'">
                            <span class="btn-icon">🏠</span>
                            <span class="btn-text">대시보드</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 브레드크럼 데이터 업데이트
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
        homeItem.style.cssText = `
            display: flex;
            align-items: center;
        `;
        homeItem.innerHTML = `
            <button class="breadcrumb-link" data-action="home" style="
                display: flex;
                align-items: center;
                gap: 4px;
                background: none;
                border: none;
                color: #cccccc;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 3px;
                font-size: 13px;
                transition: background-color 0.2s;
            " onmouseover="this.style.backgroundColor='#37373d'" onmouseout="this.style.backgroundColor='transparent'">
                <span class="breadcrumb-icon">🏠</span>
                <span class="breadcrumb-text">홈</span>
            </button>
        `;
        breadcrumbList.appendChild(homeItem);

        // 동적 브레드크럼 아이템들
        this.breadcrumbData.forEach((item, index) => {
            const separator = document.createElement('li');
            separator.className = 'breadcrumb-separator';
            separator.style.cssText = `
                display: flex;
                align-items: center;
                color: #666666;
                margin: 0 4px;
            `;
            separator.innerHTML = '<span class="separator-icon">›</span>';
            breadcrumbList.appendChild(separator);

            const breadcrumbItem = document.createElement('li');
            breadcrumbItem.className = 'breadcrumb-item';
            breadcrumbItem.style.cssText = `
                display: flex;
                align-items: center;
            `;
            
            const isLast = index === this.breadcrumbData.length - 1;
            if (isLast) {
                breadcrumbItem.innerHTML = `
                    <span class="breadcrumb-current" style="
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        color: #ffffff;
                        font-weight: 500;
                        padding: 4px 8px;
                    ">
                        <span class="breadcrumb-icon">${item.icon || '📄'}</span>
                        <span class="breadcrumb-text">${this.escapeHtml(item.name)}</span>
                    </span>
                `;
            } else {
                breadcrumbItem.innerHTML = `
                    <button class="breadcrumb-link" data-action="navigate" data-id="${item.id}" style="
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        background: none;
                        border: none;
                        color: #cccccc;
                        cursor: pointer;
                        padding: 4px 8px;
                        border-radius: 3px;
                        font-size: 13px;
                        transition: background-color 0.2s;
                    " onmouseover="this.style.backgroundColor='#37373d'" onmouseout="this.style.backgroundColor='transparent'">
                        <span class="breadcrumb-icon">${item.icon || '📁'}</span>
                        <span class="breadcrumb-text">${this.escapeHtml(item.name)}</span>
                    </button>
                `;
            }
            
            breadcrumbList.appendChild(breadcrumbItem);
        });
    }

    /**
     * 접속자 정보 업데이트
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
                <div class="user-indicator offline" style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #666666;
                    font-size: 12px;
                ">
                    <span class="user-avatar">👤</span>
                    <span class="user-count">오프라인</span>
                </div>
            `;
        } else if (userCount === 1) {
            const user = this.connectedUsers[0];
            const userName = this.escapeHtml(user.name || 'Anonymous');
            const userAvatar = this.escapeHtml(user.avatar || '👤');
            
            usersList.innerHTML = `
                <div class="user-indicator online single" style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #4caf50;
                    font-size: 12px;
                ">
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
                return `<span class="user-avatar" title="${userName}" style="margin-right: 2px;">${userAvatar}</span>`;
            }).join('');
            
            if (remainingCount > 0) {
                usersHtml += `<span class="user-more" style="
                    font-size: 11px;
                    color: #999999;
                    margin-left: 4px;
                ">+${remainingCount}</span>`;
            }
            
            usersList.innerHTML = `
                <div class="user-indicator online multiple" style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #4caf50;
                    font-size: 12px;
                ">
                    <div class="user-avatars" style="display: flex; align-items: center;">${usersHtml}</div>
                    <span class="user-count">${userCount}명 접속</span>
                </div>
            `;
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
     * 헤더 표시/숨김
     */
    setVisible(visible) {
        this.isVisible = visible;
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * 표시 상태 반환
     */
    getVisible() {
        return this.isVisible;
    }

    /**
     * 헤더 컨테이너 반환
     */
    getContainer() {
        return this.container;
    }

    /**
     * 브레드크럼 리스트 반환
     */
    getBreadcrumbList() {
        return this.container.querySelector('.breadcrumb-list');
    }

    /**
     * 대시보드 버튼 반환
     */
    getDashboardButton() {
        return this.container.querySelector('.dashboard-btn');
    }

    /**
     * 브레드크럼 데이터 반환
     */
    getBreadcrumbData() {
        return this.breadcrumbData;
    }

    /**
     * 접속 사용자 데이터 반환
     */
    getConnectedUsers() {
        return this.connectedUsers;
    }

    /**
     * 정리
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.breadcrumbData = null;
        this.connectedUsers = null;
    }
}

export { EditorHeaderCore };