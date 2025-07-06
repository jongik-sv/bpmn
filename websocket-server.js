#!/usr/bin/env node

/**
 * Simple WebSocket server for Yjs collaboration
 * Based on y-websocket
 */

const WebSocket = require('ws')
const http = require('http')
const { setupWSConnection } = require('y-websocket/bin/utils')

const host = process.env.HOST || 'localhost'
const port = process.env.PORT || 1234

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('Yjs WebSocket Server running\n')
})

const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      threshold: 1024
    }
  }
})

console.log(`WebSocket server starting on ${host}:${port}`)

wss.on('connection', (conn, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress)
  setupWSConnection(conn, req)
})

wss.on('error', (error) => {
  console.error('WebSocket server error:', error)
})

server.listen(port, host, () => {
  console.log(`✅ WebSocket server running on ws://${host}:${port}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down WebSocket server...')
  wss.close(() => {
    server.close(() => {
      console.log('✅ WebSocket server closed')
      process.exit(0)
    })
  })
})

process.on('SIGTERM', () => {
  console.log('\n🔄 Shutting down WebSocket server...')
  wss.close(() => {
    server.close(() => {
      console.log('✅ WebSocket server closed')
      process.exit(0)
    })
  })
})