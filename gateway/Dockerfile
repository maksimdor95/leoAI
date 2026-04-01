# API Gateway Dockerfile using OpenResty for Lua support
FROM openresty/openresty:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext curl

# Copy nginx configuration
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

# Create necessary directories for Nginx and set permissions
USER root
RUN mkdir -p /var/log/nginx /var/cache/nginx /var/run && \
    chmod -R 777 /var/log/nginx /var/cache/nginx /var/run

# Ensure mime.types exists (copy from OpenResty if needed, or create minimal one)
RUN if [ ! -f /usr/local/openresty/nginx/conf/mime.types ]; then \
    echo "types {" > /usr/local/openresty/nginx/conf/mime.types && \
    echo "    text/html html htm shtml;" >> /usr/local/openresty/nginx/conf/mime.types && \
    echo "    text/css css;" >> /usr/local/openresty/nginx/conf/mime.types && \
    echo "    application/javascript js;" >> /usr/local/openresty/nginx/conf/mime.types && \
    echo "    application/json json;" >> /usr/local/openresty/nginx/conf/mime.types && \
    echo "}" >> /usr/local/openresty/nginx/conf/mime.types; \
    fi

# Health check (OpenResty listens on 8080 by default in our config)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

# Start OpenResty with environment variable substitution
CMD ["/bin/sh", "-c", "mkdir -p /etc/nginx && cp /usr/local/openresty/nginx/conf/mime.types /etc/nginx/mime.types 2>/dev/null || (echo 'types { text/html html htm shtml; text/css css; application/javascript js; application/json json; }' > /etc/nginx/mime.types) && envsubst '${USER_PROFILE_SERVICE_URL} ${CONVERSATION_SERVICE_URL} ${AI_NLP_SERVICE_URL} ${JOB_MATCHING_SERVICE_URL} ${EMAIL_SERVICE_URL} ${FRONTEND_URL}' < /usr/local/openresty/nginx/conf/nginx.conf > /etc/nginx/nginx.conf && exec /usr/local/openresty/bin/openresty -g 'daemon off;' -c /etc/nginx/nginx.conf"]

