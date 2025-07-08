// CSS imports
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import '@bpmn-io/properties-panel/assets/properties-panel.css';
import './styles/login.css';
import './styles/app.css';
import './styles/editor-header.css';
import './styles/main.css';

import $ from 'jquery';
import { getAppManager } from './app/AppManager.js';

// Initialize the new application
$(document).ready(() => {
  const appManager = getAppManager();
  
  // 전역 참조 설정 (기존 코드 호환성을 위해)
  window.appManager = appManager;
  window.bpmnEditor = {
    showNotification: (message, type) => appManager.showNotification(message, type)
  };
});