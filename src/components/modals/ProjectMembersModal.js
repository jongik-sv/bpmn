import $ from 'jquery';
import { rbacManager, hasPermission, canRemoveMember, canChangeRole, getAssignableRoles, getRoleDisplayName, getRoleDescription, getRoleColor, getRoleIcon } from '../../lib/rbac.js';
import { projectService } from '../../services/ProjectService.js';

/**
 * 프로젝트 멤버 관리 모달
 */
export class ProjectMembersModal {
  constructor() {
    this.currentProject = null;
    this.currentUser = null;
    this.currentUserRole = null;
    this.members = [];
    this.invitations = [];
  }

  /**
   * 모달 표시
   */
  async show(project, user) {
    this.currentProject = project;
    this.currentUser = user;
    this.currentUserRole = rbacManager.getUserRoleInProject(user?.id, project?.id);

    // 권한 확인
    if (!hasPermission(this.currentUserRole, 'members.view')) {
      alert('멤버 목록을 볼 권한이 없습니다.');
      return;
    }

    await this.render();
    await this.loadMembers();
    await this.loadInvitations();
    this.setupEventListeners();
    
    $('#project-members-modal').fadeIn(200);
  }

  /**
   * 모달 숨기기
   */
  hide() {
    $('#project-members-modal').fadeOut(200);
  }

