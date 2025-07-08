#!/usr/bin/env node

/**
 * Enhanced WebSocket server for BPMN collaboration with database persistence
 * Features: Real-time collaboration + Database management + Document persistence
 */

// Load environment variables
require('dotenv').config()

const WebSocket = require('ws')
const http = require('http')
const { setupWSConnection } = require('y-websocket/bin/utils')
const Y = require('yjs')
const debounce = require('lodash.debounce')
const { loadDocumentFromDatabase, saveDocumentToDatabase, getDocumentName } = require('./database')
const fs = require('fs')
const path = require('path')

// 기본 BPMN XML 로드
const newDiagramXML = fs.readFileSync(path.join(__dirname, '../src/assets/newDiagram.bpmn'), 'utf8')

/**
 * 문서명에서 확장자 제거 및 표시용 이름 생성
 */
function getDisplayName(documentName) {
  if (!documentName) return '알 수 없는 문서'
  
  // .bpmn 확장자 제거
  const cleanName = documentName.replace(/\.bpmn$/i, '')
  
  return cleanName || '새 문서'
}

/**
 * 룸 메타데이터에서 실제 문서명 가져오기
 */
function getDocumentDisplayName(roomId) {
  const metadata = documentMetadata.get(roomId)
  if (!metadata) return '알 수 없는 문서'
  
  // metadata.name이 실제 DB에서 가져온 문서명이거나 fallback 이름
  if (metadata.name && !metadata.name.startsWith('문서-')) {
    // DB에서 가져온 실제 문서명
    return getDisplayName(metadata.name)
  } else {
    // DB 연결 실패시 diagramId로 더 나은 이름 생성
    if (metadata.diagramId) {
      return `새 BPMN 문서 (${metadata.diagramId.slice(0, 8)})`
    }
    return '새 BPMN 문서'
  }
}

const host = process.env.HOST || 'localhost'
const port = process.env.PORT || 1234

// 문서별 Y.Doc 저장소 및 저장 상태 관리
const documents = new Map() // roomId -> Y.Doc
const documentMetadata = new Map() // roomId -> { diagramId, name, lastSaved, saveInProgress, lastChanged, forceSaveTimeout, connections, heartbeatInterval }
const saveQueue = new Map() // roomId -> save function
const documentRequests = new Map() // diagramId -> {xml, name} 문서 요청 캐시

/**
 * 새로운 저장 전략 구현 (30초 debounce, 1분 강제 저장)
 */
function setupSaveStrategies(roomId) {
  const metadata = documentMetadata.get(roomId)
  if (!metadata) return

  // 1. 30초 디바운스 저장 함수
  const debouncedSave = debounce(async () => {
    const ydoc = documents.get(roomId)
    if (ydoc) {
      await saveDocumentToDatabaseWithLog(roomId, ydoc, '3초 자동저장')
    }
  }, 3000) // 3초 디바운스

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
        const displayName = getDocumentDisplayName(roomId)
        // console.log(`⏰ 1분 강제 저장: ${displayName}`) // Disabled: too verbose
        await saveDocumentToDatabaseWithLog(roomId, ydoc, '1분 강제저장')
      }
    }, 60000) // 1분
  }

  return { debouncedSave, scheduleForceSave }
}

/**
 * 문서 저장 with 로그
 */
async function saveDocumentToDatabaseWithLog(roomId, ydoc, reason) {
  const metadata = documentMetadata.get(roomId)
  if (!metadata || !metadata.diagramId) {
    console.warn(`⚠️ 문서 ID 없음: ${roomId}`)
    return false
  }

  if (metadata.saveInProgress) {
    // console.log(`⏳ 저장 진행 중: ${metadata.name}`) // Disabled: too verbose
    return false
  }

  metadata.saveInProgress = true

  try {
    // Y.Doc에서 BPMN XML 추출
    const bpmnMap = ydoc.getMap('bpmn-diagram')
    const bpmnXml = bpmnMap.get('xml')

    if (!bpmnXml) {
      console.warn(`⚠️ BPMN XML 없음: ${metadata.name}`)
      return false
    }

    const success = await saveDocumentToDatabase(
      metadata.diagramId,
      bpmnXml,
      reason,
      metadata.lastModifiedBy
    )

    if (success) {
      metadata.lastSaved = Date.now()
    }

    return success

  } catch (error) {
    console.warn(`⚠️ 저장 오류: ${metadata.name}`, error.message)
    return false
  } finally {
    metadata.saveInProgress = false
  }
}

/**
 * 문서 변경 이벤트 리스너 설정
 */
