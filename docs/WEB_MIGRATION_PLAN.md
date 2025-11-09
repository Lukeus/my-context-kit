# Web Migration Plan - Context Kit

**Date**: 2025-11-08  
**Status**: Planning Phase  
**Complexity**: High  

## Executive Summary

This document outlines the comprehensive plan to migrate the Context Kit desktop application (Electron-based) to a web-based architecture. The current application has significant Electron-specific dependencies that must be replaced with web-compatible alternatives.

**Estimated Effort**: 8-12 weeks for full migration  
**Risk Level**: Medium-High (significant architectural changes required)

---

## Current Architecture Analysis

### Technology Stack

**Desktop (Current)**
- **Framework**: Electron 39.0.0
- **Frontend**: Vue 3 + Tailwind CSS v4 (Material 3)
- **Build**: Vite 7.x + Electron Forge
- **State**: Pinia stores
- **Runtime**: Node.js 22+ (main process) + Chromium (renderer)

**Services**
- **Python Sidecar**: FastAPI service (`context-kit-service/`) for AI operations
- **Local Node Scripts**: Pipeline scripts in `context-repo/.context/pipelines/`

### Critical Dependencies

#### 1. **Electron-Specific APIs** (75+ usages)
- **Main Process**: `app`, `BrowserWindow`, `ipcMain`, `dialog`, `clipboard`
- **IPC Communication**: 100+ IPC channels (`ipcMain.handle`)
- **Process Model**: Main/Renderer separation with context isolation

#### 2. **Local File System Operations** (Heavy Usage)
- **Services Using `fs`**:
  - `GitService.ts` - Git operations via `simple-git`
  - `FileSystemService.ts` - Read/write YAML entities
  - `SpeckitService.ts` - Pipeline execution via `execa`
  - `ContextBuilderService.ts` - Context repo management
  - `telemetryWriter.ts` - Local log persistence
  - `AICredentialResolver.ts` - Encrypted credential storage

- **File Patterns**:
  - YAML entity storage in `contexts/` folder
  - Generated artifacts in `generated/`
  - Spec logs in `.context-kit/spec-log/`
  - C4 diagrams in `c4/` folder
  - Local repository cloning/management

#### 3. **Child Process Management**
- **Python Sidecar**: `ContextKitServiceClient` spawns FastAPI service
- **Pipeline Execution**: `execa` for Node.js script execution
- **Git Operations**: `simple-git` wraps git CLI

#### 4. **Local Python Service**
- **Context Kit Service**: FastAPI sidecar running locally
- **Dependencies**: Python 3.11+, `uv` package manager, LangChain
- **Features**: Spec generation, RAG, code generation, context analysis

---

## Migration Strategy

### Phase 1: Backend API Development (3-4 weeks)

#### 1.1 Create Node.js/Express Backend

**New Service**: `context-kit-backend/`

```typescript
// Architecture
context-kit-backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── context.routes.ts      // Context CRUD operations
│   │   │   ├── git.routes.ts          // Git operations
│   │   │   ├── filesystem.routes.ts   // File operations
│   │   │   ├── ai.routes.ts           // AI/LangChain operations
│   │   │   ├── enterprise.routes.ts   // Enterprise features
│   │   │   ├── speckit.routes.ts      // SDD workflow
│   │   │   └── rag.routes.ts          // RAG operations
│   │   └── middleware/
│   │       ├── auth.middleware.ts     // JWT/session auth
│   │       ├── upload.middleware.ts   // File uploads
│   │       └── error.middleware.ts    // Error handling
│   ├── services/
│   │   ├── GitService.ts              // Port from Electron main
│   │   ├── FileSystemService.ts       // Server-side file ops
│   │   ├── AIService.ts               // AI operations
│   │   ├── EnterpriseService.ts       // Enterprise logic
│   │   └── PythonServiceProxy.ts      // Proxy to Python sidecar
│   ├── models/                        // DB models (if needed)
│   └── utils/
├── storage/                           // File storage
│   ├── repositories/                  // User repositories
│   ├── uploads/                       // File uploads
│   └── temp/                          // Temporary files
└── config/
    ├── database.ts
    └── storage.ts
```

**Key Technologies**:
- **Framework**: Express.js or Fastify
- **Auth**: JWT + session management
- **Storage**: Local filesystem or S3-compatible object storage
- **Database**: PostgreSQL (user metadata, repo registry)
- **Process Management**: PM2 for production

**API Migration Mapping**:

| Electron IPC Channel | HTTP Endpoint | Method | Notes |
|---------------------|---------------|--------|-------|
| `context:validate` | `/api/context/validate` | POST | Body: `{ repoPath }` |
| `context:buildGraph` | `/api/context/graph` | POST | Body: `{ repoPath }` |
| `git:status` | `/api/git/status` | GET | Query: `?repoPath=...` |
| `git:commit` | `/api/git/commit` | POST | Body: `{ repoPath, message, files }` |
| `fs:readFile` | `/api/files/read` | POST | Body: `{ repoPath, filePath }` |
| `fs:writeFile` | `/api/files/write` | POST | Body: `{ repoPath, filePath, content }` |
| `ai:complete` | `/api/ai/complete` | POST | Body: `{ prompt, provider }` |
| `rag:query` | `/api/rag/query` | POST | Body: `{ repoPath, query }` |
| `enterprise:listRepos` | `/api/enterprise/repos` | GET | Auth required |
| `speckit:specify` | `/api/speckit/specify` | POST | Body: `{ repoPath, description }` |
| `sidecar:start` | `/api/sidecar/start` | POST | Internal only |

#### 1.2 Python Service Integration

**Options**:

**A. Keep Python Sidecar (Recommended)**
- Backend proxies requests to Python service
- Python service runs on same server as Node backend
- Maintains existing LangChain integration

**B. Merge into Backend**
- Rewrite Python logic in Node.js/TypeScript
- Higher migration effort
- Loses LangChain ecosystem

**Recommendation**: Keep Python sidecar, add backend proxy layer.

```typescript
// backend/src/services/PythonServiceProxy.ts
export class PythonServiceProxy {
  private pythonServiceUrl = 'http://localhost:8000';
  
  async generateSpec(request: SpecRequest): Promise<SpecResponse> {
    const response = await fetch(`${this.pythonServiceUrl}/spec/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return response.json();
  }
}
```

#### 1.3 File Storage Strategy

**Options**:

**A. Server-Side Repository Storage** (Multi-Tenant)
```
storage/
├── users/
│   ├── user-123/
│   │   ├── repo-abc/
│   │   │   ├── contexts/
│   │   │   ├── generated/
│   │   │   └── .context/
│   │   └── repo-xyz/
│   └── user-456/
```

**B. Object Storage (S3/MinIO)**
- Better scalability
- Versioning support
- CORS for direct uploads

**C. Hybrid Approach**
- Hot data: Local filesystem
- Cold data: Object storage
- Git operations: Local clone

**Recommendation**: Start with server-side storage (A), migrate to hybrid (C) for scale.

---

### Phase 2: Frontend Migration (2-3 weeks)

#### 2.1 Remove Electron Dependencies

**Changes**:
1. **Remove `window.api` bridge** - Replace with HTTP client
2. **Remove preload scripts** - No longer needed
3. **Update build config** - Vite for web, not Electron Forge

```typescript
// OLD (Electron)
const status = await window.api.git.status({ dir: repoPath });

// NEW (Web)
import { apiClient } from '@/services/apiClient';
const status = await apiClient.git.getStatus(repoPath);
```

#### 2.2 Create HTTP API Client

**New File**: `app/src/renderer/services/apiClient.ts`

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiClient = {
  context: {
    validate: (repoPath: string) => 
      client.post('/api/context/validate', { repoPath }),
    buildGraph: (repoPath: string) => 
      client.post('/api/context/graph', { repoPath }),
  },
  git: {
    getStatus: (repoPath: string) => 
      client.get(`/api/git/status?repoPath=${repoPath}`),
    commit: (repoPath: string, message: string, files?: string[]) =>
      client.post('/api/git/commit', { repoPath, message, files }),
  },
  fs: {
    readFile: (repoPath: string, filePath: string) =>
      client.post('/api/files/read', { repoPath, filePath }),
    writeFile: (repoPath: string, filePath: string, content: string) =>
      client.post('/api/files/write', { repoPath, filePath, content }),
  },
  // ... etc
};
```

#### 2.3 Update Pinia Stores

**Pattern**: Replace all `window.api` calls with `apiClient` calls.

```typescript
// OLD
const result = await window.api.context.validate({ dir: repoPath });

// NEW
const { data } = await apiClient.context.validate(repoPath);
```

