# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **BPMN Collaborative Editor** project that aims to build a real-time collaborative web application for editing BPMN diagrams, similar to Google Docs but for business process modeling.

**Current Status**: Complete technical specifications with development-ready design documents. Ready to begin implementation of MVP.

## Architecture & Technology Stack

### Planned Technology Stack
- **Frontend**: React 18+ with TypeScript, bpmn-js (BPMN.io), Vite build tool
- **Backend**: Node.js with Express.js, TypeScript, Socket.io for real-time communication
- **Database**: PostgreSQL via Supabase (includes Auth, Storage, Realtime)
- **Real-time Collaboration**: CRDT using Yjs (chosen over OT after extensive analysis)
- **Infrastructure**: Docker containers, optional Kubernetes orchestration

### Key Architectural Decisions
1. **CRDT over OT**: The project has chosen Yjs-based CRDT for real-time collaboration after thorough analysis (see `ot-crdt-comparison.md`)
2. **Supabase Backend**: Full backend-as-a-service with PostgreSQL, Auth, Storage, and Realtime capabilities
3. **Microservices Design**: Scalable architecture with separate services for auth, collaboration, and API

## Database Schema (Supabase)

### Core Tables
- `profiles` - User management (linked to Supabase Auth)
- `projects` - Project containers with ownership
- `project_members` - Role-based access control (admin/editor/viewer)
- `folders` - Hierarchical folder structure
- `diagrams` - BPMN diagram storage (XML content)
- `diagram_versions` - Automatic version control with triggers
- `collaboration_sessions` - Real-time collaboration state
- `diagram_comments` - Element-based commenting system
- `activity_logs` - Project activity tracking

### Security Features
- Row Level Security (RLS) policies for fine-grained access control
- Role-based permissions with automatic enforcement
- Supabase Auth integration with JWT tokens and OAuth2

## Development Workflow

### Current Implementation Status
**Phase 1 MVP - Basic BPMN Editor**: ✅ COMPLETED
- ✅ Basic project structure with webpack setup
- ✅ BPMN.js integration with modeler and properties panel
- ✅ Modern UI with responsive design
- ✅ File import/export functionality (BPMN XML, SVG)
- ✅ Drag-and-drop file support
- ✅ Professional Korean UI with clean styling

### AI Assistant Configuration
The project is configured with extensive AI tooling:
- **Claude**: Primary AI assistant with MCP servers for various services
- **Gemini**: Secondary AI assistant configured for Supabase integration
- **Permissions**: Extensive bash command permissions for development tasks

### Key Development Commands
**Current Available Commands:**

```bash
# Development server (현재 사용 가능)
npm run dev

# Build for production (현재 사용 가능)
npm run build

# Start development server (현재 사용 가능)
npm start

# Install dependencies (현재 사용 가능)
npm install
```

**Planned Commands (Phase 2+):**
```bash
# Run tests
npm test

# Database migrations (Supabase)
npx supabase migration up

# Generate types from database
npx supabase gen types typescript --local > src/types/database.ts

# Deploy to Supabase
npx supabase deploy
```

## Core Features & Implementation Strategy

### Real-time Collaboration (CRDT with Yjs)
The project will implement real-time collaboration using Yjs CRDT technology:
- **Phase 1**: Basic Yjs integration with simple element synchronization
- **Phase 2**: Advanced features (cursors, selection, offline support)
- **Phase 3**: Performance optimization and WebRTC integration

### BPMN Integration
- Primary editor based on bpmn-js library
- Custom modules for remote cursors and collaborative features
- Intelligent property panels with validation
- Advanced export capabilities (SVG, PNG, BPMN XML, JSON)

### Project Structure (Planned)
```
src/
├── components/
│   ├── Editor/          # BPMN editor components
│   ├── ProjectTree/     # Project/folder navigation
│   ├── Collaboration/   # Real-time collaboration UI
│   └── Permissions/     # Access control UI
├── hooks/               # Custom React hooks
├── services/            # API and WebSocket services
├── store/               # State management (Redux/Zustand)
└── types/               # TypeScript type definitions
```

## Development Phases

### Phase 1: MVP (1-2 months)
- Basic BPMN editor with bpmn-js
- User authentication via Supabase Auth
- Simple project/diagram management
- Basic real-time collaboration

