# Swagger UI - API Testing Guide

## 🚀 Quick Start

Once the backend is running on `http://localhost:3001`, visit:

**https://localhost:3001/api-docs**

You'll see the interactive Swagger UI with all endpoints, request/response examples, and the ability to test them directly.

---

## 📖 What's Documented

All **32 API endpoints** are fully documented with:

- ✅ Request parameters & body schemas
- ✅ Response schemas with examples
- ✅ Authentication requirements (JWT Bearer token)
- ✅ Role-based access (Command vs Captain)
- ✅ HTTP status codes and error descriptions
- ✅ Real data examples from fleet.json

---

## 🔐 Authentication in Swagger

### Step 1: Get a Token

1. Click on **"POST /auth/token"** under the Authentication section
2. Click **"Try it out"**
3. In the query parameters:
   - **role**: Select `command` or `captain`
   - **shipId**: If `captain`, enter a ship ID like `MV-1`
4. Click **"Execute"**
5. Copy the `token` from the response

### Step 2: Authorize All Subsequent Requests

1. Look for the green **"Authorize"** button at the top right of Swagger UI
2. Click it
3. Paste the token in the text field (without "Bearer" prefix)
4. Click **"Authorize"**
5. Now all subsequent requests will include this token automatically

---

## 📝 Testing Common Workflows

### **Workflow 1: View Live Fleet**

Goal: See all ships moving in real-time

1. **GET /ships** (no auth required)
   - Lists all 15 ships with current positions, speeds, fuels, etc.
   - **Execute** → See the live fleet state

2. **GET /fleet/state**
   - Gets ships + ports + zones in one call
   - Good for initial map load

3. **GET /fleet/stats**
   - Aggregated metrics: active ship count, average fuel, alert count, etc.

---

### **Workflow 2: Command Issues Directive to Ship**

Goal: Have Command tell a ship to reroute

1. **Authenticate as Command** (see Step 2 above)

2. **POST /directives**
   - Request body:

   ```json
   {
     "shipId": "MV-1",
     "type": "REROUTE_PORT",
     "payload": {
       "portId": "DOH-1"
     }
   }
   ```

   - **Execute** → Directive created with `status: PENDING`

3. Check the directive was created:
   - **GET /directives** → See all directives

---

### **Workflow 3: Captain Responds to Directive**

Goal: Ship captain accepts or escalates

1. **Authenticate as Captain** for the specific ship
   - role: `captain`
   - shipId: `MV-1`
   - Get the token and authorize

2. **GET /directives** (as Captain)
   - See directives pending for your ship

3. **POST /directives/{directiveId}/respond**
   - Option A (Accept):
   ```json
   {
     "response": "ACCEPT"
   }
   ```

   - Option B (Escalate with distress):
   ```json
   {
     "response": "ESCALATE_DISTRESS",
     "distressMessage": "Engine overheating. Cannot comply with reroute order. Requesting emergency port visit."
   }
   ```

   - **Execute** → Directive updated, if escalated then alerts fired

---

### **Workflow 4: Command Draws Restricted Zone**

Goal: Create a no-go zone that ships avoid

1. **Authenticate as Command**

2. **POST /zones**
   - Request body (example: small zone near Muscat):

   ```json
   {
     "name": "Military Exercise Zone A",
     "polygon": [
       { "lat": 23.8, "lng": 58.3 },
       { "lat": 23.8, "lng": 58.6 },
       { "lat": 24.0, "lng": 58.6 },
       { "lat": 24.0, "lng": 58.3 },
       { "lat": 23.8, "lng": 58.3 }
     ]
   }
   ```

   - **Execute** → Zone created, ships will detect it and reroute

3. **GET /zones**
   - See all active zones

4. **Watch for alerts**:
   - **GET /alerts** → See any `GEOFENCE_BREACH` alerts if ships were inside

---

### **Workflow 5: Monitor Alerts (Real-time via WebSocket, HTTP polling for testing)**

Goal: Stay aware of all fleet incidents

1. **Authenticate as Command**

2. **GET /alerts**
   - Optional query:
     - `limit`: 100 (default)
     - `severity`: "critical", "high", "medium", "low"
   - **Execute** → See proximity warnings, geofence breaches, etc.

3. **POST /alerts/{alertId}/acknowledge**
   - Mark an alert as acknowledged
   - Pass the alertId from the GET response

---

### **Workflow 6: Playback Fleet History**

Goal: Scrub back through time to see what happened

1. **Authenticate as Command**

2. **GET /playback/snapshots**
   - Lists available snapshots (30-second intervals, last 1 hour)
   - Find a time window you want to review

3. **GET /playback/snapshots/{timestamp}**
   - Pass a Unix timestamp (milliseconds) from the snapshot list
   - **Execute** → Get fleet state, alerts, zones at that exact moment

---

### **Workflow 7: Get AI Advisory**

Goal: Ask AI for proactive recommendations

1. **Authenticate as Command**

2. **GET /ai/advisory**
   - **Execute** → Get AI suggestions like:
     - "Ship MV-5 running low on fuel, consider rerouting"
     - "Proximity warning imminent between MV-2 and MV-3"
   - (Or fallback if GROQ_API_KEY not set)

---

## 🎯 Example: Full End-to-End Test

### Scenario: Watch ship MV-1, draw a zone, see alert

```
1. GET /ships/MV-1
   → Position: (26.55, 56.2), Speed: 14 knots, Heading: 105°

2. GET /zones
   → Currently no zones

3. POST /zones (as Command)
   → Create zone around current path

4. Watch GET /alerts
   → See GEOFENCE_BREACH if ship enters the zone

5. POST /zones/{zoneId} DELETE (as Command)
   → Remove zone, check fleet resumes original heading

6. GET /playback/snapshots
   → See timeline of events captured
```

---

## 🔧 Troubleshooting Swagger UI

| Issue                                 | Solution                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| "404 Not Found" at `/api-docs`        | Ensure backend is running (`npm run dev`)                                              |
| "Unauthorized" on protected endpoints | Click "Authorize" button and paste your token                                          |
| Token won't save                      | Make sure to remove "Bearer " prefix if you included it                                |
| Endpoint returns 401 even with token  | Your role doesn't have permission for that endpoint (e.g., Captain can't create zones) |
| Can't find {shipId} parameter         | Copy exact ship ID from `/ships` response (e.g., `MV-1`, not `Aurora`)                 |

---

## 📊 Key Endpoints by Use Case

### **For Frontend Integration Testing**

- `GET /ships` - Ship positions (poll or use WebSocket)
- `GET /zones` - Restricted zones
- `GET /alerts` - Alert list
- `GET /fleet/state` - Full state for map initialization

### **For Command Interface**

- `POST /zones` - Draw zone
- `DELETE /zones/{id}` - Remove zone
- `POST /directives` - Issue orders
- `POST /alerts/{id}/acknowledge` - Mark alert handled
- `GET /ai/advisory` - Get suggestions

### **For Captain Interface**

- `GET /ships/{shipId}` - Own ship details
- `GET /directives` - Pending orders
- `POST /directives/{id}/respond` - Accept/escalate
- (Captain sees own ship, Command sees all)

---

## 🚀 Next Steps

✅ Test all endpoints here in Swagger  
✅ Familiarize yourself with request/response formats  
✅ Once confident, integrate frontend with `/api` endpoints  
✅ Use WebSocket for real-time updates instead of polling

---

**Happy Testing! 🎉**
