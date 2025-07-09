import { EventEmitter } from 'events';
import $ from 'jquery';

/**
 * BPMN 에디터의 자동 저장 및 데이터 영속성을 담당하는 클래스
 * 디바운스 기반 자동 저장, 로컬/서버 저장 전략 관리
 */
export class BpmnAutoSave extends EventEmitter {
  constructor(bpmnEditorCore) {
    super();
    
    this.editorCore = bpmnEditorCore;
    this.autoSaveTimeout = null;
    this.isSaving = false;
    this.lastSaveTime = 0;
    this.autoSaveDelay = 2000; // 2초 디바운스
    this.isEnabled = true;
    
    // 에디터 이벤트 구독
    this.setupEditorEventListeners();
  }

  setupEditorEventListeners() {
    // 다이어그램 변경 시 자동 저장 트리거
    this.editorCore.on('diagramChanged', () => {
      if (this.isEnabled) {
        this.debouncedAutoSave();
      }
    });
  }

  /**
   * 다이어그램 저장
   */
  async saveDiagram() {
    const currentDiagram = this.editorCore.getCurrentDiagram();
    if (!currentDiagram) {
      if (window.appManager) {
        window.appManager.showNotification('저장할 다이어그램이 없습니다.', 'warning');
      }
      return;
    }

    try {
      const { xml } = await this.editorCore.getModeler().saveXML({ format: true });
      
      // 데이터베이스에 저장
      if (window.dbManager && currentDiagram.id !== 'new') {
        const result = await window.dbManager.updateDiagram(currentDiagram.id, {
          bpmn_xml: xml,
          last_modified_by: this.getCurrentUserId()
        });
        
        if (result.error) {
          console.error('Database save error:', result.error);
          // 로컬 스토리지에 백업 저장
          this.saveToLocalStorage(xml);
          this.emit('saveToLocal', { xml, reason: 'database_error' });
        } else {
          console.log('Diagram saved to database:', currentDiagram.name);
          this.emit('saveToDatabase', { xml, diagramId: currentDiagram.id });
        }
      } else {
        // 새 다이어그램이거나 DB 연결이 없으면 로컬에 저장
        this.saveToLocalStorage(xml);
        this.emit('saveToLocal', { xml, reason: 'new_diagram_or_no_db' });
      }
      
      if (window.appManager) {
        window.appManager.showNotification('다이어그램이 저장되었습니다.', 'success');
      }
      
      this.emit('saved', { xml, diagramId: currentDiagram.id });
      
    } catch (error) {
      console.error('Save diagram error:', error);
      this.emit('error', error);
      if (window.appManager) {
        window.appManager.showNotification('저장에 실패했습니다.', 'error');
      }
    }
  }

  /**
   * 다이어그램 자동 저장 (디바운스 적용)
   */
  debouncedAutoSave() {
    // 기존 타이머 취소
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    // 새로운 타이머 설정
    this.autoSaveTimeout = setTimeout(() => {
      this.autoSaveDiagram();
    }, this.autoSaveDelay);
    
    this.emit('autoSaveScheduled');
  }

  /**
   * 다이어그램 자동 저장 (실제 저장 로직)
   */
  async autoSaveDiagram() {
    const currentDiagram = this.editorCore.getCurrentDiagram();
    if (!currentDiagram || currentDiagram.id === 'new') {
      return; // 새 다이어그램은 자동 저장하지 않음
    }

    // 이미 저장 중이면 무시
    if (this.isSaving) {
      console.log('⏳ Auto-save already in progress, skipping...');
      return;
    }

    // 최근 저장 시간 확인 (1초 내 중복 방지)
    const now = Date.now();
    if (now - this.lastSaveTime < 1000) {
      console.log('⏱️ Auto-save too frequent, skipping...');
      return;
    }

    this.isSaving = true;
    this.lastSaveTime = now;

    try {
      const { xml } = await this.editorCore.getModeler().saveXML({ format: true });
      
      // 다이어그램 ID 결정 (id 또는 diagramId 사용)
      const diagramId = currentDiagram.id || currentDiagram.diagramId;
      
      if (!diagramId || diagramId === 'new' || diagramId === 'unknown-diagram') {
        console.warn('No valid diagram ID found for auto-save:', { 
          id: diagramId, 
          diagramName: currentDiagram.name,
          reason: !diagramId ? 'no_id' : 'invalid_id'
        });
        this.saveToLocalStorage(xml);
        this.showAutoSaveStatus('로컬 저장됨');
        this.emit('autoSaveToLocal', { xml, reason: 'no_valid_diagram_id' });
        return;
      }
      
      console.log('🔄 Auto-saving diagram:', { 
        id: diagramId, 
        name: currentDiagram.name || currentDiagram.title 
      });
      
      // 데이터베이스에 자동 저장
      if (window.dbManager) {
        const updateData = {
          bpmn_xml: xml,
          last_modified_by: this.getCurrentUserId()
        };
        
        const result = await window.dbManager.updateDiagram(diagramId, updateData);
        
        if (result.error) {
          console.warn('❌ Auto-save to database failed:', result.error);
          // 로컬 스토리지에 백업 저장
          this.saveToLocalStorage(xml);
          this.showAutoSaveStatus('로컬 저장됨');
          this.emit('autoSaveToLocal', { xml, reason: 'database_error' });
        } else {
          console.log('✅ Auto-saved successfully:', currentDiagram.name || currentDiagram.title);
          this.showAutoSaveStatus('저장됨');
          this.emit('autoSaveToDatabase', { xml, diagramId });
          
          // 현재 다이어그램 데이터 업데이트
          currentDiagram.bpmn_xml = xml;
          if (currentDiagram.content !== undefined) {
            currentDiagram.content = xml; // content 필드가 있는 경우에만 업데이트
          }
        }
      } else {
        // DB 연결이 없으면 로컬에 저장
        console.log('📁 Saving to local storage (no DB connection)');
        this.saveToLocalStorage(xml);
        this.showAutoSaveStatus('로컬 저장됨');
        this.emit('autoSaveToLocal', { xml, reason: 'no_db_connection' });
      }
      
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      this.showAutoSaveStatus('저장 실패');
      this.emit('error', error);
    } finally {
      // 저장 상태 해제
      this.isSaving = false;
    }
  }

