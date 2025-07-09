import { EventEmitter } from 'events';
import { commandManager } from '../../lib/CommandManager.js';
import { eventBus } from '../../lib/EventBus.js';

/**
 * 실행 취소/다시 실행 버튼 컴포넌트
 * Command Pattern을 활용한 UI 컨트롤
 */
export class UndoRedoButtons extends EventEmitter {
  constructor(container) {
    super();
    
    this.container = container;
    this.undoButton = null;
    this.redoButton = null;
    this.historyButton = null;
    this.isEnabled = true;
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.createButtons();
    this.setupEventListeners();
    this.updateButtonStates();
  }

  /**
   * 버튼 생성
   */
  createButtons() {
    // Undo/Redo 버튼 그룹 컨테이너
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'undo-redo-buttons';
    buttonGroup.style.cssText = `
      display: flex;
      gap: 4px;
      align-items: center;
      background: #2d2d30;
      border-radius: 4px;
      padding: 2px;
      border: 1px solid #3e3e42;
    `;

    // Undo 버튼
    this.undoButton = document.createElement('button');
    this.undoButton.className = 'undo-button';
    this.undoButton.title = '실행 취소 (Ctrl+Z)';
    this.undoButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3.46 8.75H8.5c1.38 0 2.5-1.12 2.5-2.5S9.88 3.75 8.5 3.75H6.25v1.5H8.5c0.69 0 1.25 0.56 1.25 1.25S9.19 7.75 8.5 7.75H3.46l1.27-1.27-1.06-1.06L1.5 7.5l2.17 2.08 1.06-1.06L3.46 8.75z"/>
      </svg>
    `;
    this.undoButton.style.cssText = `
      background: transparent;
      border: none;
      color: #cccccc;
      cursor: pointer;
      padding: 6px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    `;

    // Redo 버튼
    this.redoButton = document.createElement('button');
    this.redoButton.className = 'redo-button';
    this.redoButton.title = '다시 실행 (Ctrl+Y)';
    this.redoButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M12.54 8.75H7.5c-1.38 0-2.5-1.12-2.5-2.5S6.12 3.75 7.5 3.75h2.25v1.5H7.5c-0.69 0-1.25 0.56-1.25 1.25S6.81 7.75 7.5 7.75h5.04l-1.27-1.27 1.06-1.06L14.5 7.5l-2.17 2.08-1.06-1.06L12.54 8.75z"/>
      </svg>
    `;
    this.redoButton.style.cssText = `
      background: transparent;
      border: none;
      color: #cccccc;
      cursor: pointer;
      padding: 6px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    `;

    // History 버튼
    this.historyButton = document.createElement('button');
    this.historyButton.className = 'history-button';
    this.historyButton.title = '명령 히스토리';
    this.historyButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5A6.5 6.5 0 1 0 14.5 8H13a5.5 5.5 0 1 1-5.5-5.5V1.5z"/>
        <path d="M8 3v4l3 2-1 1.5-4-2.5V3h2z"/>
      </svg>
    `;
    this.historyButton.style.cssText = `
      background: transparent;
      border: none;
      color: #cccccc;
      cursor: pointer;
      padding: 6px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      margin-left: 2px;
      border-left: 1px solid #3e3e42;
      padding-left: 8px;
    `;

    // 호버 효과
    const hoverStyle = 'background: #383838; color: #ffffff;';
    const disabledStyle = 'opacity: 0.5; cursor: not-allowed;';

    [this.undoButton, this.redoButton, this.historyButton].forEach(button => {
      button.addEventListener('mouseenter', () => {
        if (!button.disabled) {
          button.style.cssText += hoverStyle;
        }
      });
      button.addEventListener('mouseleave', () => {
        if (!button.disabled) {
          button.style.cssText = button.style.cssText.replace(hoverStyle, '');
        }
      });
    });

    // 버튼 이벤트 리스너
    this.undoButton.addEventListener('click', () => this.handleUndo());
    this.redoButton.addEventListener('click', () => this.handleRedo());
    this.historyButton.addEventListener('click', () => this.showHistory());

    // 버튼 그룹에 추가
    buttonGroup.appendChild(this.undoButton);
    buttonGroup.appendChild(this.redoButton);
    buttonGroup.appendChild(this.historyButton);

    // 컨테이너에 추가
    this.container.appendChild(buttonGroup);
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // CommandManager 이벤트 리스너
    commandManager.on('historyChanged', () => {
      this.updateButtonStates();
    });

    // EventBus 이벤트 리스너
    eventBus.on('command:afterExecute', () => {
      this.updateButtonStates();
    });

    eventBus.on('command:undone', () => {
      this.updateButtonStates();
    });

    eventBus.on('command:redone', () => {
      this.updateButtonStates();
    });

    // 키보드 단축키
    document.addEventListener('keydown', (event) => {
      if (this.isEnabled && event.ctrlKey && !event.shiftKey && !event.altKey) {
        if (event.key === 'z' || event.key === 'Z') {
          event.preventDefault();
          this.handleUndo();
        } else if (event.key === 'y' || event.key === 'Y') {
          event.preventDefault();
          this.handleRedo();
        }
      }
    });
  }

  /**
   * 버튼 상태 업데이트
   */
  updateButtonStates() {
    const canUndo = commandManager.canUndo();
    const canRedo = commandManager.canRedo();
    const status = commandManager.getStatus();

    // Undo 버튼 상태
    this.undoButton.disabled = !canUndo || !this.isEnabled;
    this.undoButton.style.opacity = this.undoButton.disabled ? '0.5' : '1';
    this.undoButton.style.cursor = this.undoButton.disabled ? 'not-allowed' : 'pointer';

    // Redo 버튼 상태
    this.redoButton.disabled = !canRedo || !this.isEnabled;
    this.redoButton.style.opacity = this.redoButton.disabled ? '0.5' : '1';
    this.redoButton.style.cursor = this.redoButton.disabled ? 'not-allowed' : 'pointer';

    // 툴팁 업데이트
    if (canUndo && status.historyLength > 0) {
      const history = commandManager.getHistory();
      const lastCommand = history[status.currentIndex];
      if (lastCommand) {
        this.undoButton.title = `실행 취소: ${lastCommand.description || lastCommand.name} (Ctrl+Z)`;
      }
    } else {
      this.undoButton.title = '실행 취소 (Ctrl+Z)';
    }

    if (canRedo && status.historyLength > 0) {
      const history = commandManager.getHistory();
      const nextCommand = history[status.currentIndex + 1];
      if (nextCommand) {
        this.redoButton.title = `다시 실행: ${nextCommand.description || nextCommand.name} (Ctrl+Y)`;
      }
    } else {
      this.redoButton.title = '다시 실행 (Ctrl+Y)';
    }

    // 히스토리 버튼 상태
    this.historyButton.disabled = !this.isEnabled;
    this.historyButton.style.opacity = this.historyButton.disabled ? '0.5' : '1';
    this.historyButton.style.cursor = this.historyButton.disabled ? 'not-allowed' : 'pointer';
    this.historyButton.title = `명령 히스토리 (${status.historyLength}개)`;
  }

  /**
   * 실행 취소 처리
   */
  async handleUndo() {
    if (!this.isEnabled || !commandManager.canUndo()) {
      return;
    }

    try {
      console.log('🔄 Undo requested');
      await commandManager.undo();
      this.emit('undoExecuted');
    } catch (error) {
      console.error('❌ Undo failed:', error);
      this.emit('undoFailed', error);
      
      // 사용자에게 알림
      if (window.appManager && window.appManager.showNotification) {
        window.appManager.showNotification('실행 취소에 실패했습니다.', 'error');
      } else {
        alert('실행 취소에 실패했습니다.');
      }
    }
  }

  /**
   * 다시 실행 처리
   */
  async handleRedo() {
    if (!this.isEnabled || !commandManager.canRedo()) {
      return;
    }

    try {
      console.log('🔄 Redo requested');
      await commandManager.redo();
      this.emit('redoExecuted');
    } catch (error) {
      console.error('❌ Redo failed:', error);
      this.emit('redoFailed', error);
      
      // 사용자에게 알림
      if (window.appManager && window.appManager.showNotification) {
        window.appManager.showNotification('다시 실행에 실패했습니다.', 'error');
      } else {
        alert('다시 실행에 실패했습니다.');
      }
    }
  }

  /**
   * 명령 히스토리 표시
   */
  showHistory() {
    if (!this.isEnabled) {
      return;
    }

    const history = commandManager.getHistory();
    const status = commandManager.getStatus();

    if (history.length === 0) {
      alert('명령 히스토리가 비어있습니다.');
      return;
    }

    // 히스토리 목록 생성
    const historyList = history.map((cmd, index) => {
      const isCurrent = index === status.currentIndex;
      const isUndone = cmd.undone || false;
      const marker = isCurrent ? '→ ' : '  ';
      const status_text = isUndone ? ' (취소됨)' : '';
      
      return `${marker}${cmd.description || cmd.name}${status_text}`;
    }).join('\n');

    const message = `명령 히스토리 (${history.length}개):\n\n${historyList}`;
    
    // 단순 alert로 표시 (나중에 모달로 개선 가능)
    alert(message);
    
    this.emit('historyShown', history);
  }

  /**
   * 컴포넌트 활성화/비활성화
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    this.updateButtonStates();
  }

  /**
   * 컴포넌트 표시/숨김
   */
  setVisible(visible) {
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * 상태 정보 반환
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      canUndo: commandManager.canUndo(),
      canRedo: commandManager.canRedo(),
      historyLength: commandManager.getStatus().historyLength
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 이벤트 리스너 정리
    commandManager.removeAllListeners();
    eventBus.off('command:afterExecute');
    eventBus.off('command:undone');
    eventBus.off('command:redone');
    
    // DOM 요소 정리
    if (this.container && this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    
    // 참조 정리
    this.undoButton = null;
    this.redoButton = null;
    this.historyButton = null;
    this.container = null;
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    console.log('🗑️ UndoRedoButtons destroyed');
  }
}