**Files to Update** (~30 stores):
- `assistantStore.ts`
- `agentStore.ts`
- `c4Store.ts`
- `contextStore.ts`
- `gitStore.ts`
- `langchainStore.ts`
- `ragStore.ts`
- `speckitStore.ts`
- ... etc

#### 2.4 File Upload Handling

**Change**: File operations must use upload endpoints, not direct `fs` access.

```typescript
// Create entity with file upload
async createEntity(entity: Entity, entityType: string) {
  const formData = new FormData();
  formData.append('entity', JSON.stringify(entity));
  formData.append('entityType', entityType);
  
  const { data } = await client.post('/api/context/entities', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  
  return data;
}
```

#### 2.5 Real-time Updates

**Current**: IPC event emitters for file watching

**New**: WebSockets or Server-Sent Events (SSE)

```typescript
// WebSocket connection
const ws = new WebSocket('ws://localhost:3000/api/watch');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  if (update.type === 'file-changed') {
    store.dispatch('refreshFile', update.filePath);
  }
};
```

---

### Phase 3: Authentication & Multi-Tenancy (2 weeks)

#### 3.1 User Authentication

**New Features**:
- User registration/login
- JWT tokens for API access
- Session management
- OAuth integration (GitHub, Google)

```typescript
// Auth flow
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

#### 3.2 Repository Ownership

**Database Schema** (PostgreSQL):

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE repositories (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE repo_collaborators (
  repo_id UUID REFERENCES repositories(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50) NOT NULL, -- 'owner', 'editor', 'viewer'
  PRIMARY KEY (repo_id, user_id)
);
```

#### 3.3 Access Control

**Middleware**: Ensure users can only access their own repositories.

```typescript
export async function repoAccessMiddleware(req, res, next) {
  const { repoPath } = req.body;
  const userId = req.user.id;
  
  const repo = await db.repositories.findOne({
    where: { storage_path: repoPath },
  });
  
  if (!repo) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  const hasAccess = await checkRepoAccess(userId, repo.id);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  req.repo = repo;
  next();
}
```

---

### Phase 4: Azure Kubernetes Service (AKS) Deployment & Infrastructure (2-3 weeks)

#### 4.1 Azure AKS Architecture

**Production-Ready Azure Stack**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Front Door                            │
│          (Global CDN + WAF + DDoS Protection)                  │
└────────┬────────────────────────────────────┬──────────────────┘
         │                                    │
    ┌────▼─────────────┐              ┌──────▼──────────────┐
    │  Azure CDN       │              │  Application Gateway │
    │  (Static Assets) │              │  (L7 Load Balancer)  │
    └──────────────────┘              └──────┬───────────────┘
                                             │
                                      ┌──────▼───────────────────┐
                                      │   AKS Cluster            │
                                      │   (Managed Kubernetes)   │
                                      └──────┬───────────────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────┐
         │                                   │                           │
    ┌────▼────────┐                  ┌───────▼──────────┐       ┌────────▼────────┐
    │  Frontend   │                  │   Backend API    │       │  Python AI      │
    │  Deployment │                  │   Deployment     │       │  Service        │
    │  (nginx)    │                  │  (Node.js)       │       │  (FastAPI)      │
    │  Replicas:  │                  │  Replicas: 3-10  │       │  Replicas: 2-5  │
    │  2-5        │                  │  Port: 3000      │       │  Port: 8000     │
    └─────────────┘                  └───────┬──────────┘       └────────┬────────┘
                                             │                           │
                    ┌────────────────────────┼───────────────────────────┘
                    │                        │
         ┌──────────▼──────────┐   ┌─────────▼─────────┐   ┌──────────────────┐
         │ Azure Database      │   │ Azure Cache       │   │ Azure Blob       │
         │ for PostgreSQL      │   │ for Redis         │   │ Storage          │
         │ (Flexible Server)   │   │ (Premium Tier)    │   │ (Hot/Cool Tiers) │
         │ HA + Auto-backup    │   │ 6GB+ RAM          │   │ 500GB-10TB       │
         └─────────────────────┘   └───────────────────┘   └──────────────────┘
                    │                        │                        │
         ┌──────────▼────────────────────────▼────────────────────────▼──────┐
         │              Azure Monitor + Application Insights                │
         │          Logging, Metrics, Alerts, Distributed Tracing           │
         └──────────────────────────────────────────────────────────────────┘
```

**Namespace Structure**:
```
context-kit-prod        # Production environment
context-kit-staging     # Staging environment
context-kit-dev         # Development environment
```

**Azure Service Choices**:

| Component | Azure Service | Tier/SKU | Notes |
|-----------|---------------|----------|-------|
| Cluster | AKS | Standard tier | Managed K8s with SLA |
| Ingress | Application Gateway | Standard_v2 | L7 LB + WAF |
| CDN | Azure Front Door | Premium | Global CDN + DDoS |
| Database | PostgreSQL Flexible | Burstable B2s | HA available |
| Cache | Azure Cache for Redis | Premium P1 | 6GB + persistence |
| Storage | Azure Blob Storage | Hot tier | LRS/GRS |
| Registry | Azure Container Registry | Basic/Standard | Geo-replication |
| Monitoring | Azure Monitor + App Insights | Pay-as-you-go | Native integration |
| Secrets | Azure Key Vault | Standard | RBAC + audit logs |
| Identity | Azure AD (Entra ID) | Free tier | Workload identity |
| Cost (est.) | | | **$350-650/mo** |

#### 4.2 Docker Configuration

**Directory Structure**:
```
my-context-kit/
├── docker/
│   ├── frontend/
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   ├── backend/
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   ├── python-service/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── docker-compose.yml
└── k8s/
    ├── base/
    │   ├── kustomization.yaml
    │   ├── namespace.yaml
    │   ├── frontend-deployment.yaml
    │   ├── backend-deployment.yaml
    │   ├── python-service-deployment.yaml
    │   ├── postgres-statefulset.yaml
    │   ├── redis-statefulset.yaml
    │   ├── minio-statefulset.yaml
    │   ├── services.yaml
    │   ├── ingress.yaml
    │   ├── configmaps.yaml
    │   └── secrets.yaml
    └── overlays/
        ├── dev/
        │   └── kustomization.yaml
        ├── staging/
        │   └── kustomization.yaml
        └── production/
            └── kustomization.yaml
```

**Frontend Dockerfile**:
```dockerfile
# docker/frontend/Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# Copy package files
COPY app/package.json app/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY app/ .

# Build for production (web mode)
RUN pnpm build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY docker/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Backend Dockerfile**:
```dockerfile
# docker/backend/Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# Copy package files
COPY context-kit-backend/package.json context-kit-backend/pnpm-lock.yaml ./

# Install dependencies (production only)
RUN pnpm install --frozen-lockfile --prod

# Copy source
COPY context-kit-backend/ .

# Build TypeScript
RUN pnpm build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**Python Service Dockerfile**:
```dockerfile
# docker/python-service/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install uv for faster dependency management
RUN pip install uv

# Copy dependency files
COPY context-kit-service/pyproject.toml context-kit-service/uv.lock* ./

# Install dependencies
RUN uv pip install --system --no-cache -e .

# Copy source
COPY context-kit-service/ .

# Create non-root user
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

EXPOSE 8000