async function setupDocumentPersistence(roomId, ydoc, diagramId) {
  console.log(`🔧 협업 세션 설정 중: ${roomId} (문서 ID: ${diagramId})`)

  // 데이터베이스에서 문서 로드
  const dbDocument = await loadDocumentFromDatabase(diagramId)
  let documentName = '새 문서'
  
  if (dbDocument && dbDocument.name) {
    documentName = dbDocument.name
  } else {
    // DB에서 문서명만 따로 조회
    const nameFromDb = await getDocumentName(diagramId)
    documentName = nameFromDb
  }
  
  // 메타데이터 저장
  documentMetadata.set(roomId, {
    diagramId,
    name: documentName,
    lastSaved: 0,
    saveInProgress: false,
    lastModifiedBy: null,
    lastChanged: 0,
    forceSaveTimeout: null,
    connections: 0,
    lastSavedXml: null, // 변경사항 추적용
    heartbeatInterval: null, // heartbeat 타이머
    lastHeartbeat: Date.now() // 마지막 heartbeat 시간
  })

  // 새로운 저장 전략 설정
  const { debouncedSave, scheduleForceSave } = setupSaveStrategies(roomId)
  saveQueue.set(roomId, { debouncedSave, scheduleForceSave })

  // 데이터베이스에서 문서 로드 및 Y.Doc에 설정
  const displayName = getDisplayName(documentName)
  if (dbDocument && dbDocument.bpmn_xml) {
    // console.log(`📖 기존 문서 로드: ${displayName}`) // Disabled: too verbose
    const bpmnMap = ydoc.getMap('bpmn-diagram')
    bpmnMap.set('xml', dbDocument.bpmn_xml)
    documentMetadata.get(roomId).lastSaved = Date.now()
  } else {
    // console.log(`📄 새 문서 생성: ${displayName}`) // Disabled: too verbose
    // 기본 BPMN XML을 로드하여 빈 다이어그램 상태 방지
    const bpmnMap = ydoc.getMap('bpmn-diagram')
    if (!bpmnMap.get('xml')) {
      const defaultBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"/>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;
      bpmnMap.set('xml', defaultBpmn);
    }
  }

  // Y.Doc 변경 시 저장 로직
  ydoc.on('update', (update, origin) => {
    console.log(" yodc.on('update')");
    const metadata = documentMetadata.get(roomId)
    if (!metadata) return

    const now = Date.now()
    
    // 변경사항이 실제로 있는지 확인
    const bpmnMap = ydoc.getMap('bpmn-diagram')
    const currentXml = bpmnMap.get('xml')
    
    // 이전 XML과 비교하여 실제 변경이 있었는지 확인
    if (metadata.lastSavedXml && currentXml === metadata.lastSavedXml) {
      return // 변경사항 없음
    }
    
    metadata.lastChanged = now
    metadata.lastSavedXml = currentXml

    const displayName = getDocumentDisplayName(roomId)
    // console.log(`📝 문서 수정됨: ${displayName}`) // Disabled: too verbose
    
    // Y.Doc 문서 내용 출력 (분석용)
    console.log(`📝 Y.Doc 업데이트 - ${displayName}:`, {
      xmlLength: currentXml ? currentXml.length : 0,
      xmlPreview: currentXml ? currentXml.substring(0, 200) + '...' : 'null',
      timestamp: new Date().toISOString()
    });
    
    // 30초 디바운스 저장
    debouncedSave()
    
    // 1분 강제 저장 타이머 재설정
    scheduleForceSave()
  })

  console.log(`✅ 협업 세션 준비 완료: ${displayName}`)
  return { documentName, hasExistingData: !!(dbDocument && dbDocument.bpmn_xml) }
}

/**
 * heartbeat 시스템 설정
 */
function setupHeartbeat() {
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        // console.log('💔 Heartbeat 실패로 연결 종료') // Disabled: too verbose
        return ws.terminate()
      }
      
      ws.isAlive = false
      ws.ping()
    })
  }, 30000) // 30초마다 heartbeat
  
  return heartbeatInterval
}

