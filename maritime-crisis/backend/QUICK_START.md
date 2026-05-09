# Quick Start Guide - Maritime Crisis Backend

**Get the backend running in 5 minutes and begin testing real-time fleet management.**

---

## 📋 Prerequisites

- **Node.js**: v18+ (check: `node --version`)
- **Database**: PostgreSQL or Supabase (connection string required)
- **API Key**: Groq API key (optional for basic testing, required for AI features)

---

## ⚡ 5-Minute Setup

### Step 1: Prepare Environment (1 min)

```bash
cd maritime-crisis/backend

# Copy template and edit
cp .env.example .env

# Edit .env with your values:
# - DATABASE_URL: PostgreSQL connection string
# - GROQ_API_KEY: From console.groq.com (optional)
```

**Where to get DATABASE_URL**:

- **Supabase**: Copy from Project Settings → Database → Connection Pooler
- **Local**: `postgresql://postgres:password@localhost:5432/maritime`

### Step 2: Install & Initialize (2 min)

```bash
# Install dependencies
npm install

# Initialize database schema
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

### Step 3: Start Backend (1 min)

```bash
npm run dev
```

**Expected output**:

```
[startup] GROQ_API_KEY: present
[startup] JWT_SECRET: present
Server running on http://localhost:3001
[Simulator] Starting simulation...
[Simulator] Tick 1: 15 ships loaded
```

### Step 4: Verify Installation (1 min)

```bash
# In another terminal, test backend
curl http://localhost:3001/api/ships | jq '.data | length'
# Should print: 15
```

✅ **Backend is running!**

---

## 🧪 Quick Tests

### Test 1: Get All Ships

```bash
curl http://localhost:3001/api/ships | jq '.'
```

**Expected**: Array of 15 ships with positions, fuel, speed, status.

### Test 2: Generate Auth Token

```bash
curl -X POST http://localhost:3001/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"role":"command"}'
```

**Save the token** for next tests:

```bash
TOKEN="eyJhbGc..." # From response
```

### Test 3: Get Fleet State

```bash
curl http://localhost:3001/api/fleet/state \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Expected**: Ships, zones, active alerts, all real-time data.

### Test 4: Connect WebSocket

```bash
# Using wscat (install: npm install -g wscat)
wscat -c 'ws://localhost:3001/ws?role=command'

# You should see FLEET_STATE messages arriving every ~1 second
```

Press Ctrl+C to exit.

### Test 5: AI Distress Analysis

```bash
curl http://localhost:3001/api/ai/advisory \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Expected**:

- If GROQ_API_KEY set: Real recommendations from AI
- If missing: Fallback recommendations with note

---

## 🔧 Common Issues & Fixes

### ❌ "Error: connect ECONNREFUSED"

**Problem**: Database not running or connection string wrong.

**Fix**:

```bash
# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL

# If using Supabase:
# 1. Go to supabase.com
# 2. Create project
# 3. Copy connection string from Settings → Database → Connection Pooler
# 4. Update DATABASE_URL in .env

# If using local PostgreSQL:
# 1. Start PostgreSQL: psql postgres
# 2. Create DB: CREATE DATABASE maritime;
# 3. Set DATABASE_URL=postgresql://postgres:password@localhost:5432/maritime
```

### ❌ "WebSocket connection failed"

**Problem**: Backend not running or wrong URL.

**Fix**:

```bash
# Ensure backend is running
npm run dev

# Check the exact URL
# Should be: ws://localhost:3001/ws?role=command
# Not: http:// or https://
```

### ❌ "AI returns fallback responses"

**Problem**: GROQ_API_KEY missing or invalid.

**Fix**:

```bash
# Get free key from:
# https://console.groq.com/keys

# Add to .env
GROQ_API_KEY="gsk_..."

# Restart backend
npm run dev
```

### ❌ "Prisma migration fails"

**Problem**: Database schema mismatch.

**Fix**:

```bash
# Reset database (⚠️ deletes all data)
npx prisma migrate reset --force

# Or manually fix:
npx prisma migrate dev --name init
```

---

## 🎯 What Each Component Does

| Component     | What It Does                              | Location                           |
| ------------- | ----------------------------------------- | ---------------------------------- |
| **Simulator** | Advances 15 ships every 1 second          | `src/simulation/simulator.ts`      |
| **Routing**   | Computes A\* paths avoiding zones         | `src/routing/astar.ts`             |
| **Alerts**    | Detects geofences, proximity, fuel issues | `src/alerts/alert-engine.ts`       |
| **WebSocket** | Broadcasts fleet state to UI every 1Hz    | `src/websocket/ws-manager.ts`      |
| **Auth**      | Generates & validates JWT tokens          | `src/middleware/auth.ts`           |
| **AI**        | Analyzes distress messages                | `src/ai/ai-service.ts`             |
| **Playback**  | Captures snapshots every 30s              | `src/playback/playback-service.ts` |

---

## 📊 Real-Time Data Flow

```
Every 1 second:

