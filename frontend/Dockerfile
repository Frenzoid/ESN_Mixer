# Frontend Dockerfile for Vite
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install instead of npm ci)
RUN npm install

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

# Serve the build folder
CMD ["serve", "-s", "build", "-l", "3000"]
