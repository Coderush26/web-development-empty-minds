# Implementation Checklist & Verification Guide

**Step-by-step verification that all requirements are met and system is production-ready.**

---

## 📋 Pre-Flight Checklist

Before starting, verify your environment:

### Environment Setup

- [ ] Node.js v18+ installed: `node --version`
- [ ] npm or pnpm available: `npm --version`
- [ ] PostgreSQL or Supabase account ready
- [ ] Groq API key obtained (optional, from console.groq.com)
- [ ] Git repository cloned
- [ ] Terminal open in `maritime-crisis/backend/` directory

### Initial Configuration

- [ ] `.env.example` exists: `ls .env.example`
- [ ] `.env` created: `cp .env.example .env`
- [ ] DATABASE_URL set in `.env` (PostgreSQL or Supabase connection)
- [ ] GROQ_API_KEY set in `.env` (or marked as optional)
- [ ] JWT_SECRET will be auto-generated (check on first run)

---

## 🚀 Phase 1: Setup & Installation (15 min)

### Step 1.1: Install Dependencies

```bash
npm install
# Expected: ✅ no errors
# Installs: express, prisma, ws, groq, typescript, etc.
```

**Checklist**:

- [ ] No "ERR!" messages
- [ ] No version conflicts
- [ ] `node_modules/` directory created
- [ ] `package-lock.json` updated

### Step 1.2: Generate Prisma Client

```bash
npx prisma generate
# Expected: ✔ Generated Prisma Client to ./src/generated/prisma in Xms
```

**Checklist**:

- [ ] No errors printed
- [ ] `src/generated/prisma/` directory created
- [ ] `index.d.ts` exists with types

### Step 1.3: Initialize Database

```bash
npx prisma migrate dev --name init
# Follow prompts:
# 1. "Do you want to create a new database?" → Yes
# 2. Migrations applied successfully
```

**Checklist**:

- [ ] Database migrations succeeded
- [ ] `prisma/migrations/` directory created
- [ ] Timestamp migration file exists
- [ ] SQL applied without errors
- [ ] Message: "Your database is now in sync with your schema"

### Step 1.4: Build TypeScript

```bash
npm run build
# Expected: ✅ Build succeeded
```

**Checklist**:

- [ ] No TypeScript errors
- [ ] No compilation warnings
- [ ] `dist/` directory created with `.js` files
- [ ] Build completed in <30 seconds

### Step 1.5: Verify File Structure

```bash
# Check critical files exist
ls -la src/app.ts
ls -la src/server.ts
ls -la prisma/schema.prisma
ls -la public/fleet.json
```

**Checklist**:

- [ ] `src/app.ts` exists (1 KB+)
- [ ] `src/server.ts` exists (1 KB+)
- [ ] `prisma/schema.prisma` exists (10+ KB)
- [ ] `public/fleet.json` exists (50+ KB)
- [ ] All files readable

---

## 🔥 Phase 2: Startup Verification (5 min)

### Step 2.1: Start Backend

```bash
npm run dev
# Expected: Server starts on http://localhost:3001
```

**Checklist**:

- [ ] No startup errors
- [ ] Output shows: `Server running on http://localhost:3001`
- [ ] Output shows: `[startup] GROQ_API_KEY: present` (or "not set")
- [ ] Output shows: `[startup] JWT_SECRET: present`
- [ ] Output shows: `[Simulator] Starting simulation...`
- [ ] Output shows: `[Simulator] Tick 1: 15 ships loaded`
- [ ] No "Cannot find module" errors
- [ ] No database connection errors

### Step 2.2: Keep Backend Running

**Important**: Leave backend running in this terminal for all remaining tests.

Open a **new terminal window** for all API tests below.

---

## 🔍 Phase 3: API Endpoint Verification (10 min)

**In NEW terminal**, run these tests. Backend should still be running in other terminal.

### Test 3.1: Health Check

```bash
curl http://localhost:3001/api/ships | jq '.' | head -5
```

**Checklist**:

- [ ] HTTP 200 response
- [ ] JSON with `{ "status": "ok", "data": [...] }`
- [ ] `data` array has 15 ships
- [ ] First ship has fields: `shipId`, `name`, `lat`, `lng`, `speed`, `fuel`, `status`

### Test 3.2: Individual Ship Fetch

```bash
curl http://localhost:3001/api/ships/MV-1 | jq '.'
```

**Checklist**:

