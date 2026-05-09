# Auth and Role Flow Guide

## Purpose of this system

This backend does **not** use a traditional username/password login flow yet.
Instead, it uses a **role token model**:

- `command` = operator / command center access
- `captain` = a ship-scoped operator for one assigned ship

The token is a JWT that carries the role and, for captains, the assigned `shipId`.
That token is what the backend uses to decide whether a request is allowed.

---

## Short answer

If you open Swagger UI and want to test protected endpoints:

1. Call the token endpoint first.
2. Copy the returned JWT token.
3. Click **Authorize** in Swagger UI.
4. Paste the token as a Bearer token.
5. Call the protected APIs.

That is how the current system works.

---

## What is happening internally?

### 1) No real login screen exists

There is currently:

- no user database for login accounts
- no password validation
- no identity provider like Auth0, Clerk, or Keycloak

So the backend is not checking “who the person is” in a business sense.
It is only checking “what role this token represents”.

---

### 2) The backend issues a JWT role token

The token is created by `POST /auth/token`.

The token payload includes:

- `role`: `command` or `captain`
- `shipId`: only for captain tokens
- `sessionId`: random identifier

This is generated in the backend middleware and signed with `JWT_SECRET`.

---

### 3) Protected routes read the JWT

When a request hits a protected endpoint:

- `requireAuth` checks that a Bearer token exists and is valid
- `requireRole("command")` checks that the token role is `command`
- `requireShipAccess()` checks that a captain token is only acting on its own ship

So the role does **not** come from the frontend UI itself.
It comes from the JWT token that the frontend sends.

---

## Where do `command` and `captain` come from?

They come from the token generation step.

### Command role

A command token is used for:

- creating restricted zones
- issuing directives
- acknowledging alerts
- requesting AI advisory
- full control operations

### Captain role

A captain token is used for:

- ship-scoped actions
- responding to directives for one assigned ship

In this backend, a captain token is tied to a specific `shipId`.
That means the backend expects the captain to act only on that ship.

---

## How Swagger UI should be used

Swagger UI is only a testing console.
It does not create a real login account.
It helps you simulate a role-based session.

### What the token endpoint accepts

`POST /auth/token` now accepts the role in **either** of these forms:

- query parameters, for example `?role=command`
- JSON body, for example `{ "role": "command" }`

That means Swagger UI, curl, or the frontend can use whichever is easier.

This is important because the earlier crash happened when the endpoint was called with no parsed body.
The controller now safely reads both `req.body` and `req.query`.

### Steps

#### Option A: Test as Command

1. Open `/api-docs`
2. Expand `POST /auth/token`
3. Request a token with role `command`
4. Copy the token from the response
5. Click **Authorize**
6. Paste the token as `Bearer <token>`
7. Call command-protected endpoints

#### Option B: Test as Captain

1. Open `/api-docs`
2. Expand `POST /auth/token`
3. Request a token with role `captain` and a valid `shipId`
4. Copy the token from the response
5. Click **Authorize**
6. Paste the token as `Bearer <token>`
7. Call captain-scoped endpoints

---

## What the frontend would do later

When a frontend is built, it will need a simple auth wrapper:

1. User selects a role or signs in through a real auth provider later
2. Frontend requests a token from backend or identity provider
3. Frontend stores the token in memory or secure storage
4. Frontend sends the token in the `Authorization` header
5. Backend reads the token and authorizes the request

So the frontend does not invent the role.
It only forwards the token that contains the role.

---

## Current request flow

### Protected request example

1. Frontend or Swagger sends `Authorization: Bearer <JWT>`
2. Backend extracts token
3. Backend verifies signature with `JWT_SECRET`
4. Backend reads `role` and `shipId`
5. Middleware allows or rejects the request

---

## Middleware behavior

### `requireAuth`

Used when any authenticated token is required.

Examples:

- `GET /auth/me`
- `GET /alerts`
- `GET /directives`
- `GET /playback/snapshots`

### `requireRole("command")`

Used when only command role is allowed.

Examples:

- `POST /zones`
- `POST /directives`
- `POST /alerts/:id/acknowledge`
- `GET /ai/advisory`

### `requireShipAccess("shipId")`

Used when a captain may only act on their own ship.

Example:

- `POST /directives/:directiveId/respond`

---

## Similar routes that were hardened

The same empty-body safety pattern is also applied to other write endpoints that used direct destructuring:

- `POST /zones`
- `POST /directives`
- `POST /directives/:directiveId/respond`

These routes now return a clean `400 Bad Request` if required fields are missing, instead of crashing the server.

That is the correct behavior for Swagger testing and for future frontend integration.

---

## Important limitation

This is a **simulated authorization system**, not a real enterprise identity system.
It is good for:

- API testing
- role separation
- ship-scoped control
- frontend/backend integration work

It is **not yet** a real login platform.

---

## What this means for your product right now

### If you want to test quickly

Use the existing token system.
It is enough for Swagger UI and frontend development.

### If you want real users later

Then this system should be replaced or extended with:

- email/password login
- SSO
- OAuth2 / OpenID Connect
- RBAC from a user database
- captain assignments stored in DB

---

## Recommended testing path in Swagger UI

### Command testing

- get command token
- authorize
- test zones, directives, alerts, AI

### Captain testing

- get captain token for a ship
- authorize
- test ship response endpoint

### Public testing

No token required for:

- `GET /ships`
- `GET /ports`
- `GET /fleet/state`
- `GET /fleet/stats`
- `GET /zones`

---

## Current truth in one line

The backend does **not** know real users yet; it only trusts the JWT role you generate through the token endpoint.

---

## Files involved

- `src/middleware/auth.ts` — token creation and authorization checks
- `src/controllers/auth.controller.ts` — token endpoint
- `src/routes.ts` — route protection rules
- `src/config/swagger.json` — Swagger auth documentation

---

## Next decision point

At this stage you can choose one of two directions later:

1. **Eliminate the role-token system** and keep everything public or manually controlled
2. **Enhance it** into a real login and identity system with persistent users and assignments

This guide is written so either path can be chosen cleanly later.
