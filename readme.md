# 🎵 ESN Karaoke Night Song Request Queue Webapp

A real-time song request queue application built with Node.js, Express, Socket.IO, and React for the ESN Karaoke Nights!

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
# Edit .env to set your ADMIN_PASSWORD
npm start
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

### 3. Open http://localhost:3000

## Features

- **Real-time updates** via Socket.IO
- **One request per user** (tracked via localStorage)
- **User self-management** - remove your own requests
- **Admin controls** with password protection:
  - Reorder songs
  - Mark as played
  - Remove songs
  - Clear entire queue
- **Persistent storage** to SQLite File.
- **Beautiful dark synthwave UI**

## Environment Variables

### Backend (.env)
```
PORT=5000
ADMIN_PASSWORD=your_secure_password_here
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)
```
REACT_APP_SOCKET_URL=http://localhost:5000
```
