FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directory for SSL certificates (mount or copy in production)
RUN mkdir -p /etc/nginx/ssl

# Create self-signed placeholder certs for development/testing
# In production, replace these with real certificates (e.g. Let's Encrypt)
RUN apk add --no-cache openssl && \
    openssl req -x509 -nodes -days 365 \
      -subj "/C=US/ST=State/L=City/O=TransformHub/CN=localhost" \
      -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/privkey.pem \
      -out /etc/nginx/ssl/fullchain.pem && \
    apk del openssl

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