/**
 * 문서 요청 처리 API
 */
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)
  
  // CORS 헤더 설정
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (request.method === 'OPTIONS') {
    response.writeHead(200)
    response.end()
    return
  }
  
  // 문서 요청 API: /api/document/:diagramId
  if (request.method === 'GET' && url.pathname.startsWith('/api/document/')) {
    const diagramId = url.pathname.replace('/api/document/', '')
    
    try {
      // console.log(`📄 문서 요청: ${diagramId}`) // Disabled: too verbose
      
      // 룸 ID 생성 (문서 ID를 룸 ID로 사용)
      const roomId = diagramId
      
      let ydoc = documents.get(roomId)
      let documentInfo = null
      
      if (!ydoc) {
        // 룸이 없으면 생성
        ydoc = new Y.Doc()
        documents.set(roomId, ydoc)
        
        console.log(`🏠 룸 생성: ${roomId}`)
        
        // 문서를 DB에서 로드하고 룸에 저장
        documentInfo = await setupDocumentPersistence(roomId, ydoc, diagramId)
        
        const displayName = getDocumentDisplayName(roomId)
        // console.log(`📁 룸에 문서 저장: ${displayName}`) // Disabled: too verbose
      }
      
      // 룸에 있는 문서를 UI에게 보냄
      const bpmnMap = ydoc.getMap('bpmn-diagram')
      const xml = bpmnMap.get('xml')
      const metadata = documentMetadata.get(roomId)
      
      // 로컬과 같으면 적용할 필요없음, 다를 경우만 적용
      let finalXml = xml || newDiagramXML
      if (!xml) {
        // 빈 문서인 경우 기본 XML 설정
        bpmnMap.set('xml', newDiagramXML)
        finalXml = newDiagramXML
        // console.log(`📄 기본 문서 로드: ${metadata?.name || '새 문서'}`) // Disabled: too verbose
      }
      
      response.writeHead(200, { 'Content-Type': 'application/json' })
      const responseData = {
        success: true,
        diagramId: diagramId,
        name: metadata?.name || '새 문서',
        xml: finalXml,
        roomId: roomId
      };
      
      // API 응답 문서 내용 출력 (분석용)
      console.log(`📤 API 응답 - ${metadata?.name || '새 문서'}:`, {
        xmlLength: finalXml ? finalXml.length : 0,
        xmlPreview: finalXml, // ? finalXml.substring(0, 200) + '...' : 'null',
        timestamp: new Date().toISOString()
      });
      
      response.end(JSON.stringify(responseData))
      
      // console.log(`📤 문서 전송 완료: ${metadata?.name || '새 문서'}`) // Disabled: too verbose
      
    } catch (error) {
      console.error(`❌ 문서 요청 오류:`, error)
      response.writeHead(500, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        success: false,
        error: error.message
      }))
    }
    return
  }
  
  // 기본 응답
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('Enhanced BPMN Collaboration Server with Database\n')
})

const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      threshold: 1024
    }
  }
})

console.log(`🚀 BPMN 협업 서버 시작: ${host}:${port}`)

// heartbeat 시스템 시작
function heartbeat() {
  this.isAlive = true
}

const globalHeartbeatInterval = setupHeartbeat()

