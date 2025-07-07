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
const documentMetadata = new Map() // roomId -> { diagramId, lastSaved, saveInProgress, lastChanged, forceSaveTimeout, connections }
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
 * 데이터베이스에서 문서 로드
 */
async function loadDocumentFromDatabase(diagramId) {
  if (!supabase) {
    console.log(`📝 Loading document ${diagramId} - Supabase not configured`)
    return null
  }

  try {
    console.log(`📖 Loading document ${diagramId} from database...`)

    const { data, error } = await supabase
      .from('diagrams')
      .select('bpmn_xml, name, updated_at')
      .eq('id', diagramId)
      .single()

    if (error) {
      console.error(`❌ Failed to load document ${diagramId}:`, error)
      return null
    }

    console.log(`✅ Document ${diagramId} loaded from database`)
    return data

  } catch (error) {
    console.error(`❌ Error loading document ${diagramId}:`, error)
    return null
  }
}

/**
 * 서버 측 문서 저장 함수
 */
async function saveDocumentToDatabase(roomId, ydoc, reason = 'unknown') {
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
    const bpmnMap = ydoc.getMap('bpmn-diagram')
    const bpmnXml = bpmnMap.get('xml')

    if (!bpmnXml) {
      console.warn(`⚠️ No BPMN XML found in document ${roomId}`)
      return false
    }

    console.log(`💾 Saving document ${roomId} to database (reason: ${reason})...`)

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
 * 새로운 저장 전략 구현
 */
function setupSaveStrategies(roomId) {
  const metadata = documentMetadata.get(roomId)
  if (!metadata) return

  // 1. 10초 디바운스 저장 함수
  const debouncedSave = debounce(async () => {
    const ydoc = documents.get(roomId)
    if (ydoc) {
      await saveDocumentToDatabase(roomId, ydoc, '10s-debounce')
    }
  }, 10000) // 10초 디바운스

  // 2. 1분 강제 저장 타이머 설정
  function scheduleForceSave() {
    // 기존 타이머 정리
    if (metadata.forceSaveTimeout) {
      clearTimeout(metadata.forceSaveTimeout)
    }

    // 1분 후 강제 저장
    metadata.forceSaveTimeout = setTimeout(async () => {
      const ydoc = documents.get(roomId)
      if (ydoc) {
        console.log(`⏰ Force saving document ${roomId} after 1 minute`)
        await saveDocumentToDatabase(roomId, ydoc, '1min-force')
      }
    }, 60000) // 1분
  }

  return { debouncedSave, scheduleForceSave }
}

/**
 * 문서 변경 이벤트 리스너 설정
 */
async function setupDocumentPersistence(roomId, ydoc, diagramId) {
  console.log(`🔧 Setting up persistence for room ${roomId} (diagram: ${diagramId})`)

  // 메타데이터 저장
  documentMetadata.set(roomId, {
    diagramId,
    lastSaved: 0,
    saveInProgress: false,
    lastModifiedBy: null,
    lastChanged: 0,
    forceSaveTimeout: null,
    connections: 0
  })

  // 새로운 저장 전략 설정
  const { debouncedSave, scheduleForceSave } = setupSaveStrategies(roomId)
  saveQueue.set(roomId, { debouncedSave, scheduleForceSave })

  // 데이터베이스에서 문서 로드 및 Y.Doc에 설정
  const dbDocument = await loadDocumentFromDatabase(diagramId)
  if (dbDocument && dbDocument.bpmn_xml) {
    console.log(`📖 Loading existing document from DB for room ${roomId}`)
    const bpmnMap = ydoc.getMap('bpmn-diagram')
    bpmnMap.set('xml', dbDocument.bpmn_xml)
    documentMetadata.get(roomId).lastSaved = Date.now()
  } else {
    console.log(`📄 No existing document found for room ${roomId}, will use client data`)
  }

  // Y.Doc 변경 시 저장 로직
  ydoc.on('update', () => {
    const metadata = documentMetadata.get(roomId)
    if (!metadata) return

    const now = Date.now()
    metadata.lastChanged = now

    console.log(`📝 Document ${roomId} updated, scheduling saves...`)
    
    // 10초 디바운스 저장
    debouncedSave()
    
    // 1분 강제 저장 타이머 재설정
    scheduleForceSave()
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

wss.on('connection', async (conn, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress)
  
  // URL에서 room ID와 diagram ID 파싱
  const url = new URL(req.url, `http://${req.headers.host}`)
  const roomId = url.pathname.slice(1) // Remove leading slash
  const diagramId = url.searchParams.get('diagramId')
  
  console.log(`🏠 Client joining room: ${roomId}${diagramId ? ` (diagram: ${diagramId})` : ''}`)
  
  // 기존 Y.Doc이 있는지 확인하거나 새로 생성
  let ydoc = documents.get(roomId)
  let isNewRoom = false
  
  if (!ydoc) {
    // 새 룸 생성
    ydoc = new Y.Doc()
    documents.set(roomId, ydoc)
    isNewRoom = true
    console.log(`📄 Created new room: ${roomId}`)
    
    // 다이어그램 ID가 있으면 문서 저장 설정 및 DB에서 로드
    if (diagramId) {
      await setupDocumentPersistence(roomId, ydoc, diagramId)
    }
  }
  
  // 연결 수 증가
  const metadata = documentMetadata.get(roomId)
  if (metadata) {
    metadata.connections++
    console.log(`👥 Room ${roomId} connections: ${metadata.connections}`)
  }
  
  // Yjs WebSocket 연결 설정
  setupWSConnection(conn, req, { docName: roomId, gc: true })
  
  conn.on('close', async () => {
    console.log(`🔌 Client disconnected from room: ${roomId}`)
    
    // 연결 수 감소
    const metadata = documentMetadata.get(roomId)
    if (metadata) {
      metadata.connections--
      console.log(`👥 Room ${roomId} connections: ${metadata.connections}`)
      
      // 마지막 사용자가 나가면 저장 후 룸 정리
      if (metadata.connections <= 0) {
        console.log(`🧹 Last user left room ${roomId}, saving and cleaning up...`)
        
        const ydoc = documents.get(roomId)
        if (ydoc) {
          await saveDocumentToDatabase(roomId, ydoc, 'room-cleanup')
        }
        
        // 타이머 정리
        if (metadata.forceSaveTimeout) {
          clearTimeout(metadata.forceSaveTimeout)
        }
        
        // 룸 정리 (5분 후)
        setTimeout(() => {
          const currentMetadata = documentMetadata.get(roomId)
          if (currentMetadata && currentMetadata.connections <= 0) {
            console.log(`🗑️ Cleaning up room ${roomId} after 5 minutes of inactivity`)
            documents.delete(roomId)
            documentMetadata.delete(roomId)
            saveQueue.delete(roomId)
          }
        }, 5 * 60 * 1000) // 5분
      }
    }
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