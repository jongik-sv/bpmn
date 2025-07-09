import $ from 'jquery';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { debounce } from 'min-dash';
import { EventEmitter } from 'events';

import { 
  BpmnPropertiesPanelModule, 
  BpmnPropertiesProviderModule 
} from 'bpmn-js-properties-panel';

import newDiagramXML from '../../../assets/newDiagram.bpmn';

/**
 * BPMN 에디터 핵심 기능만 담당하는 클래스
 * 순수한 BPMN 편집 기능만 제공하며, 협업, 자동 저장, UI 통합 로직은 분리됨
 */
export class BpmnEditorCore extends EventEmitter {
  constructor(containerSelector = '#js-drop-zone') {
    super();
    
    // 컨테이너 동적 할당 지원
    this.containerSelector = containerSelector;
    this.container = $(containerSelector);
    
    // 서브 요소들도 동적으로 찾거나 생성
    this.canvas = null;
    this.propertiesPanel = null;
    
    // 현재 다이어그램 상태
    this.currentDiagram = null;
    
    // 에디터 상태
    this.modeler = null;
    this.isInitialized = false;
  }
  
  async initializeWhenReady() {
    try {
      // DOM이 준비될 때까지 대기
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }
      
      await this.setupContainer();
      this.initializeModeler();
      this.isInitialized = true;
      
      this.emit('initialized');
      console.log('✅ BpmnEditorCore initialized');
    } catch (error) {
      console.error('❌ BpmnEditorCore initialization failed:', error);
      this.emit('error', error);
    }
  }
  
  async setupContainer() {
    // 컨테이너가 존재하지 않으면 생성
    if (this.container.length === 0) {
      console.log('📍 Container not found, creating default structure...');
      
      // 기본 구조 생성 (flex layout)
      const body = $('body');
      const defaultContainer = $(`
        <div id="js-drop-zone" style="width: 100%; height: 100vh; position: relative; display: flex;">
          <div id="js-canvas" style="flex: 1; width: 100%; height: 100%; background: #fafafa;"></div>
          <div id="js-properties-panel" style="width: 300px; height: 100%; background: white; border-left: 1px solid #ccc; overflow-y: auto;"></div>
        </div>
      `);
      
      body.append(defaultContainer);
      this.container = defaultContainer;
    }
    
    // 서브 요소들 확인 및 생성
    this.canvas = this.container.find('#js-canvas');
    if (this.canvas.length === 0) {
      this.canvas = $('<div id="js-canvas" style="width: 100%; height: 100%;"></div>');
      this.container.append(this.canvas);
    }
    
    this.propertiesPanel = this.container.find('#js-properties-panel');
    if (this.propertiesPanel.length === 0) {
      this.propertiesPanel = $('<div id="js-properties-panel" style="position: absolute; top: 0; right: 0; width: 300px; height: 100%; background: white; border-left: 1px solid #ccc; z-index: 100;"></div>');
      this.container.append(this.propertiesPanel);
    }
  }
  
  /**
   * 새 컨테이너로 에디터 이동
   */
  async moveToContainer(newContainerSelector) {
    try {
      console.log('📦 Moving BPMN Editor to new container:', newContainerSelector);
      
      const newContainer = $(newContainerSelector);
      if (newContainer.length === 0) {
        throw new Error('New container not found: ' + newContainerSelector);
      }
      
      // 기존 modeler 정리
      if (this.modeler) {
        this.modeler.destroy();
        this.modeler = null;
      }
      
      // 새 컨테이너 설정
      this.containerSelector = newContainerSelector;
      this.container = newContainer;
      
      // 새 컨테이너에 필요한 구조 생성
      newContainer.html(`
        <div id="js-canvas" style="flex: 1; width: 100%; height: 100%; background: #fafafa;"></div>
        <div id="js-properties-panel" style="width: 250px; height: 100%; background: white; border-left: 1px solid #ccc; overflow-y: auto; display: block;"></div>
      `);
      
      this.canvas = newContainer.find('#js-canvas');
      this.propertiesPanel = newContainer.find('#js-properties-panel');
      
      // 에디터 재초기화
      this.initializeModeler();
      this.setupFileDrop();
      
      // 현재 다이어그램이 있으면 다시 로드
      if (this.currentDiagram) {
        await this.openDiagram(this.currentDiagram);
      }
      
      this.emit('containerMoved', newContainerSelector);
      console.log('✅ BPMN Editor moved successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to move BPMN Editor:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * BPMN 모델러 초기화
   */
  initializeModeler(targetContainer = null) {
    try {
      // 타겟 컨테이너가 지정된 경우 해당 컨테이너 사용
      let canvasElement = this.canvas;
      let propertiesPanelSelector = '#js-properties-panel';
      
      if (targetContainer) {
        console.log('🔧 Initializing modeler in target container:', targetContainer);
        
        // 타겟 컨테이너에 canvas와 properties panel 생성 (flex layout)
        const $targetContainer = $(targetContainer);
        $targetContainer.css('display', 'flex');
        $targetContainer.html(`
          <div id="js-canvas" style="flex: 1; width: 100%; height: 100%; background: #fafafa;"></div>
          <div id="js-properties-panel" style="width: 250px; height: 100%; background: white; border-left: 1px solid #ccc; overflow-y: auto; display: block;"></div>
        `);
        
        canvasElement = $targetContainer.find('#js-canvas');
        this.canvas = canvasElement;
        this.propertiesPanel = $targetContainer.find('#js-properties-panel');
        this.container = $targetContainer;
      }
      
      if (!canvasElement || canvasElement.length === 0) {
        throw new Error('Canvas element not found');
      }

      this.modeler = new BpmnModeler({
        container: canvasElement[0], // DOM 요소 전달
        propertiesPanel: {
          parent: this.propertiesPanel[0] || propertiesPanelSelector
        },
        additionalModules: [
          BpmnPropertiesPanelModule,
          BpmnPropertiesProviderModule
        ]
      });

      this.container.removeClass('with-diagram');
      
      // 다이어그램 변경 시 이벤트 발생
      this.modeler.on('commandStack.changed', () => {
        this.exportArtifacts();
        this.emit('diagramChanged');
      });
      
      this.emit('modelerInitialized');
      console.log('✅ BPMN Modeler initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize BPMN modeler:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 다이어그램 열기 - 서버에서 문서 요청
   */
  async openDiagram(diagramData) {
    try {
      const diagramId = (diagramData && diagramData.id) || (diagramData && diagramData.diagramId);
      if (!diagramId) {
        throw new Error('다이어그램 ID가 없습니다.');
      }
      
      // 모델러가 초기화되었는지 확인
      if (!this.modeler) {
        console.warn('⚠️  BPMN Modeler is not initialized, attempting to initialize...');
        try {
          this.initializeModeler();
          if (!this.modeler) {
            throw new Error('BPMN 모델러 초기화에 실패했습니다.');
          }
        } catch (initError) {
          console.error('❌ Failed to initialize BPMN modeler:', initError);
          throw new Error('BPMN 모델러가 초기화되지 않았습니다.');
        }
      }
      
      // 서버에 문서 요청
      console.log(`🌐 API 요청: ${diagramId}`, new Date().toISOString());
      const response = await fetch(`http://localhost:1234/api/document/${diagramId}`);
      
      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
      }
      
      const documentData = await response.json();
      
      if (!documentData.success) {
        throw new Error(documentData.error || '문서 로드 실패');
      }
      
      console.log(`📥 API 응답:`, {
        xmlLength: documentData.xml ? documentData.xml.length : 0,
        xmlPreview: documentData.xml ? documentData.xml.substring(0, 200) + '...' : 'null',
        timestamp: new Date().toISOString()
      });
      
      // 현재 다이어그램 정보 업데이트
      this.currentDiagram = {
        ...diagramData,
        content: documentData.xml,
        name: documentData.name
      };
      
      // 서버에서 받은 XML과 현재 로컬 XML 비교
      const serverXml = documentData.xml || newDiagramXML;
      let shouldImport = true;
      
      try {
        // 현재 모델러의 XML을 가져와서 비교 (모델러가 null이 아닌지 다시 확인)
        if (this.modeler) {
          const currentResult = await this.modeler.saveXML({ format: true });
          const currentXml = currentResult.xml;
          
          // XML 내용이 같은지 확인 (공백 제거 후 비교)
          const normalizeXml = (xml) => xml.replace(/\s+/g, ' ').trim();
          if (normalizeXml(currentXml) === normalizeXml(serverXml)) {
            shouldImport = false;
          }
        }
      } catch (error) {
        // 현재 XML 비교 실패, 서버 XML 적용
        console.warn('XML comparison failed:', error);
      }
      
      // 다른 경우만 서버 XML 적용 (모델러가 null이 아닌지 확인)
      if (shouldImport && this.modeler) {
        await this.modeler.importXML(serverXml);
      }
      
      // 캔버스 크기 조정
      setTimeout(() => {
        try {
          const canvas = this.modeler.get('canvas');
          canvas.resized();
        } catch (resizeError) {
          console.warn('Canvas resize failed:', resizeError);
        }
      }, 100);
      
      this.container
        .removeClass('with-error')
        .addClass('with-diagram');
      
      this.emit('diagramLoaded', this.currentDiagram);
      
    } catch (err) {
      this.container
        .removeClass('with-diagram')
        .addClass('with-error');

      this.container.find('.error pre').text(err.message);
      console.error('Error loading diagram:', err);
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * 새 다이어그램 생성
   */
  async createNewDiagram() {
    const newDiagram = {
      id: 'new',
      name: '새 다이어그램',
      content: newDiagramXML
    };
    
    await this.openDiagram(newDiagram);
    this.emit('newDiagramCreated', newDiagram);
  }

  /**
   * 현재 다이어그램 닫기
   */
  async closeDiagram() {
    if (this.currentDiagram) {
      console.log('📝 Closing diagram:', this.currentDiagram.name);
      
      // 현재 다이어그램 정보 클리어
      const closedDiagram = this.currentDiagram;
      this.currentDiagram = null;
      
      // 에디터를 기본 상태로 리셋
      try {
        if (this.modeler) {
          const xml = newDiagramXML;
          await this.modeler.importXML(xml);
        }
      } catch (error) {
        console.warn('Error resetting diagram:', error);
      }
      
      this.emit('diagramClosed', closedDiagram);
      console.log('✅ Diagram closed');
    }
  }

  /**
   * 다이어그램 내보내기
   */
  async exportDiagram() {
    if (!this.currentDiagram) {
      throw new Error('내보낼 다이어그램이 없습니다.');
    }

    try {
      console.log('💾 Exporting diagram:', this.currentDiagram.name);
      
      // BPMN XML 내보내기
      const { xml } = await this.modeler.saveXML({ format: true });
      const blob = new Blob([xml], { type: 'application/bpmn20-xml' });
      const url = URL.createObjectURL(blob);
      
      // 다운로드 링크 생성
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.currentDiagram.name}.bpmn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // URL 정리
      URL.revokeObjectURL(url);
      
      this.emit('diagramExported', this.currentDiagram);
      console.log('✅ Diagram exported successfully');
      
    } catch (error) {
      console.error('❌ Error exporting diagram:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * BPMN XML 유효성 검증
   */
  isValidBpmnXml(xml) {
    if (!xml || typeof xml !== 'string' || xml.trim() === '') {
      return false;
    }
    
    try {
      // 기본 XML 파싱 확인
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      
      // 파싱 오류 확인
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.warn('XML 파싱 오류:', parserError.textContent);
        return false;
      }
      
      // BPMN 네임스페이스 확인
      const hasValidNamespace = xml.includes('http://www.omg.org/spec/BPMN/20100524/MODEL') ||
                               xml.includes('bpmn:definitions') ||
                               xml.includes('bpmn2:definitions');
      
      if (!hasValidNamespace) {
        console.warn('유효한 BPMN 네임스페이스가 없습니다.');
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('BPMN XML 유효성 검증 실패:', error);
      return false;
    }
  }

  // 파일 드래그앤드롭 기능은 온라인 전용으로 제거됨

  /**
   * 내보내기 업데이트 (디바운스)
   */
  exportArtifacts = debounce(async () => {
    try {
      // Export SVG
      const { svg } = await this.modeler.saveSVG();
      this.setDownloadLink('#js-download-svg', 'diagram.svg', svg, 'image/svg+xml');
    } catch (err) {
      console.error('Error exporting SVG:', err);
      this.setDownloadLink('#js-download-svg', 'diagram.svg', null);
    }

    try {
      // Export BPMN XML
      const { xml } = await this.modeler.saveXML({ format: true });
      this.setDownloadLink('#js-download-diagram', 'diagram.bpmn', xml, 'application/bpmn20-xml');
    } catch (err) {
      console.error('Error exporting BPMN:', err);
      this.setDownloadLink('#js-download-diagram', 'diagram.bpmn', null);
    }
  }, 500);

  /**
   * 다운로드 링크 설정
   */
  setDownloadLink(selector, filename, data, mimeType = 'text/plain') {
    const link = $(selector);
    
    if (data) {
      const encodedData = encodeURIComponent(data);
      link.addClass('active').attr({
        'href': `data:${mimeType};charset=UTF-8,${encodedData}`,
        'download': filename
      });
    } else {
      link.removeClass('active').removeAttr('href download');
    }
  }

  /**
   * 현재 다이어그램 가져오기
   */
  getCurrentDiagram() {
    return this.currentDiagram;
  }

  /**
   * 모델러 인스턴스 가져오기
   */
  getModeler() {
    return this.modeler;
  }

  /**
   * 리소스 정리
   */
  destroy() {
    if (this.modeler) {
      this.modeler.destroy();
      this.modeler = null;
    }
    
    this.removeAllListeners();
    this.currentDiagram = null;
    this.isInitialized = false;
    
    console.log('🗑️ BpmnEditorCore destroyed');
  }
}