- [ ] HTTP 200 response
- [ ] Single ship object returned
- [ ] Contains all required fields
- [ ] `shipId` is "MV-1"

### Test 3.3: Generate Auth Token

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"role":"command"}' | jq -r '.data.token')

echo "Token: $TOKEN" | head -c 50
```

**Checklist**:

- [ ] HTTP 200 response
- [ ] `token` field present in response
- [ ] Token starts with "eyJ"
- [ ] Token is valid JWT format
- [ ] No "Invalid role" errors

### Test 3.4: Fleet State (Requires Auth)

```bash
curl http://localhost:3001/api/fleet/state \
  -H "Authorization: Bearer $TOKEN" | jq '.data | keys'
```

**Checklist**:

- [ ] HTTP 200 response
- [ ] Response contains arrays for: `ships`, `zones`, `activeAlerts`
- [ ] `ships` array length >= 15
- [ ] No "Unauthorized" 401 response

### Test 3.5: API Documentation

```bash
curl http://localhost:3001/api-docs 2>/dev/null | grep -c "openapi"
```

**Checklist**:

- [ ] HTTP 200 response
- [ ] Swagger/OpenAPI docs available
- [ ] Can open `http://localhost:3001/api-docs` in browser

### Test 3.6: All Core Endpoints

```bash
# Ports
curl -s http://localhost:3001/api/ports | jq '.data | length'

# Zones (should be empty initially)
curl -s http://localhost:3001/api/zones \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

# Alerts
curl -s http://localhost:3001/api/alerts \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

# Directives
curl -s http://localhost:3001/api/directives \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

# Fleet stats
curl -s http://localhost:3001/api/fleet/stats \
  -H "Authorization: Bearer $TOKEN" | jq '.data | keys'
```

**Checklist**:

- [ ] Ports returns 10+ ports
- [ ] Zones returns array (empty or with zones)
- [ ] Alerts returns array
- [ ] Directives returns array
- [ ] Stats returns object with fleet metrics

---

## 📡 Phase 4: Real-Time WebSocket Verification (10 min)

### Step 4.1: Install WebSocket Test Tool

```bash
npm install -g wscat
# Expected: Successfully installed
```

**Checklist**:

- [ ] No errors
- [ ] `wscat` available: `which wscat`

### Step 4.2: Connect WebSocket as Command

```bash
wscat -c 'ws://localhost:3001/ws?role=command'
```

**Checklist**:

- [ ] Shows: `Connected (press CTRL+C to quit)`
- [ ] No "connection refused" or "ECONNREFUSED"

### Step 4.3: Receive Fleet State Messages

**Leave wscat connected for ~5 seconds. You should see messages like:**

```json
{"type":"FLEET_STATE","payload":{"ships":[...],"zones":[],"alerts":[]},"timestamp":1778321400000}
```

**Checklist**:

- [ ] Messages arrive every ~1 second (configurable)
- [ ] Each message has `type`, `payload`, `timestamp`
- [ ] `payload.ships` array has 15 ships
- [ ] Ship objects have `lat`, `lng`, `speed`, `fuel`, `status`
- [ ] Values change between messages (ships moving)
- [ ] No error messages in stream

### Step 4.4: Verify Ships Are Moving

Save first message, wait 2 seconds, save second message. Compare positions:

```
Message 1: Ship MV-1 at lat: 26.50, lng: 55.00
Message 2: Ship MV-1 at lat: 26.50, lng: 55.01 (changed!)
```

**Checklist**:

- [ ] Positions updated in newer messages
- [ ] Changes correspond to ship speed and time elapsed
- [ ] Fuel decreased between messages

### Step 4.5: Exit WebSocket

Press Ctrl+C to disconnect.

---

## 🎯 Phase 5: Feature-Specific Tests (20 min)

**New terminal** with TOKEN variable:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"role":"command"}' | jq -r '.data.token')
```

### Test 5.1: Create Restricted Zone

```bash
ZONE_ID=$(curl -s -X POST http://localhost:3001/api/zones \
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
  }' | jq -r '.data.id')

echo "Created zone: $ZONE_ID"
```

**Checklist**:

- [ ] HTTP 201 response
- [ ] Zone ID returned (UUID format)
- [ ] Zone appears in WebSocket messages next tick

### Test 5.2: Retrieve Zones

```bash
curl -s http://localhost:3001/api/zones \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

**Checklist**:

