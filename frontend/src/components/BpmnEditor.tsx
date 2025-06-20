'use client';

import { 
  useEffect, 
  useRef, 
  useImperativeHandle, 
  forwardRef, 
  useState 
} from 'react';
import { Box, CircularProgress } from '@mui/material';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { 
  BpmnPropertiesPanelModule, 
  BpmnPropertiesProviderModule 
} from 'bpmn-js-properties-panel';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Project } from '@/types';
import { documentService } from '@/services/document.service';
import toast from 'react-hot-toast';

interface BpmnEditorProps {
  projectId: string;
  project: Project;
}

export interface BpmnEditorRef {
  save: () => Promise<void>;
  exportDiagram: () => void;
  undo: () => void;
  redo: () => void;
}

const BpmnEditor = forwardRef<BpmnEditorRef, BpmnEditorProps>(
  ({ projectId, project }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const propertiesRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<BpmnModeler | null>(null);
    const providerRef = useRef<WebsocketProvider | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useImperativeHandle(ref, () => ({
      save: async () => {
        if (modelerRef.current && hasUnsavedChanges) {
          try {
            const result = await modelerRef.current.saveXML({ format: true });
            const xml = result.xml;
            if (xml) {
              await documentService.updateDocument(projectId, { bpmnXml: xml });
              setHasUnsavedChanges(false);
              toast.success('저장되었습니다');
            } else {
              throw new Error('XML generation failed');
            }
          } catch (error) {
            console.error('Save failed:', error);
            toast.error('저장에 실패했습니다');
          }
        }
      },
      
      exportDiagram: () => {
        if (modelerRef.current) {
          modelerRef.current.saveXML({ format: true }).then((result) => {
            const xml = result.xml;
            if (xml) {
              const blob = new Blob([xml], { type: 'application/xml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${project.name || 'diagram'}.bpmn`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          });
        }
      },
      
      undo: () => {
        if (modelerRef.current) {
          const commandStack = modelerRef.current.get('commandStack') as any;
          if (commandStack?.canUndo()) {
            commandStack.undo();
          }
        }
      },
      
      redo: () => {
        if (modelerRef.current) {
          const commandStack = modelerRef.current.get('commandStack') as any;
          if (commandStack?.canRedo()) {
            commandStack.redo();
          }
        }
      }
    }));

    useEffect(() => {
      if (!containerRef.current || !propertiesRef.current) return;

      const initializeEditor = async () => {
        try {
          // Initialize Yjs document for real-time collaboration
          const ydoc = new Y.Doc();
          ydocRef.current = ydoc;

          // Connect to WebSocket provider
          const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234') as string;
          const provider = new WebsocketProvider(wsUrl, `project-${projectId}`, ydoc);
          providerRef.current = provider;

          // Initialize BPMN modeler
          const modeler = new BpmnModeler({
            container: containerRef.current!,
            propertiesPanel: {
              parent: propertiesRef.current!,
            },
            additionalModules: [
              BpmnPropertiesPanelModule,
              BpmnPropertiesProviderModule,
            ],
          });

          modelerRef.current = modeler;

          // Load document
          const document = await documentService.getDocument(projectId);
          
          let xml = document.bpmnXml;
          if (!xml) {
            // Default empty BPMN diagram
            xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                  id="Definitions_1" 
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="99" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
          }

          await modeler.importXML(xml);

          // Setup collaborative editing with Yjs
          const xmlText = ydoc.getText('bpmn-xml');
          xmlText.insert(0, xml);

          // Listen for remote changes
          xmlText.observe(() => {
            const updatedXml = xmlText.toString();
            if (updatedXml !== xml) {
              modeler.importXML(updatedXml).catch(console.error);
            }
          });

          // Listen for local changes
          modeler.on('commandStack.changed', async () => {
            setHasUnsavedChanges(true);
            try {
              const result = await modeler.saveXML({ format: true });
              const newXml = result.xml;
              if (newXml && newXml !== xmlText.toString()) {
                xmlText.delete(0, xmlText.length);
                xmlText.insert(0, newXml);
              }
            } catch (error) {
              console.error('Failed to sync changes:', error);
            }
          });

          setIsLoading(false);
          
        } catch (error) {
          console.error('Failed to initialize editor:', error);
          toast.error('에디터 초기화에 실패했습니다');
          setIsLoading(false);
        }
      };

      initializeEditor();

      // Cleanup
      return () => {
        if (modelerRef.current) {
          modelerRef.current.destroy();
        }
        if (providerRef.current) {
          providerRef.current.destroy();
        }
        if (ydocRef.current) {
          ydocRef.current.destroy();
        }
      };
    }, [projectId]);

    // Auto-save functionality
    useEffect(() => {
      if (!hasUnsavedChanges) return;

      const autoSaveTimer = setTimeout(async () => {
        if (modelerRef.current && hasUnsavedChanges) {
          try {
            const result = await modelerRef.current.saveXML({ format: true });
            const xml = result.xml;
            if (xml) {
              await documentService.updateDocument(projectId, { bpmnXml: xml });
              setHasUnsavedChanges(false);
            }
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }
      }, 5000); // Auto-save after 5 seconds of inactivity

      return () => clearTimeout(autoSaveTimer);
    }, [hasUnsavedChanges, projectId]);

    if (isLoading) {
      return (
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Box sx={{ height: '100%', display: 'flex' }}>
        <Box
          ref={containerRef}
          sx={{
            flexGrow: 1,
            height: '100%',
            '& .bjs-container': {
              height: '100% !important',
            },
          }}
        />
        <Box
          ref={propertiesRef}
          sx={{
            width: 300,
            height: '100%',
            borderLeft: '1px solid #ccc',
            overflow: 'auto',
            backgroundColor: '#f5f5f5',
            '& .bio-properties-panel': {
              height: '100% !important',
            },
          }}
        />
      </Box>
    );
  }
);

BpmnEditor.displayName = 'BpmnEditor';

export { BpmnEditor };