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
app.use(cors({
  origin: true,  // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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
let dbReady = false;

async function initDB() {
  try {
    // Open the database
    db = await open({
      filename: path.join(dataDir, 'queue.db'),
      driver: sqlite3.Database
    });

    // Create the queue table
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

    // Create the blocked_users table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id TEXT PRIMARY KEY,
        oduserId TEXT UNIQUE,
        reason TEXT,
        blockedAt TEXT,
        blockedBy TEXT
      )
    `);

    dbReady = true;
    console.log('📂 Database initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// Start DB immediately
initDB();

// --- HELPER FUNCTIONS ---

// Get all songs sorted by position
const getQueue = async () => {
  return await db.all('SELECT * FROM queue ORDER BY position ASC');
};

// Get all blocked users
const getBlockedUsers = async () => {
  return await db.all('SELECT * FROM blocked_users ORDER BY blockedAt DESC');
};

// Check if a user is blocked
const isUserBlocked = async (oduserId) => {
  const blocked = await db.get('SELECT * FROM blocked_users WHERE oduserId = ?', oduserId);
  return blocked || null;
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
  console.log('Admin login attempt received');
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    console.log('Admin login successful');
    res.json({ success: true });
  } else {
    console.log('Admin login failed - wrong password');
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// Check if user is blocked (public endpoint)
app.get('/api/blocked/:userId', async (req, res) => {
  try {
    const blocked = await isUserBlocked(req.params.userId);
    if (blocked) {
      res.json({ blocked: true, reason: blocked.reason, blockedAt: blocked.blockedAt });
    } else {
      res.json({ blocked: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
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

  // Admin login via socket (bypasses CORS issues with HTTP)
  socket.on('admin:login', ({ password }, callback) => {
    console.log('Admin login attempt via socket');
    if (password === ADMIN_PASSWORD) {
      console.log('Admin login successful');
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } else {
      console.log('Admin login failed - wrong password');
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Invalid admin password' });
      }
    }
  });

  // Check if user has a request
  socket.on('user:check', async (userId, callback) => {
    try {
      const row = await db.get('SELECT id FROM queue WHERE userId = ?', userId);
      const blocked = await isUserBlocked(userId);
      
      if (typeof callback === 'function') {
        callback({
          hasRequest: !!row,
          requestId: row ? row.id : null,
          blocked: blocked ? { reason: blocked.reason, blockedAt: blocked.blockedAt } : null
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  // Check if user is blocked
  socket.on('user:checkBlocked', async (userId, callback) => {
    try {
      const blocked = await isUserBlocked(userId);
      if (typeof callback === 'function') {
        callback({
          blocked: !!blocked,
          reason: blocked ? blocked.reason : null,
          blockedAt: blocked ? blocked.blockedAt : null
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  // Add Song
  socket.on('song:add', async ({ songTitle, artistName, userId, requesterName }) => {
    try {
      // 1. Check if user is blocked
      const blocked = await isUserBlocked(userId);
      if (blocked) {
        socket.emit('error', { 
          message: 'You have been blocked from requesting songs.',
          blocked: true,
          reason: blocked.reason 
        });
        return;
      }

      // 2. Check if user already has a song
      const existing = await db.get('SELECT id FROM queue WHERE userId = ?', userId);
      if (existing) {
        socket.emit('error', { message: 'You already have a song in the queue!' });
        return;
      }

      // 3. Calculate next position
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

      // 4. Insert
      await db.run(
        `INSERT INTO queue (id, songTitle, artistName, requesterName, userId, timestamp, position) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newSong.id, newSong.songTitle, newSong.artistName, newSong.requesterName, newSong.userId, newSong.timestamp, newSong.position]
      );

      // 5. Broadcast
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

  // Admin Clear Queue
  socket.on('admin:clear', async ({ password }) => {
    if (password !== ADMIN_PASSWORD) return socket.emit('error', { message: 'Invalid password' });

    try {
      await db.run('DELETE FROM queue');
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
      const queue = await getQueue();
      const currentIndex = queue.findIndex(s => s.id === songId);

      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (newIndex < 0 || newIndex >= queue.length) return;

      [queue[currentIndex], queue[newIndex]] = [queue[newIndex], queue[currentIndex]];

      const updatePromise = queue.map((song, index) => {
        return db.run('UPDATE queue SET position = ? WHERE id = ?', index, song.id);
      });

      await Promise.all(updatePromise);

      io.emit('queue:update', queue);
      console.log(`Queue reordered`);
    } catch (err) {
      console.error(err);
    }
  });

  // === BAN MANAGEMENT ===

  // Admin: Ban a user
  socket.on('admin:ban', async ({ oduserId, reason, password }) => {
    if (password !== ADMIN_PASSWORD) return socket.emit('error', { message: 'Invalid password' });

    try {
      // Check if already banned
      const existing = await db.get('SELECT id FROM blocked_users WHERE oduserId = ?', oduserId);
      if (existing) {
        socket.emit('error', { message: 'User is already banned' });
        return;
      }

      const banRecord = {
        id: uuidv4(),
        oduserId,
        reason: reason || 'Inappropriate behavior',
        blockedAt: new Date().toISOString(),
        blockedBy: 'admin'
      };

      await db.run(
        `INSERT INTO blocked_users (id, oduserId, reason, blockedAt, blockedBy) 
         VALUES (?, ?, ?, ?, ?)`,
        [banRecord.id, banRecord.oduserId, banRecord.reason, banRecord.blockedAt, banRecord.blockedBy]
      );

      // Also remove their song from the queue if they have one
      await db.run('DELETE FROM queue WHERE userId = ?', oduserId);

      // Broadcast updated queue and blocked list
      const updatedQueue = await getQueue();
      const blockedUsers = await getBlockedUsers();
      
      io.emit('queue:update', updatedQueue);
      io.emit('blocked:update', blockedUsers);
      
      // Notify the banned user specifically
      io.emit('user:banned', { oduserId, reason: banRecord.reason });
      
      socket.emit('admin:banned', { success: true, oduserId });
      console.log(`User banned: ${oduserId}`);
    } catch (err) {
      console.error('Error banning user:', err);
      socket.emit('error', { message: 'Failed to ban user' });
    }
  });

  // Admin: Unban a user
  socket.on('admin:unban', async ({ oduserId, password }) => {
    if (password !== ADMIN_PASSWORD) return socket.emit('error', { message: 'Invalid password' });

    try {
      const result = await db.run('DELETE FROM blocked_users WHERE oduserId = ?', oduserId);

      if (result.changes === 0) {
        socket.emit('error', { message: 'User not found in ban list' });
        return;
      }

      const blockedUsers = await getBlockedUsers();
      io.emit('blocked:update', blockedUsers);
      
      // Notify the unbanned user
      io.emit('user:unbanned', { oduserId });
      
      socket.emit('admin:unbanned', { success: true, oduserId });
      console.log(`User unbanned: ${oduserId}`);
    } catch (err) {
      console.error('Error unbanning user:', err);
      socket.emit('error', { message: 'Failed to unban user' });
    }
  });

  // Admin: Unban all users
  socket.on('admin:unbanAll', async ({ password }) => {
    if (password !== ADMIN_PASSWORD) return socket.emit('error', { message: 'Invalid password' });

    try {
      await db.run('DELETE FROM blocked_users');

      io.emit('blocked:update', []);
      io.emit('user:allUnbanned', {});
      
      socket.emit('admin:unbannedAll', { success: true });
      console.log('All users unbanned');
    } catch (err) {
      console.error('Error unbanning all users:', err);
      socket.emit('error', { message: 'Failed to unban all users' });
    }
  });

  // Admin: Get blocked users list
  socket.on('admin:getBlocked', async ({ password }, callback) => {
    if (password !== ADMIN_PASSWORD) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid password' });
      return;
    }

    try {
      const blockedUsers = await getBlockedUsers();
      if (typeof callback === 'function') {
        callback({ success: true, blockedUsers });
      }
    } catch (err) {
      console.error('Error getting blocked users:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Database error' });
      }
    }
  });

  // Admin: Reset event (clear queue + unban all)
  socket.on('admin:resetEvent', async ({ password }) => {
    if (password !== ADMIN_PASSWORD) return socket.emit('error', { message: 'Invalid password' });

    try {
      // Clear queue
      await db.run('DELETE FROM queue');
      // Unban all users
      await db.run('DELETE FROM blocked_users');

      io.emit('queue:update', []);
      io.emit('blocked:update', []);
      io.emit('user:allUnbanned', {});
      
      socket.emit('admin:eventReset', { success: true });
      console.log('Event reset: Queue cleared and all users unbanned');
    } catch (err) {
      console.error('Error resetting event:', err);
      socket.emit('error', { message: 'Failed to reset event' });
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