# Dockerfile for Frontend
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application with environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CONVERSATION_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CONVERSATION_API_URL=$NEXT_PUBLIC_CONVERSATION_API_URL

# Set NODE_ENV to production for static export build
ENV NODE_ENV=production

RUN npm run build

# Production stage
FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy built files from the out directory (Next.js static export)
COPY --from=builder /app/out /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ || exit 1

EXPOSE 8080

# Start nginx with environment variable substitution
CMD ["/bin/sh", "-c", "envsubst '${API_URL}' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.tmp && mv /etc/nginx/nginx.conf.tmp /etc/nginx/nginx.conf && exec nginx -g 'daemon off;'"]