[Simulator Tick]
    ↓
[Advance Ships] → Update position/fuel/status
    ↓
[Check Alerts] → Geofence? Proximity? Fuel?
    ↓
[Update Routes] → Any new zones? Reroute needed?
    ↓
[Broadcast WebSocket] → Send FLEET_STATE to all clients
    ↓
[Capture Snapshot] → Save state to database (every 30s)
```

---

## 🚀 Next Steps

### To Test Individual Features

See [ARCHITECTURE_AND_API.md](./ARCHITECTURE_AND_API.md) for:

- Complete API reference with all endpoints
- WebSocket message formats
- Database schema documentation

### To Create Zones

```bash
curl -X POST http://localhost:3001/api/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Zone",
    "polygon": [
      {"lat": 26.5, "lng": 55.0},
      {"lat": 26.5, "lng": 55.5},
      {"lat": 27.0, "lng": 55.5},
      {"lat": 27.0, "lng": 55.0}
    ]
  }'
```

### To Issue Directives

```bash
# Get a ship ID first
curl http://localhost:3001/api/ships | jq '.data[0].shipId'
# e.g., "MV-1"

# Issue directive
curl -X POST http://localhost:3001/api/directives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipId": "MV-1",
    "type": "REROUTE_PORT",
    "payload": {
      "portId": "DOH-1"
    }
  }'
```

### To Connect Frontend

1. Open frontend repository
2. Find WebSocket connection code
3. Set URL to: `ws://localhost:3001/ws?role=command`
4. Generate token from backend
5. Frontend should start receiving FLEET_STATE every 1 second

---

## 📚 Documentation Map

| Document                             | Purpose                                            |
| ------------------------------------ | -------------------------------------------------- |
| **README.md**                        | Overview & feature list                            |
| **QUICK_START.md**                   | This file - get running in 5 min                   |
| **ARCHITECTURE_AND_API.md**          | Deep dive: API ref, data flows, WebSocket protocol |
| **IMPLEMENTATION_AUDIT.md**          | Feature checklist vs. requirements                 |
| **BACKEND_SETUP.md**                 | Detailed setup instructions                        |
| **SWAGGER_TESTING.md**               | REST API testing guide                             |
| **WEBSOCKET_TESTING.md**             | Real-time connection testing                       |
| **DOCKER_DEPLOYMENT_SUMMARY.md**     | Docker & cloud deployment                          |
| **COMPREHENSIVE_TROUBLESHOOTING.md** | Detailed error diagnosis                           |

---

## 💡 Pro Tips

**Tip 1: Speed up simulation**

```bash
# Edit .env
TICK_INTERVAL_MS=500  # 2Hz instead of 1Hz
npm run dev
```

**Tip 2: Test with mock data**

```bash
# Ships already load from fleet.json with real positions
# Just start the server and they'll move
npm run dev
```

**Tip 3: Monitor in real-time**

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Watch WebSocket messages
wscat -c 'ws://localhost:3001/ws?role=command'

# Terminal 3: Make API calls
curl http://localhost:3001/api/ships | jq '.data[0]'
```

**Tip 4: Debug routing**

```bash
# Check if a ship is stranded
curl http://localhost:3001/api/ships | jq '.data[] | select(.status=="stranded")'

# Try rerouting it
curl -X POST http://localhost:3001/api/directives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shipId":"MV-1","type":"REROUTE_PORT","payload":{"portId":"AUH-1"}}'
```

---

## 🔍 Verify the System is Working

Run this checklist:

- [ ] `npm install` completes without errors
- [ ] `npx prisma migrate dev` creates database
- [ ] `npm run dev` starts without errors
- [ ] Backend shows "[startup]" logs
- [ ] `curl http://localhost:3001/api/ships` returns 15 ships
- [ ] `curl -X POST /api/auth/token` returns valid JWT
- [ ] WebSocket connects and receives FLEET_STATE every 1 second
- [ ] Zones can be created via POST /api/zones
- [ ] Ships update positions every second
- [ ] No errors in terminal logs

**If all ✅**: System is ready for frontend integration and live testing!

---

## ❓ Questions?

Refer to specific documentation files above or check terminal logs for error messages. The backend logs are very detailed and help diagnose issues quickly.
