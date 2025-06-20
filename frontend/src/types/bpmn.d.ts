// BPMN.js type declarations
declare module 'bpmn-js/lib/Modeler' {
  export interface SaveXMLResult {
    xml?: string;
  }
  
  export default class BpmnModeler {
    constructor(options: any);
    importXML(xml: string): Promise<{ warnings: any[] }>;
    saveXML(options?: { format?: boolean }): Promise<SaveXMLResult>;
    get(serviceName: string): any;
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
    destroy(): void;
  }
}

declare module 'bpmn-js-properties-panel' {
  export const BpmnPropertiesPanelModule: any;
  export const BpmnPropertiesProviderModule: any;
}

declare module 'bpmn-moddle' {
  export default class BpmnModdle {
    constructor(packages?: any);
    fromXML(xml: string): Promise<any>;
    toXML(definitions: any): Promise<{ xml: string }>;
  }
}

declare module 'y-websocket' {
  import * as Y from 'yjs';
  
  export class WebsocketProvider {
    constructor(serverUrl: string, roomname: string, ydoc: Y.Doc, options?: any);
    destroy(): void;
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
  }
}

declare module 'y-protocols' {
  export const awareness: any;
}

// Global types for BPMN editor
declare global {
  interface Window {
    bpmnModeler?: any;
  }
}