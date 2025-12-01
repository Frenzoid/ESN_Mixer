# 🎵 Song Request Queue

A real-time song request queue application built with Node.js, Express, Socket.IO, and React.

## Project Structure

After downloading, organize the files like this:

```
song-queue-app/
├── backend/
│   ├── server.js              ← server.js
│   ├── package.json           ← backend-package.json (rename to package.json)
│   └── .env                   ← backend.env (rename to .env)
│
└── frontend/
    ├── public/
    │   └── index.html         ← index.html
    ├── src/
    │   ├── App.js             ← App.js
    │   ├── index.js           ← index.js
    │   ├── components/
    │   │   ├── Header.js      ← Header.js
    │   │   ├── SongRequestForm.js  ← SongRequestForm.js
    │   │   ├── QueueList.js   ← QueueList.js
    │   │   ├── AdminPanel.js  ← AdminPanel.js
    │   │   └── NowPlaying.js  ← NowPlaying.js
    │   └── styles/
    │       └── App.css        ← App.css
    ├── package.json           ← frontend-package.json (rename to package.json)
    └── .env                   ← frontend.env (rename to .env)
```

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
- **Persistent storage** to JSON file
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