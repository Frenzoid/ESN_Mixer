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

// Environment
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEBUG = process.env.DEBUG === 'true' || !IS_PRODUCTION;

// Debug logger
const log = {
  info: (...args) => DEBUG && console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
};

// CORS middleware for Express
app.use(cors({
  origin: true,
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

// Input validation constants
const MAX_SONG_TITLE_LENGTH = 50;
const MAX_ARTIST_NAME_LENGTH = 20;
const MAX_REQUESTER_NAME_LENGTH = 20;
const MAX_BAN_REASON_LENGTH = 500;

// Track online users
let onlineUsers = 0;

// --- DATABASE SETUP ---

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;
let dbReady = false;

async function initDB() {
  try {
    db = await open({
      filename: path.join(dataDir, 'queue.db'),
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS queue (
        id TEXT PRIMARY KEY,
        songTitle TEXT NOT NULL,
        artistName TEXT NOT NULL,
        requesterName TEXT DEFAULT 'Anonymous',
        oduserId TEXT UNIQUE,
        timestamp TEXT NOT NULL,
        position INTEGER NOT NULL
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id TEXT PRIMARY KEY,
        oduserId TEXT UNIQUE NOT NULL,
        reason TEXT,
        blockedAt TEXT NOT NULL,
        blockedBy TEXT
      )
    `);

    // Create index for faster lookups
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_queue_oduserId ON queue(oduserId)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_blocked_oduserId ON blocked_users(oduserId)`);

    dbReady = true;
    log.info('📂 Database initialized');
    return true;
  } catch (err) {
    log.error('Database initialization error:', err);
    return false;
  }
}

// --- MIDDLEWARE ---

// Database readiness check middleware
const requireDB = (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({ error: 'Database not ready, please try again' });
  }
  next();
};

// Socket database check
const socketRequireDB = (socket, callback) => {
  if (!dbReady) {
    socket.emit('error', { message: 'Database not ready, please try again' });
    if (typeof callback === 'function') {
      callback({ success: false, error: 'Database not ready' });
    }
    return false;
  }
  return true;
};

// --- INPUT VALIDATION ---

const sanitizeString = (str, maxLength) => {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
};

const validateSongInput = (songTitle, artistName, requesterName) => {
  const errors = [];
  
  if (!songTitle || typeof songTitle !== 'string' || !songTitle.trim()) {
    errors.push('Song title is required');
  } else if (songTitle.trim().length > MAX_SONG_TITLE_LENGTH) {
    errors.push(`Song title must be less than ${MAX_SONG_TITLE_LENGTH} characters`);
  }
  
  if (!artistName || typeof artistName !== 'string' || !artistName.trim()) {
    errors.push('Artist name is required');
  } else if (artistName.trim().length > MAX_ARTIST_NAME_LENGTH) {
    errors.push(`Artist name must be less than ${MAX_ARTIST_NAME_LENGTH} characters`);
  }
  
  if (requesterName && requesterName.length > MAX_REQUESTER_NAME_LENGTH) {
    errors.push(`Requester name must be less than ${MAX_REQUESTER_NAME_LENGTH} characters`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      songTitle: sanitizeString(songTitle, MAX_SONG_TITLE_LENGTH),
      artistName: sanitizeString(artistName, MAX_ARTIST_NAME_LENGTH),
      requesterName: sanitizeString(requesterName, MAX_REQUESTER_NAME_LENGTH) || 'Anonymous'
    }
  };
};

const validateOduserId = (oduserId) => {
  if (!oduserId || typeof oduserId !== 'string' || !oduserId.trim()) {
    return { isValid: false, error: 'User ID is required' };
  }
  // UUID format check (basic)
  if (oduserId.length > 50) {
    return { isValid: false, error: 'Invalid user ID format' };
  }
  return { isValid: true, sanitized: oduserId.trim() };
};

// --- HELPER FUNCTIONS ---

const getQueue = async () => {
  if (!dbReady) throw new Error('Database not ready');
  return await db.all('SELECT * FROM queue ORDER BY position ASC');
};

const getBlockedUsers = async () => {
  if (!dbReady) throw new Error('Database not ready');
  return await db.all('SELECT * FROM blocked_users ORDER BY blockedAt DESC');
};

const isUserBlocked = async (oduserId) => {
  if (!dbReady) throw new Error('Database not ready');
  const blocked = await db.get('SELECT * FROM blocked_users WHERE oduserId = ?', oduserId);
  return blocked || null;
};

// Normalize queue positions (fix gaps)
const normalizeQueuePositions = async () => {
  const queue = await db.all('SELECT id FROM queue ORDER BY position ASC');
  const updates = queue.map((song, index) => 
    db.run('UPDATE queue SET position = ? WHERE id = ?', index, song.id)
  );
  await Promise.all(updates);
};

const broadcastOnlineUsers = () => {
  io.emit('users:count', onlineUsers);
};

// --- REST API ---

app.get('/api/queue', requireDB, async (req, res) => {
  try {
    const queue = await getQueue();
    res.json(queue);
  } catch (err) {
    log.error('Error fetching queue:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: dbReady ? 'ok' : 'initializing', 
    dbReady,
    timestamp: new Date().toISOString() 
  });
});

app.post('/api/verify-admin', (req, res) => {
  log.info('Admin login attempt received');
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    log.info('Admin login successful');
    res.json({ success: true });
  } else {
    log.info('Admin login failed - wrong password');
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

app.get('/api/blocked/:oduserId', requireDB, async (req, res) => {
  try {
    const validation = validateOduserId(req.params.oduserId);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const blocked = await isUserBlocked(validation.sanitized);
    if (blocked) {
      res.json({ blocked: true, reason: blocked.reason, blockedAt: blocked.blockedAt });
    } else {
      res.json({ blocked: false });
    }
  } catch (err) {
    log.error('Error checking blocked status:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/online-users', (req, res) => {
  res.json({ count: onlineUsers });
});

// --- SOCKET.IO HANDLING ---

io.on('connection', async (socket) => {
  log.info(`User connected - Tunnel id: ${socket.id}`);
  
  onlineUsers++;
  broadcastOnlineUsers();

  // Send current queue to new client (only if DB is ready)
  if (dbReady) {
    try {
      const queue = await getQueue();
      socket.emit('queue:update', queue);
    } catch (e) {
      log.error('Error sending initial queue:', e);
    }
  }

  // Admin login
  socket.on('admin:login', ({ password }, callback) => {
    log.info('Admin login attempt via socket');
    const success = password === ADMIN_PASSWORD;
    log.info(success ? 'Admin login successful' : 'Admin login failed');
    
    if (typeof callback === 'function') {
      callback({ 
        success, 
        message: success ? undefined : 'Invalid admin password' 
      });
    }
  });

  // Check if user has a request
  socket.on('user:check', async (oduserId, callback) => {
    if (!socketRequireDB(socket, callback)) return;
    
    try {
      const validation = validateOduserId(oduserId);
      if (!validation.isValid) {
        if (typeof callback === 'function') {
          callback({ hasRequest: false, error: validation.error });
        }
        return;
      }

      const row = await db.get('SELECT id FROM queue WHERE oduserId = ?', validation.sanitized);
      const blocked = await isUserBlocked(validation.sanitized);
      
      if (typeof callback === 'function') {
        callback({
          hasRequest: !!row,
          requestId: row ? row.id : null,
          blocked: blocked ? { reason: blocked.reason, blockedAt: blocked.blockedAt } : null
        });
      }
    } catch (e) {
      log.error('Error in user:check:', e);
      if (typeof callback === 'function') {
        callback({ hasRequest: false, error: 'Server error' });
      }
    }
  });

  // Check if user is blocked
  socket.on('user:checkBlocked', async (oduserId, callback) => {
    if (!socketRequireDB(socket, callback)) return;
    
    try {
      const validation = validateOduserId(oduserId);
      if (!validation.isValid) {
        if (typeof callback === 'function') {
          callback({ blocked: false, error: validation.error });
        }
        return;
      }

      const blocked = await isUserBlocked(validation.sanitized);
      if (typeof callback === 'function') {
        callback({
          blocked: !!blocked,
          reason: blocked ? blocked.reason : null,
          blockedAt: blocked ? blocked.blockedAt : null
        });
      }
    } catch (e) {
      log.error('Error in user:checkBlocked:', e);
      if (typeof callback === 'function') {
        callback({ blocked: false, error: 'Server error' });
      }
    }
  });

  // Add Song
  socket.on('song:add', async ({ songTitle, artistName, oduserId, requesterName }) => {
    if (!socketRequireDB(socket)) return;

    try {
      // Validate user ID
      const userValidation = validateOduserId(oduserId);
      if (!userValidation.isValid) {
        socket.emit('error', { message: userValidation.error });
        return;
      }

      // Validate song input
      const songValidation = validateSongInput(songTitle, artistName, requesterName);
      if (!songValidation.isValid) {
        socket.emit('error', { message: songValidation.errors.join(', ') });
        return;
      }

      const sanitizedOduserId = userValidation.sanitized;
      const { songTitle: cleanTitle, artistName: cleanArtist, requesterName: cleanRequester } = songValidation.sanitized;

      // Check if user is blocked
      const blocked = await isUserBlocked(sanitizedOduserId);
      if (blocked) {
        socket.emit('error', { 
          message: 'You have been blocked from requesting songs.',
          blocked: true,
          reason: blocked.reason 
        });
        return;
      }

      // Check if user already has a song
      const existing = await db.get('SELECT id FROM queue WHERE oduserId = ?', sanitizedOduserId);
      if (existing) {
        socket.emit('error', { message: 'You already have a song in the queue!' });
        return;
      }

      // Calculate next position
      const result = await db.get('SELECT MAX(position) as maxPos FROM queue');
      const nextPos = (result.maxPos ?? -1) + 1;

      const newSong = {
        id: uuidv4(),
        songTitle: cleanTitle,
        artistName: cleanArtist,
        requesterName: cleanRequester,
        oduserId: sanitizedOduserId,
        timestamp: new Date().toISOString(),
        position: nextPos
      };

      await db.run(
        `INSERT INTO queue (id, songTitle, artistName, requesterName, oduserId, timestamp, position) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newSong.id, newSong.songTitle, newSong.artistName, newSong.requesterName, newSong.oduserId, newSong.timestamp, newSong.position]
      );

      const updatedQueue = await getQueue();
      io.emit('queue:update', updatedQueue);
      socket.emit('song:added', { success: true, songId: newSong.id });
      log.info(`Song added: "${newSong.songTitle}" by ${newSong.artistName}`);

    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        socket.emit('error', { message: 'You already have a song in the queue!' });
      } else {
        log.error('Error adding song:', err);
        socket.emit('error', { message: 'Failed to add song. Please try again.' });
      }
    }
  });

  // Remove Song (User)
  socket.on('song:remove', async ({ songId, oduserId }) => {
    if (!socketRequireDB(socket)) return;

    try {
      const userValidation = validateOduserId(oduserId);
      if (!userValidation.isValid) {
        socket.emit('error', { message: userValidation.error });
        return;
      }

      const result = await db.run(
        'DELETE FROM queue WHERE id = ? AND oduserId = ?',
        songId, userValidation.sanitized
      );

      if (result.changes === 0) {
        socket.emit('error', { message: 'Song not found or permission denied' });
        return;
      }

      // Normalize positions after deletion
      await normalizeQueuePositions();

      const updatedQueue = await getQueue();
      io.emit('queue:update', updatedQueue);
      socket.emit('song:removed', { success: true });
      log.info('Song removed by user');
    } catch (err) {
      log.error('Error removing song:', err);
      socket.emit('error', { message: 'Failed to remove song' });
    }
  });

  // Admin Remove
  socket.on('admin:remove', async ({ songId, password }) => {
    if (password !== ADMIN_PASSWORD) {
      return socket.emit('error', { message: 'Invalid password' });
    }
    if (!socketRequireDB(socket)) return;

    try {
      const result = await db.run('DELETE FROM queue WHERE id = ?', songId);
      
      if (result.changes > 0) {
        await normalizeQueuePositions();
      }

      const updatedQueue = await getQueue();
      io.emit('queue:update', updatedQueue);
      socket.emit('admin:removed', { success: true });
      log.info('Song removed by admin');
    } catch (err) {
      log.error('Error in admin:remove:', err);
      socket.emit('error', { message: 'Failed to remove song' });
    }
  });

  // Admin Clear Queue
  socket.on('admin:clear', async ({ password }) => {
    if (password !== ADMIN_PASSWORD) {
      return socket.emit('error', { message: 'Invalid password' });
    }
    if (!socketRequireDB(socket)) return;

    try {
      await db.run('DELETE FROM queue');
      io.emit('queue:update', []);
      socket.emit('admin:cleared', { success: true });
      log.info('Queue cleared by admin');
    } catch (err) {
      log.error('Error clearing queue:', err);
      socket.emit('error', { message: 'Failed to clear queue' });
    }
  });

  // Admin Reorder (supports both drag-drop and button-based reordering)
  socket.on('admin:reorder', async ({ songId, oldIndex, newIndex, direction, password }) => {
    if (password !== ADMIN_PASSWORD) {
      return socket.emit('error', { message: 'Invalid password' });
    }
    if (!socketRequireDB(socket)) return;

    try {
      const queue = await getQueue();
      const currentIndex = queue.findIndex(s => s.id === songId);

      if (currentIndex === -1) {
        socket.emit('error', { message: 'Song not found' });
        return;
      }

      let targetIndex;

      // Support both drag-drop (oldIndex/newIndex) and button-based (direction) reordering
      if (typeof oldIndex === 'number' && typeof newIndex === 'number') {
        // Drag and drop mode
        targetIndex = newIndex;
      } else if (direction) {
        // Button mode (up/down)
        targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      } else {
        socket.emit('error', { message: 'Invalid reorder parameters' });
        return;
      }

      if (targetIndex < 0 || targetIndex >= queue.length) {
        return; // Can't move further
      }

      // Remove the song from its current position
      const [movedSong] = queue.splice(currentIndex, 1);
      // Insert it at the new position
      queue.splice(targetIndex, 0, movedSong);

      // Update all positions in the database
      const updates = queue.map((song, index) => 
        db.run('UPDATE queue SET position = ? WHERE id = ?', index, song.id)
      );
      await Promise.all(updates);

      const updatedQueue = await getQueue();
      io.emit('queue:update', updatedQueue);
      log.info(`Queue reordered: song moved from position ${currentIndex} to ${targetIndex}`);
    } catch (err) {
      log.error('Error reordering queue:', err);
      socket.emit('error', { message: 'Failed to reorder queue' });
    }
  });

  // === BAN MANAGEMENT ===

  // Admin: Ban a user
  socket.on('admin:ban', async ({ oduserId, reason, password }) => {
    if (password !== ADMIN_PASSWORD) {
      return socket.emit('error', { message: 'Invalid password' });
    }
    if (!socketRequireDB(socket)) return;

    try {
      const userValidation = validateOduserId(oduserId);
      if (!userValidation.isValid) {
        socket.emit('error', { message: userValidation.error });
        return;
      }

      const sanitizedOduserId = userValidation.sanitized;
      const sanitizedReason = sanitizeString(reason, MAX_BAN_REASON_LENGTH) || 'Inappropriate behavior';

      // Check if already banned
      const existing = await db.get('SELECT id FROM blocked_users WHERE oduserId = ?', sanitizedOduserId);
      if (existing) {
        socket.emit('error', { message: 'User is already banned' });
        return;
      }

      const banRecord = {
        id: uuidv4(),
        oduserId: sanitizedOduserId,
        reason: sanitizedReason,
        blockedAt: new Date().toISOString(),
        blockedBy: 'admin'
      };

      await db.run(
        `INSERT INTO blocked_users (id, oduserId, reason, blockedAt, blockedBy) 
         VALUES (?, ?, ?, ?, ?)`,
        [banRecord.id, banRecord.oduserId, banRecord.reason, banRecord.blockedAt, banRecord.blockedBy]
      );

      // Remove their song from queue
      const deleteResult = await db.run('DELETE FROM queue WHERE oduserId = ?', sanitizedOduserId);
      
      if (deleteResult.changes > 0) {
        await normalizeQueuePositions();
      }

      const updatedQueue = await getQueue();
      const blockedUsers = await getBlockedUsers();
      
      io.emit('queue:update', updatedQueue);
      io.emit('blocked:update', blockedUsers);
      io.emit('user:banned', { oduserId: sanitizedOduserId, reason: banRecord.reason });
      
      socket.emit('admin:banned', { success: true, oduserId: sanitizedOduserId });
      log.info(`User banned: ${sanitizedOduserId.substring(0, 8)}...`);
    } catch (err) {
      log.error('Error banning user:', err);
      socket.emit('error', { message: 'Failed to ban user' });
    }
  });

  // Admin: Unban a user
  socket.on('admin:unban', async ({ oduserId, password }) => {
    if (password !== ADMIN_PASSWORD) {
      return socket.emit('error', { message: 'Invalid password' });
    }
    if (!socketRequireDB(socket)) return;

    try {
      const userValidation = validateOduserId(oduserId);
      if (!userValidation.isValid) {
        socket.emit('error', { message: userValidation.error });
        return;
      }

      const result = await db.run('DELETE FROM blocked_users WHERE oduserId = ?', userValidation.sanitized);

      if (result.changes === 0) {
        socket.emit('error', { message: 'User not found in ban list' });
        return;
      }

      const blockedUsers = await getBlockedUsers();
      io.emit('blocked:update', blockedUsers);
      io.emit('user:unbanned', { oduserId: userValidation.sanitized });
      
      socket.emit('admin:unbanned', { success: true, oduserId: userValidation.sanitized });
      log.info(`User unbanned: ${userValidation.sanitized.substring(0, 8)}...`);
    } catch (err) {
      log.error('Error unbanning user:', err);
      socket.emit('error', { message: 'Failed to unban user' });
    }
  });

  // Admin: Unban all users
  socket.on('admin:unbanAll', async ({ password }) => {
    if (password !== ADMIN_PASSWORD) {
      return socket.emit('error', { message: 'Invalid password' });
    }
    if (!socketRequireDB(socket)) return;

    try {
      await db.run('DELETE FROM blocked_users');

      io.emit('blocked:update', []);
      io.emit('user:allUnbanned', {});
      
      socket.emit('admin:unbannedAll', { success: true });
      log.info('All users unbanned by admin');
    } catch (err) {
      log.error('Error unbanning all users:', err);
      socket.emit('error', { message: 'Failed to unban all users' });
    }
  });

  // Admin: Get blocked users list
  socket.on('admin:getBlocked', async ({ password }, callback) => {
    if (password !== ADMIN_PASSWORD) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Invalid password' });
      }
      return;
    }
    if (!socketRequireDB(socket, callback)) return;

    try {
      const blockedUsers = await getBlockedUsers();
      if (typeof callback === 'function') {
        callback({ success: true, blockedUsers });
      }
    } catch (err) {
      log.error('Error getting blocked users:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Database error' });
      }
    }
  });

  // Admin: Reset event (clear queue + unban all)
  socket.on('admin:resetEvent', async ({ password }) => {
    if (password !== ADMIN_PASSWORD) {
      return socket.emit('error', { message: 'Invalid password' });
    }
    if (!socketRequireDB(socket)) return;

    try {
      await db.run('DELETE FROM queue');
      await db.run('DELETE FROM blocked_users');

      io.emit('queue:update', []);
      io.emit('blocked:update', []);
      io.emit('user:allUnbanned', {});
      
      socket.emit('admin:eventReset', { success: true });
      log.info('Event reset: Queue cleared and all users unbanned');
    } catch (err) {
      log.error('Error resetting event:', err);
      socket.emit('error', { message: 'Failed to reset event' });
    }
  });

  socket.on('disconnect', (reason) => {
    onlineUsers = Math.max(0, onlineUsers - 1);
    broadcastOnlineUsers();
    log.info(`User disconnected - Reason: ${reason}`);
  });
});

// --- SERVER STARTUP ---

const PORT = process.env.PORT || 5000;

// Initialize database first, then start server
initDB().then((success) => {
  if (!success) {
    log.error('Failed to initialize database. Server will start but may not function correctly.');
  }
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log(`🎵 ESN Lugano Song Queue (SQLite)`);
    console.log(`📡 Running on port ${PORT}`);
    console.log(`🔧 Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);
    console.log(`📊 Database: ${dbReady ? 'ready' : 'not ready'}`);
    if (DEBUG) {
      console.log(`🔑 Admin password: ${ADMIN_PASSWORD}`);
    }
    console.log('========================================');
  });
}).catch((err) => {
  log.error('Fatal error during startup:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log.info('HTTP server closed');
    if (db) {
      db.close().then(() => {
        log.info('Database connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});