wss.on('connection', async (conn, req) => {
  // heartbeat 초기화
  conn.isAlive = true
  conn.on('pong', heartbeat)
  
  // console.log('새 WebSocket 연결:', req.socket.remoteAddress) // Disabled: too verbose
  
  // URL에서 diagram ID 파싱 (룸 ID는 문서 ID와 동일하게 사용)
  const url = new URL(req.url, `http://${req.headers.host}`)
  let diagramId = url.searchParams.get('diagramId')
  
  // diagramId가 복잡한 경로 형태인 경우 실제 ID만 추출
  if (diagramId && diagramId.includes('/')) {
    // 경로에서 마지막 UUID 부분만 추출
    const parts = diagramId.split('/')
    const lastPart = parts[parts.length - 1]
    // UUID 형태인지 확인하고 추출
    const uuidMatch = lastPart.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
    if (uuidMatch) {
      diagramId = uuidMatch[0]
    }
  }
  
  // 룸 ID는 문서 ID와 동일하게 사용
  const roomId = diagramId || 'default-room'
  
  // console.log(`🔗 연결 정보: 룸ID=${roomId}, 다이어그램ID=${diagramId}`) // Disabled: too verbose
  
  if (!diagramId) {
    console.warn('⚠️ 다이어그램 ID가 없어 연결을 거부합니다.')
    conn.close(1000, '다이어그램 ID가 필요합니다.')
    return
  }
  
  // 기존 Y.Doc이 있는지 확인하거나 새로 생성
  let ydoc = documents.get(roomId)
  let isNewRoom = false
  let documentInfo = null
  
  if (!ydoc) {
    // 새 룸 생성
    ydoc = new Y.Doc()
    documents.set(roomId, ydoc)
    isNewRoom = true
    
    // 문서 저장 설정 및 DB에서 로드
    documentInfo = await setupDocumentPersistence(roomId, ydoc, diagramId)
    // DB에서 로드된 실제 문서명 표시
    const displayName = getDocumentDisplayName(roomId)
    // console.log(`👤 사용자가 문서에 접속: ${displayName}`) // Disabled: too verbose
    console.log(`🏠 룸 생성: 룸ID=${roomId}, 문서명=${displayName}`)
  } else {
    // 기존 룸 - 실제 문서명 출력
    const displayName = getDocumentDisplayName(roomId)
    // console.log(`👤 사용자가 문서에 입장: ${displayName}`) // Disabled: too verbose
  }
  
  // 연결 수 증가
  const metadata = documentMetadata.get(roomId)
  if (metadata) {
    metadata.connections++
    const displayName = getDocumentDisplayName(roomId)
    // console.log(`👥 ${displayName} 접속자 수: ${metadata.connections}`) // Disabled: too verbose
  }
  
  // Yjs WebSocket 연결 설정
  setupWSConnection(conn, req, { docName: roomId, gc: true })
  
  // 새 룸이고 DB에서 문서를 로드했다면 클라이언트에게 즉시 동기화
  if (isNewRoom && documentInfo && documentInfo.hasExistingData) {
    // 짧은 지연 후 동기화 (클라이언트 연결 완료 대기)
    setTimeout(() => {
      const displayName = getDocumentDisplayName(roomId)
      // console.log(`📤 문서 내용 즉시 동기화: ${displayName}`) // Disabled: too verbose
    }, 100)
  }
  
  conn.on('close', async () => {
    const displayName = getDocumentDisplayName(roomId)
    // console.log(`🔌 사용자가 문서에서 나감: ${displayName}`) // Disabled: too verbose
    
    // 연결 수 감소
    const metadata = documentMetadata.get(roomId)
    if (metadata) {
      metadata.connections--
      // console.log(`👥 ${displayName} 접속자 수: ${metadata.connections}`) // Disabled: too verbose
      
      // 마지막 사용자가 나가면 즉시 저장하고 룸 정리
      if (metadata.connections <= 0) {
        console.log(`💾 DB 저장: 마지막 사용자 나감 - ${displayName}`)
        
        const ydoc = documents.get(roomId)
        if (ydoc) {
          await saveDocumentToDatabaseWithLog(roomId, ydoc, '룸 정리')
        }
        
        // 타이머 정리
        if (metadata.forceSaveTimeout) {
          clearTimeout(metadata.forceSaveTimeout)
        }
        
        // 접속자가 없으면 즉시 룸 정리
        console.log(`🗑️ 룸 즉시 소멸 (접속자 없음): 룸ID=${roomId}, 문서명=${displayName}`)
        
        // heartbeat 타이머 정리
        if (metadata.heartbeatInterval) {
          clearInterval(metadata.heartbeatInterval)
        }
        
        documents.delete(roomId)
        documentMetadata.delete(roomId)
        saveQueue.delete(roomId)
      }
    }
  })
  
  // 연결 오류 처리 (즉시 정리)
  conn.on('error', (error) => {
    const displayName = getDocumentDisplayName(roomId)
    console.log(`❌ 연결 오류 발생: ${displayName}`, error.message)
    
    // 오류 발생시 즉시 연결 수 감소
    const metadata = documentMetadata.get(roomId)
    if (metadata && metadata.connections > 0) {
      metadata.connections--
      console.log(`👥 ${displayName} 접속자 수 (오류로 인한 감소): ${metadata.connections}`)
    }
  })
})

wss.on('error', (error) => {
  console.error('WebSocket 서버 오류:', error)
})

server.listen(port, host, () => {
  console.log(`✅ BPMN 협업 서버 실행 중: ws://${host}:${port}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 WebSocket 서버 종료 중...')
  
  // heartbeat 타이머 정리
  if (globalHeartbeatInterval) {
    clearInterval(globalHeartbeatInterval)
  }
  
  wss.close(() => {
    server.close(() => {
      console.log('✅ WebSocket 서버 종료 완료')
      process.exit(0)
    })
  })
})

process.on('SIGTERM', () => {
  console.log('\n🔄 WebSocket 서버 종료 중...')
  
  // heartbeat 타이머 정리
  if (globalHeartbeatInterval) {
    clearInterval(globalHeartbeatInterval)
  }
  
  wss.close(() => {
    server.close(() => {
      console.log('✅ WebSocket 서버 종료 완료')
      process.exit(0)
    })
  })
})