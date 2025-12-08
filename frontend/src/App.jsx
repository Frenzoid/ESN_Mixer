import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { Container, Row, Col, Alert } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';

import Header from './components/Header';
import SongRequestForm from './components/SongRequestForm';
import QueueList from './components/QueueList';
import AdminPanel from './components/AdminPanel';

import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/App.css';

// Environment
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const IS_PRODUCTION = import.meta.env.PROD;
const DEBUG = import.meta.env.VITE_DEBUG === 'true' || !IS_PRODUCTION;

// Debug logger
const log = {
  info: (...args) => DEBUG && console.log('[App]', ...args),
  error: (...args) => console.error('[App]', ...args),
  warn: (...args) => console.warn('[App]', ...args),
};

// Socket callback timeout (ms)
const SOCKET_CALLBACK_TIMEOUT = 10000;

// Safe localStorage helper
const safeLocalStorage = {
  getItem: (key, fallback = null) => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
};

// Get or create user ID
const getStoredOduserId = () => {
  let storedId = safeLocalStorage.getItem('songQueueOduserId');
  if (!storedId) {
    storedId = uuidv4();
    safeLocalStorage.setItem('songQueueOduserId', storedId);
  }
  return storedId;
};

// Theme helpers
const getStoredTheme = () => {
  const stored = safeLocalStorage.getItem('songQueueTheme');
  if (stored) return stored;
  
  // Check system preference
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

const setStoredTheme = (theme) => {
  safeLocalStorage.setItem('songQueueTheme', theme);
};

// Helper for socket callbacks with timeout
const emitWithTimeout = (socket, event, data, callback, timeout = SOCKET_CALLBACK_TIMEOUT) => {
  if (!socket?.connected) {
    log.warn(`Socket not connected, cannot emit ${event}`);
    callback?.({ success: false, error: 'Not connected' });
    return;
  }

  let timeoutId;
  let hasResponded = false;

  const wrappedCallback = (response) => {
    if (hasResponded) return;
    hasResponded = true;
    clearTimeout(timeoutId);
    callback?.(response);
  };

  timeoutId = setTimeout(() => {
    if (!hasResponded) {
      hasResponded = true;
      log.warn(`Socket callback timeout for ${event}`);
      callback?.({ success: false, error: 'Request timed out' });
    }
  }, timeout);

  socket.emit(event, data, wrappedCallback);
};

function App() {
  // Refs
  const socketRef = useRef(null);
  const socketInitialized = useRef(false);
  const oduserId = useRef(getStoredOduserId());

  // State
  const [queue, setQueue] = useState([]);
  const [userRequestId, setUserRequestId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [notification, setNotification] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  // Ban state
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [blockedUsers, setBlockedUsers] = useState([]);
  
  // Theme state
  const [theme, setTheme] = useState(getStoredTheme);
  
  // Online users count
  const [onlineUsers, setOnlineUsers] = useState(0);

  // Ref to track userRequestId in callbacks
  const userRequestIdRef = useRef(userRequestId);
  useEffect(() => {
    userRequestIdRef.current = userRequestId;
  }, [userRequestId]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    setStoredTheme(theme);
  }, [theme]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // Auto-dismiss notification
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  // Socket connection
  useEffect(() => {
    if (socketInitialized.current) return;
    socketInitialized.current = true;

    log.info('Connecting to:', SOCKET_URL);

    try {
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        log.info('Connected to server');
        setIsConnected(true);
        setConnectionError(null);
      });

      socket.on('disconnect', (reason) => {
        log.info('Disconnected:', reason);
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        log.error('Connection error:', error.message);
        setConnectionError(`Cannot connect to server: ${error.message}`);
        setIsConnected(false);
      });

      socket.on('queue:update', (updatedQueue) => {
        log.info('Queue updated:', updatedQueue?.length, 'items');
        setQueue(updatedQueue || []);

        // Check if user's song is still in queue
        const currentRequestId = userRequestIdRef.current;
        if (currentRequestId && updatedQueue) {
          const stillInQueue = updatedQueue.some(song => song.id === currentRequestId);
          if (!stillInQueue) {
            log.info('User song no longer in queue');
            setUserRequestId(null);
          }
        }
      });

      socket.on('users:count', (count) => {
        log.info('Online users:', count);
        setOnlineUsers(count);
      });

      socket.on('error', (errorData) => {
        if (errorData?.blocked) {
          setIsBanned(true);
          setBanReason(errorData.reason || 'Inappropriate behavior');
        }
        showNotification(errorData?.message || 'An error occurred', 'danger');
      });

      socket.on('song:added', (data) => {
        if (data?.success) {
          setUserRequestId(data.songId);
          showNotification('Your song has been added to the queue!', 'success');
        }
      });

      socket.on('song:removed', (data) => {
        if (data?.success) {
          setUserRequestId(null);
          showNotification('Your song has been removed from the queue.', 'info');
        }
      });

      socket.on('admin:removed', (data) => {
        if (data?.success) {
          showNotification('Song removed successfully.', 'success');
        }
      });

      socket.on('admin:cleared', (data) => {
        if (data?.success) {
          setUserRequestId(null);
          showNotification('Queue has been cleared.', 'warning');
        }
      });

      // Ban events
      socket.on('blocked:update', (users) => {
        setBlockedUsers(users || []);
      });

      socket.on('user:banned', (data) => {
        if (data.oduserId === oduserId.current) {
          setIsBanned(true);
          setBanReason(data.reason || 'Inappropriate behavior');
          setUserRequestId(null);
        }
      });

      socket.on('user:unbanned', (data) => {
        if (data.oduserId === oduserId.current) {
          setIsBanned(false);
          setBanReason('');
        }
      });

      socket.on('user:allUnbanned', () => {
        setIsBanned(false);
        setBanReason('');
      });

      socket.on('admin:banned', (data) => {
        if (data?.success) {
          showNotification('User has been banned.', 'warning');
        }
      });

      socket.on('admin:unbanned', (data) => {
        if (data?.success) {
          showNotification('User has been unbanned.', 'success');
        }
      });

      socket.on('admin:unbannedAll', (data) => {
        if (data?.success) {
          showNotification('All users have been unbanned.', 'success');
        }
      });

      socket.on('admin:eventReset', (data) => {
        if (data?.success) {
          setUserRequestId(null);
          showNotification('Event reset: Queue cleared and all users unbanned.', 'success');
        }
      });

      return () => {
        log.info('Cleaning up socket');
        socket.close();
      };
    } catch (error) {
      log.error('Socket initialization error:', error);
      setConnectionError('Failed to initialize connection');
    }
  }, [showNotification]);

  // Check existing request and ban status when connected
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    emitWithTimeout(
      socket,
      'user:check',
      oduserId.current,
      (response) => {
        if (response?.error) {
          log.warn('user:check error:', response.error);
          return;
        }
        
        setUserRequestId(response?.hasRequest ? response.requestId : null);
        
        if (response?.blocked) {
          setIsBanned(true);
          setBanReason(response.blocked.reason || 'Inappropriate behavior');
        }
      }
    );
  }, [isConnected]);

  // Fetch blocked users when admin logs in
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isAdmin || !adminPassword || !isConnected) return;

    emitWithTimeout(
      socket,
      'admin:getBlocked',
      { password: adminPassword },
      (response) => {
        if (response?.success) {
          setBlockedUsers(response.blockedUsers || []);
        }
      }
    );
  }, [isAdmin, adminPassword, isConnected]);

  // Action handlers
  const handleAddSong = useCallback((songData) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) {
      showNotification('Not connected to server', 'danger');
      return;
    }
    socket.emit('song:add', { ...songData, oduserId: oduserId.current });
  }, [isConnected, showNotification]);

  const handleRemoveSong = useCallback((songId) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) {
      showNotification('Not connected to server', 'danger');
      return;
    }
    socket.emit('song:remove', { songId, oduserId: oduserId.current });
  }, [isConnected, showNotification]);

  const handleAdminRemove = useCallback((songId) => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !adminPassword) return;
    socket.emit('admin:remove', { songId, password: adminPassword });
  }, [adminPassword, isConnected]);

  const handleAdminClear = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !adminPassword) return;
    socket.emit('admin:clear', { password: adminPassword });
  }, [adminPassword, isConnected]);

  const handleAdminReorder = useCallback((songId, oldIndex, newIndex) => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !adminPassword) return;
    socket.emit('admin:reorder', { songId, oldIndex, newIndex, password: adminPassword });
  }, [adminPassword, isConnected]);

  const handleBanUser = useCallback((targetOduserId, reason) => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !adminPassword) return;
    socket.emit('admin:ban', { oduserId: targetOduserId, reason, password: adminPassword });
  }, [adminPassword, isConnected]);

  const handleUnbanUser = useCallback((targetOduserId) => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !adminPassword) return;
    socket.emit('admin:unban', { oduserId: targetOduserId, password: adminPassword });
  }, [adminPassword, isConnected]);

  const handleUnbanAll = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !adminPassword) return;
    socket.emit('admin:unbanAll', { password: adminPassword });
  }, [adminPassword, isConnected]);

  const handleAdminLogin = useCallback(async (password) => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket || !isConnected) {
        showNotification('Not connected to server', 'danger');
        resolve(false);
        return;
      }

      emitWithTimeout(
        socket,
        'admin:login',
        { password },
        (response) => {
          if (response?.success) {
            setIsAdmin(true);
            setAdminPassword(password);
            showNotification('Admin mode activated!', 'success');
            resolve(true);
          } else {
            showNotification(response?.message || response?.error || 'Invalid admin password', 'danger');
            resolve(false);
          }
        }
      );
    });
  }, [isConnected, showNotification]);

  const handleAdminLogout = useCallback(() => {
    setIsAdmin(false);
    setAdminPassword('');
    setBlockedUsers([]);
    showNotification('Admin mode deactivated', 'info');
  }, [showNotification]);

  const hasActiveRequest = userRequestId !== null;

  return (
    <div className="app-wrapper">
      <div className="background-effects">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <Container fluid className="app-container">
        <Header 
          isConnected={isConnected} 
          queueLength={queue.length} 
          theme={theme}
          onToggleTheme={toggleTheme}
          onlineUsers={onlineUsers}
        />

        {connectionError && (
          <Alert variant="danger" className="notification-alert">
            {connectionError}
            <br />
            <small>Error connecting to: {SOCKET_URL}</small>
          </Alert>
        )}

        {notification && (
          <Alert
            variant={notification.type}
            className="notification-alert"
            onClose={clearNotification}
            dismissible
          >
            {notification.message}
          </Alert>
        )}

        <Row className="main-content">
          <Col lg={4} className="mb-4">
            <SongRequestForm
              onSubmit={handleAddSong}
              hasActiveRequest={hasActiveRequest}
              isBanned={isBanned}
              banReason={banReason}
            />
            <AdminPanel
              isAdmin={isAdmin}
              onLogin={handleAdminLogin}
              onLogout={handleAdminLogout}
              onClearQueue={handleAdminClear}
              onUnbanAll={handleUnbanAll}
              blockedUsers={blockedUsers}
              onUnbanUser={handleUnbanUser}
            />
          </Col>
          <Col lg={8}>
            <QueueList
              queue={queue}
              oduserId={oduserId.current}
              isAdmin={isAdmin}
              onRemove={handleRemoveSong}
              onAdminRemove={handleAdminRemove}
              onAdminReorder={handleAdminReorder}
              onBanUser={handleBanUser}
            />
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;