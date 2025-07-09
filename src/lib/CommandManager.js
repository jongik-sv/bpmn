import { EventEmitter } from 'events';
import { eventBus } from './EventBus.js';

/**
 * Command Pattern 구현을 위한 기본 Command 클래스
 */
export class Command {
  constructor(name, description = '') {
    this.name = name;
    this.description = description;
    this.timestamp = new Date();
    this.id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.executed = false;
    this.undone = false;
    this.data = null;
  }

  /**
   * 명령 실행 (서브클래스에서 구현)
   */
  async execute() {
    throw new Error('Command.execute() must be implemented by subclass');
  }

  /**
   * 명령 취소 (서브클래스에서 구현)
   */
  async undo() {
    throw new Error('Command.undo() must be implemented by subclass');
  }

  /**
   * 명령 재실행 (기본적으로 execute를 다시 호출)
   */
  async redo() {
    return await this.execute();
  }

  /**
   * 명령이 실행 가능한지 확인
   */
  canExecute() {
    return !this.executed;
  }

  /**
   * 명령이 취소 가능한지 확인
   */
  canUndo() {
    return this.executed && !this.undone;
  }

  /**
   * 명령이 재실행 가능한지 확인
   */
  canRedo() {
    return this.executed && this.undone;
  }

  /**
   * 명령 상태 정보
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      timestamp: this.timestamp,
      executed: this.executed,
      undone: this.undone,
      canExecute: this.canExecute(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }
}

/**
 * Command Manager - 명령 실행, 취소, 재실행 관리
 */
export class CommandManager extends EventEmitter {
  constructor() {
    super();
    
    // 명령 히스토리
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = 50;
    
    // 명령 그룹 (일련의 명령들을 하나의 단위로 처리)
    this.currentGroup = null;
    this.groups = [];
    
    // 실행 중인 명령 추적
    this.executingCommand = null;
    
    console.log('⚡ CommandManager initialized');
  }

  /**
   * 명령 실행
   */
  async executeCommand(command) {
    if (!(command instanceof Command)) {
      throw new Error('Invalid command object');
    }

    if (!command.canExecute()) {
      throw new Error(`Command '${command.name}' cannot be executed`);
    }

    try {
      this.executingCommand = command;
      
      console.log(`⚡ Executing command: ${command.name}`);
      
      // 명령 실행 전 이벤트
      this.emit('beforeExecute', command);
      eventBus.emit('command:beforeExecute', { command });
      
      // 명령 실행
      const result = await command.execute();
      
      // 명령 상태 업데이트
      command.executed = true;
      command.undone = false;
      command.data = result;
      
      // 현재 그룹이 있으면 그룹에 추가, 없으면 히스토리에 직접 추가
      if (this.currentGroup) {
        this.currentGroup.commands.push(command);
      } else {
        this.addToHistory(command);
      }
      
      // 명령 실행 후 이벤트
      this.emit('afterExecute', command, result);
      eventBus.emit('command:afterExecute', { command, result });
      
      console.log(`✅ Command executed: ${command.name}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Command execution failed: ${command.name}`, error);
      
      // 실행 실패 이벤트
      this.emit('executionFailed', command, error);
      eventBus.emit('command:executionFailed', { command, error });
      
      throw error;
    } finally {
      this.executingCommand = null;
    }
  }

  /**
   * 명령 취소
   */
  async undo() {
    if (!this.canUndo()) {
      console.warn('⚠️ No command to undo');
      return false;
    }

    try {
      const command = this.history[this.currentIndex];
      
      if (command.isGroup) {
        // 그룹 명령의 경우 역순으로 취소
        console.log(`⏪ Undoing command group: ${command.name}`);
        
        for (let i = command.commands.length - 1; i >= 0; i--) {
          const cmd = command.commands[i];
          if (cmd.canUndo()) {
            await cmd.undo();
            cmd.undone = true;
          }
        }
        
        command.undone = true;
      } else {
        // 단일 명령 취소
        console.log(`⏪ Undoing command: ${command.name}`);
        
        await command.undo();
        command.undone = true;
      }
      
      this.currentIndex--;
      
      // 취소 이벤트
      this.emit('undone', command);
      eventBus.emit('command:undone', { command });
      
      console.log(`✅ Command undone: ${command.name}`);
      return true;
      
    } catch (error) {
      console.error('❌ Undo failed:', error);
      
      // 취소 실패 이벤트
      this.emit('undoFailed', error);
      eventBus.emit('command:undoFailed', { error });
      
      throw error;
    }
  }

  /**
   * 명령 재실행
   */
  async redo() {
    if (!this.canRedo()) {
      console.warn('⚠️ No command to redo');
      return false;
    }

    try {
      const command = this.history[this.currentIndex + 1];
      
      if (command.isGroup) {
        // 그룹 명령의 경우 순서대로 재실행
        console.log(`⏩ Redoing command group: ${command.name}`);
        
        for (const cmd of command.commands) {
          if (cmd.canRedo()) {
            await cmd.redo();
            cmd.undone = false;
          }
        }
        
        command.undone = false;
      } else {
        // 단일 명령 재실행
        console.log(`⏩ Redoing command: ${command.name}`);
        
        await command.redo();
        command.undone = false;
      }
      
      this.currentIndex++;
      
      // 재실행 이벤트
      this.emit('redone', command);
      eventBus.emit('command:redone', { command });
      
      console.log(`✅ Command redone: ${command.name}`);
      return true;
      
    } catch (error) {
      console.error('❌ Redo failed:', error);
      
      // 재실행 실패 이벤트
      this.emit('redoFailed', error);
      eventBus.emit('command:redoFailed', { error });
      
      throw error;
    }
  }