  /**
   * 로컬 스토리지에 저장
   */
  saveToLocalStorage(xml) {
    const currentDiagram = this.editorCore.getCurrentDiagram();
    if (!currentDiagram) return;
    
    const key = `bpmn-diagram-${currentDiagram.id}`;
    const data = {
      id: currentDiagram.id,
      name: currentDiagram.name,
      xml: xml,
      lastSaved: new Date().toISOString()
    };
    
    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log('Saved to localStorage:', key);
      this.emit('localStorageSaved', { key, data });
    } catch (error) {
      console.error('localStorage save failed:', error);
      this.emit('error', error);
    }
  }

  /**
   * 로컬 스토리지에서 복원
   */
  loadFromLocalStorage(diagramId) {
    const key = `bpmn-diagram-${diagramId}`;
    
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        this.emit('localStorageLoaded', { key, data });
        return data;
      }
    } catch (error) {
      console.error('localStorage load failed:', error);
      this.emit('error', error);
    }
    
    return null;
  }

  /**
   * 자동 저장 상태 표시
   */
  showAutoSaveStatus(message) {
    const statusEl = $('#auto-save-status');
    if (statusEl.length === 0) {
      // 상태 표시 요소가 없으면 생성
      $('body').append(`<div id="auto-save-status" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 0.875rem;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
      ">${message}</div>`);
    } else {
      statusEl.text(message);
    }
    
    // 페이드 인/아웃 효과
    $('#auto-save-status').css('opacity', '1');
    setTimeout(() => {
      $('#auto-save-status').css('opacity', '0');
    }, 2000);
    
    this.emit('statusShown', message);
  }

  /**
   * 자동 저장 활성화
   */
  enableAutoSave() {
    this.isEnabled = true;
    console.log('🔄 Auto-save enabled');
    this.emit('enabled');
  }

  /**
   * 자동 저장 비활성화
   */
  disableAutoSave() {
    this.isEnabled = false;
    
    // 진행 중인 타이머 취소
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    
    console.log('⏸️ Auto-save disabled');
    this.emit('disabled');
  }

  /**
   * 자동 저장 딜레이 설정
   */
  setAutoSaveDelay(delayMs) {
    this.autoSaveDelay = Math.max(500, delayMs); // 최소 500ms
    console.log(`⏱️ Auto-save delay set to ${this.autoSaveDelay}ms`);
    this.emit('delayChanged', this.autoSaveDelay);
  }

  /**
   * 현재 사용자 ID 반환
   */
  getCurrentUserId() {
    if (window.appManager && window.appManager.currentUser) {
      return window.appManager.currentUser.id;
    }
    return null;
  }

  /**
   * 자동 저장 상태 정보 반환
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      isSaving: this.isSaving,
      autoSaveDelay: this.autoSaveDelay,
      lastSaveTime: this.lastSaveTime,
      hasPendingAutoSave: !!this.autoSaveTimeout
    };
  }

  /**
   * 강제 저장 (즉시 실행)
   */
  async forceSave() {
    // 진행 중인 자동 저장 취소
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    
    // 즉시 저장 실행
    await this.saveDiagram();
    this.emit('forceSaved');
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 진행 중인 타이머 취소
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    
    // 이벤트 리스너 해제
    this.removeAllListeners();
    this.editorCore.removeAllListeners('diagramChanged');
    
    // 상태 표시 요소 제거
    $('#auto-save-status').remove();
    
    this.isEnabled = false;
    this.isSaving = false;
    
    console.log('🗑️ BpmnAutoSave destroyed');
  }
}