CMD ["uvicorn", "context_kit_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Docker Compose** (Local Development):
```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: ..
      dockerfile: docker/frontend/Dockerfile
    ports:
      - "8080:80"
    depends_on:
      - backend
    environment:
      - VITE_API_BASE_URL=http://localhost:3000
    networks:
      - context-kit-net

  backend:
    build:
      context: ..
      dockerfile: docker/backend/Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
      - minio
      - python-service
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://contextkit:password@postgres:5432/contextkit
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio:9000
      - PYTHON_SERVICE_URL=http://python-service:8000
      - JWT_SECRET=dev-secret-change-in-prod
    volumes:
      - ../storage:/app/storage
    networks:
      - context-kit-net

  python-service:
    build:
      context: ..
      dockerfile: docker/python-service/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}
      - AZURE_OPENAI_KEY=${AZURE_OPENAI_KEY}
      - AZURE_OPENAI_DEPLOYMENT=${AZURE_OPENAI_DEPLOYMENT}
      - OLLAMA_ENDPOINT=${OLLAMA_ENDPOINT:-http://host.docker.internal:11434}
    networks:
      - context-kit-net

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=contextkit
      - POSTGRES_USER=contextkit
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - context-kit-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U contextkit"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - context-kit-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio-data:/data
    command: server /data --console-address ":9001"
    networks:
      - context-kit-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  postgres-data:
  redis-data:
  minio-data:

networks:
  context-kit-net:
    driver: bridge
```

#### 4.3 Kubernetes Manifests

**Namespace**:
```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: context-kit-prod
  labels:
    app: context-kit
    environment: production
```

**Frontend Deployment**:
```yaml
# k8s/base/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: context-kit-prod
  labels:
    app: context-kit
    component: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: context-kit
      component: frontend
  template:
    metadata:
      labels:
        app: context-kit
        component: frontend
    spec:
      containers:
      - name: nginx
        image: ghcr.io/lukeus/context-kit-frontend:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 80
          name: http
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: context-kit-prod
spec:
  type: ClusterIP
  selector:
    app: context-kit
    component: frontend
  ports:
  - port: 80
    targetPort: 80
    name: http
```

**Backend Deployment**:
```yaml
# k8s/base/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: context-kit-prod
  labels:
    app: context-kit
    component: backend
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: context-kit
      component: backend
  template:
    metadata:
      labels:
        app: context-kit
        component: backend
    spec:
      containers:
      - name: api
        image: ghcr.io/lukeus/context-kit-backend:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: context-kit-secrets
              key: database-url
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: MINIO_ENDPOINT
          value: "minio:9000"
        - name: PYTHON_SERVICE_URL
          value: "http://python-service:8000"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: context-kit-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 15
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
        volumeMounts:
        - name: storage
          mountPath: /app/storage
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: backend-storage
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: context-kit-prod
spec:
  type: ClusterIP
  selector:
    app: context-kit
    component: backend
  ports:
  - port: 3000
    targetPort: 3000
    name: http
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backend-storage
  namespace: context-kit-prod
spec:
  accessModes:
  - ReadWriteMany  # For multi-pod access
  resources:
    requests:
      storage: 100Gi
  storageClassName: standard-rwo
```

**Python Service Deployment**:
```yaml
# k8s/base/python-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-service
  namespace: context-kit-prod
  labels:
    app: context-kit
    component: python-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: context-kit
      component: python-service
  template:
    metadata:
      labels:
        app: context-kit
        component: python-service
    spec:
      containers:
      - name: fastapi
        image: ghcr.io/lukeus/context-kit-python:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
          name: http
        env:
        - name: AZURE_OPENAI_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: context-kit-secrets
              key: azure-openai-endpoint
        - name: AZURE_OPENAI_KEY
          valueFrom:
            secretKeyRef:
              name: context-kit-secrets
              key: azure-openai-key
        - name: AZURE_OPENAI_DEPLOYMENT
          valueFrom:
            secretKeyRef:
              name: context-kit-secrets
              key: azure-openai-deployment
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 20
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: python-service
  namespace: context-kit-prod
spec:
  type: ClusterIP
  selector:
    app: context-kit
    component: python-service
  ports:
  - port: 8000
    targetPort: 8000
    name: http
```

**PostgreSQL StatefulSet**:
```yaml
# k8s/base/postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: context-kit-prod
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: context-kit
      component: postgres
  template:
    metadata:
      labels:
        app: context-kit
        component: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: contextkit
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: context-kit-secrets
              key: postgres-user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: context-kit-secrets
              key: postgres-password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - contextkit
          initialDelaySeconds: 30
          periodSeconds: 10
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 50Gi
      storageClassName: standard-rwo
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: context-kit-prod
spec:
  type: ClusterIP
  selector:
    app: context-kit
    component: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

**Redis StatefulSet**:
```yaml
# k8s/base/redis-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: context-kit-prod
spec:
  serviceName: redis
  replicas: 1
  selector:
    matchLabels:
      app: context-kit
      component: redis
  template:
    metadata:
      labels:
        app: context-kit
        component: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: redis
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: redis-storage
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: redis-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: context-kit-prod
spec:
  type: ClusterIP
  selector:
    app: context-kit
    component: redis
  ports:
  - port: 6379
    targetPort: 6379
```

**MinIO StatefulSet**:
```yaml
# k8s/base/minio-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: minio
  namespace: context-kit-prod
spec:
  serviceName: minio
  replicas: 1
  selector:
    matchLabels:
      app: context-kit
      component: minio
  template:
    metadata:
      labels:
        app: context-kit
        component: minio
    spec:
      containers:
      - name: minio
        image: minio/minio:latest
        args:
        - server
        - /data
        - --console-address
        - ":9001"
        ports:
        - containerPort: 9000
          name: api
        - containerPort: 9001
          name: console
        env:
        - name: MINIO_ROOT_USER
          valueFrom:
            secretKeyRef:
              name: context-kit-secrets
              key: minio-root-user
        - name: MINIO_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: context-kit-secrets
              key: minio-root-password
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        volumeMounts:
        - name: minio-storage
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: minio-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 500Gi
---
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: context-kit-prod
spec:
  type: ClusterIP
  selector:
    app: context-kit
    component: minio
  ports:
  - port: 9000
    targetPort: 9000
    name: api
  - port: 9001
    targetPort: 9001
    name: console
```

**Ingress Configuration**:
```yaml
# k8s/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: context-kit-ingress
  namespace: context-kit-prod
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - contextkit.app
    - api.contextkit.app
    secretName: context-kit-tls
  rules:
  - host: contextkit.app
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  - host: api.contextkit.app
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 3000
```

**Secrets Template**:
```yaml
# k8s/base/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: context-kit-secrets
  namespace: context-kit-prod
type: Opaque
stringData:
  database-url: "postgresql://contextkit:CHANGEME@postgres:5432/contextkit"
  jwt-secret: "CHANGEME-LONG-RANDOM-STRING"
  postgres-user: "contextkit"
  postgres-password: "CHANGEME"
  minio-root-user: "CHANGEME"
  minio-root-password: "CHANGEME"
  azure-openai-endpoint: "https://YOUR-INSTANCE.openai.azure.com/"
  azure-openai-key: "CHANGEME"
  azure-openai-deployment: "gpt-4"
```

**Kustomization Base**:
```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: context-kit-prod

resources:
  - namespace.yaml
  - frontend-deployment.yaml
  - backend-deployment.yaml
  - python-service-deployment.yaml
  - postgres-statefulset.yaml
  - redis-statefulset.yaml
  - minio-statefulset.yaml
  - ingress.yaml
  - secrets.yaml

commonLabels:
  app: context-kit

images:
  - name: ghcr.io/lukeus/context-kit-frontend
    newTag: latest
  - name: ghcr.io/lukeus/context-kit-backend
    newTag: latest
  - name: ghcr.io/lukeus/context-kit-python
    newTag: latest
```

**Production Overlay**:
```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

namespace: context-kit-prod

patchesStrategicMerge:
  - replica-scaling.yaml

images:
  - name: ghcr.io/lukeus/context-kit-frontend
    newTag: v1.0.0  # Specific version tag
  - name: ghcr.io/lukeus/context-kit-backend
    newTag: v1.0.0
  - name: ghcr.io/lukeus/context-kit-python
    newTag: v1.0.0
```

```yaml
# k8s/overlays/production/replica-scaling.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 5

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 10

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-service
spec:
  replicas: 5
```

#### 4.4 CI/CD Pipeline with K8s Deployment

**GitHub Actions Workflow**:

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy to Azure AKS

on:
  push:
    branches: [main]
    tags:
      - 'v*'
  pull_request:
    branches: [main]

env:
  AZURE_CONTAINER_REGISTRY: contextkit
  ACR_LOGIN_SERVER: contextkit.azurecr.io
  RESOURCE_GROUP: context-kit-rg
  AKS_CLUSTER: context-kit-aks

jobs:
  # Build and push Docker images to Azure Container Registry
  build-images:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    strategy:
      matrix:
        component: [frontend, backend, python-service]
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Log in to Azure Container Registry
        run: |
          az acr login --name ${{ env.AZURE_CONTAINER_REGISTRY }}

      - name: Get image tag
        id: image-tag
        run: |
          if [[ "${{ github.ref }}" == refs/tags/v* ]]; then
            echo "tag=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT
          else
            echo "tag=${{ github.sha }}" >> $GITHUB_OUTPUT
          fi

      - name: Build and push to ACR
        run: |
          az acr build \
            --registry ${{ env.AZURE_CONTAINER_REGISTRY }} \
            --image context-kit-${{ matrix.component }}:${{ steps.image-tag.outputs.tag }} \
            --image context-kit-${{ matrix.component }}:latest \
            --file docker/${{ matrix.component }}/Dockerfile \
            .

  # Run tests
  test:
    runs-on: ubuntu-latest
    needs: build-images
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10.19.0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test

      - name: Run E2E tests
        run: pnpm test:e2e

  # Deploy to staging
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build-images, test]
    if: github.ref == 'refs/heads/main'
    environment:
      name: staging
      url: https://staging.contextkit.app
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Get AKS credentials
        run: |
          az aks get-credentials \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --name ${{ env.AKS_CLUSTER }} \
            --overwrite-existing

      - name: Retrieve secrets from Key Vault
        run: |
          az keyvault secret show --vault-name context-kit-kv --name db-password --query value -o tsv > /tmp/db-password
          az keyvault secret show --vault-name context-kit-kv --name redis-password --query value -o tsv > /tmp/redis-password

      - name: Deploy to staging
        run: |
          kubectl kustomize k8s/overlays/staging | kubectl apply -f -
          kubectl rollout status deployment/frontend -n context-kit-staging
          kubectl rollout status deployment/backend -n context-kit-staging
          kubectl rollout status deployment/python-service -n context-kit-staging

      - name: Run smoke tests
        run: |
          curl -f https://staging.contextkit.app/health || exit 1
          curl -f https://api.staging.contextkit.app/api/health || exit 1

  # Deploy to production
  deploy-production:
    runs-on: ubuntu-latest
    needs: [build-images, test]
    if: startsWith(github.ref, 'refs/tags/v')
    environment:
      name: production
      url: https://contextkit.app
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Get AKS credentials
        run: |
          az aks get-credentials \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --name ${{ env.AKS_CLUSTER }} \
            --overwrite-existing

      - name: Update image tags
        run: |
          cd k8s/overlays/production
          kustomize edit set image \
            ${{ env.ACR_LOGIN_SERVER }}/context-kit-frontend:${GITHUB_REF#refs/tags/v} \
            ${{ env.ACR_LOGIN_SERVER }}/context-kit-backend:${GITHUB_REF#refs/tags/v} \
            ${{ env.ACR_LOGIN_SERVER }}/context-kit-python-service:${GITHUB_REF#refs/tags/v}

      - name: Deploy to production
        run: |
          kubectl kustomize k8s/overlays/production | kubectl apply -f -
          kubectl rollout status deployment/frontend -n context-kit-prod --timeout=10m
          kubectl rollout status deployment/backend -n context-kit-prod --timeout=10m
          kubectl rollout status deployment/python-service -n context-kit-prod --timeout=10m

      - name: Run smoke tests
        run: |
          curl -f https://contextkit.app/health || exit 1
          curl -f https://api.contextkit.app/api/health || exit 1

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        if: always()
        with:
          status: ${{ job.status }}
          text: 'Production deployment: ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  # Build desktop app (maintains feature parity)
  build-desktop:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10.19.0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build desktop app
        run: pnpm --filter context-sync make

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: desktop-${{ matrix.os }}
          path: app/out/make/**/*
```

**Deployment Commands**:

```bash
# Local development with Docker Compose
cd docker
docker-compose up -d

# Build Docker images locally
docker build -t context-kit-frontend -f docker/frontend/Dockerfile .
docker build -t context-kit-backend -f docker/backend/Dockerfile .
docker build -t context-kit-python -f docker/python-service/Dockerfile .

# Push to registry
docker tag context-kit-frontend ghcr.io/lukeus/context-kit-frontend:v1.0.0
docker push ghcr.io/lukeus/context-kit-frontend:v1.0.0

# Deploy to K8s cluster
kubectl apply -k k8s/overlays/production

# Check deployment status
kubectl get pods -n context-kit-prod
kubectl logs -f deployment/backend -n context-kit-prod
kubectl describe ingress context-kit-ingress -n context-kit-prod

# Scale deployments
kubectl scale deployment backend --replicas=10 -n context-kit-prod
kubectl scale deployment python-service --replicas=5 -n context-kit-prod

# Update secrets
kubectl create secret generic context-kit-secrets \
  --from-literal=jwt-secret=YOUR-SECRET \
  --from-literal=database-url=postgresql://... \
  -n context-kit-prod \
  --dry-run=client -o yaml | kubectl apply -f -

# Rollback deployment
kubectl rollout undo deployment/backend -n context-kit-prod

# Port forwarding for debugging
kubectl port-forward svc/backend 3000:3000 -n context-kit-prod
kubectl port-forward svc/postgres 5432:5432 -n context-kit-prod
```

#### 4.5 Monitoring & Observability

**Prometheus + Grafana Stack**:

```yaml
# k8s/monitoring/prometheus-stack.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring

---
# Install using Helm
# helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
# helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring

# Custom ServiceMonitor for Context Kit
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: context-kit-backend
  namespace: context-kit-prod
  labels:
    app: context-kit
spec:
  selector:
    matchLabels:
      app: context-kit
      component: backend
  endpoints:
  - port: http
    path: /metrics
    interval: 30s

---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: context-kit-python
  namespace: context-kit-prod
spec:
  selector:
    matchLabels:
      app: context-kit
      component: python-service
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

**Application Metrics** (Add to backend):

```typescript
// backend/src/middleware/metrics.ts
import promClient from 'prom-client';

const register = new promClient.Registry();

// Default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register],
});

