# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and config
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client
RUN npm run prisma:generate

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:24-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    npm install -g tsx

# Copy Prisma schema for runtime migrations
COPY prisma ./prisma

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Expose port (default 3001, but Render may override with PORT env var)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001), (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application
CMD ["node", "dist/server.js"]
