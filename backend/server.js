require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// CORS middleware for Express
app.use(cors());
app.use(express.json());

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true // Allow Engine.IO v3 clients
});

// Data storage file path
const DATA_FILE = path.join(__dirname, 'data', 'queue.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ queue: [], userRequests: {} }));
}

// Helper functions for data persistence
const loadData = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading data:', error);
    return { queue: [], userRequests: {} };
  }
};

const saveData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
};

// Admin password from environment
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// REST API endpoints
app.get('/api/queue', (req, res) => {
  const data = loadData();
  res.json(data.queue);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/verify-admin', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} from ${socket.handshake.headers.origin || 'unknown origin'}`);

  // Send current queue to newly connected client
  const data = loadData();
  socket.emit('queue:update', data.queue);

  // Check if user already has a request
  socket.on('user:check', (userId, callback) => {
    const data = loadData();
    const hasRequest = data.userRequests[userId] !== undefined;
    const requestId = data.userRequests[userId] || null;
    if (typeof callback === 'function') {
      callback({ hasRequest, requestId });
    }
  });

  // Add song request
  socket.on('song:add', ({ songTitle, artistName, userId, requesterName }) => {
    const data = loadData();

    // Check if user already has a request
    if (data.userRequests[userId]) {
      socket.emit('error', { message: 'You already have a song in the queue!' });
      return;
    }

    const newSong = {
      id: uuidv4(),
      songTitle: songTitle.trim(),
      artistName: artistName.trim(),
      requesterName: requesterName.trim() || 'Anonymous',
      userId,
      timestamp: new Date().toISOString()
    };

    data.queue.push(newSong);
    data.userRequests[userId] = newSong.id;
    saveData(data);

    // Broadcast updated queue to all clients
    io.emit('queue:update', data.queue);
    socket.emit('song:added', { success: true, songId: newSong.id });

    console.log(`Song added: "${songTitle}" by ${artistName}`);
  });

  // Remove song request (user's own)
  socket.on('song:remove', ({ songId, userId }) => {
    const data = loadData();

    // Find the song
    const songIndex = data.queue.findIndex(s => s.id === songId);

    if (songIndex === -1) {
      socket.emit('error', { message: 'Song not found in queue' });
      return;
    }

    const song = data.queue[songIndex];

    // Check if user owns this request
    if (song.userId !== userId) {
      socket.emit('error', { message: 'You can only remove your own requests' });
      return;
    }

    // Remove from queue and user tracking
    data.queue.splice(songIndex, 1);
    delete data.userRequests[userId];
    saveData(data);

    // Broadcast updated queue
    io.emit('queue:update', data.queue);
    socket.emit('song:removed', { success: true });

    console.log(`Song removed by user: "${song.songTitle}"`);
  });

  // Admin remove song
  socket.on('admin:remove', ({ songId, password }) => {
    if (password !== ADMIN_PASSWORD) {
      socket.emit('error', { message: 'Invalid admin password' });
      return;
    }

    const data = loadData();
    const songIndex = data.queue.findIndex(s => s.id === songId);

    if (songIndex === -1) {
      socket.emit('error', { message: 'Song not found in queue' });
      return;
    }

    const song = data.queue[songIndex];

    // Remove from queue and user tracking
    data.queue.splice(songIndex, 1);
    delete data.userRequests[song.userId];
    saveData(data);

    // Broadcast updated queue
    io.emit('queue:update', data.queue);
    socket.emit('admin:removed', { success: true });

    console.log(`Song removed by admin: "${song.songTitle}"`);
  });

  // Admin clear entire queue
  socket.on('admin:clear', ({ password }) => {
    if (password !== ADMIN_PASSWORD) {
      socket.emit('error', { message: 'Invalid admin password' });
      return;
    }

    const data = { queue: [], userRequests: {} };
    saveData(data);

    io.emit('queue:update', data.queue);
    socket.emit('admin:cleared', { success: true });

    console.log('Queue cleared by admin');
  });

  // Admin move song position
  socket.on('admin:reorder', ({ songId, direction, password }) => {
    if (password !== ADMIN_PASSWORD) {
      socket.emit('error', { message: 'Invalid admin password' });
      return;
    }

    const data = loadData();
    const currentIndex = data.queue.findIndex(s => s.id === songId);

    if (currentIndex === -1) {
      socket.emit('error', { message: 'Song not found in queue' });
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= data.queue.length) {
      return; // Can't move further
    }

    // Swap positions
    [data.queue[currentIndex], data.queue[newIndex]] = [data.queue[newIndex], data.queue[currentIndex]];
    saveData(data);

    io.emit('queue:update', data.queue);

    console.log(`Song reordered: "${data.queue[newIndex].songTitle}" moved ${direction}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.id} (${reason})`);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`🎵 ESN Lugano Song Queue Server`);
  console.log(`📡 Running on port ${PORT}`);
  console.log(`🔑 Admin password: ${ADMIN_PASSWORD}`);
  console.log('========================================');
});