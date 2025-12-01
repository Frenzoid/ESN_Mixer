# Frontend Dockerfile for Vite
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL (Vite uses VITE_ prefix)
ARG VITE_SOCKET_URL=http://localhost:5000
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Build the app
RUN npm run build

# Install serve globally
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Serve the build folder
CMD ["serve", "-s", "build", "-l", "3000"]