import { EventEmitter } from 'events';

/**
 * 전역 이벤트 버스 - 애플리케이션 전체의 이벤트 통신을 관리
 * 느슨한 결합을 통해 컴포넌트 간 통신을 단순화하고 확장성을 제공
 */
export class EventBus extends EventEmitter {
  constructor() {
    super();
    
    // 이벤트 통계 및 디버깅을 위한 정보
    this.eventStats = new Map();
    this.debugMode = false;
    this.eventHistory = [];
    this.maxHistorySize = 100;
    
    // 이벤트 네임스페이스
    this.namespaces = {
      APP: 'app',
      AUTH: 'auth', 
      PROJECT: 'project',
      DIAGRAM: 'diagram',
      FOLDER: 'folder',
      EDITOR: 'editor',
      COLLABORATION: 'collaboration',
      UI: 'ui',
      NOTIFICATION: 'notification',
      ERROR: 'error'
    };

    // 시스템 이벤트 상수
    this.EVENTS = {
      // 앱 라이프사이클
      APP_INITIALIZED: 'app:initialized',
      APP_DESTROYED: 'app:destroyed',
      
      // 인증 관련
      AUTH_LOGIN: 'auth:login',
      AUTH_LOGOUT: 'auth:logout',
      AUTH_STATE_CHANGED: 'auth:state_changed',
      
      // 프로젝트 관련
      PROJECT_CREATED: 'project:created',
      PROJECT_UPDATED: 'project:updated',
      PROJECT_DELETED: 'project:deleted',
      PROJECT_SELECTED: 'project:selected',
      PROJECT_LIST_LOADED: 'project:list_loaded',
      
      // 다이어그램 관련
      DIAGRAM_CREATED: 'diagram:created',
      DIAGRAM_OPENED: 'diagram:opened',
      DIAGRAM_CLOSED: 'diagram:closed',
      DIAGRAM_UPDATED: 'diagram:updated',
      DIAGRAM_DELETED: 'diagram:deleted',
      DIAGRAM_SAVED: 'diagram:saved',
      DIAGRAM_EXPORTED: 'diagram:exported',
      
      // 폴더 관련
      FOLDER_CREATED: 'folder:created',
      FOLDER_UPDATED: 'folder:updated',
      FOLDER_DELETED: 'folder:deleted',
      FOLDER_MOVED: 'folder:moved',
      
      // 에디터 관련
      EDITOR_INITIALIZED: 'editor:initialized',
      EDITOR_CONTENT_CHANGED: 'editor:content_changed',
      EDITOR_SELECTION_CHANGED: 'editor:selection_changed',
      
      // 협업 관련
      COLLABORATION_CONNECTED: 'collaboration:connected',
      COLLABORATION_DISCONNECTED: 'collaboration:disconnected',
      COLLABORATION_USER_JOINED: 'collaboration:user_joined',
      COLLABORATION_USER_LEFT: 'collaboration:user_left',
      COLLABORATION_CURSOR_MOVED: 'collaboration:cursor_moved',
      
      // UI 관련
      UI_PAGE_CHANGED: 'ui:page_changed',
      UI_MODAL_OPENED: 'ui:modal_opened',
      UI_MODAL_CLOSED: 'ui:modal_closed',
      UI_SIDEBAR_TOGGLED: 'ui:sidebar_toggled',
      
      // 알림 관련
      NOTIFICATION_SHOW: 'notification:show',
      NOTIFICATION_HIDE: 'notification:hide',
      
      // 에러 관련
      ERROR_OCCURRED: 'error:occurred',
      ERROR_RESOLVED: 'error:resolved'
    };

    this.setupInternalEventHandlers();
    console.log('🚌 EventBus initialized');
  }

  /**
   * 내부 이벤트 핸들러 설정
   */
  setupInternalEventHandlers() {
    // 모든 이벤트를 감지해서 통계 수집
    this.on('newListener', (eventName) => {
      if (!this.eventStats.has(eventName)) {
        this.eventStats.set(eventName, {
          listenerCount: 0,
          emitCount: 0,
          lastEmitted: null
        });
      }
      const stats = this.eventStats.get(eventName);
      stats.listenerCount = this.listenerCount(eventName);
    });

    this.on('removeListener', (eventName) => {
      if (this.eventStats.has(eventName)) {
        const stats = this.eventStats.get(eventName);
        stats.listenerCount = this.listenerCount(eventName);
      }
    });
  }

  /**
   * 이벤트 발생 (오버라이드해서 통계 수집)
   */
  emit(eventName, ...args) {
    // 통계 업데이트
    if (this.eventStats.has(eventName)) {
      const stats = this.eventStats.get(eventName);
      stats.emitCount++;
      stats.lastEmitted = new Date();
    }

    // 히스토리 저장
    this.addToHistory(eventName, args);

    // 디버그 모드에서 로깅
    if (this.debugMode) {
      console.log(`🚌 EventBus: ${eventName}`, args);
    }

    return super.emit(eventName, ...args);
  }

  /**
   * 네임스페이스가 포함된 이벤트 이름 생성
   */
  createEventName(namespace, event) {
    return `${namespace}:${event}`;
  }

