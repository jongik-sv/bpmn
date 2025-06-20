import { create } from 'zustand';
import { CollaborativeUser, CursorUpdateMessage, UserJoinedMessage, UserLeftMessage } from '@/types';

interface CollaborationState {
  activeUsers: CollaborativeUser[];
  isConnected: boolean;
  currentProjectId: string | null;
  wsConnection: WebSocket | null;

  // Actions
  connectToProject: (projectId: string) => void;
  disconnectFromProject: () => void;
  updateUserCursor: (userId: string, cursor: { x: number; y: number; elementId?: string }) => void;
  setUserSelection: (userId: string, selection: string[]) => void;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  activeUsers: [],
  isConnected: false,
  currentProjectId: null,
  wsConnection: null,

  connectToProject: (projectId: string) => {
    const { wsConnection, currentProjectId } = get();
    
    // Disconnect from previous project if exists
    if (wsConnection && currentProjectId !== projectId) {
      wsConnection.close();
    }

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';
      const ws = new WebSocket(`${wsUrl}/collaboration/${projectId}`);

      ws.onopen = () => {
        set({ 
          isConnected: true, 
          currentProjectId: projectId,
          wsConnection: ws 
        });
        console.log('Connected to collaboration server');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'user-joined':
              handleUserJoined(message as UserJoinedMessage);
              break;
            case 'user-left':
              handleUserLeft(message as UserLeftMessage);
              break;
            case 'cursor-update':
              handleCursorUpdate(message as CursorUpdateMessage);
              break;
            case 'users-list':
              set({ activeUsers: message.payload.users });
              break;
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        set({ 
          isConnected: false, 
          wsConnection: null,
          activeUsers: [] 
        });
        console.log('Disconnected from collaboration server');
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        set({ isConnected: false });
      };

      // Store connection
      set({ wsConnection: ws });

    } catch (error) {
      console.error('Failed to connect to collaboration server:', error);
    }
  },

  disconnectFromProject: () => {
    const { wsConnection } = get();
    
    if (wsConnection) {
      wsConnection.close();
    }
    
    set({
      isConnected: false,
      currentProjectId: null,
      wsConnection: null,
      activeUsers: [],
    });
  },

  updateUserCursor: (userId: string, cursor: { x: number; y: number; elementId?: string }) => {
    const { wsConnection } = get();
    
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      const message: CursorUpdateMessage = {
        type: 'cursor-update',
        payload: { userId, cursor },
        timestamp: new Date().toISOString(),
      };
      
      wsConnection.send(JSON.stringify(message));
    }
  },

  setUserSelection: (userId: string, selection: string[]) => {
    set((state) => ({
      activeUsers: state.activeUsers.map(user =>
        user.id === userId ? { ...user, selection } : user
      ),
    }));
  },
}));

// Helper functions
function handleUserJoined(message: UserJoinedMessage) {
  useCollaborationStore.setState((state) => {
    const existingUser = state.activeUsers.find(u => u.id === message.payload.user.id);
    if (existingUser) {
      return state; // User already exists
    }
    
    return {
      activeUsers: [...state.activeUsers, message.payload.user],
    };
  });
}

function handleUserLeft(message: UserLeftMessage) {
  useCollaborationStore.setState((state) => ({
    activeUsers: state.activeUsers.filter(u => u.id !== message.payload.userId),
  }));
}

function handleCursorUpdate(message: CursorUpdateMessage) {
  useCollaborationStore.setState((state) => ({
    activeUsers: state.activeUsers.map(user =>
      user.id === message.payload.userId
        ? { ...user, cursor: message.payload.cursor }
        : user
    ),
  }));
}