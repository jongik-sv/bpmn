const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = process.env.WS_PORT || 1234;
const HOST = process.env.WS_HOST || 'localhost';

console.log('🚀 Starting Yjs WebSocket Server...');

// HTTP 서버 생성
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Yjs WebSocket Server running\n');
});

// WebSocket 서버 생성
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    // 성능을 위한 압축 설정
    threshold: 1024,
    concurrencyLimit: 10,
    memLevel: 7
  }
});

// 연결된 클라이언트 관리
const connections = new Map();
const documents = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = url.searchParams.get('room') || 'default-room';
  
  console.log(`📡 New client connected to room: ${roomName}`);
  
  // Yjs WebSocket 연결 설정
  setupWSConnection(ws, req, {
    docName: roomName,
    gc: true // 가비지 컬렉션 활성화
  });
  
  // 연결 정보 저장
  const clientInfo = {
    id: generateClientId(),
    room: roomName,
    connectedAt: new Date(),
    ws: ws
  };
  
  connections.set(ws, clientInfo);
  
  // 방별 문서 관리
  if (!documents.has(roomName)) {
    documents.set(roomName, {
      clients: new Set(),
      createdAt: new Date(),
      lastActivity: new Date()
    });
  }
  
  const room = documents.get(roomName);
  room.clients.add(clientInfo.id);
  room.lastActivity = new Date();
  
  console.log(`👥 Room "${roomName}" now has ${room.clients.size} client(s)`);
  
  // 연결 해제 처리
  ws.on('close', () => {
    console.log(`📤 Client disconnected from room: ${roomName}`);
    
    connections.delete(ws);
    
    if (room) {
      room.clients.delete(clientInfo.id);
      
      if (room.clients.size === 0) {
        console.log(`🗑️ Room "${roomName}" is now empty`);
        // 빈 방은 일정 시간 후 정리 (선택사항)
        setTimeout(() => {
          if (room.clients.size === 0) {
            documents.delete(roomName);
            console.log(`🧹 Cleaned up empty room: ${roomName}`);
          }
        }, 60000); // 1분 후 정리
      } else {
        console.log(`👥 Room "${roomName}" now has ${room.clients.size} client(s)`);
      }
    }
  });
  
  // 에러 처리
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error in room ${roomName}:`, error);
  });
});

// 서버 시작
server.listen(PORT, HOST, () => {
  console.log(`✅ Yjs WebSocket Server is running on ws://${HOST}:${PORT}`);
  console.log(`🌐 HTTP health check available at http://${HOST}:${PORT}`);
  console.log(`📊 Server started at ${new Date().toISOString()}`);
});

// 정리 작업을 위한 주기적 체크 (선택사항)
setInterval(() => {
  const now = new Date();
  const activeRooms = documents.size;
  const totalConnections = connections.size;
  
  console.log(`📈 Server status: ${totalConnections} connections across ${activeRooms} rooms`);
  
  // 비활성 방 정리 (1시간 이상 활동 없음)
  for (const [roomName, room] of documents.entries()) {
    const inactiveTime = now - room.lastActivity;
    if (inactiveTime > 3600000 && room.clients.size === 0) { // 1시간
      documents.delete(roomName);
      console.log(`🧹 Cleaned up inactive room: ${roomName}`);
    }
  }
}, 300000); // 5분마다 체크

// 우아한 종료 처리
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  wss.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  wss.close(() => {
    process.exit(0);
  });
});

// 에러 처리
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 유틸리티 함수
function generateClientId() {
  return Math.random().toString(36).substr(2, 9);
}

// 서버 정보 API (선택사항)
server.on('request', (req, res) => {
  if (req.url === '/status') {
    const status = {
      uptime: process.uptime(),
      connections: connections.size,
      rooms: documents.size,
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
    return;
  }
  
  // 기본 응답
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Yjs WebSocket Server
Connected clients: ${connections.size}
Active rooms: ${documents.size}
Uptime: ${Math.floor(process.uptime())}s
Status endpoint: /status
`);
});