- [ ] Returns array with at least 1 zone
- [ ] Zone has: `id`, `name`, `polygon`, `createdAt`
- [ ] Polygon matches what was sent

### Test 5.3: Issue Directive

```bash
DIR_ID=$(curl -s -X POST http://localhost:3001/api/directives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipId": "MV-1",
    "type": "REROUTE_PORT",
    "payload": {"portId": "DOH-1"}
  }' | jq -r '.data.id')

echo "Created directive: $DIR_ID"
```

**Checklist**:

- [ ] HTTP 201 response
- [ ] Directive ID returned
- [ ] Status is "PENDING"
- [ ] Ship ID matches

### Test 5.4: Get Directives

```bash
curl -s http://localhost:3001/api/directives \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

**Checklist**:

- [ ] Returns array with directive
- [ ] Directive has: `id`, `shipId`, `type`, `status`, `response`
- [ ] Latest directive shows status "PENDING"

### Test 5.5: Get Current Alerts

```bash
curl -s http://localhost:3001/api/alerts \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

**Checklist**:

- [ ] Returns array
- [ ] Alerts may include GEOFENCE_BREACH if ship near test zone
- [ ] Each alert has: `id`, `type`, `severity`, `shipId`, `acknowledged`

### Test 5.6: Check Playback Snapshots

```bash
curl -s http://localhost:3001/api/playback/snapshots \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

**Checklist**:

- [ ] Returns array of snapshots
- [ ] Length increases over time (new snapshot every 30s)
- [ ] Each has: `timestamp`, `fleetState`, `activeAlerts`

### Test 5.7: Get AI Advisory

```bash
curl -s http://localhost:3001/api/ai/advisory \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

**Checklist**:

- [ ] HTTP 200 response
- [ ] If GROQ_API_KEY set: Real recommendations with `suggestions` array
- [ ] If GROQ_API_KEY not set: Fallback recommendations (still valid response)
- [ ] Response has: `overallSituation`, `recommendations`

---

## 🔐 Phase 6: Authentication & Authorization (5 min)

### Test 6.1: Generate Captain Token

```bash
CAPTAIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"role":"captain","shipId":"MV-1"}' | jq -r '.data.token')

echo "Captain token: $CAPTAIN_TOKEN"
```

**Checklist**:

- [ ] Token generated successfully
- [ ] Different from command token

### Test 6.2: Captain Can Access Own Ship

```bash
curl -s http://localhost:3001/api/ships/MV-1 \
  -H "Authorization: Bearer $CAPTAIN_TOKEN" | jq '.data.shipId'
```

**Checklist**:

- [ ] HTTP 200 response
- [ ] Returns "MV-1"

### Test 6.3: Captain Cannot Create Zones (Command Only)

```bash
curl -s -X POST http://localhost:3001/api/zones \
  -H "Authorization: Bearer $CAPTAIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","polygon":[]}' | jq '.error'
```

**Checklist**:

- [ ] HTTP 403 Forbidden response
- [ ] Error message indicates permission denied
- [ ] Zone not created

### Test 6.4: Invalid Token Rejected

```bash
curl -s http://localhost:3001/api/fleet/state \
  -H "Authorization: Bearer invalid_token_12345" | jq '.error'
```

**Checklist**:

- [ ] HTTP 401 Unauthorized response
- [ ] Error indicates invalid token
- [ ] Data not returned

### Test 6.5: Missing Token Rejected

```bash
curl -s http://localhost:3001/api/fleet/state | jq '.error'
```

**Checklist**:

- [ ] HTTP 401 Unauthorized response
- [ ] Requires Authorization header

---

## 📊 Phase 7: Performance & Scalability (10 min)

### Test 7.1: Response Time for Fleet State

```bash
time curl -s http://localhost:3001/api/fleet/state \
  -H "Authorization: Bearer $TOKEN" > /dev/null
```

**Checklist**:

- [ ] Response time < 100ms
- [ ] Real time: 0.050s user

### Test 7.2: WebSocket Broadcast Latency

**In wscat terminal**, watch timestamps:

```json
Receive 1: "timestamp":1778321400000
Receive 2: "timestamp":1778321401000  (1000ms = 1 second later)
```

**Checklist**:

- [ ] Interval ~1000ms (±50ms tolerance)
- [ ] Consistent timing
- [ ] No dropped messages

### Test 7.3: Concurrent API Requests

```bash
for i in {1..5}; do
  curl -s http://localhost:3001/api/ships \
    -H "Authorization: Bearer $TOKEN" &
done
wait
echo "All 5 requests completed"
```

