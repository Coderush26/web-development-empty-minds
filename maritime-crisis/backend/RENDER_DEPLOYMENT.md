# Render Deployment Guide for Maritime Crisis Backend

## Prerequisites

- Render.com account (free tier available)
- PostgreSQL database (Render provides a free-tier option, or use Supabase)
- GitHub repository connected to Render
- Environment variables prepared

---

## Step 1: Prepare your repository

Ensure these files are in `maritime-crisis/backend/`:

- ✅ `Dockerfile`
- ✅ `package.json`
- ✅ `tsconfig.json`
- ✅ `prisma/schema.prisma`
- ✅ `.env` (or will be set as environment variables in Render)

---

## Step 2: Set up PostgreSQL on Render

### Option A: Use Render's PostgreSQL

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **PostgreSQL**
3. Configure:
   - Name: `maritime-crisis-db`
   - Database: `maritime_crisis`
   - User: `postgres` (or custom)
   - Region: same as backend
4. Create the database
5. Copy the **Internal Database URL** (for backend to use)
6. Note the **External Database URL** (for local migrations if needed)

### Option B: Use Supabase (recommended, more features)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Project Settings** → **Database**
3. Copy the **Connection String** (Standard)
4. Use this as `DATABASE_URL`

---

## Step 3: Create the Web Service on Render

### 3.1: Create the service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configuration:
   - **Name**: `maritime-crisis-backend`
   - **Root Directory**: `maritime-crisis/backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run prisma:generate && npm run build`
   - **Start Command**: `node dist/server.js`
   - **Plan**: Free or paid (your choice)
   - **Region**: Choose one close to your users

### 3.2: Set Environment Variables

Click **Environment** and add:

```
DATABASE_URL=postgresql://user:password@your-db-host/maritime_crisis
DIRECT_URL=postgresql://user:password@your-db-host/maritime_crisis
JWT_SECRET=your-very-secret-key-generate-a-long-random-string
GROQ_API_KEY=optional-your-groq-key
FRONTEND_URL=https://your-frontend-domain.com
NODE_ENV=production
PORT=3001
TICK_INTERVAL_MS=1000
```

**Important**: Generate a strong `JWT_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.3: Deploy

1. Click **Create Web Service**
2. Render will start the build process
3. Watch the logs to confirm:
   - Dependencies installed ✅
   - TypeScript compiled ✅
   - Prisma generated ✅
   - Server started ✅

---

## Step 4: Verify Deployment

### Check health endpoints

```bash
# Health check
curl https://your-service.onrender.com/health

# Root endpoint
curl https://your-service.onrender.com/

# Swagger UI
https://your-service.onrender.com/api-docs
```

All should return `200 OK`.

### Test WebSocket connection

```javascript
// From browser console or Node script
const ws = new WebSocket("wss://your-service.onrender.com/ws?role=command");
ws.onopen = () => console.log("Connected");
ws.onmessage = (e) => console.log("Message:", e.data);
```

**Note**: Use `wss://` (secure WebSocket) on Render, not `ws://`

---

## Step 5: Database Migrations

The build command runs `prisma:generate`, which sets up the Prisma client.

To run migrations during deployment:

### Option A: Automatic on startup (recommended)

Modify `src/server.ts` to run migrations before starting:

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Before starting server
async function runMigrations() {
  try {
    await execAsync("npx prisma migrate deploy");
    logger.info("Migrations completed");
  } catch (err) {
    logger.warn("Migrations failed or already applied", err);
  }
}

// In the main startup
await runMigrations();
// Then initialize services
```

### Option B: Manual run

SSH into Render and run:

```bash
npx prisma db push
```

---

## Step 6: Configure Frontend CORS

The backend CORS is pre-configured for these URLs:

- `http://localhost:5173` (Vite dev)
- `http://localhost:3000` (Next.js dev)
- `FRONTEND_URL` environment variable

Update the backend to your actual frontend domain by setting `FRONTEND_URL` in Render environment.

---

## Step 7: Monitor and Debug

### View logs