### Phase 2: Advanced Features (2-3 months)
- CRDT implementation with Yjs
- Advanced collaboration features (cursors, selection)
- Role-based access control
- Version management and history

### Phase 3: Production Ready (1-2 months)
- Performance optimization for large diagrams
- Advanced security features
- Comprehensive testing suite
- Production deployment pipeline

## Technical Considerations

### Performance Optimization
- React.lazy for code splitting
- Virtual scrolling for large diagram lists
- WebWorker for BPMN parsing
- Debouncing/throttling for real-time updates
- Redis caching strategy

### Security & Access Control
- HTTPS/WSS encryption mandatory
- SQL injection prevention with prepared statements
- XSS protection with input validation
- API rate limiting
- CORS configuration

### Scalability Features
- P2P collaboration capability (no central server dependency)
- Horizontal server scaling
- Database indexing strategy
- Connection pooling
- Delta updates for efficient synchronization

## Monitoring & Operations

### Planned Monitoring Stack
- Application Performance Monitoring (APM)
- ELK Stack for log aggregation
- Sentry for error tracking
- User analytics integration
- Automated cleanup functions for old data

### CI/CD Pipeline
- GitHub Actions for automated deployment
- Docker containerization
- Kubernetes deployment (optional)
- Automated testing and quality checks

## Documentation Files

### Core Design Documents
- `development-design-document.md` - **Main development-ready design document** (comprehensive technical specifications)
- `project-todo-management.md` - **Project TODO management and development phases**

### Research and Analysis Documents
- `requirement/bpmn-editor-design-doc.md` - Original architectural design document (Korean)
- `requirement/supabase-bpmn-db-design.md` - Comprehensive database schema design
- `requirement/ot-crdt-comparison.md` - Technical analysis comparing OT vs CRDT approaches
- `requirement/merged-features.md` - Advanced feature specifications
- `requirement/additional_features.md` - Additional feature proposals

## Getting Started (Implementation Ready)

### Phase 1: MVP Development (6-8 weeks) - ✅ COMPLETED
**Basic BPMN Editor** - Successfully implemented with modern web stack:

1. **Project Setup** - ✅ COMPLETED
   - ✅ Webpack + JavaScript (ES6+) project structure
   - ✅ Professional UI with responsive design
   - ✅ Modern build system with hot reloading

2. **Core BPMN Features** - ✅ COMPLETED
   - ✅ BPMN.js modeler integration
   - ✅ Properties panel for element editing
   - ✅ File import/export (BPMN XML, SVG)
   - ✅ Drag-and-drop file support
   - ✅ Korean UI with professional styling

3. **Foundation Ready** - ✅ COMPLETED
   - ✅ Extensible architecture for collaboration features
   - ✅ Clean separation of concerns
   - ✅ Ready for Phase 2 real-time collaboration

### Next Steps - Phase 2: Real-time Collaboration
Follow the detailed TODO list in `todo.md`:

1. **Real-time Collaboration Setup**
   - Integrate Yjs CRDT library
   - Add WebSocket connection management
   - Implement basic synchronization

2. **User Management**
   - Add user authentication
   - Implement user avatars and cursors
   - Basic permission system

3. **Collaboration Features**
   - Real-time element synchronization
   - User presence indicators
   - Conflict resolution

Refer to `development-design-document.md` for detailed technical specifications and `todo.md` for comprehensive task breakdown.

## Key Implementation Notes

### Technology Decisions
- **CRDT over OT**: Yjs chosen for superior scalability and offline support
- **Supabase Backend**: Full-stack solution with PostgreSQL, Auth, Realtime, and Storage
- **React + TypeScript**: Modern frontend with strong type safety
- **bpmn-js Integration**: Proven BPMN editing library with custom collaborative modules

### Development Approach
- **Phase-based Development**: MVP → Advanced Features → Production Ready
- **Security First**: RLS policies, role-based access control, data encryption
- **Performance Optimized**: Virtual scrolling, code splitting, efficient synchronization
- **Scalable Architecture**: Horizontal scaling, P2P capability, microservices ready

### Ready for Implementation
All technical decisions are finalized with comprehensive documentation. The project is ready to begin development following the structured approach outlined in the design documents.

## Rules
- 개발이 끝나면 꼭 todo.md 파일을 업데이트 한다.
- 스탭마다 끝날 때는 실행 가능한 상태로 만든다.