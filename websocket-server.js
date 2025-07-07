#!/usr/bin/env node

/**
 * Enhanced WebSocket server for Yjs collaboration with server-side persistence
 * Features: Real-time collaboration + Centralized document storage
 */

const WebSocket = require('ws')
const http = require('http')
const { setupWSConnection } = require('y-websocket/bin/utils')
const Y = require('yjs')
const debounce = require('lodash.debounce')

const host = process.env.HOST || 'localhost'
const port = process.env.PORT || 1234

// 문서별 Y.Doc 저장소 및 저장 상태 관리
const documents = new Map() // roomId -> Y.Doc
const documentMetadata = new Map() // roomId -> { diagramId, lastSaved, saveInProgress }
const saveQueue = new Map() // roomId -> save function

// Supabase 클라이언트 설정 (서버 측)
const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'

let supabase = null
try {
  supabase = createClient(supabaseUrl, supabaseServiceKey)
  console.log('✅ Supabase client initialized for server-side persistence')
} catch (error) {
  console.warn('⚠️ Supabase not configured - documents will only persist in memory')
}

/**
 * 서버 측 문서 저장 함수
 */
async function saveDocumentToDatabase(roomId, ydoc) {
  if (!supabase) {
    console.log(`📝 Saving document ${roomId} - Supabase not configured, skipping DB save`)
    return false
  }

  const metadata = documentMetadata.get(roomId)
  if (!metadata || !metadata.diagramId) {
    console.warn(`⚠️ No diagram ID found for room ${roomId}`)
    return false
  }

  if (metadata.saveInProgress) {
    console.log(`⏳ Save already in progress for ${roomId}`)
    return false
  }

  metadata.saveInProgress = true

  try {
    // Y.Doc에서 BPMN XML 추출
    const bpmnMap = ydoc.getMap('bpmn')
    const bpmnXml = bpmnMap.get('xml')

    if (!bpmnXml) {
      console.warn(`⚠️ No BPMN XML found in document ${roomId}`)
      return false
    }

    console.log(`💾 Saving document ${roomId} to database...`)

    const { data, error } = await supabase
      .from('diagrams')
      .update({
        bpmn_xml: bpmnXml,
        updated_at: new Date().toISOString(),
        last_modified_by: metadata.lastModifiedBy || null
      })
      .eq('id', metadata.diagramId)

    if (error) {
      console.error(`❌ Failed to save document ${roomId}:`, error)
      return false
    }

    metadata.lastSaved = Date.now()
    console.log(`✅ Document ${roomId} saved to database successfully`)
    return true

  } catch (error) {
    console.error(`❌ Error saving document ${roomId}:`, error)
    return false
  } finally {
    metadata.saveInProgress = false
  }
}

/**
 * 디바운스된 저장 함수 생성
 */
function createDebouncedSave(roomId) {
  return debounce(async () => {
    const ydoc = documents.get(roomId)
    if (ydoc) {
      await saveDocumentToDatabase(roomId, ydoc)
    }
  }, 2000) // 2초 디바운스
}

/**
 * 문서 변경 이벤트 리스너 설정
 */
function setupDocumentPersistence(roomId, ydoc, diagramId) {
  console.log(`🔧 Setting up persistence for room ${roomId} (diagram: ${diagramId})`)

  // 메타데이터 저장
  documentMetadata.set(roomId, {
    diagramId,
    lastSaved: Date.now(),
    saveInProgress: false,
    lastModifiedBy: null
  })

  // 디바운스된 저장 함수 생성
  const debouncedSave = createDebouncedSave(roomId)
  saveQueue.set(roomId, debouncedSave)

  // Y.Doc 변경 시 자동 저장
  ydoc.on('update', () => {
    console.log(`📝 Document ${roomId} updated, scheduling save...`)
    debouncedSave()
  })

  console.log(`✅ Persistence setup complete for room ${roomId}`)
}

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('Enhanced Yjs WebSocket Server with Persistence\n')
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
  
  // URL에서 room ID와 diagram ID 파싱
  const url = new URL(req.url, `http://${req.headers.host}`)
  const roomId = url.pathname.slice(1) // Remove leading slash
  const diagramId = url.searchParams.get('diagramId')
  
  console.log(`🏠 Client joining room: ${roomId}${diagramId ? ` (diagram: ${diagramId})` : ''}`)
  
  // 기존 Y.Doc이 있는지 확인하거나 새로 생성
  let ydoc = documents.get(roomId)
  if (!ydoc) {
    ydoc = new Y.Doc()
    documents.set(roomId, ydoc)
    console.log(`📄 Created new document for room: ${roomId}`)
    
    // 다이어그램 ID가 있으면 문서 저장 설정
    if (diagramId) {
      setupDocumentPersistence(roomId, ydoc, diagramId)
    }
  }
  
  // Yjs WebSocket 연결 설정
  setupWSConnection(conn, req, { docName: roomId, gc: true })
  
  conn.on('close', () => {
    console.log(`🔌 Client disconnected from room: ${roomId}`)
    
    // 룸에 더 이상 연결된 클라이언트가 없으면 정리
    // (실제 구현에서는 더 정교한 정리 로직 필요)
  })
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