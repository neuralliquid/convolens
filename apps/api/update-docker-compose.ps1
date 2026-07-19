# PowerShell script to update docker-compose.dev.yml with enhanced configuration
$content = @'
version: '3.8'

services:
  app:
    build:
      context: .
      target: development
      args:
        - NODE_ENV=development
    container_name: convolens-backend-dev
    command: npm run dev
    restart: unless-stopped
    ports:
      - "3001:3001"
      - "9229:9229" # Node.js debug port
      - "1080:1080" # MailHog UI
    volumes:
      - .:/app
      - /app/node_modules
      - logs:/app/logs
      - data:/app/data
      - uploads:/app/uploads
    environment:
      # Server
      - NODE_ENV=development
      - PORT=3001
      - HOST=0.0.0.0
      - API_PREFIX=/api
      - NODE_OPTIONS=--inspect=0.0.0.0:9229
      
      # Database
      - DB_TYPE=sqlite
      - DATABASE_PATH=/app/data/development.sqlite
      - DB_SYNCHRONIZE=true
      - DB_LOGGING=all
      
      # Authentication
      - JWT_SECRET=dev_jwt_secret_change_me
      - JWT_EXPIRES_IN=1d
      - REFRESH_TOKEN_EXPIRES_IN=7d
      - COOKIE_SECRET=dev_cookie_secret_change_me
      
      # Logging
      - LOG_LEVEL=debug
      - LOG_TO_FILE=true
      - LOG_DIR=/app/logs
      - DEBUG=app:*,typeorm:*,express:*
      
      # CORS
      - CORS_ORIGIN=http://localhost:3000,http://localhost:3001
      - CORS_METHODS=GET,HEAD,PUT,PATCH,POST,DELETE
      - CORS_CREDENTIALS=true
      
      # File Uploads
      - MAX_FILE_SIZE=10485760 # 10MB
      - UPLOAD_DIR=/app/uploads
      - ALLOWED_FILE_TYPES=text/plain,application/json
      
      # Email (MailHog for development)
      - SMTP_HOST=mailhog
      - SMTP_PORT=1025
      - SMTP_SECURE=false
      - EMAIL_FROM=noreply@convolens.local
      
      # Rate Limiting (increased for development)
      - RATE_LIMIT_WINDOW_MS=900000 # 15 minutes
      - RATE_LIMIT_MAX=1000
      
      # Redis
      - REDIS_URL=redis://redis:6379
      - REDIS_CACHE_TTL=3600
    networks:
      - app-network
    depends_on:
      - redis
      - mailhog

  # Redis for caching and rate limiting
  redis:
    image: redis:7-alpine
    container_name: convolens-redis-dev
    restart: unless-stopped
    ports:
      - "63790:6379"
    volumes:
      - redis_data_dev:/data
    command: redis-server --save 60 1 --loglevel warning
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MailHog for email testing
  mailhog:
    image: mailhog/mailhog:latest
    container_name: convolens-mailhog-dev
    restart: unless-stopped
    ports:
      - "1025:1025" # SMTP server
      - "8025:8025" # Web UI
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8025"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Database management UI (Adminer)
  dbadmin:
    image: adminer:latest
    container_name: convolens-dbadmin-dev
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - ADMINER_DEFAULT_SERVER=db
    networks:
      - app-network
    depends_on:
      - db

  # Database (SQLite in development)
  db:
    image: nouchka/sqlite3:latest
    container_name: convolens-db-dev
    restart: unless-stopped
    volumes:
      - db_data_dev:/app/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "ls", "/app/data/development.sqlite"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  app-network:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16

volumes:
  redis_data_dev:
  db_data_dev:
  logs:
  data:
  uploads:
'@

# Write the content to docker-compose.dev.yml
$content | Out-File -FilePath "docker-compose.dev.yml" -Encoding utf8

Write-Host "docker-compose.dev.yml has been updated with the enhanced configuration." -ForegroundColor Green