1. Go to your service in Render Dashboard
2. Click **Logs** to see real-time backend output
3. Check for:
   - Database connection errors
   - Port binding issues
   - Migration failures

### Restart the service

If something goes wrong:

1. Go to your service
2. Click **Manual Deploy** → **Latest Commit**
3. Or click **Restart** for a quick restart

---

## Step 8: Set up auto-deploys (optional)

Enable automatic deployment when you push to your repo:

1. Go to your service settings
2. Under **Deploy**, enable **Auto-Deploy**
3. Select your branch (e.g., `main`)

Now every commit to `main` triggers a new deploy.

---

## WebSocket on Render

Render fully supports WebSockets through the same service.

### For frontend to connect

Use the secure WebSocket URL:

```javascript
// Production
const ws = new WebSocket("wss://your-service.onrender.com/ws?role=command");

// Development (localhost)
const ws = new WebSocket("ws://localhost:3001/ws?role=command");
```

The protocol automatically upgrades from HTTP to WebSocket through the Render proxy.

---

## Environment Variables Checklist

| Variable         | Example                   | Required | Notes                            |
| ---------------- | ------------------------- | -------- | -------------------------------- |
| DATABASE_URL     | postgresql://user:pass... | Yes      | Render PostgreSQL or Supabase    |
| DIRECT_URL       | postgresql://user:pass... | Yes      | Same as DATABASE_URL usually     |
| JWT_SECRET       | 64-char random string     | Yes      | Generate with crypto.randomBytes |
| GROQ_API_KEY     | gsk\_...                  | No       | For AI distress analysis         |
| FRONTEND_URL     | https://mydomain.com      | Yes      | Your frontend deployment URL     |
| NODE_ENV         | production                | Yes      | Always production on Render      |
| PORT             | 3001                      | No       | Render default is fine           |
| TICK_INTERVAL_MS | 1000                      | No       | Simulator speed                  |

---

## Troubleshooting

### Build fails

- Check the **Build Logs** for TypeScript errors
- Verify `package.json` is correct
- Ensure `Dockerfile` path is correct in Render config

### Database connection fails

- Verify `DATABASE_URL` is correct
- Check if the database is accessible from Render's IP
- If using Supabase, whitelist Render's IPs in Supabase

### WebSocket not working

- Ensure you're using `wss://` (secure) on Render
- Check that `/ws` path is correct
- Verify the service is running and not in a crash loop

### Service keeps crashing

1. Check logs for errors
2. Verify all required environment variables are set
3. Ensure the database is up and responding

---

## Performance Tuning (after deployment)

### Database connection pooling

Update `DATABASE_URL` to use a connection pool URL if Supabase offers it.

### Ship simulator speed

Adjust `TICK_INTERVAL_MS`:

- `1000` (1 second) = realtime, use more resources
- `5000` (5 seconds) = slower simulation, lower resource usage

### Memory

Render free tier has limited RAM. Monitor in the service dashboard.

---

## Frontend Integration URL

Once your backend is deployed, your frontend should connect to:

- REST API: `https://your-service.onrender.com/api`
- WebSocket: `wss://your-service.onrender.com/ws`
- Swagger UI: `https://your-service.onrender.com/api-docs`

---

## Next Steps

1. Deploy backend to Render
2. Test all endpoints using Swagger UI
3. Test WebSocket using Postman or browser
4. Deploy frontend and update its API base URL
5. Monitor logs and performance

---

## Support & Monitoring

Render provides:

- Real-time logs
- CPU and memory usage graphs
- Alerts (paid plans)
- Auto-restart on crash

All accessible from the service dashboard.

---

## Quick Deploy Checklist

- [ ] Dockerfile created and tested locally
- [ ] GitHub repo connected to Render
- [ ] PostgreSQL database provisioned
- [ ] Environment variables configured in Render
- [ ] Build command working
- [ ] Start command correct
- [ ] Health endpoint returns 200
- [ ] Swagger UI accessible
- [ ] WebSocket connects with `wss://`
- [ ] Frontend URL set in CORS