  /**
   * 모달 HTML 렌더링
   */
  async render() {
    const canInvite = hasPermission(this.currentUserRole, 'members.invite');
    
    const modalHtml = `
      <div id="project-members-modal" class="modal-overlay" style="display: none;">
        <div class="modal" style="max-width: 800px;">
          <div class="modal-header">
            <h3>프로젝트 멤버 관리</h3>
            <button class="close-btn" onclick="window.projectMembersModal.hide()">×</button>
          </div>
          <div class="modal-body">
            <!-- 멤버 초대 섹션 -->
            ${canInvite ? `
            <div class="invite-section" style="margin-bottom: 2rem; padding: 1rem; background: var(--gray-50); border-radius: var(--border-radius);">
              <h4 style="margin-bottom: 1rem; color: var(--gray-900);">새 멤버 초대</h4>
              <div style="display: flex; gap: 0.5rem; align-items: end;">
                <div class="form-group" style="flex: 1; margin-bottom: 0;">
                  <label for="invite-email">이메일 주소</label>
                  <input type="email" id="invite-email" placeholder="user@example.com" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="invite-role">역할</label>
                  <select id="invite-role">
                    ${getAssignableRoles(this.currentUserRole).map(role => 
                      `<option value="${role}">${getRoleIcon(role)} ${getRoleDisplayName(role)}</option>`
                    ).join('')}
                  </select>
                </div>
                <button class="btn btn-primary" onclick="window.projectMembersModal.sendInvitation()">
                  초대 보내기
                </button>
              </div>
            </div>
            ` : ''}

            <!-- 현재 멤버 목록 -->
            <div class="members-section">
              <h4 style="margin-bottom: 1rem; color: var(--gray-900);">현재 멤버 (0)</h4>
              <div id="members-list" class="members-list">
                <div class="loading" style="text-align: center; padding: 2rem; color: var(--gray-500);">
                  멤버 목록을 불러오는 중...
                </div>
              </div>
            </div>

            <!-- 대기 중인 초대 -->
            <div class="invitations-section" style="margin-top: 2rem;">
              <h4 style="margin-bottom: 1rem; color: var(--gray-900);">대기 중인 초대 (0)</h4>
              <div id="invitations-list" class="invitations-list">
                <div class="loading" style="text-align: center; padding: 1rem; color: var(--gray-500);">
                  초대 목록을 불러오는 중...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 기존 모달 제거 후 새로 추가
    $('#project-members-modal').remove();
    $('body').append(modalHtml);
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // Enter 키로 초대 보내기
    $('#invite-email').on('keypress', (e) => {
      if (e.which === 13) {
        this.sendInvitation();
      }
    });

    // 모달 외부 클릭 시 닫기
    $('#project-members-modal').on('click', (e) => {
      if (e.target.id === 'project-members-modal') {
        this.hide();
      }
    });
  }

  /**
   * 멤버 목록 로드
   */
  async loadMembers() {
    try {
      // 로컬 스토리지에서 멤버 정보 가져오기 (실제 구현에서는 Supabase에서)
      const project = this.currentProject;
      this.members = project.project_members || [];

      this.renderMembers();
    } catch (error) {
      console.error('Error loading members:', error);
      $('#members-list').html(`
        <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
          멤버 목록을 불러오는데 실패했습니다.
        </div>
      `);
    }
  }

  /**
   * 초대 목록 로드
   */
  async loadInvitations() {
    try {
      // 실제 구현에서는 Supabase에서 초대 목록 가져오기
      this.invitations = []; // 임시로 빈 배열

      this.renderInvitations();
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  }

  /**
   * 멤버 목록 렌더링
   */
  renderMembers() {
    const membersHtml = this.members.map(member => {
      const canChange = canChangeRole(this.currentUserRole, member.role, 'viewer');
      const canRemove = canRemoveMember(this.currentUserRole, member.role);
      const isCurrentUser = member.user_id === this.currentUser?.id;
      
      return `
        <div class="member-item" style="
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          padding: 0.75rem 0; 
          border-bottom: 1px solid var(--gray-200);
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="member-avatar" style="
              width: 40px; 
              height: 40px; 
              border-radius: 50%; 
              background: linear-gradient(135deg, ${getRoleColor(member.role)}22, ${getRoleColor(member.role)}44);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.2rem;
            ">
              ${getRoleIcon(member.role)}
            </div>
            <div>
              <div style="font-weight: 500; color: var(--gray-900);">
                ${member.display_name || member.email || 'Unknown User'}
                ${isCurrentUser ? ' (나)' : ''}
              </div>
              <div style="font-size: 0.875rem; color: var(--gray-600);">
                ${member.email || ''}
              </div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <!-- 역할 표시 -->
            <div class="role-badge" style="
              padding: 0.25rem 0.5rem;
              border-radius: 12px;
              background: ${getRoleColor(member.role)}22;
              color: ${getRoleColor(member.role)};
              font-size: 0.75rem;
              font-weight: 500;
            ">
              ${getRoleDisplayName(member.role)}
            </div>
            
            <!-- 액션 버튼들 -->
            <div style="display: flex; gap: 0.25rem;">
              ${canChange && !isCurrentUser ? `
                <button class="btn btn-sm btn-secondary" onclick="window.projectMembersModal.changeRole('${member.user_id}', '${member.role}')" title="역할 변경">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </button>
              ` : ''}
              
              ${canRemove && !isCurrentUser ? `
                <button class="btn btn-sm btn-secondary" onclick="window.projectMembersModal.removeMember('${member.user_id}', '${member.display_name || member.email}')" title="멤버 제거" style="color: var(--danger-color);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    $('#members-list').html(membersHtml || `
      <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
        아직 멤버가 없습니다.
      </div>
    `);

    // 멤버 수 업데이트
    $('.members-section h4').text(`현재 멤버 (${this.members.length})`);
  }

  /**
   * 초대 목록 렌더링
   */
  renderInvitations() {
    const invitationsHtml = this.invitations.map(invitation => `
      <div class="invitation-item" style="
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        padding: 0.5rem 0; 
        border-bottom: 1px solid var(--gray-200);
      ">
        <div>
          <div style="font-weight: 500; color: var(--gray-900);">
            ${invitation.email}
          </div>
          <div style="font-size: 0.75rem; color: var(--gray-500);">
            ${getRoleDisplayName(invitation.role)} 역할로 초대됨 • ${this.formatDate(invitation.invited_at)}
          </div>
        </div>
        
        <div style="display: flex; gap: 0.25rem;">
          <button class="btn btn-sm btn-secondary" onclick="window.projectMembersModal.resendInvitation('${invitation.id}')" title="재전송">
            📧
          </button>
          <button class="btn btn-sm btn-secondary" onclick="window.projectMembersModal.cancelInvitation('${invitation.id}')" title="취소" style="color: var(--danger-color);">
            ✕
          </button>
        </div>
      </div>
    `).join('');

    $('#invitations-list').html(invitationsHtml || `
      <div style="text-align: center; padding: 1rem; color: var(--gray-500);">
        대기 중인 초대가 없습니다.
      </div>
    `);

    // 초대 수 업데이트
    $('.invitations-section h4').text(`대기 중인 초대 (${this.invitations.length})`);
  }

  /**
   * 새 멤버 초대
   */
  async sendInvitation() {
    const email = $('#invite-email').val().trim();
    const role = $('#invite-role').val();

    if (!email) {
      alert('이메일 주소를 입력해주세요.');
      return;
    }

    if (!this.isValidEmail(email)) {
      alert('올바른 이메일 주소를 입력해주세요.');
      return;
    }

    // 이미 멤버인지 확인
    if (this.members.some(m => m.email === email)) {
      alert('이미 프로젝트 멤버입니다.');
      return;
    }

    try {
      // 실제 구현에서는 Supabase에 초대 정보 저장
      console.log('Sending invitation:', { email, role, project: this.currentProject.id });
      
      // 임시로 로컬에 저장
      const invitation = {
        id: 'inv_' + Date.now(),
        project_id: this.currentProject.id,
        email: email,
        role: role,
        invited_by: this.currentUser.id,
        invited_at: new Date().toISOString(),
        status: 'pending'
      };

      this.invitations.push(invitation);
      this.renderInvitations();

      // 입력 필드 초기화
      $('#invite-email').val('');
      $('#invite-role').val(getAssignableRoles(this.currentUserRole)[0]);

      alert(`${email}에게 초대를 보냈습니다.`);
      
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('초대 전송에 실패했습니다.');
    }
  }

  /**
   * 멤버 역할 변경
   */
  async changeRole(userId, currentRole) {
    const assignableRoles = getAssignableRoles(this.currentUserRole);
    const member = this.members.find(m => m.user_id === userId);
    
    if (!member) return;

    const roleOptions = assignableRoles.map(role => `
      <option value="${role}" ${role === currentRole ? 'selected' : ''}>
        ${getRoleIcon(role)} ${getRoleDisplayName(role)} - ${getRoleDescription(role)}
      </option>
    `).join('');

    const newRole = prompt(`${member.display_name || member.email}의 역할을 변경하세요:\n\n${assignableRoles.map(role => `${getRoleIcon(role)} ${getRoleDisplayName(role)}: ${getRoleDescription(role)}`).join('\n')}\n\n새 역할을 입력하세요 (${assignableRoles.join(', ')}):`);

    if (!newRole || !assignableRoles.includes(newRole)) return;

    if (!canChangeRole(this.currentUserRole, currentRole, newRole)) {
      alert('이 역할로 변경할 권한이 없습니다.');
      return;
    }

    try {
      // 실제 구현에서는 Supabase 업데이트
      const memberIndex = this.members.findIndex(m => m.user_id === userId);
      if (memberIndex !== -1) {
        this.members[memberIndex].role = newRole;
        this.renderMembers();
        alert(`역할이 ${getRoleDisplayName(newRole)}로 변경되었습니다.`);
      }
    } catch (error) {
      console.error('Error changing role:', error);
      alert('역할 변경에 실패했습니다.');
    }
  }

  /**
   * 멤버 제거
   */
  async removeMember(userId, userName) {
    const member = this.members.find(m => m.user_id === userId);
    if (!member) return;

    if (!canRemoveMember(this.currentUserRole, member.role)) {
      alert('이 멤버를 제거할 권한이 없습니다.');
      return;
    }

    if (!confirm(`정말로 ${userName}을 프로젝트에서 제거하시겠습니까?`)) return;

    try {
      // 실제 구현에서는 Supabase에서 제거
      this.members = this.members.filter(m => m.user_id !== userId);
      this.renderMembers();
      alert(`${userName}이 프로젝트에서 제거되었습니다.`);
    } catch (error) {
      console.error('Error removing member:', error);
      alert('멤버 제거에 실패했습니다.');
    }
  }

  /**
   * 초대 재전송
   */
  async resendInvitation(invitationId) {
    try {
      // 실제 구현에서는 Supabase에서 초대 재전송
      alert('초대를 재전송했습니다.');
    } catch (error) {
      console.error('Error resending invitation:', error);
      alert('초대 재전송에 실패했습니다.');
    }
  }

  /**
   * 초대 취소
   */
  async cancelInvitation(invitationId) {
    if (!confirm('정말로 이 초대를 취소하시겠습니까?')) return;

    try {
      this.invitations = this.invitations.filter(inv => inv.id !== invitationId);
      this.renderInvitations();
      alert('초대가 취소되었습니다.');
    } catch (error) {
      console.error('Error canceling invitation:', error);
      alert('초대 취소에 실패했습니다.');
    }
  }

  /**
   * 이메일 유효성 검사
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return Math.floor(diff / 60000) + '분 전';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '시간 전';
    if (diff < 2592000000) return Math.floor(diff / 86400000) + '일 전';
    
    return date.toLocaleDateString('ko-KR');
  }
}

// 전역 인스턴스
window.projectMembersModal = new ProjectMembersModal();