  /**
   * 명령 그룹 시작
   */
  beginGroup(name, description = '') {
    if (this.currentGroup) {
      throw new Error('Cannot begin group while another group is active');
    }

    this.currentGroup = {
      name,
      description,
      commands: [],
      timestamp: new Date(),
      isGroup: true,
      executed: false,
      undone: false
    };

    console.log(`📦 Command group started: ${name}`);
    this.emit('groupStarted', this.currentGroup);
  }

  /**
   * 명령 그룹 종료
   */
  endGroup() {
    if (!this.currentGroup) {
      throw new Error('No active command group to end');
    }

    if (this.currentGroup.commands.length === 0) {
      console.warn('⚠️ Ending empty command group');
      this.currentGroup = null;
      return;
    }

    const group = this.currentGroup;
    group.executed = true;
    group.undone = false;
    
    // 그룹을 히스토리에 추가
    this.addToHistory(group);
    
    console.log(`📦 Command group ended: ${group.name} (${group.commands.length} commands)`);
    this.emit('groupEnded', group);
    
    this.currentGroup = null;
  }

  /**
   * 현재 그룹 취소 (실행 중인 그룹을 버림)
   */
  cancelGroup() {
    if (!this.currentGroup) {
      throw new Error('No active command group to cancel');
    }

    const group = this.currentGroup;
    console.log(`🗑️ Command group cancelled: ${group.name}`);
    this.emit('groupCancelled', group);
    
    this.currentGroup = null;
  }

  /**
   * 히스토리에 명령 추가
   */
  addToHistory(command) {
    // 현재 위치 이후의 히스토리 제거 (새로운 명령 실행 시)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // 새 명령 추가
    this.history.push(command);
    this.currentIndex = this.history.length - 1;
    
    // 히스토리 크기 제한
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
      this.currentIndex = this.history.length - 1;
    }
    
    // 히스토리 변경 이벤트
    this.emit('historyChanged');
    eventBus.emit('command:historyChanged', { 
      history: this.getHistory(),
      currentIndex: this.currentIndex
    });
  }

  /**
   * 취소 가능 여부 확인
   */
  canUndo() {
    return this.currentIndex >= 0 && 
           this.history[this.currentIndex] && 
           !this.history[this.currentIndex].undone;
  }

  /**
   * 재실행 가능 여부 확인
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1 && 
           this.history[this.currentIndex + 1] && 
           this.history[this.currentIndex + 1].undone;
  }

  /**
   * 특정 명령까지 취소
   */
  async undoToCommand(commandId) {
    const index = this.history.findIndex(cmd => cmd.id === commandId);
    if (index === -1) {
      throw new Error('Command not found in history');
    }

    // 현재 위치에서 해당 명령까지 순차적으로 취소
    while (this.currentIndex >= index) {
      if (!await this.undo()) {
        break;
      }
    }
  }

  /**
   * 특정 명령까지 재실행
   */
  async redoToCommand(commandId) {
    const index = this.history.findIndex(cmd => cmd.id === commandId);
    if (index === -1) {
      throw new Error('Command not found in history');
    }

    // 현재 위치에서 해당 명령까지 순차적으로 재실행
    while (this.currentIndex < index) {
      if (!await this.redo()) {
        break;
      }
    }
  }

  /**
   * 히스토리 조회
   */
  getHistory() {
    return this.history.map(cmd => ({
      ...cmd.getStatus ? cmd.getStatus() : cmd,
      isGroup: cmd.isGroup || false,
      commandCount: cmd.commands ? cmd.commands.length : 1
    }));
  }

  /**
   * 현재 실행 중인 명령 조회
   */
  getCurrentCommand() {
    return this.executingCommand;
  }

  /**
   * 현재 그룹 정보 조회
   */
  getCurrentGroup() {
    return this.currentGroup;
  }

  /**
   * 히스토리 지우기
   */
  clearHistory() {
    this.history = [];
    this.currentIndex = -1;
    this.currentGroup = null;
    this.executingCommand = null;
    
    console.log('🧹 Command history cleared');
    this.emit('historyCleared');
    eventBus.emit('command:historyCleared');
  }

  /**
   * 상태 정보 조회
   */
  getStatus() {
    return {
      historyLength: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      currentCommand: this.executingCommand?.name || null,
      currentGroup: this.currentGroup?.name || null,
      maxHistorySize: this.maxHistorySize
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.clearHistory();
    this.removeAllListeners();
    console.log('🗑️ CommandManager destroyed');
  }
}

// 싱글톤 인스턴스
export const commandManager = new CommandManager();
export default commandManager;