/**
 * 역할 기반 접근 제어 (RBAC) 유틸리티
 */

export class RBACManager {
  constructor() {
    // 역할 계층 정의 (높은 숫자 = 높은 권한)
    this.roleHierarchy = {
      'viewer': 1,
      'editor': 2, 
      'admin': 3,
      'owner': 4
    };

    // 권한 정의
    this.permissions = {
      // 프로젝트 권한
      'project.view': ['viewer', 'editor', 'admin', 'owner'],
      'project.edit': ['admin', 'owner'],
      'project.delete': ['owner'],
      'project.settings': ['admin', 'owner'],
      
      // 멤버 관리 권한
      'members.view': ['viewer', 'editor', 'admin', 'owner'],
      'members.invite': ['admin', 'owner'],
      'members.remove': ['admin', 'owner'],
      'members.change_role': ['owner'],
      
      // 다이어그램 권한
      'diagram.view': ['viewer', 'editor', 'admin', 'owner'],
      'diagram.create': ['editor', 'admin', 'owner'],
      'diagram.edit': ['editor', 'admin', 'owner'],
      'diagram.delete': ['editor', 'admin', 'owner'],
      'diagram.share': ['admin', 'owner'],
      
      // 폴더 권한
      'folder.view': ['viewer', 'editor', 'admin', 'owner'],
      'folder.create': ['editor', 'admin', 'owner'],
      'folder.edit': ['editor', 'admin', 'owner'],
      'folder.delete': ['editor', 'admin', 'owner'],
      
      // 댓글 권한
      'comment.view': ['viewer', 'editor', 'admin', 'owner'],
      'comment.create': ['editor', 'admin', 'owner'],
      'comment.edit': ['editor', 'admin', 'owner'], // 자신의 댓글만
      'comment.delete': ['admin', 'owner'],
      
      // 버전 관리 권한
      'version.view': ['viewer', 'editor', 'admin', 'owner'],
      'version.restore': ['admin', 'owner'],
      
      // 활동 로그 권한
      'activity.view': ['admin', 'owner']
    };
  }

  /**
   * 사용자가 특정 권한을 가지고 있는지 확인
   */
  hasPermission(userRole, permission) {
    if (!userRole || !permission) return false;
    
    const allowedRoles = this.permissions[permission];
    if (!allowedRoles) return false;
    
    return allowedRoles.includes(userRole);
  }

  /**
   * 사용자 역할이 최소 요구 역할 이상인지 확인
   */
  hasMinimumRole(userRole, minimumRole) {
    if (!userRole || !minimumRole) return false;
    
    const userLevel = this.roleHierarchy[userRole] || 0;
    const minimumLevel = this.roleHierarchy[minimumRole] || 0;
    
    return userLevel >= minimumLevel;
  }

  /**
   * 사용자가 다른 사용자의 역할을 변경할 수 있는지 확인
   */
  canChangeRole(currentUserRole, targetUserRole, newRole) {
    const currentLevel = this.roleHierarchy[currentUserRole] || 0;
    const targetLevel = this.roleHierarchy[targetUserRole] || 0;
    const newLevel = this.roleHierarchy[newRole] || 0;
    
    // owner만 역할 변경 가능, 그리고 자신보다 낮은 역할만 변경 가능
    return currentUserRole === 'owner' && 
           currentLevel > targetLevel && 
           currentLevel > newLevel;
  }

  /**
   * 사용자가 다른 사용자를 제거할 수 있는지 확인
   */
  canRemoveMember(currentUserRole, targetUserRole) {
    const currentLevel = this.roleHierarchy[currentUserRole] || 0;
    const targetLevel = this.roleHierarchy[targetUserRole] || 0;
    
    // admin 이상이고, 자신보다 낮은 역할만 제거 가능
    return this.hasMinimumRole(currentUserRole, 'admin') && 
           currentLevel > targetLevel;
  }

  /**
   * 역할에 대한 한글 이름 반환
   */
  getRoleDisplayName(role) {
    const roleNames = {
      'owner': '소유자',
      'admin': '관리자', 
      'editor': '편집자',
      'viewer': '뷰어'
    };
    
    return roleNames[role] || role;
  }

  /**
   * 역할에 대한 설명 반환
   */
  getRoleDescription(role) {
    const descriptions = {
      'owner': '프로젝트의 모든 권한을 가지며, 프로젝트를 삭제할 수 있습니다.',
      'admin': '멤버 관리 및 프로젝트 설정을 변경할 수 있습니다.',
      'editor': '다이어그램과 폴더를 생성, 편집, 삭제할 수 있습니다.',
      'viewer': '프로젝트를 보기만 할 수 있습니다.'
    };
    
    return descriptions[role] || '';
  }

