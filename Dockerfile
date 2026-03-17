# Multi-stage build for smaller final image
# Stage 1: Builder
FROM node:18-alpine as builder

# Set working directory
WORKDIR /build

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
# Use --ignore-scripts to skip optional dependencies like phantomjs that may fail on ARM64
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine

# Metadata labels
LABEL description="Notion to Jira Automation Service"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files from builder
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /build/dist ./dist

# Create logs directory with proper permissions
RUN mkdir -p logs && chmod 755 logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -h /app

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Railway will override this with PORT env var)
EXPOSE 3003

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/webhook/health', (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode) })" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
