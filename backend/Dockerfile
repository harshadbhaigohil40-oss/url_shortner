# Multi-stage production Dockerfile for Backend
FROM node:22-alpine AS build

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY . .

# Remove tests and scratch files from final release
RUN rm -rf test scratch*.js

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install dumb-init or curl for healthchecks
RUN apk add --no-cache curl

# Run as non-privileged node user for security
USER node

# Copy dependencies and code from build stage with correct ownership
COPY --chown=node:node --from=build /app ./

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "start.js"]
