# Comprehensive Troubleshooting & Testing Guide

## Problem: Groq API Fallback Being Used Despite Setting GROQ_API_KEY

### Root Cause Analysis

When you see:

```json
{
  "success": true,
  "data": {
    "recommendations": [],
    "overallSituation": "Fleet is operating. Manual review recommended."
  }
}
```

This is the **hardcoded fallback** from `src/ai/ai-service.ts` line ~183-200. This happens when:

1. **`config.groqApiKey` is empty or not defined** — typically because:
   - `GROQ_API_KEY` env var was **not set before the backend started**
   - Or the backend was **not rebuilt/restarted** after adding the env var
   - Or the env var was set in one shell but the backend started in a different shell/context

2. **Token validation now passes** (you're getting a 200 response) because the auth fix and new development debug mode are working.

3. **The startup log shows presence/absence** — look for:
   ```
   [startup] GROQ_API_KEY: present; JWT_SECRET: present
   ```
   or
   ```
   [startup] GROQ_API_KEY: missing; JWT_SECRET: present
   ```

### CRITICAL FIX: Groq Model Decommissioned

**If you see Groq API errors like:**

```
Groq API error 400: {"error": {"message": "model_decommissioned"}}
```

**This means**: The model `llama3-8b-8192` (previously used) is no longer available from Groq.

**Solution** ✅ **ALREADY APPLIED**:

- Updated model to `mixtral-8x7b-32768` (stable, performant)
- File: `src/ai/ai-service.ts` line 8
- Changes already compiled into `dist/ai/ai-service.js`

**To test if Groq now works**:

```bash
cd backend
GROQ_API_KEY="gsk_YOUR_KEY" node test-groq-api.js
```

Expected output:

```
✅ Groq API call succeeded
📋 Response: { "choices": [...], "model": "mixtral-8x7b-32768", ... }
```

---

## Step-by-Step Diagnostic & Fix

### 1. Verify Your Groq API Key

Before running anything, ensure you have a valid Groq API key:

- Get it from [console.groq.com](https://console.groq.com)
- Copy the full key (looks like `gsk_...`)
- Keep it safe; do not commit it to git

### 2. Stop the Running Backend (if any)

```bash
# Kill any running Node process
pkill -f "node.*src/server" || true
# or Ctrl+C in the terminal where backend is running
```

### 3. Clean Build & Restart with GROQ_API_KEY

Choose **one** of these approaches:

#### **Approach A: Set env var in shell, then run** (Recommended for quick testing)

```bash
cd /home/mhamza/sem6/web-development-empty-minds/maritime-crisis/backend

# Set the env var in THIS shell session
export GROQ_API_KEY="gsk_YOUR_ACTUAL_KEY_HERE"
export JWT_SECRET="my-secret-key-min-32-chars-long-123456"
export NODE_ENV="development"

# Rebuild TypeScript
npm run build

# Start the backend
npm start
```

**Expected output on startup (first lines of console):**

```
[startup] GROQ_API_KEY: present; JWT_SECRET: present
Server running on port 3001
Database connected
```

#### **Approach B: Use `.env` file** (Recommended for persistent local dev)

1. Create `.env` file in backend root:

   ```bash
   cd /home/mhamza/sem6/web-development-empty-minds/maritime-crisis/backend
   cat > .env << 'EOF'
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/maritime"
   GROQ_API_KEY="gsk_YOUR_ACTUAL_KEY_HERE"
   JWT_SECRET="my-secret-key-min-32-chars-long-123456"
   NODE_ENV="development"
   PORT="3001"
   WS_PORT="3001"
   EOF
   ```

2. Rebuild and start:

   ```bash
   npm run build
   npm start
   ```

3. **Verify**:
   ```bash
   # You should see in logs:
   # [startup] GROQ_API_KEY: present; JWT_SECRET: present
   ```

#### **Approach C: Use Docker Compose** (For isolated environment)

```bash
cd /home/mhamza/sem6/web-development-empty-minds/maritime-crisis/backend

# Edit docker-compose.yml to include GROQ_API_KEY in environment:
nano docker-compose.yml
# Add to services.backend.environment:
#   GROQ_API_KEY: "gsk_YOUR_ACTUAL_KEY_HERE"

# Build and run
docker-compose down && docker-compose up --build
```

---

## Test Commands

Once the backend is running with `[startup] GROQ_API_KEY: present`, test the following:

### Test 0: Direct Groq API Test (Quick Validation)

**Before starting the backend, verify Groq API is reachable:**

```bash
cd backend
GROQ_API_KEY="gsk_YOUR_ACTUAL_KEY" node test-groq-api.js
```

**Expected output if Groq works:**

```
🔍 Testing Groq API...
📌 Model: mixtral-8x7b-32768
✅ Groq API call succeeded
💬 Assistant message: {...}
```

**If you see `model_decommissioned`**, ensure you ran `npm run build` after the model was updated.

### Test 1: Get Auth Token

```bash
curl -X POST "http://localhost:3001/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"role": "command", "shipId": "MV-1"}' \
  | jq .
```

**Expected response:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "command",
    "shipId": "MV-1",
    "expiresIn": "24h"
  },
  "timestamp": 1778321470955
}
```

**Copy the token value** (without quotes).

### Test 2: Call AI Advisory with Token

```bash
# Save your token in a variable
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET "http://localhost:3001/api/ai/advisory" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq .
```

**Expected response (if Groq is called successfully):**

```json
{
  "success": true,
  "data": {
    "recommendations": [
      "Monitor fuel consumption on MV-1...",
      "Consider rerouting..."
    ],
    "overallSituation": "Fleet status nominal with minor advisory items."
  },
  "timestamp": 1778322014618
}
```

**Or if Groq API call fails:**

```json
{
  "success": false,
  "error": "Groq API error 401: Invalid API key",
  "timestamp": 1778322014618
}
```

(This is **good** — it means the key was attempted; you just need to verify the key is correct.)

### Test 3: Check Server Logs for Groq Call Evidence

While the curl request is in flight, watch the backend terminal for:

```
[AI Service] Calling Groq API
[AI Service] Distress analysed ...
```

or error like:

```
[AI Service] Groq API error 401
```

If you see neither, then `config.groqApiKey` is still empty.

### Test 4: Test Token Validation Debug

If you got "Invalid or expired token" earlier, test the new debug feature:

```bash
# Use a malformed token
curl -X GET "http://localhost:3001/api/ai/advisory" \
  -H "Authorization: Bearer bad_token" \
  | jq .