**Checklist**:

- [ ] All requests succeed
- [ ] No "Too many requests" errors
- [ ] Responses all valid

### Test 7.4: Multiple WebSocket Connections

**Terminal 3:**

```bash
wscat -c 'ws://localhost:3001/ws?role=captain'
```

**Terminal 4:**

```bash
wscat -c 'ws://localhost:3001/ws?role=command'
```

**Checklist**:

- [ ] Both connections simultaneously active
- [ ] Both receive FLEET_STATE messages
- [ ] Messages arrive in sync (same timestamp)

---

## 🌍 Phase 8: Geospatial & Simulation (15 min)

### Test 8.1: Fleet Configuration

```bash
curl -s http://localhost:3001/api/ships | jq '.data | length'
```

**Checklist**:

- [ ] Exactly 15 ships
- [ ] Ship IDs: MV-1 through MV-15

### Test 8.2: Ships Have Realistic Data

```bash
curl -s http://localhost:3001/api/ships | jq '.data[0]'
```

**Checklist**:

- [ ] Required fields: `shipId`, `name`, `lat`, `lng`, `speed`, `fuel`, `status`, `cargo`, `destination`
- [ ] `lat` and `lng` in valid range (Strait of Hormuz: 24°N-28°N, 48°E-58°E)
- [ ] `speed` in knots (typical 10-20)
- [ ] `fuel` in tons (typical 500-1000)
- [ ] `cargo` > 0 (ships loaded)
- [ ] `status` is one of: `normal`, `rerouting`, `distressed`, `stopped`, `stranded`, `arrived`, `out_of_fuel`

### Test 8.3: Ships Move Every Tick

Monitor WebSocket messages for 10 seconds:

```json
Tick 1: MV-1 at 26.5000, 55.0000
Tick 2: MV-1 at 26.5001, 55.0005  (moved!)
Tick 3: MV-1 at 26.5002, 55.0010  (moved more!)
```

**Checklist**:

- [ ] Coordinates change between ticks
- [ ] Movement is proportional to speed
- [ ] Direction is consistent (heading toward destination)
- [ ] Fuel decreases: `1000 → 999.99 → 999.98` (per tick, ~0.01 tons)

### Test 8.4: Fuel Calculation

At 15 knots, fuel should burn ~0.01 tons/second:

```
Speed: 15 knots/hour = 0.00417 knots/second
Time: 1 second
Fuel burn: (15 / 3600) * 2.5 tons ≈ 0.0104 tons/sec (wait, this should be per hour)
Actually: (15 / 3600) * 2.5 = 0.0104 tons
```

Monitor: fuel should decrease ~0.01 per tick

**Checklist**:

- [ ] Fuel decreases every tick
- [ ] Rate is consistent
- [ ] Eventually reaches 0 for ships on long voyages

### Test 8.5: Ports Exist and Have Positions

```bash
curl -s http://localhost:3001/api/ports | jq '.data | map({name, lat, lng})'
```

**Checklist**:

- [ ] At least 10 ports
- [ ] Each has: `id`, `name`, `lat`, `lng`, `country`
- [ ] Ports in Strait region
- [ ] Ports include: UAE, Oman, Saudi Arabia

### Test 8.6: Ship Routes to Ports

```bash
curl -s http://localhost:3001/api/ships | jq '.data[0] | {name, destination, destinationPort}'
```

**Checklist**:

- [ ] `destination` is valid port ID or coordinates
- [ ] `destinationPort` matches a port in database
- [ ] Route is being followed (monitor WebSocket)

### Test 8.7: Geofence Detection

After creating test zone, monitor alerts:

```bash
# If a ship route passes through test zone
curl -s http://localhost:3001/api/alerts \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | select(.type=="GEOFENCE_BREACH")'
```

**If zone is in path:**

- [ ] GEOFENCE_BREACH alert fires
- [ ] Alert includes `shipId` and `zoneId`
- [ ] Ship status changes to "rerouting"

**If zone not in path:**

- [ ] No alert fired (correct behavior)

### Test 8.8: Proximity Detection

Monitor alerts for PROXIMITY_WARNING:

```bash
curl -s http://localhost:3001/api/alerts \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | select(.type=="PROXIMITY_WARNING")'
```

**Checklist**:

- [ ] Alerts fire when ships get <2km apart
- [ ] Alert includes both `shipId` and `otherShipId`
- [ ] Cleared when ships move >2km apart