export const repoOperations = new promClient.Counter({
  name: 'repo_operations_total',
  help: 'Total number of repository operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// Metrics endpoint
export function metricsHandler(req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
}
```

**Logging Stack** (EFK - Elasticsearch, Fluentd, Kibana):

```yaml
# k8s/logging/fluentd-daemonset.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: fluentd
  template:
    metadata:
      labels:
        app: fluentd
    spec:
      containers:
      - name: fluentd
        image: fluent/fluentd-kubernetes-daemonset:v1-debian-elasticsearch
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch.logging.svc.cluster.local"
        - name: FLUENT_ELASTICSEARCH_PORT
          value: "9200"
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

#### 4.6 Autoscaling Configuration

**Horizontal Pod Autoscaler**:

```yaml
# k8s/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: context-kit-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 4
        periodSeconds: 30
      selectPolicy: Max

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: python-service-hpa
  namespace: context-kit-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: python-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 75
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 85
```

**Cluster Autoscaler** (for cloud providers):

```yaml
# For AWS EKS
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-autoscaler-priority-expander
  namespace: kube-system
data:
  priorities: |-
    10:
      - .*-spot-.*
    50:
      - .*-ondemand-.*
```

---

### Phase 5: Feature Parity & Testing (2 weeks)

#### 5.1 Feature Migration Checklist

**Core Features**:
- [ ] Context repository CRUD
- [ ] YAML entity management
- [ ] Git operations (status, commit, branch, PR)
- [ ] Context graph visualization (Cytoscape)
- [ ] C4 diagram rendering (Mermaid)
- [ ] Spec-driven development workflow
- [ ] AI-powered spec generation
- [ ] RAG context search
- [ ] Assistant safe tooling
- [ ] Enterprise features (constitution merging, repo sync)
- [ ] Real-time file watching
- [ ] Diff viewer
- [ ] Code editor (CodeMirror)

**UI Components** (all Material 3 compatible):
- [ ] ContextTree
- [ ] EntityDependencyGraph
- [ ] C4DiagramRenderer
- [ ] DiffViewer
- [ ] CommandPalette
- [ ] ConstitutionViewer
- [ ] EnterpriseDashboard
- [ ] All 80+ Vue components

#### 5.2 Testing Strategy

**Unit Tests**:
- Backend API routes (Jest/Vitest)
- Service layer (GitService, AIService)
- Frontend stores (Pinia)

**Integration Tests**:
- API endpoint flows
- Python service integration
- Database operations

**E2E Tests** (Playwright):
- User registration/login
- Repository creation
- Entity CRUD operations
- Git workflows
- Spec generation
- C4 diagram creation

---

## Breaking Changes & Migration Path

### For End Users

**Desktop App → Web App**:

1. **Local Repositories** must be **uploaded** to server
   - Provide migration tool: `pnpm run migrate:upload`
   - Uploads `contexts/`, `c4/`, `specs/` to server storage

2. **Credential Storage** changes
   - Desktop: Encrypted local file
   - Web: Server-side encrypted storage + JWT

3. **Offline Mode** lost (unless PWA implemented)

4. **File System Access** indirect
   - Desktop: Direct file system access
   - Web: Upload/download via API

### For Developers

**API Changes**:
```typescript
// OLD (Electron IPC)
import { ipcRenderer } from 'electron';
const result = await ipcRenderer.invoke('context:validate', { dir });

// NEW (HTTP API)
import { apiClient } from '@/services/apiClient';
const result = await apiClient.context.validate(repoPath);
```

**Build Changes**:
```bash
# OLD
pnpm start           # Electron dev
pnpm build           # Electron package

# NEW
pnpm dev:frontend    # Vite dev server
pnpm dev:backend     # Express + Python
pnpm build:frontend  # Static build
pnpm build:backend   # Backend build
```

---

## Risk Assessment

### High Risks

1. **Data Migration Complexity** ⚠️
   - **Risk**: Users have large local repositories
   - **Mitigation**: Incremental upload tool with resume capability

2. **Python Service Scaling** ⚠️
   - **Risk**: LangChain operations are CPU/memory intensive
   - **Mitigation**: Queue system (Bull/Redis) for async processing

3. **File Upload Limits** ⚠️
   - **Risk**: Large YAML files, C4 diagrams
   - **Mitigation**: Chunked uploads, S3 direct upload

4. **Real-time Performance** ⚠️
   - **Risk**: WebSocket connections for file watching
   - **Mitigation**: Debouncing, selective watching, SSE instead

### Medium Risks

5. **Authentication Security** ⚙️
   - **Risk**: New attack surface with public API
   - **Mitigation**: Rate limiting, CSRF protection, input validation

6. **Git Operations Performance** ⚙️
   - **Risk**: Server-side git operations slower than local
   - **Mitigation**: Background jobs, caching, webhook automation

### Low Risks

7. **UI Compatibility** ✅
   - **Risk**: Material 3 + Tailwind v4 works in browser
   - **Mitigation**: Already browser-based (Chromium in Electron)

---

## Implementation Roadmap

### Week 1-2: Backend Foundation
- [ ] Create Express.js backend skeleton
- [ ] Port GitService, FileSystemService
- [ ] Implement auth middleware (JWT)
- [ ] Setup PostgreSQL schema
- [ ] Create `/api/context/*` routes

### Week 3-4: Core API Migration
- [ ] Implement all IPC → HTTP route mappings
- [ ] File upload/download endpoints
- [ ] Python service proxy layer
- [ ] WebSocket for real-time updates
- [ ] Error handling & logging

### Week 5-6: Frontend Migration
- [ ] Remove Electron dependencies
- [ ] Create `apiClient.ts`
- [ ] Update all Pinia stores
- [ ] Add auth pages (login/register)
- [ ] Update build config for web

### Week 7-8: Enterprise Features
- [ ] Enterprise repo sync via backend
- [ ] Constitution merging server-side
- [ ] Spec derivation API
- [ ] GitHub integration (backend)
- [ ] Multi-tenant access control

### Week 9-10: Testing & Polish
- [ ] Write integration tests
- [ ] E2E test suite (Playwright)
- [ ] Performance optimization
- [ ] Security audit
- [ ] Migration tool development

### Week 11-12: Deployment & Launch
- [ ] Setup cloud infrastructure
- [ ] CI/CD pipelines
- [ ] Beta testing with users
- [ ] Data migration support
- [ ] Documentation updates

---

## Recommended: Hybrid Architecture with K8s Deployment

**Concept**: Maintain desktop app feature parity while deploying web version to Kubernetes.

**Benefits**:
- ✅ No breaking changes for existing desktop users
- ✅ Web version for broader accessibility via browser
- ✅ Shared backend API serves both platforms
- ✅ Scalable K8s deployment for web traffic
- ✅ Desktop app works offline or connects to cloud backend

**Unified Architecture**:
```
┌──────────────┐       ┌──────────────┐
│  Electron    │       │   Web App    │
│  Desktop App │◄─────►│   (Browser)  │
│              │       │              │
│ ┌──────────┐ │       └──────┬───────┘
│ │ Local    │ │              │
│ │ Services │ │              │ HTTPS
│ └──────────┘ │              │
└──────┬───────┘       ┌──────▼───────┐
       │               │  Kubernetes  │
       │ Optional      │   Cluster    │
       │ Cloud Sync    │              │
       └──────────────►│  Backend API │
                       └──────────────┘
```

**Dual-Mode Desktop App**:
- **Local Mode**: All services run locally (current behavior)
- **Cloud Mode**: Connect to K8s backend for collaboration/sync
- **Hybrid Mode**: Local operations + cloud backup/sync

**Trade-off**: Maintain shared codebase between local and cloud services (manageable with abstraction layer).

## Desktop App Feature Parity Strategy

### Dual-Mode Architecture

The desktop app will support **two operating modes** to maintain feature parity while enabling cloud collaboration:

#### Mode 1: Local-Only (Current Behavior)
- All services run locally on user's machine
- No network connectivity required
- Full offline functionality
- Direct file system access
- Local Git operations

#### Mode 2: Cloud-Connected (New)
- Desktop UI connects to K8s backend API
- Hybrid storage: local cache + cloud sync
- Real-time collaboration features
- Cross-device synchronization
- Cloud-based AI processing (optional)

#### Mode 3: Hybrid (Best of Both)
- Local operations for speed and offline work
- Background sync to cloud for backup
- Switch seamlessly between local and cloud
- Conflict resolution with merge strategies

### Implementation Approach

**Service Abstraction Layer**:

```typescript
// app/src/main/services/abstraction/ServiceProvider.ts

export interface IContextService {
  validate(repoPath: string): Promise<ValidationResult>;
  buildGraph(repoPath: string): Promise<GraphResult>;
  // ... all other methods
}

export interface IGitService {
  getStatus(repoPath: string): Promise<GitStatus>;
  commit(repoPath: string, message: string, files?: string[]): Promise<void>;
  // ... all other methods
}

// Local implementation (current)
export class LocalContextService implements IContextService {
  async validate(repoPath: string): Promise<ValidationResult> {
    // Direct local file system access
    const result = await execa('node', [pipelinePath, 'validate'], { cwd: repoPath });
    return JSON.parse(result.stdout);
  }
}

// Cloud implementation (new)
export class CloudContextService implements IContextService {
  private apiClient: AxiosInstance;
  
  constructor(baseUrl: string, apiKey: string) {
    this.apiClient = axios.create({
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }
  
  async validate(repoPath: string): Promise<ValidationResult> {
    // Call K8s backend API
    const { data } = await this.apiClient.post('/api/context/validate', { repoPath });
    return data;
  }
}

// Hybrid implementation (intelligent routing)
export class HybridContextService implements IContextService {
  constructor(
    private local: LocalContextService,
    private cloud: CloudContextService,
    private config: HybridConfig
  ) {}
  
  async validate(repoPath: string): Promise<ValidationResult> {
    if (this.config.mode === 'local-only') {
      return this.local.validate(repoPath);
    }
    
    if (this.config.mode === 'cloud-only') {
      return this.cloud.validate(repoPath);
    }
    
    // Hybrid mode: try local first, fallback to cloud
    try {
      return await this.local.validate(repoPath);
    } catch (error) {
      console.log('Local validation failed, trying cloud...');
      return await this.cloud.validate(repoPath);
    }
  }
}

// Factory to create appropriate service
export class ServiceFactory {
  static createContextService(mode: 'local' | 'cloud' | 'hybrid'): IContextService {
    const config = getAppConfig();
    
    switch (mode) {
      case 'local':
        return new LocalContextService();
      case 'cloud':
        return new CloudContextService(config.cloudApiUrl, config.apiKey);
      case 'hybrid':
        return new HybridContextService(
          new LocalContextService(),
          new CloudContextService(config.cloudApiUrl, config.apiKey),
          config.hybrid
        );
    }
  }
}
```

**Desktop App Configuration UI**:

```vue
<!-- app/src/renderer/components/settings/CloudSyncSettings.vue -->
<template>
  <div class="cloud-sync-settings">
    <h2>Cloud Synchronization</h2>
    
    <div class="mode-selector">
      <label>
        <input type="radio" v-model="mode" value="local-only" />
        Local Only (No cloud connectivity)
      </label>
      
      <label>
        <input type="radio" v-model="mode" value="cloud-only" />
        Cloud Only (All operations via API)
      </label>
      
      <label>
        <input type="radio" v-model="mode" value="hybrid" />
        Hybrid (Local with cloud backup)
      </label>
    </div>
    
    <div v-if="mode !== 'local-only'" class="cloud-config">
      <input 
        type="text" 
        v-model="apiUrl" 
        placeholder="API URL (e.g., https://api.contextkit.app)"
      />
      
      <input 
        type="password" 
        v-model="apiKey" 
        placeholder="API Key"
      />
      
      <button @click="testConnection">Test Connection</button>
      <span v-if="connectionStatus" :class="connectionStatus">
        {{ connectionStatus }}
      </span>
    </div>
    
    <div v-if="mode === 'hybrid'" class="hybrid-config">
      <h3>Hybrid Mode Settings</h3>
      
      <label>
        <input type="checkbox" v-model="autoSync" />
        Automatically sync changes to cloud
      </label>
      
      <label>
        Sync interval:
        <select v-model="syncInterval">
          <option value="manual">Manual only</option>
          <option value="300">5 minutes</option>
          <option value="900">15 minutes</option>
          <option value="3600">1 hour</option>
        </select>
      </label>
      
      <label>
        Conflict resolution:
        <select v-model="conflictStrategy">
          <option value="local-first">Prefer local changes</option>
          <option value="cloud-first">Prefer cloud changes</option>
          <option value="manual">Ask me every time</option>
        </select>
      </label>
    </div>
    
    <button @click="saveSettings" class="btn-primary">Save Settings</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const mode = ref<'local-only' | 'cloud-only' | 'hybrid'>('local-only');
const apiUrl = ref('');
const apiKey = ref('');
const connectionStatus = ref('');
const autoSync = ref(true);
const syncInterval = ref('900');
const conflictStrategy = ref('manual');

async function testConnection() {
  try {
    const result = await window.api.settings.testCloudConnection(apiUrl.value, apiKey.value);
    connectionStatus.value = result.success ? 'Connected ✓' : 'Failed ✗';
  } catch (error) {
    connectionStatus.value = 'Failed ✗';
  }
}

async function saveSettings() {
  await window.api.settings.set('cloudSync', {
    mode: mode.value,
    apiUrl: apiUrl.value,
    apiKey: apiKey.value,
    autoSync: autoSync.value,
    syncInterval: parseInt(syncInterval.value),
    conflictStrategy: conflictStrategy.value,
  });
}

onMounted(async () => {
  const settings = await window.api.settings.get('cloudSync');
  if (settings) {
    mode.value = settings.mode;
    apiUrl.value = settings.apiUrl;
    apiKey.value = settings.apiKey;
    autoSync.value = settings.autoSync;
    syncInterval.value = settings.syncInterval.toString();
    conflictStrategy.value = settings.conflictStrategy;
  }
});
</script>
```

### Desktop-Specific Features (No Cloud Equivalent)

**Features that remain desktop-only**:

1. **Offline Operation** - Full functionality without network
2. **Direct File System Access** - Faster local file operations
3. **Native Integrations** - OS-level features (notifications, file associations)
4. **Local Python Service** - Run LangChain operations locally
5. **Multi-Repository Management** - Switch between multiple local repos instantly
6. **System Tray Integration** - Background monitoring and quick access
7. **Native Git Client** - Use system Git installation

### Cloud-Enabled Features (Desktop Enhancement)

**New features enabled by cloud connectivity**:

1. **Cross-Device Sync** - Work on desktop, continue on laptop
2. **Team Collaboration** - Share repositories with team members
3. **Cloud AI Processing** - Offload heavy AI operations to K8s cluster
4. **Automatic Backups** - Cloud backup of all repository data
5. **Version History** - Cloud-based versioning beyond Git
6. **Real-time Collaboration** - Multiple users editing simultaneously
7. **Mobile Access** - View (not edit) repos from mobile devices

### Migration Path for Users

**Phase 1: Desktop App Updates** (Month 1-2)
- Add cloud connectivity option to desktop app
- Implement abstraction layer for dual-mode support
- Add settings UI for cloud configuration
- Ship desktop app v2.0.0 with cloud sync (disabled by default)

**Phase 2: Cloud Onboarding** (Month 3-4)
- Users opt-in to cloud sync via settings
- Desktop app uploads repositories to cloud (one-time)
- Background sync enabled based on user preference
- Users can invite team members to shared repos

**Phase 3: Web App Launch** (Month 5-6)
- Launch web version at https://contextkit.app
- Desktop users can access same data via browser
- Web users can sign up without desktop app
- Full feature parity between desktop and web

**Phase 4: Advanced Features** (Month 7+)
- Real-time collaboration in desktop app
- Conflict resolution UI
- Advanced cloud-based AI features
- Mobile companion app (view-only)

### Desktop App Build Configuration

**Maintain Separate Build Targets**:

```json
// app/package.json - Updated scripts
{
  "scripts": {
    "start": "electron-forge start",
    "start:cloud": "CLOUD_MODE=enabled electron-forge start",
    "build": "electron-forge package",
    "build:desktop-only": "CLOUD_FEATURES=disabled electron-forge package",
    "build:cloud-enabled": "CLOUD_FEATURES=enabled electron-forge package",
    "build:all": "pnpm build:desktop-only && pnpm build:cloud-enabled"
  }
}
```

**Feature Flags**:

```typescript
// app/src/shared/featureFlags.ts

export const FEATURE_FLAGS = {
  CLOUD_SYNC: process.env.CLOUD_FEATURES === 'enabled',
  CLOUD_AI: process.env.CLOUD_FEATURES === 'enabled',
  REAL_TIME_COLLAB: process.env.CLOUD_FEATURES === 'enabled',
  WEB_SOCKET_SUPPORT: process.env.CLOUD_FEATURES === 'enabled',
  
  // Always enabled
  LOCAL_FILE_ACCESS: true,
  LOCAL_GIT_OPERATIONS: true,
  OFFLINE_MODE: true,
  PYTHON_SIDECAR: true,
};

export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[feature];
}
```

### Data Synchronization Strategy

**Sync Architecture**:

```typescript
// app/src/main/services/CloudSyncService.ts

export class CloudSyncService {
  private syncQueue: SyncOperation[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  
  async startAutoSync(intervalMs: number): Promise<void> {
    this.syncInterval = setInterval(() => {
      void this.performSync();
    }, intervalMs);
  }
  
  async performSync(): Promise<SyncResult> {
    const localChanges = await this.detectLocalChanges();
    const cloudChanges = await this.fetchCloudChanges();
    
    const conflicts = this.detectConflicts(localChanges, cloudChanges);
    
    if (conflicts.length > 0) {
      return this.handleConflicts(conflicts);
    }
    
    // Push local changes to cloud
    await this.pushToCloud(localChanges);
    
    // Pull cloud changes to local
    await this.pullFromCloud(cloudChanges);
    
    return { success: true, conflictsResolved: 0 };
  }
  
  private async detectLocalChanges(): Promise<Change[]> {
    // Compare local files with last sync timestamp
    const lastSync = await this.getLastSyncTimestamp();
    const files = await this.getModifiedFilesSince(lastSync);
    return files.map(f => ({
      type: 'local',
      filePath: f.path,
      timestamp: f.mtime,
      hash: f.hash,
    }));
  }
  
  private async fetchCloudChanges(): Promise<Change[]> {
    // Call cloud API to get changes since last sync
    const lastSync = await this.getLastSyncTimestamp();
    const { data } = await this.apiClient.get('/api/sync/changes', {
      params: { since: lastSync },
    });
    return data.changes;
  }
  
  private detectConflicts(local: Change[], cloud: Change[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    for (const localChange of local) {
      const cloudChange = cloud.find(c => c.filePath === localChange.filePath);
      if (cloudChange && cloudChange.hash !== localChange.hash) {
        conflicts.push({
          filePath: localChange.filePath,
          localVersion: localChange,
          cloudVersion: cloudChange,
        });
      }
    }
    
    return conflicts;
  }
  
  private async handleConflicts(conflicts: Conflict[]): Promise<SyncResult> {
    const strategy = await this.getConflictStrategy();
    
    switch (strategy) {
      case 'local-first':
        await this.resolveConflictsLocalFirst(conflicts);
        break;
      case 'cloud-first':
        await this.resolveConflictsCloudFirst(conflicts);
        break;
      case 'manual':
        // Show UI dialog for user to choose
        await this.showConflictResolutionDialog(conflicts);
        break;
    }
    
    return { success: true, conflictsResolved: conflicts.length };
  }
}
```

---

## Implementation Roadmap (Updated for K8s)

### Week 1-2: Backend Foundation + Docker
- [ ] Create Express.js backend skeleton (`context-kit-backend/`)
- [ ] Port GitService, FileSystemService from Electron main
- [ ] Implement auth middleware (JWT)
- [ ] Setup PostgreSQL schema
- [ ] Create `/api/context/*` routes
- [ ] **Write Dockerfiles for all components**
- [ ] **Create docker-compose.yml for local dev**
- [ ] **Setup local Docker development environment**

### Week 3-4: Core API Migration + K8s Base
- [ ] Implement all IPC → HTTP route mappings
- [ ] File upload/download endpoints
- [ ] Python service proxy layer
- [ ] WebSocket for real-time updates
- [ ] Error handling & logging
- [ ] **Create base K8s manifests (deployments, services)**
- [ ] **Setup Kustomize overlays (dev, staging, prod)**
- [ ] **Configure persistent volumes and storage**

### Week 5-6: Frontend Migration (Web)
- [ ] Remove Electron dependencies from web build
- [ ] Create `apiClient.ts` for HTTP communication
- [ ] Update all Pinia stores for web mode
- [ ] Add auth pages (login/register)
- [ ] Update Vite config for web-only build
- [ ] **Create frontend Dockerfile and nginx config**
- [ ] **Test containerized frontend build**

### Week 7-8: Desktop App Dual-Mode Support
- [ ] Implement service abstraction layer (IContextService, IGitService)
- [ ] Create LocalService and CloudService implementations
- [ ] Add HybridService with intelligent routing
- [ ] Build cloud sync settings UI
- [ ] Add feature flags for cloud features
- [ ] Implement CloudSyncService with conflict resolution
- [ ] **Test desktop app in all three modes (local, cloud, hybrid)**
- [ ] **Ensure desktop app can connect to K8s backend**

### Week 9-10: K8s Deployment Pipeline
- [ ] **Setup GitHub Container Registry (GHCR)**
- [ ] **Create CI/CD workflow for Docker builds**
- [ ] **Configure staging K8s cluster**
- [ ] **Deploy to staging and run smoke tests**
- [ ] **Setup Ingress with SSL/TLS (cert-manager)**
- [ ] **Configure Horizontal Pod Autoscaler (HPA)**
- [ ] **Implement monitoring (Prometheus + Grafana)**
- [ ] **Setup logging (EFK stack or Loki)**

### Week 11-12: Enterprise Features + Production
- [ ] Enterprise repo sync via backend API
- [ ] Constitution merging server-side
- [ ] Spec derivation API
- [ ] GitHub integration (backend)
- [ ] Multi-tenant access control
- [ ] **Production K8s cluster setup**
- [ ] **Database migration scripts**
- [ ] **Secrets management (Sealed Secrets or Vault)**
- [ ] **Production deployment with blue-green strategy**
- [ ] **Load testing and performance optimization**

### Week 13-14: Testing & Optimization
- [ ] Write integration tests for backend API
- [ ] E2E test suite (Playwright) for web app
- [ ] Desktop app tests for dual-mode operation
- [ ] Security audit (OWASP, dependency scanning)
- [ ] Performance optimization (caching, CDN)
- [ ] **K8s resource optimization (limits, requests)**
- [ ] **Disaster recovery plan and backup strategy**
- [ ] **Chaos engineering tests (Chaos Mesh)**

### Week 15-16: Beta Testing & Launch
- [ ] Beta testing with selected users
- [ ] Migration tool for existing desktop users
- [ ] Documentation updates (user guides, API docs)
- [ ] Video tutorials for cloud sync setup
- [ ] **Production monitoring dashboards**
- [ ] **Alerting and on-call procedures**
- [ ] **Final security audit**
- [ ] **Public launch of web version**
- [ ] **Desktop app v2.0.0 release with cloud support**

---

## Kubernetes Cluster Setup Guide

### Option 1: Managed Kubernetes (Recommended for Production)

**AWS EKS**:
```bash
# Install eksctl
brew install eksctl  # macOS
choco install eksctl  # Windows

# Create EKS cluster
eksctl create cluster \
  --name context-kit-prod \
  --region us-west-2 \
  --nodegroup-name standard-workers \
  --node-type t3.large \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 10 \
  --managed

# Configure kubectl
aws eks update-kubeconfig --region us-west-2 --name context-kit-prod

# Install cluster autoscaler
eksctl create iamserviceaccount \
  --cluster=context-kit-prod \
  --namespace=kube-system \
  --name=cluster-autoscaler \
  --attach-policy-arn=arn:aws:iam::aws:policy/AutoScalingFullAccess \
  --approve

kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
```

**Google GKE**:
```bash
# Create GKE cluster
gcloud container clusters create context-kit-prod \
  --region us-central1 \
  --num-nodes 3 \
  --machine-type n1-standard-2 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 10 \
  --enable-autorepair \
  --enable-autoupgrade

# Configure kubectl
gcloud container clusters get-credentials context-kit-prod --region us-central1
```

**Azure AKS** (Recommended):

```bash
# Login to Azure
az login

# Create resource group
az group create \
  --name context-kit-prod-rg \
  --location eastus

# Create Azure Container Registry (ACR)
az acr create \
  --resource-group context-kit-prod-rg \
  --name contextkitacr \
  --sku Standard \
  --location eastus

# Create AKS cluster with Azure CNI and managed identity
az aks create \
  --resource-group context-kit-prod-rg \
  --name context-kit-prod \
  --location eastus \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-managed-identity \
  --enable-addons monitoring \
  --enable-cluster-autoscaler \
  --min-count 2 \
  --max-count 10 \
  --network-plugin azure \
  --network-policy azure \
  --attach-acr contextkitacr \
  --enable-app-routing \
  --generate-ssh-keys

# Enable workload identity (for Key Vault integration)
az aks update \
  --resource-group context-kit-prod-rg \
  --name context-kit-prod \
  --enable-oidc-issuer \
  --enable-workload-identity

# Configure kubectl
az aks get-credentials \
  --resource-group context-kit-prod-rg \
  --name context-kit-prod \
  --overwrite-existing

# Verify cluster access
kubectl get nodes

# Create Azure Database for PostgreSQL
az postgres flexible-server create \
  --resource-group context-kit-prod-rg \
  --name contextkit-db-prod \
  --location eastus \
  --admin-user dbadmin \
  --admin-password 'SecurePassword123!' \
  --sku-name Standard_B2s \
  --tier Burstable \
  --storage-size 32 \
  --version 14 \
  --high-availability Disabled \
  --public-access 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group context-kit-prod-rg \
  --server-name contextkit-db-prod \
  --database-name contextkit

# Create Azure Cache for Redis
az redis create \
  --resource-group context-kit-prod-rg \
  --name contextkit-redis-prod \
  --location eastus \
  --sku Premium \
  --vm-size P1 \
  --enable-non-ssl-port false

# Create Azure Storage Account for Blob Storage
az storage account create \
  --resource-group context-kit-prod-rg \
  --name contextkitstorageprod \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2 \
  --access-tier Hot

# Create blob container
az storage container create \
  --account-name contextkitstorageprod \
  --name repositories \
  --public-access off

# Create Azure Key Vault
az keyvault create \
  --resource-group context-kit-prod-rg \
  --name contextkit-kv-prod \
  --location eastus \
  --sku standard

# Store secrets in Key Vault
az keyvault secret set \
  --vault-name contextkit-kv-prod \
  --name jwt-secret \
  --value 'your-jwt-secret-here'

az keyvault secret set \
  --vault-name contextkit-kv-prod \
  --name azure-openai-key \
  --value 'your-azure-openai-key'

# Create Application Gateway (optional - for advanced L7 routing)
az network application-gateway create \
  --resource-group context-kit-prod-rg \
  --name contextkit-appgw \
  --location eastus \
  --sku Standard_v2 \
  --capacity 2 \
  --vnet-name aks-vnet \
  --subnet appgw-subnet \
  --http-settings-cookie-based-affinity Disabled \
  --frontend-port 80 \
  --http-settings-port 80 \
  --http-settings-protocol Http
```

### Option 2: Self-Managed Kubernetes (Not Recommended)

<details>
<summary>k3s on Azure VMs (Click to expand)</summary>

```bash
# Create Azure VMs for k3s cluster
az vm create \
  --resource-group context-kit-prod-rg \
  --name k3s-master \
  --image UbuntuLTS \
  --size Standard_D4s_v3 \
  --admin-username azureuser \
  --generate-ssh-keys

# SSH into master node
az vm run-command invoke \
  --resource-group context-kit-prod-rg \
  --name k3s-master \
  --command-id RunShellScript \
  --scripts "curl -sfL https://get.k3s.io | sh -"

# Get node token
az vm run-command invoke \
  --resource-group context-kit-prod-rg \
  --name k3s-master \
  --command-id RunShellScript \
  --scripts "sudo cat /var/lib/rancher/k3s/server/node-token"
```

**Note**: Self-managed K8s on Azure VMs loses many benefits of AKS:
- No managed control plane
- Manual updates and patching
- No Azure Monitor integration
- Higher operational overhead
- **Recommendation**: Use AKS instead
</details>

### Essential Azure Add-ons Installation

**Ingress Controller (nginx with Azure integration)**:
```bash
# Add helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install nginx ingress with Azure Load Balancer
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz \
  --set controller.service.externalTrafficPolicy=Local

# Get external IP
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

**Alternative: Azure Application Gateway Ingress Controller (AGIC)**:
```bash
# Enable AGIC add-on (recommended for production)
az aks enable-addons \
  --resource-group context-kit-prod-rg \
  --name context-kit-prod \
  --addon ingress-appgw \
  --appgw-name contextkit-appgw \
  --appgw-subnet-cidr "10.2.0.0/16"
```

**Cert Manager (SSL Certificates)**:
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create Let's Encrypt issuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@contextkit.app
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

**Azure Monitor + Application Insights** (Recommended for AKS):
```bash
# Azure Monitor is enabled by default with --enable-addons monitoring
# Application Insights is configured via instrumentation key

# Create Application Insights resource
az monitor app-insights component create \
  --app contextkit-insights \
  --location eastus \
  --resource-group context-kit-prod-rg \
  --application-type web

# Get instrumentation key
az monitor app-insights component show \
  --app contextkit-insights \
  --resource-group context-kit-prod-rg \
  --query instrumentationKey -o tsv

# Install Azure Monitor Container Insights
az aks enable-addons \
  --resource-group context-kit-prod-rg \
  --name context-kit-prod \
  --addons monitoring \
  --workspace-resource-id /subscriptions/<sub-id>/resourceGroups/context-kit-prod-rg/providers/Microsoft.OperationalInsights/workspaces/contextkit-logs
```

**Alternative: Prometheus + Grafana** (if Azure Monitor not sufficient):
<details>
<summary>Click to expand Prometheus setup</summary>

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```
</details>

**Storage Classes** (AKS provides default storage classes):
```bash
# View available storage classes
kubectl get storageclass

# AKS includes by default:
# - default: Azure Disk (StandardSSD_LRS)
# - managed-premium: Azure Disk (Premium_LRS)
# - azurefile: Azure Files (Standard_LRS)
# - azurefile-premium: Azure Files (Premium_LRS)

# No additional storage setup needed for AKS
```

---

## Cost Estimation

### Azure AKS Production Deployment (Recommended)

| Component | Resource | Monthly Cost (USD) |
|-----------|----------|-------------------:|
| **AKS Control Plane** | Standard tier | $73 |
| **Worker Nodes** | 3x Standard_D4s_v3 (4 vCPU, 16GB RAM) | $280 |
| **Auto-scaling Nodes** | +2-7 nodes (peak traffic) | $190-440 |
| **Application Gateway** | Standard_v2 (2 capacity units) | $60 |
| **Azure Front Door** | Standard tier | $35 |
| **Database** | PostgreSQL Flexible (B2s Burstable) | $25 |
| **Redis Cache** | Premium P1 (6GB) | $142 |
| **Blob Storage** | 500GB Hot tier (LRS) | $10 |
| **Container Registry** | Standard tier (500GB) | $20 |
| **Azure Monitor** | Logs + metrics (50GB/mo) | $30 |
| **Application Insights** | Pay-as-you-go | $15 |
| **Key Vault** | Standard (1000 operations/mo) | $3 |
| **Data Transfer** | 500GB egress | $45 |
| **Azure DNS** | Hosted zone + queries | $1 |
| **SSL Certificates** | Managed by App Gateway | $0 |
| **Total (Low Traffic)** | | **$649/month** |
| **Total (High Traffic)** | | **$1,159/month** |

**Cost Optimization Tips**:
- 💰 Use **Azure Reserved Instances** (save 30-40% on VMs)
- 💰 Enable **Azure Spot VMs** for non-critical workloads (save 60-90%)
- 💰 Use **Burstable B-series VMs** for dev/staging
- 💰 Configure **autoscaling** to scale down during off-peak hours
- 💰 Use **Azure Hybrid Benefit** if you have Windows Server licenses
- 💰 Set up **Azure Cost Management** alerts and budgets

### Comparison with Other Cloud Providers

<details>
<summary>AWS EKS Cost Estimate (Click to expand)</summary>

| Component | Resource | Monthly Cost |
|-----------|----------|--------------|
| **EKS Control Plane** | Managed | $73 |
| **Worker Nodes** | 3x t3.large (2 vCPU, 8GB RAM) | $150 |
| **Auto-scaling Nodes** | +2-7 nodes (peak traffic) | $100-350 |
| **Load Balancer** | Network LB | $20 |
| **Database** | RDS PostgreSQL (db.t3.medium) | $50 |
| **Storage** | 200GB EBS (gp3) | $20 |
| **Object Storage** | 500GB S3 | $12 |
| **Data Transfer** | 500GB egress | $45 |
| **Monitoring** | CloudWatch | $30 |
| **Container Registry** | ECR (500GB storage) | $50 |
| **DNS** | Route 53 | $5 |
| **Total (Low Traffic)** | | **$555/month** |
| **Total (High Traffic)** | | **$805/month** |
</details>

### Self-Hosted K8s (3 VPS Servers)

| Component | Resource | Monthly Cost |
|-----------|----------|--------------|
| **Master Node** | 4 vCPU, 8GB RAM, 100GB SSD | $40 |
| **Worker Node 1** | 8 vCPU, 16GB RAM, 200GB SSD | $80 |
| **Worker Node 2** | 8 vCPU, 16GB RAM, 200GB SSD | $80 |
| **Object Storage** | MinIO on separate VPS or S3 | $20-30 |
| **Bandwidth** | 5TB/month included | $0 |
| **Monitoring** | Self-hosted Prometheus/Grafana | $0 |
| **Backup Storage** | 500GB backup | $10 |
| **Total** | | **$230-240/month** |

### Desktop-Only (Current Model)

| Component | Cost |
|-----------|------|
| **Infrastructure** | $0 (users run locally) |
| **Distribution** | GitHub releases (free) |
| **Support** | Community/documentation |
| **Total** | **$0/month** |

---

## Recommended Next Steps

1. **Decision Point**: Full migration vs. hybrid approach
2. **Setup Backend Repo**: `context-kit-backend/` with Express skeleton
3. **Define API Spec**: OpenAPI/Swagger for all endpoints
4. **Database Design**: Finalize PostgreSQL schema
5. **Prototype Auth**: JWT flow + test routes

### Proof of Concept (Week 2-3)

1. **Implement 3 Core Endpoints**:
   - `POST /api/context/validate`
   - `GET /api/git/status`
   - `POST /api/files/read`

2. **Update 1 Pinia Store**: `contextStore.ts` → use API client
3. **Test End-to-End**: Login → validate repo → see results
4. **Evaluate Complexity**: Adjust timeline based on findings

### Stakeholder Questions

1. **Target Users**: Desktop power users only, or broader web audience?
2. **Hosting Preference**: Cloud (AWS/Vercel) or self-hosted?
3. **Budget**: Infrastructure costs acceptable?
4. **Timeline**: Hard deadline or flexible?
5. **Backwards Compatibility**: Support old desktop app during transition?

---

## Conclusion

**Feasibility**: ✅ **Achievable** with 8-12 weeks of focused effort.

**Complexity**: The migration is **non-trivial** due to:
- 100+ IPC channels to convert to HTTP endpoints
- Heavy file system usage requiring storage abstraction
- Python sidecar integration needs proxying
- Multi-tenancy and auth add new requirements

**Recommendation**: 

1. **Hybrid Architecture**: Desktop app v2.0.0 with cloud sync + Web version
2. **Incremental Deployment**: Start with staging K8s cluster, graduate to production
3. **Managed K8s (Phase 1)**: Use EKS/GKE/AKS to reduce operational overhead
4. **Self-Hosted Migration (Phase 2)**: Migrate to k3s/RKE2 after stability proven
5. **Phased User Migration**: 
   - Month 1-2: Desktop app v2.0.0 beta with cloud sync (optional)
   - Month 3-4: Web app beta launch for new users
   - Month 5-6: General availability, encourage cloud adoption
   - Month 6+: Enterprise features (team collaboration, advanced AI)

**Success Criteria**:
- ✅ All current desktop features work in web version
- ✅ Desktop app can operate in local-only, cloud-only, or hybrid mode
- ✅ No data loss during cloud sync or migration
- ✅ K8s deployment auto-scales from 3 to 20 pods based on traffic
- ✅ 99.9% uptime with proper monitoring and alerting
- ✅ Security best practices (RBAC, secrets management, network policies)
- ✅ Comprehensive documentation for developers and users
- ✅ Desktop and web apps share 90%+ of UI components (Vue SPA)

**Next Milestone**: 
Complete Week 1-2 tasks (backend foundation + Docker) and demonstrate:
1. Containerized backend running locally with docker-compose
2. Desktop app connecting to localhost:3000 backend API
3. Single IPC endpoint migrated to HTTP (e.g., `context:validate`)
4. Initial K8s manifests deployed to local Minikube

---

**Document Owner**: GitHub Copilot  
**Last Updated**: 2025-11-08  
**Version**: 2.0 (K8s Enhanced)