  /**
   * 안전한 이벤트 발생 (에러가 발생해도 다른 리스너에 영향 없음)
   */
  safeEmit(eventName, ...args) {
    try {
      const listeners = this.listeners(eventName);
      
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (error) {
          console.error(`❌ EventBus listener error for '${eventName}':`, error);
          this.emit(this.EVENTS.ERROR_OCCURRED, {
            type: 'event_listener_error',
            eventName,
            error,
            timestamp: new Date()
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ EventBus safeEmit error for '${eventName}':`, error);
      return false;
    }
  }

  /**
   * 일회성 이벤트 리스너 (Promise 기반)
   */
  waitFor(eventName, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeListener(eventName, handler);
        reject(new Error(`Event '${eventName}' timeout after ${timeout}ms`));
      }, timeout);

      const handler = (...args) => {
        clearTimeout(timeoutId);
        resolve(args.length === 1 ? args[0] : args);
      };

      this.once(eventName, handler);
    });
  }

  /**
   * 여러 이벤트를 동시에 기다리기
   */
  waitForAll(eventNames, timeout = 10000) {
    const promises = eventNames.map(eventName => this.waitFor(eventName, timeout));
    return Promise.all(promises);
  }

  /**
   * 여러 이벤트 중 하나라도 발생하면 반환
   */
  waitForAny(eventNames, timeout = 10000) {
    const promises = eventNames.map(eventName => this.waitFor(eventName, timeout));
    return Promise.race(promises);
  }

  /**
   * 이벤트 히스토리에 추가
   */
  addToHistory(eventName, args) {
    this.eventHistory.push({
      eventName,
      args: JSON.parse(JSON.stringify(args)), // Deep copy
      timestamp: new Date(),
      id: Date.now() + Math.random()
    });

    // 히스토리 크기 제한
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 조건부 이벤트 리스너
   */
  onIf(eventName, condition, handler) {
    const conditionalHandler = (...args) => {
      if (typeof condition === 'function' ? condition(...args) : condition) {
        handler(...args);
      }
    };

    this.on(eventName, conditionalHandler);
    return conditionalHandler;
  }

  /**
   * 최대 횟수 제한 리스너
   */
  onMax(eventName, maxCount, handler) {
    let count = 0;
    const countingHandler = (...args) => {
      if (count < maxCount) {
        count++;
        handler(...args);
        
        if (count >= maxCount) {
          this.removeListener(eventName, countingHandler);
        }
      }
    };

    this.on(eventName, countingHandler);
    return countingHandler;
  }

  /**
   * 디바운스된 이벤트 리스너
   */
  onDebounced(eventName, delay, handler) {
    let timeoutId = null;
    
    const debouncedHandler = (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        handler(...args);
        timeoutId = null;
      }, delay);
    };

    this.on(eventName, debouncedHandler);
    return debouncedHandler;
  }

  /**
   * 쓰로틀된 이벤트 리스너
   */
  onThrottled(eventName, delay, handler) {
    let lastCall = 0;
    
    const throttledHandler = (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        handler(...args);
      }
    };

    this.on(eventName, throttledHandler);
    return throttledHandler;
  }

  /**
   * 이벤트 체이닝 (한 이벤트가 발생하면 다른 이벤트도 발생)
   */
  chain(fromEvent, toEvent, transformer = null) {
    this.on(fromEvent, (...args) => {
      const transformedArgs = transformer ? transformer(...args) : args;
      this.emit(toEvent, ...transformedArgs);
    });
  }

  /**
   * 이벤트 필터링
   */
  filter(eventName, filterFn, newEventName) {
    this.on(eventName, (...args) => {
      if (filterFn(...args)) {
        this.emit(newEventName || `${eventName}:filtered`, ...args);
      }
    });
  }

  /**
   * 이벤트 통계 조회
   */
  getEventStats(eventName = null) {
    if (eventName) {
      return this.eventStats.get(eventName) || null;
    }
    
    return Object.fromEntries(this.eventStats.entries());
  }

  /**
   * 이벤트 히스토리 조회
   */
  getEventHistory(eventName = null, limit = 50) {
    let history = this.eventHistory;
    
    if (eventName) {
      history = history.filter(item => item.eventName === eventName);
    }
    
    return history.slice(-limit);
  }

  /**
   * 활성 리스너 목록 조회
   */
  getActiveListeners() {
    const result = {};
    
    for (const [eventName] of this.eventStats.entries()) {
      const count = this.listenerCount(eventName);
      if (count > 0) {
        result[eventName] = count;
      }
    }
    
    return result;
  }

  /**
   * 디버그 모드 토글
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`🚌 EventBus debug mode: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * 전체 상태 조회
   */
  getStatus() {
    return {
      totalEvents: this.eventStats.size,
      totalEmits: Array.from(this.eventStats.values()).reduce((sum, stats) => sum + stats.emitCount, 0),
      activeListeners: this.getActiveListeners(),
      historySize: this.eventHistory.length,
      debugMode: this.debugMode,
      namespaces: this.namespaces,
      constants: Object.keys(this.EVENTS).length
    };
  }

  /**
   * 특정 네임스페이스의 모든 이벤트 제거
   */
  removeNamespaceListeners(namespace) {
    const eventNames = Array.from(this.eventStats.keys());
    const namespaceEvents = eventNames.filter(name => name.startsWith(`${namespace}:`));
    
    namespaceEvents.forEach(eventName => {
      this.removeAllListeners(eventName);
    });
    
    console.log(`🧹 Removed ${namespaceEvents.length} listeners from namespace: ${namespace}`);
  }

  /**
   * EventBus 정리
   */
  destroy() {
    this.removeAllListeners();
    this.eventStats.clear();
    this.eventHistory = [];
    console.log('🗑️ EventBus destroyed');
  }
}

// 싱글톤 인스턴스
export const eventBus = new EventBus();
export default eventBus;