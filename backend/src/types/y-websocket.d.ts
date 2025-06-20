declare module 'y-websocket/bin/utils' {
  import { IncomingMessage } from 'http';
  import * as WebSocket from 'ws';
  import * as Y from 'yjs';

  export interface WSConnectionOptions {
    docName?: string;
    gc?: boolean;
    getYDoc?: (docName: string) => Promise<Y.Doc> | Y.Doc;
    persistDoc?: (docName: string, ydoc: Y.Doc) => Promise<void> | void;
    authenticate?: (auth: any) => boolean;
    authorize?: (docName: string, ydoc: Y.Doc, ws: WebSocket) => boolean;
  }

  export function setupWSConnection(
    ws: WebSocket,
    req: IncomingMessage,
    options?: WSConnectionOptions
  ): void;
}

declare module 'y-websocket' {
  export * from 'y-websocket/bin/utils';
}