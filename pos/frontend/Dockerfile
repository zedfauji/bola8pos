# Multi-stage build to produce a static SPA and serve it via Nginx on Cloud Run

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Accept API URL at build time and expose to Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runner

# Copy custom nginx config for SPA fallback
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Cloud Run listens on $PORT; configure Nginx accordingly via envsubst not needed since we bind to 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]


