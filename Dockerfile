# Multi-Stage Production Dockerfile for MealLoop (Google Cloud Run)
# Builds Vite frontend SPA and runs unified Node.js Express server on $PORT

# Stage 1: Build frontend assets
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files & compile frontend
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package manifests & install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy built frontend dist and backend server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Cloud Run injects $PORT environment variable
EXPOSE 8080

# Start server
CMD ["tsx", "server.ts"]
