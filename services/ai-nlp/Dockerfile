# Dockerfile for AI/NLP Service
FROM node:18-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for build)
COPY package.json ./
RUN npm install && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json ./
RUN npm install --only=production && npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]