```

**Expected response (in development mode):**

```json
{
  "success": false,
  "error": "Invalid or expired token",
  "timestamp": 1778322014618,
  "debug": "JsonWebTokenError: invalid token" // <-- This is NEW
}
```

The `debug` field tells you **why** the token failed (only in development).

---

## A\* Grid Resolution Testing

### What Grid Resolution Does

- **Higher value (e.g., 0.5°)** = Coarser grid, faster A\*, but may miss narrow passages
- **Lower value (e.g., 0.05°)** = Finer grid, slower A\*, but finds more paths

### Run the Reproduction Script

#### Build first:

```bash
npm run build
```

#### Then run with different grid resolutions:

**Test 1: Coarse grid (0.5° — likely to fail finding paths)**

```bash
GRID_RES_DEG=0.5 node dist/routing/astar-repro.js
```

**Expected output:**

```
== Route repro test ==
Effective GRID_RES_DEG: 0.5
{
  "path": [
    {"lat": 26.4, "lng": 51.5},
    {"lat": 26.0, "lng": 55.5}
  ],
  "distanceKm": 294.8,
  "reachable": false  // <-- FAILS (too coarse)
}
```

**Test 2: Default grid (0.15°)**

```bash
GRID_RES_DEG=0.15 node dist/routing/astar-repro.js
```

**Expected output:**

```
== Route repro test ==
Effective GRID_RES_DEG: 0.15
{
  "path": [...waypoints...],
  "distanceKm": 312.4,
  "reachable": true  // <-- SUCCESS
}
```

**Test 3: Fine grid (0.05° — slower but very likely to find paths)**

```bash
GRID_RES_DEG=0.05 node dist/routing/astar-repro.js
```

**Expected output:**

```
== Route repro test ==
Effective GRID_RES_DEG: 0.05
{
  "path": [...more_waypoints...],
  "distanceKm": 310.2,
  "reachable": true  // <-- SUCCESS
}
```

### Observe the Trade-offs

Compare the outputs:

- **Coarse (0.5)**: Fast but `reachable: false`
- **Default (0.15)**: Balanced
- **Fine (0.05)**: Slower but `reachable: true`

You can adjust the default in `.env`:

```
GRID_RES_DEG=0.08  # or any value
```

Then rebuild and restart.

---

## Real-Time Ship Movement Diagnostic

Ships should update their position every `TICK_INTERVAL_MS` (default 1000ms = 1 second) and broadcast via WebSocket.

### Check 1: Backend Logs

Look for lines like:

```
[Simulator] Tick #42: 5 ships updated
Broadcast: type=FLEET_STATE, clients=2
```

If you **don't** see these, the simulator may not be running. Check for:

```
[Simulator] Started
```

### Check 2: WebSocket Connection from Browser

Open browser DevTools → Network → WS tab, and connect to:

```javascript
const ws = new WebSocket("wss://localhost:3001/ws?role=command&shipId=MV-1");
ws.onmessage = (e) => console.log("received:", JSON.parse(e.data));
```

You should see `FLEET_STATE` messages arriving every ~1 second.

### Check 3: Frontend Issue vs Backend

| Frontend updates but ships don't move | ✓ Backend sends FLEET_STATE; ✗ Frontend not applying position updates |
| Ships don't appear at all | ✗ Frontend not connected to WS or not rendering ships |
| WebSocket connects but no messages | ✗ Backend not broadcasting; check simulator logs |

---

## Quick Sanity Checks

| Check                    | Command                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| Is backend running?      | `curl http://localhost:3001/api/health` (if exists) or `npm start` output |
| Is database connected?   | Look for "Database connected" in logs                                     |
| Is WebSocket listening?  | Look for "WebSocket server attached" in logs                              |
| Is simulator running?    | Look for "[Simulator] Started" in logs                                    |
| Is GROQ_API_KEY set?     | Look for `[startup] GROQ_API_KEY: present` in logs                        |
| Is NODE_ENV=development? | Check logs or `echo $NODE_ENV`                                            |

---

## Recommended Next Steps

1. **Copy this guide** and follow **Approach A or B** above to restart with `GROQ_API_KEY`
2. **Verify startup log** shows `GROQ_API_KEY: present`
3. **Run Test Commands** to confirm Groq is being called
4. **Run A\* script** with different grid resolutions to see the trade-off
5. **Check WebSocket** in browser DevTools to confirm ship updates are broadcasting
6. **Share any errors** from Test 2 (AI Advisory response) and I can help debug further