---

## 🤖 Phase 9: AI Integration Verification (5 min)

### Test 9.1: Groq API Configuration

```bash
grep GROQ_API_KEY .env
```

**Checklist**:

- [ ] Key is set (if testing AI) or `# GROQ_API_KEY=` (if skipping)

### Test 9.2: AI Advisory Response

```bash
curl -s http://localhost:3001/api/ai/advisory \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**If GROQ_API_KEY is set (Live AI)**:

- [ ] HTTP 200 response
- [ ] `recommendations` array with real suggestions
- [ ] `overallSituation` describes actual fleet state
- [ ] Response time <5 seconds

**If GROQ_API_KEY not set (Fallback)**:

- [ ] HTTP 200 response
- [ ] Fallback recommendations present
- [ ] Message notes: "Manual review recommended" or similar
- [ ] Still returns valid JSON (not empty)

### Test 9.3: Distress Message Analysis

Create distress via directive escalation:

```bash
# Issue directive
curl -s -X POST http://localhost:3001/api/directives \
  -H "Authorization: Bearer $TOKEN" \
  -i "Content-Type: application/json" \
  -d '{"shipId":"MV-1","type":"TEST"}' | head -20
```

Then captain escalates with message (if UI connected):

```
Captain message: "Engine overheating, crew 4 injured"
```

**Expected AI extraction**:

```json
{
  "severity": "high",
  "issueType": "engine fire or overheating",
  "injuryCount": 4,
  "damageEstimate": "engine damage"
}
```

**Checklist**:

- [ ] If GROQ_API_KEY set: Real extraction from AI
- [ ] If not set: Fallback still processes message
- [ ] No API errors in logs

---

## 🗄️ Phase 10: Database Integrity (5 min)

### Test 10.1: Prisma Connection

```bash
npx prisma db execute --stdin <<EOF
SELECT COUNT(*) as ship_count FROM "Ship";
EOF
```

**Checklist**:

- [ ] Command succeeds
- [ ] Returns `ship_count: 15`
- [ ] No connection errors

### Test 10.2: Data Persistence

Create a zone:

```bash
ZONE_ID=$(curl -s -X POST http://localhost:3001/api/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Persist Test","polygon":[...]}' \
  | jq -r '.data.id')
```

Query database directly:

```bash
npx prisma db execute --stdin <<EOF
SELECT name FROM "RestrictedZone" WHERE id = '$ZONE_ID';
EOF
```

**Checklist**:

- [ ] Zone exists in database
- [ ] Name matches
- [ ] Data persisted across server restarts

### Test 10.3: Playback Snapshots Saved

```bash
npx prisma db execute --stdin <<EOF
SELECT COUNT(*) as snapshot_count FROM "Snapshot";
EOF
```

**After running for 2 minutes:**

- [ ] At least 4 snapshots (one every 30s)
- [ ] Snapshots have timestamps
- [ ] Data includes ship positions

### Test 10.4: Alert History

```bash
npx prisma db execute --stdin <<EOF
SELECT type, COUNT(*) FROM "Alert" GROUP BY type;
EOF
```

**Checklist**:

- [ ] Alert records exist in database
- [ ] Alert types match what was broadcast
- [ ] Timestamps are present

---

## 🚨 Phase 11: Error Handling & Edge Cases (10 min)

### Test 11.1: Missing Authorization Header

```bash
curl -s http://localhost:3001/api/fleet/state | jq '.error'
```

**Checklist**:

- [ ] HTTP 401 Unauthorized
- [ ] Error message clear

### Test 11.2: Invalid JSON Payload

```bash
curl -s -X POST http://localhost:3001/api/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d 'invalid json' | jq '.error'
```

**Checklist**:

- [ ] HTTP 400 Bad Request
- [ ] Error message explains problem

### Test 11.3: Non-Existent Ship

```bash
curl -s http://localhost:3001/api/ships/FAKE-123 | jq '.error'
```

**Checklist**:

- [ ] HTTP 404 Not Found
- [ ] Error message clear

### Test 11.4: Non-Existent Zone

```bash
curl -s -X DELETE http://localhost:3001/api/zones/fake-zone-id \
  -H "Authorization: Bearer $TOKEN" | jq '.error'
