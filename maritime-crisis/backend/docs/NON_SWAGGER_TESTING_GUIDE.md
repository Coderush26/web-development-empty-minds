# Non-Swagger Testing Guide

## Purpose

Some backend features are not fully testable through Swagger UI alone.
This guide collects the manual checks you should use for those features.

The main non-Swagger areas are:

- WebSocket real-time updates
- server health and root endpoints
- frontend-style connection tests
- long-running live simulator observation

---

## 1. WebSocket testing

Use [WEBSOCKET_TESTING.md](./WEBSOCKET_TESTING.md) for the full real-time guide.

### Quick check

- Connect to `ws://localhost:3001/ws?role=command`
- Confirm the first message is `FLEET_STATE`
- Send `PING`
- Confirm `PONG`

This is the most important non-Swagger test.

---

## 2. Root endpoint test

The root endpoint is a simple manual check that the backend is alive.

### URL

- `GET http://localhost:3001/`

### What to verify

- service name is returned
- status is `online`
- documentation links are present
- fleet summary exists

### How to test

Use one of these:

- browser address bar
- `curl`
- Postman GET request

This is useful for a quick smoke test after startup.

---

## 3. Health endpoint test

### URL

- `GET http://localhost:3001/health`

### Expected result

A small JSON response like:

- `status: ok`
- current timestamp

### Why it matters

This is the simplest service-health check and should stay available even when you do not use Swagger.

---

## 4. Swagger JSON test

Even though Swagger UI is already available, the raw OpenAPI JSON is sometimes useful for automation or debugging.

### URL

- `GET http://localhost:3001/api-docs.json`

### Use cases

- import into Postman
- verify schema changes
- compare documentation versions
- generate clients later

---

## 5. Live simulator observation

This system is partly a real-time simulation, so some behavior is best observed over time.

### What to observe

- ship positions changing every second
- fuel decreasing
- alerts appearing when incidents occur
- zones affecting route behavior
- snapshots being stored over time

### Best ways to observe

- Swagger UI for control actions
- WebSocket for live updates
- repeated `GET /ships` or `GET /fleet/state` calls for polling

---

## 6. Manual end-to-end validation flow

This flow combines Swagger and non-Swagger checks.

### Step 1

Open [Swagger UI](./SWAGGER_TESTING.md) and create a zone or directive.

### Step 2

Open a WebSocket client and watch for the broadcast event.

### Step 3

Call `GET /ships` or `GET /fleet/state` and confirm the state changed.

### Step 4

Use `GET /playback/snapshots` to confirm the event is captured in history.

This proves the system is not only responding to HTTP requests, but also propagating state correctly in real time.

---

## 7. Frontend readiness checks

Before frontend integration, verify these manually:

- WebSocket connects reliably
- live events arrive without page refresh
- root and health endpoints are stable
- Swagger API calls update the live socket view
- multiple clients can connect simultaneously

If all of these work, the backend is ready for frontend binding.

---

## 8. Tools you can use

### Postman

Use Postman for:

- HTTP endpoints
- WebSocket endpoint testing
- saving reusable requests

### Browser

Use the browser for:

- root and health URLs
- Swagger UI
- quick WebSocket testing via DevTools

### cURL

Use cURL for:

- quick smoke tests
- shell scripts
- CI-style checks

### WebSocket CLI

Use `wscat` or similar for:

- pure socket testing
- quick ping/pong checks
- automation from terminal

---

## 9. Recommended order of testing

1. `GET /health`
2. `GET /`
3. `GET /api-docs`
4. `GET /api-docs.json`
5. Swagger token flow
6. WebSocket connection test
7. WebSocket `PING` / `PONG`
8. Create a zone or directive in Swagger
9. Confirm real-time WebSocket broadcast
10. Confirm snapshots and playback

---

## 10. Troubleshooting

### Root or health fails

- backend is not running
- wrong port
- startup failed before HTTP bind

### WebSocket fails but HTTP works

- wrong path
- wrong protocol
- client did not use `/ws`
- firewall or proxy issue

### Events are missing

- no trigger action was performed
- simulator has not produced the event yet
- client connected after the event already happened

---

## Files involved

- `src/app.ts` — root, health, Swagger UI
- `src/server.ts` — server startup and socket attachment
- `src/websocket/ws-manager.ts` — live socket logic
- `src/simulation/simulator.ts` — live updates
- `src/playback/playback-service.ts` — history capture

---

## Final note

If a feature needs real-time observation or continuous state change, Swagger UI alone is not enough.
Use this guide together with the WebSocket guide for full verification.
