/**
 * Database operations for BPMN collaboration server  
 * Uses Supabase REST API directly
 */

const https = require('https')

// Supabase 설정
const SUPABASE_URL = 'https://yigkpwxaemgcasxtopup.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ2twd3hhZW1nY2FzeHRvcHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MDY1MzcsImV4cCI6MjA2NzI4MjUzN30.uMWtejlU7yqPwmthdgp4FhNGtpsW_JzmZR5RDMEv4JY'

// HTTP 요청 헬퍼
function makeSupabaseRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL + '/rest/v1/')
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''
      
      res.on('data', (chunk) => {
        responseData += chunk
      })
      
      res.on('end', () => {
        try {
          const result = responseData ? JSON.parse(responseData) : {}
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result)
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${result.message || responseData}`))
          }
        } catch (error) {
          reject(new Error(`JSON parse error: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (data) {
      req.write(JSON.stringify(data))
    }
    
    req.end()
  })
}

console.log('✅ Supabase REST API 연결 준비 완료')

/**
 * Load document from database
 * @param {string} diagramId - The diagram ID to load
 * @returns {Promise<Object|null>} Document data or null
 */
async function loadDocumentFromDatabase(diagramId) {
  try {
    console.log(`📖 DB에서 문서 로드 중... (ID: ${diagramId})`)

    const data = await makeSupabaseRequest('GET', `diagrams?id=eq.${diagramId}&select=bpmn_xml,name,updated_at`)
    
    if (!data || data.length === 0) {
      console.log(`📄 DB에서 문서를 찾을 수 없음 - 새 문서 생성 (ID: ${diagramId})`)
      return null
    }

    const document = data[0]
    console.log(`✅ DB에서 문서 로드 완료: "${document.name}" (ID: ${diagramId})`)
    return document

  } catch (error) {
    console.warn(`⚠️ DB 로드 오류, 메모리 사용:`, error.message)
    return null
  }
}

/**
 * Save document to database
 * @param {string} diagramId - The diagram ID to save
 * @param {string} bpmnXml - The BPMN XML content
 * @param {string} reason - Reason for saving
 * @param {string} lastModifiedBy - User who modified the document
 * @returns {Promise<boolean>} Success status
 */
async function saveDocumentToDatabase(diagramId, bpmnXml, reason = 'unknown', lastModifiedBy = null) {
  if (!bpmnXml) {
    console.warn(`⚠️ 저장할 BPMN XML이 없음 (ID: ${diagramId})`)
    return false
  }

  try {
    console.log(`💾 DB에 문서 저장 중... (ID: ${diagramId}, 사유: ${reason})`)

    const updateData = {
      bpmn_xml: bpmnXml,
      updated_at: new Date().toISOString()
    }
    
    if (lastModifiedBy) {
      updateData.last_modified_by = lastModifiedBy
    }

    const data = await makeSupabaseRequest('PATCH', `diagrams?id=eq.${diagramId}&select=name`, updateData)
    
    const documentName = data && data[0] ? data[0].name : `문서-${diagramId}`
    console.log(`✅ DB 저장 완료: "${documentName}" (사유: ${reason})`)
    return true

  } catch (error) {
    console.warn(`⚠️ DB 저장 오류:`, error.message)
    console.log(`📝 문서는 메모리에서 유지됨`)
    return false
  }
}

/**
 * Get document name by ID
 * @param {string} diagramId - The diagram ID
 * @returns {Promise<string>} Document name
 */
async function getDocumentName(diagramId) {
  try {
    const data = await makeSupabaseRequest('GET', `diagrams?id=eq.${diagramId}&select=name`)
    
    if (!data || data.length === 0) {
      return `새 문서 (${diagramId.slice(0, 8)})`
    }

    return data[0].name
  } catch (error) {
    return `새 문서 (${diagramId.slice(0, 8)})`
  }
}

module.exports = {
  loadDocumentFromDatabase,
  saveDocumentToDatabase,
  getDocumentName
}