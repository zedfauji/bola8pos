# syntax=docker/dockerfile:1
FROM node:18-alpine AS base
WORKDIR /usr/src/app

FROM base AS deps
COPY package*.json ./
RUN apk --no-cache add --virtual .build-deps \
    python3 \
    make \
    g++ \
    && npm install -g npm@latest
RUN npm ci --only=production

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:18-alpine AS runner
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/package*.json ./
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /usr/src/app
USER appuser

# Expose the port the app runs on
EXPOSE 8080
CMD ["node", "dist/index.js"]


