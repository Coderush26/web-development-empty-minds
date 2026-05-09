# WebSocket Testing Guide

## Purpose

This guide explains how to verify the real-time WebSocket channel in the Maritime Crisis backend before integrating it into the frontend.

The WebSocket server is used for live updates such as:

- full fleet state on connect
- alert broadcasts
- zone updates
- directive events
- ongoing simulator updates

---

## WebSocket endpoint

- **URL**: `ws://localhost:3001/ws`
- **Protocol**: WebSocket
- **Auth**: No JWT yet
- **Role selection**: query parameters

### Query parameters

- `role=command` or `role=captain`
- `shipId=MV-1` only when testing a captain session

### Examples

- Command client:
  - `ws://localhost:3001/ws?role=command`
- Captain client:
  - `ws://localhost:3001/ws?role=captain&shipId=MV-1`

---

## What happens on connect

As soon as a client connects, the server sends:

- `FLEET_STATE`

This message contains the full current fleet snapshot.

That is the first sign that the socket is working.

---

## Supported incoming messages from client

Right now the backend supports one simple test message:

- `PING`

Expected reply:

- `PONG`

This is useful for checking two-way communication.

---

## Broadcast events you should expect

The server can broadcast these live events:

- `FLEET_STATE`
- `ZONE_ADDED`
- `ZONE_REMOVED`
- `DIRECTIVE_ISSUED`
- `DIRECTIVE_RESPONDED`
- `ALERT_FIRED`
- other simulator-driven state messages

Some of these are triggered by REST actions, so the best WebSocket test is to open the socket and then perform API actions in Swagger UI or Postman.

---

## Test method 1: Postman

Postman can connect to WebSocket endpoints directly.

### Steps

1. Open Postman
2. Click **New**
3. Choose **WebSocket Request**
4. Enter:
   - `ws://localhost:3001/ws?role=command`
5. Click **Connect**
6. Watch for the first message
   - you should receive `FLEET_STATE`
7. Send a test message:

   ```json
   { "type": "PING" }
   ```

8. Confirm the reply:

   ```json
   { "type": "PONG" }
   ```

### Captain session test

Repeat with:

- `ws://localhost:3001/ws?role=captain&shipId=MV-1`

You should still receive `FLEET_STATE` on connect.

---

## Test method 2: Browser DevTools console

This is the fastest manual test.

### Steps

1. Start the backend with `npm run dev`
2. Open any browser tab
3. Open DevTools console
4. Paste this code:

```javascript
const ws = new WebSocket("ws://localhost:3001/ws?role=command");

ws.onopen = () => {
  console.log("socket open");
  ws.send(JSON.stringify({ type: "PING" }));
};

ws.onmessage = (event) => {
  console.log("message:", JSON.parse(event.data));
};

ws.onerror = (err) => console.log("error:", err);
ws.onclose = () => console.log("socket closed");
```

### What to verify

- socket opens successfully
- first message is `FLEET_STATE`
- `PING` returns `PONG`
- no connection error appears

---

## Test method 3: Browser-based mini test page

If you want a reusable HTML test page, create a temporary file and open it in the browser:

```html
<!doctype html>
<html>
  <body>
    <button id="connect">Connect</button>
    <button id="ping">PING</button>
    <pre id="log"></pre>
    <script>
      let ws;
      const log = (msg) =>
        (document.getElementById("log").textContent += msg + "\n");

      document.getElementById("connect").onclick = () => {
        ws = new WebSocket("ws://localhost:3001/ws?role=command");
        ws.onopen = () => log("connected");
        ws.onmessage = (e) => log(e.data);
        ws.onerror = () => log("error");
        ws.onclose = () => log("closed");
      };

      document.getElementById("ping").onclick = () => {
        ws?.send(JSON.stringify({ type: "PING" }));
      };
    </script>
  </body>
</html>
```

---

## Test method 4: CLI tools

If you prefer terminal testing, you can use a WebSocket CLI such as `wscat`.

### Example

1. Install the tool globally if needed
2. Connect to the server:
   - `ws://localhost:3001/ws?role=command`
3. Send:
   - `{"type":"PING"}`
4. Confirm the response is `PONG`

This is useful when you want to test outside the browser entirely.

---

## End-to-end real-time test flow

This is the best full test for frontend readiness.

### Scenario

1. Open one WebSocket client as Command
2. Open another WebSocket client as Captain for `MV-1`
3. Confirm both get `FLEET_STATE`
4. In Swagger UI, create a restricted zone
5. Observe `ZONE_ADDED` in the WebSocket clients
6. Issue a directive to a ship
7. Observe `DIRECTIVE_ISSUED`
8. Respond to the directive as captain
9. Observe `DIRECTIVE_RESPONDED`
10. Wait for simulator activity and watch state updates continue

If those steps work, the socket path is functioning correctly.

---

## What frontend integration should do later

The frontend should:

- open the socket when the app starts
- show live fleet state from the first `FLEET_STATE`
- keep a single shared socket connection
- reconnect on disconnect
- update the map and panels from incoming events
- optionally filter by role if the UI has separate command and captain views

---

## Troubleshooting

### No connection

- confirm backend is running on port 3001
- ensure the URL is exactly `ws://localhost:3001/ws`
- check that your client is using WebSocket, not plain HTTP

### Connected but no messages

- wait a few seconds for simulator activity
- check browser console or Postman message log
- verify the server log says the client connected

### `PING` does not return `PONG`

- send valid JSON
- make sure the message type is exactly `PING`
- check whether the socket is still open

### Captain role issues

- include `shipId` in the query string
- use a valid ship ID such as `MV-1`

---

## Files involved

- `src/websocket/ws-manager.ts` — connection, broadcast, ping/pong
- `src/server.ts` — WebSocket attachment to HTTP server
- `src/simulation/simulator.ts` — live fleet updates
- `src/alerts/alert-engine.ts` — alert broadcasts
- `src/controllers/zone.controller.ts` — zone events
- `src/controllers/directive.controller.ts` — directive events

---

## Quick success checklist

- [ ] WebSocket connects without error
- [ ] First message is `FLEET_STATE`
- [ ] `PING` returns `PONG`
- [ ] `ZONE_ADDED` appears after creating a zone
- [ ] `DIRECTIVE_ISSUED` appears after issuing a directive
- [ ] `DIRECTIVE_RESPONDED` appears after captain response
- [ ] Multiple clients can connect at the same time
