import BpmnEditor from './components/BpmnEditor'

function App() {
  return (
    <div className="h-screen w-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            BPMN 협업 에디터
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            실시간 협업 BPMN 다이어그램 편집기
          </p>
        </div>
      </header>
      
      <main className="h-[calc(100vh-80px)]">
        <BpmnEditor />
      </main>
    </div>
  )
}

export default App