  /**
   * 사용자가 선택할 수 있는 역할 목록 반환
   */
  getAssignableRoles(currentUserRole) {
    const currentLevel = this.roleHierarchy[currentUserRole] || 0;
    
    // owner만 모든 역할 할당 가능 (owner 제외)
    if (currentUserRole === 'owner') {
      return ['admin', 'editor', 'viewer'];
    }
    
    // admin은 editor, viewer만 할당 가능
    if (currentUserRole === 'admin') {
      return ['editor', 'viewer'];
    }
    
    return [];
  }

  /**
   * UI 요소를 역할에 따라 비활성화해야 하는지 확인
   */
  shouldDisableAction(userRole, action, targetRole = null) {
    // 기본 권한 확인
    if (!this.hasPermission(userRole, action)) {
      return true;
    }
    
    // 대상이 있는 경우 계층 확인
    if (targetRole) {
      const userLevel = this.roleHierarchy[userRole] || 0;
      const targetLevel = this.roleHierarchy[targetRole] || 0;
      
      // 자신보다 높거나 같은 역할에는 액션 불가
      return userLevel <= targetLevel;
    }
    
    return false;
  }

  /**
   * 로컬 스토리지에서 사용자의 프로젝트 역할 가져오기
   */
  getUserRoleInProject(userId, projectId) {
    try {
      const projects = JSON.parse(localStorage.getItem('bpmn_projects') || '[]');
      const project = projects.find(p => p.id === projectId);
      
      if (!project || !project.project_members) return null;
      
      const member = project.project_members.find(m => m.user_id === userId);
      return member ? member.role : null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  /**
   * 사용자가 프로젝트의 소유자인지 확인
   */
  isProjectOwner(userId, projectId) {
    const role = this.getUserRoleInProject(userId, projectId);
    return role === 'owner';
  }

  /**
   * 사용자가 프로젝트의 관리자 이상인지 확인
   */
  isProjectAdminOrOwner(userId, projectId) {
    const role = this.getUserRoleInProject(userId, projectId);
    return this.hasMinimumRole(role, 'admin');
  }

  /**
   * 역할별 색상 반환 (UI용)
   */
  getRoleColor(role) {
    const colors = {
      'owner': '#ef4444',      // red
      'admin': '#f59e0b',      // amber  
      'editor': '#10b981',     // emerald
      'viewer': '#6b7280'      // gray
    };
    
    return colors[role] || colors['viewer'];
  }

  /**
   * 역할별 아이콘 반환 (UI용)
   */
  getRoleIcon(role) {
    const icons = {
      'owner': '👑',
      'admin': '🛡️',
      'editor': '✏️', 
      'viewer': '👁️'
    };
    
    return icons[role] || icons['viewer'];
  }
}

// 싱글톤 인스턴스
export const rbacManager = new RBACManager();

// 편의 함수들
export const hasPermission = (userRole, permission) => rbacManager.hasPermission(userRole, permission);
export const hasMinimumRole = (userRole, minimumRole) => rbacManager.hasMinimumRole(userRole, minimumRole);
export const canChangeRole = (currentUserRole, targetUserRole, newRole) => rbacManager.canChangeRole(currentUserRole, targetUserRole, newRole);
export const canRemoveMember = (currentUserRole, targetUserRole) => rbacManager.canRemoveMember(currentUserRole, targetUserRole);
export const getRoleDisplayName = (role) => rbacManager.getRoleDisplayName(role);
export const getRoleDescription = (role) => rbacManager.getRoleDescription(role);
export const getAssignableRoles = (currentUserRole) => rbacManager.getAssignableRoles(currentUserRole);
export const shouldDisableAction = (userRole, action, targetRole) => rbacManager.shouldDisableAction(userRole, action, targetRole);
export const getUserRoleInProject = (userId, projectId) => rbacManager.getUserRoleInProject(userId, projectId);
export const isProjectOwner = (userId, projectId) => rbacManager.isProjectOwner(userId, projectId);
export const isProjectAdminOrOwner = (userId, projectId) => rbacManager.isProjectAdminOrOwner(userId, projectId);
export const getRoleColor = (role) => rbacManager.getRoleColor(role);
export const getRoleIcon = (role) => rbacManager.getRoleIcon(role);