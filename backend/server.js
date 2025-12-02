require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
const server = http.createServer(app);

// CORS middleware for Express
app.use(cors());
app.use(express.json());

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Admin password from environment
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// --- DATABASE SETUP ---

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

async function initDB() {
  // Open the database
  db = await open({
    filename: path.join(dataDir, 'queue.db'),
    driver: sqlite3.Database
  });

  // Create the table
  // We add 'position' to handle the ordering (1, 2, 3...)
  // We add a UNIQUE constraint on userId to strictly enforce 1 song per user at the DB level
  await db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      songTitle TEXT,
      artistName TEXT,
      requesterName TEXT,
      userId TEXT UNIQUE, 
      timestamp TEXT,
      position INTEGER
    )
  `);

  console.log('📂 Database initialized');
}

// Start DB immediately
initDB().catch(console.error);

// --- HELPER FUNCTIONS ---

// Get all songs sorted by position
const getQueue = async () => {
  return await db.all('SELECT * FROM queue ORDER BY position ASC');
};

// --- REST API ---

app.get('/api/queue', async (req, res) => {
  try {
    const queue = await getQueue();
    res.json(queue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

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

// --- SOCKET.IO HANDLING ---

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send current queue to new client
  try {
    const queue = await getQueue();
    socket.emit('queue:update', queue);
  } catch (e) {
    console.error(e);
  }

  // Check if user has a request
  socket.on('user:check', async (userId, callback) => {
    try {
      const row = await db.get('SELECT id FROM queue WHERE userId = ?', userId);
      if (typeof callback === 'function') {
        callback({
          hasRequest: !!row,
          requestId: row ? row.id : null
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  // Add Song
  socket.on('song:add', async ({ songTitle, artistName, userId, requesterName }) => {
    try {
      // 1. Check if user exists (Double check, though DB Unique constraint handles this too)
      const existing = await db.get('SELECT id FROM queue WHERE userId = ?', userId);
      if (existing) {
        socket.emit('error', { message: 'You already have a song in the queue!' });
        return;
      }

      // 2. Calculate next position
      // We get the highest current position and add 1
      const result = await db.get('SELECT MAX(position) as maxPos FROM queue');
      const nextPos = (result.maxPos || 0) + 1;

      const newSong = {
        id: uuidv4(),
        songTitle: songTitle.trim(),
        artistName: artistName.trim(),
        requesterName: requesterName.trim() || 'Anonymous',
        userId,
        timestamp: new Date().toISOString(),
        position: nextPos
      };

      // 3. Insert
      await db.run(
        `INSERT INTO queue (id, songTitle, artistName, requesterName, userId, timestamp, position) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newSong.id, newSong.songTitle, newSong.artistName, newSong.requesterName, newSong.userId, newSong.timestamp, newSong.position]
      );

      // 4. Broadcast
      const updatedQueue = await getQueue();
      io.emit('queue:update', updatedQueue);
      socket.emit('song:added', { success: true, songId: newSong.id });
      console.log(`Song added: "${newSong.songTitle}"`);

    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        socket.emit('error', { message: 'You already have a song in the queue!' });
      } else {
        console.error('Error adding song:', err);
      }
    }
  });

  // Remove Song (User)
  socket.on('song:remove', async ({ songId, userId }) => {
    try {
      // We check userId in the DELETE clause to ensure security (can only delete own)
      const result = await db.run(
        'DELETE FROM queue WHERE id = ? AND userId = ?',
        songId, userId
      );

      if (result.changes === 0) {
        socket.emit('error', { message: 'Song not found or permission denied' });
        return;
      }

      const updatedQueue = await getQueue();
      io.emit('queue:update', updatedQueue);
      socket.emit('song:removed', { success: true });
      console.log(`Song removed by user`);
    } catch (err) {
      console.error(err);
    }
  });

  // Admin Remove
  socket.on('admin:remove', async ({ songId, password }) => {
    if (password !== ADMIN_PASSWORD) return socket.emit('error', { message: 'Invalid password' });

    try {
      await db.run('DELETE FROM queue WHERE id = ?', songId);

      const updatedQueue = await getQueue();
      io.emit('queue:update', updatedQueue);
      socket.emit('admin:removed', { success: true });
      console.log(`Song removed by admin`);
    } catch (err) {
      console.error(err);
    }
  });

  // Admin Clear
  socket.on('admin:clear', async ({ password }) => {
    if (password !== ADMIN_PASSWORD) return socket.emit('error', { message: 'Invalid password' });

    try {
      await db.run('DELETE FROM queue'); // Clears table
      io.emit('queue:update', []);
      socket.emit('admin:cleared', { success: true });
      console.log('Queue cleared');
    } catch (err) {
      console.error(err);
    }
  });

  // Admin Reorder
  socket.on('admin:reorder', async ({ songId, direction, password }) => {
    if (password !== ADMIN_PASSWORD) return socket.emit('error', { message: 'Invalid password' });

    try {
      // 1. Get current list
      const queue = await getQueue();
      const currentIndex = queue.findIndex(s => s.id === songId);

      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      // Check bounds
      if (newIndex < 0 || newIndex >= queue.length) return;

      // 2. Swap in memory
      [queue[currentIndex], queue[newIndex]] = [queue[newIndex], queue[currentIndex]];

      // 3. Update POSITIONS in DB
      // We rewrite the position integers to match the new array order (0, 1, 2...)
      // This heals any "gaps" in numbers caused by previous deletions
      const updatePromise = queue.map((song, index) => {
        return db.run('UPDATE queue SET position = ? WHERE id = ?', index, song.id);
      });

      await Promise.all(updatePromise);

      // 4. Broadcast
      // We can just send the memory queue since we know it's correct now
      io.emit('queue:update', queue);
      console.log(`Queue reordered`);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnect', (reason) => {
    // console.log(`User disconnected: ${reason}`);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`🎵 ESN Lugano Song Queue (SQLite)`);
  console.log(`📡 Running on port ${PORT}`);
  console.log(`🔑 Admin password: ${ADMIN_PASSWORD}`);
  console.log('========================================');
});