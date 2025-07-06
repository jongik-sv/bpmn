const WebSocket = require('ws');

console.log('Testing WebSocket connection to ws://localhost:1234...');

const ws = new WebSocket('ws://localhost:1234');

ws.on('open', function open() {
  console.log('✅ WebSocket connection successful!');
  ws.close();
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket connection failed:', err.message);
});

ws.on('close', function close() {
  console.log('Connection closed');
  process.exit(0);
});

setTimeout(() => {
  console.log('❌ Connection timeout');
  process.exit(1);
}, 5000);