```

**Checklist**:

- [ ] HTTP 404 Not Found
- [ ] Zone not deleted

### Test 11.5: Invalid Polygon

```bash
curl -s -X POST http://localhost:3001/api/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bad Zone","polygon":[]}' | jq '.error'
```

**Checklist**:

- [ ] HTTP 400 or 422 response
- [ ] Error explains polygon must have 3+ points

### Test 11.6: Database Down Simulation

Stop backend, try API call:

```bash
curl -s http://localhost:3001/api/ships 2>&1
```

**Checklist**:

- [ ] Connection refused (expected)
- [ ] Clear error message

Restart backend:

```bash
# In original terminal: Ctrl+C
# Then: npm run dev
```

---

## 📋 Final Verification Matrix

| Component          | Test             | Expected           | Status | Notes |
| ------------------ | ---------------- | ------------------ | ------ | ----- |
| **Setup**          | npm install      | ✅ No errors       | ⬜     |       |
| **Database**       | Migrations       | ✅ Files created   | ⬜     |       |
| **Build**          | npm run build    | ✅ Succeeds        | ⬜     |       |
| **Server**         | npm run dev      | ✅ Starts          | ⬜     |       |
| **Ports**          | GET /ports       | ✅ 10+ ports       | ⬜     |       |
| **Ships**          | GET /ships       | ✅ 15 ships        | ⬜     |       |
| **Auth**           | POST /token      | ✅ JWT             | ⬜     |       |
| **Fleet State**    | GET /fleet/state | ✅ Full state      | ⬜     |       |
| **WebSocket**      | ws connect       | ✅ 1Hz broadcast   | ⬜     |       |
| **Zones**          | POST /zones      | ✅ Created         | ⬜     |       |
| **Movement**       | Ships advance    | ✅ Coords change   | ⬜     |       |
| **Geofence**       | Zone creation    | ✅ Detection       | ⬜     |       |
| **Proximity**      | Ships <2km       | ✅ Alert fires     | ⬜     |       |
| **Directives**     | POST /directives | ✅ Issued          | ⬜     |       |
| **Alerts**         | GET /alerts      | ✅ Present         | ⬜     |       |
| **Playback**       | Snapshots        | ✅ Saving          | ⬜     |       |
| **AI**             | GET /ai/advisory | ✅ Recommendations | ⬜     |       |
| **Roles**          | Authorization    | ✅ Enforced        | ⬜     |       |
| **Performance**    | Response time    | ✅ <100ms          | ⬜     |       |
| **Error Handling** | Bad requests     | ✅ Proper errors   | ⬜     |       |

---

## ✅ Sign-Off Checklist

When all tests pass, check these:

- [ ] All 20 components tested successfully
- [ ] No errors in server logs
- [ ] No database errors
- [ ] WebSocket streaming consistently
- [ ] API response times acceptable
- [ ] Authentication working correctly
- [ ] Geospatial calculations functioning
- [ ] Alerts generating properly
- [ ] AI integration (or fallback) working
- [ ] Database persisting data

---

## 🎉 Ready for Next Steps

When all above pass:

1. **Connect Frontend**
   - Set WebSocket URL to `ws://localhost:3001/ws`
   - Create auth flow to get token
   - Start consuming FLEET_STATE messages

2. **Integration Testing**
   - Draw zones on map → verify server receives
   - View ships on map → verify movement
   - Issue directives → verify captain receives
   - Monitor dashboards → verify real-time updates

3. **Deployment**
   - Build Docker image
   - Test in Docker
   - Deploy to Render (backend) + Vercel (frontend)

---

## 🐛 Troubleshooting Reference

| Issue                       | Cause                      | Fix                              |
| --------------------------- | -------------------------- | -------------------------------- |
| "Port 3001 already in use"  | Another process on port    | `lsof -i :3001; kill -9 <PID>`   |
| "Cannot find module"        | Dependencies not installed | `npm install`                    |
| "Database connection error" | Wrong DATABASE_URL         | Verify connection string in .env |
| "WebSocket connect refused" | Backend not running        | `npm run dev`                    |
| "Token expired"             | JWT expired                | Generate new token               |
| "Permission denied"         | Wrong role for endpoint    | Use correct role token           |
| "Geofence not detected"     | Zone not in path           | Create zone in ship's route      |

See [COMPREHENSIVE_TROUBLESHOOTING.md](./COMPREHENSIVE_TROUBLESHOOTING.md) for detailed help.

---

**Print this checklist and mark items as you complete them. Total time: ~90-120 minutes from zero to full system verification.**
