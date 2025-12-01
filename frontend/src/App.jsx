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

// Vite uses import.meta.env instead of process.env
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Safe localStorage helper
const getStoredUserId = () => {
  try {
    let storedUserId = localStorage.getItem('songQueueUserId');
    if (!storedUserId) {
      storedUserId = uuidv4();
      localStorage.setItem('songQueueUserId', storedUserId);
    }
    return storedUserId;
  } catch (error) {
    console.warn('localStorage not available, using session ID:', error);
    return uuidv4();
  }
};

function App() {
  const socketRef = useRef(null);
  const socketInitialized = useRef(false);

  const [queue, setQueue] = useState([]);
  const [userId] = useState(getStoredUserId);
  const [userRequestId, setUserRequestId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [notification, setNotification] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Ref to track current userRequestId for use in socket callbacks
  const userRequestIdRef = useRef(userRequestId);
  useEffect(() => {
    userRequestIdRef.current = userRequestId;
  }, [userRequestId]);

  // Auto-dismiss notification
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  // Socket connection
  useEffect(() => {
    if (socketInitialized.current) return;
    socketInitialized.current = true;

    console.log('Connecting to:', SOCKET_URL);

    try {
      const newSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      socketRef.current = newSocket;

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        setConnectionError(null);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        setConnectionError(`Cannot connect to server: ${error.message}`);
        setIsConnected(false);
      });

      newSocket.on('queue:update', (updatedQueue) => {
        console.log('Queue updated:', updatedQueue?.length, 'items');
        setQueue(updatedQueue || []);

        // Check if user's song is still in the queue
        // If not, clear their userRequestId so they can request again
        const currentRequestId = userRequestIdRef.current;
        if (currentRequestId && updatedQueue) {
          const userSongStillInQueue = updatedQueue.some(song => song.id === currentRequestId);
          if (!userSongStillInQueue) {
            console.log('User song no longer in queue, clearing request ID');
            setUserRequestId(null);
          }
        }
      });

      newSocket.on('error', (errorData) => {
        setNotification({ message: errorData?.message || 'An error occurred', type: 'danger' });
      });

      newSocket.on('song:added', (data) => {
        if (data?.success) {
          setUserRequestId(data.songId);
          setNotification({ message: 'Your song has been added to the queue!', type: 'success' });
        }
      });

      newSocket.on('song:removed', (data) => {
        if (data?.success) {
          setUserRequestId(null);
          setNotification({ message: 'Your song has been removed from the queue.', type: 'info' });
        }
      });

      newSocket.on('admin:removed', (data) => {
        if (data?.success) {
          setNotification({ message: 'Song removed successfully.', type: 'success' });
        }
      });

      newSocket.on('admin:cleared', (data) => {
        if (data?.success) {
          // Queue was cleared, so user's song is definitely gone
          setUserRequestId(null);
          setNotification({ message: 'Queue has been cleared.', type: 'warning' });
        }
      });

      return () => {
        console.log('Cleaning up socket');
        newSocket.close();
      };
    } catch (error) {
      console.error('Socket initialization error:', error);
      setConnectionError('Failed to initialize connection');
    }
  }, []);

  // Check for existing request when connected
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && isConnected && userId) {
      socket.emit('user:check', userId, (response) => {
        if (response?.hasRequest) {
          setUserRequestId(response.requestId);
        } else {
          // Server says user has no request, make sure we're in sync
          setUserRequestId(null);
        }
      });
    }
  }, [isConnected, userId]);

  const handleAddSong = useCallback((songData) => {
    const socket = socketRef.current;
    if (socket && userId) {
      socket.emit('song:add', { ...songData, userId });
    }
  }, [userId]);

  const handleRemoveSong = useCallback((songId) => {
    const socket = socketRef.current;
    if (socket && userId) {
      socket.emit('song:remove', { songId, userId });
    }
  }, [userId]);

  const handleAdminRemove = useCallback((songId) => {
    const socket = socketRef.current;
    if (socket && adminPassword) {
      socket.emit('admin:remove', { songId, password: adminPassword });
    }
  }, [adminPassword]);

  const handleAdminClear = useCallback(() => {
    const socket = socketRef.current;
    if (socket && adminPassword) {
      socket.emit('admin:clear', { password: adminPassword });
    }
  }, [adminPassword]);

  const handleAdminReorder = useCallback((songId, direction) => {
    const socket = socketRef.current;
    if (socket && adminPassword) {
      socket.emit('admin:reorder', { songId, direction, password: adminPassword });
    }
  }, [adminPassword]);

  const handleAdminLogin = useCallback(async (password) => {
    try {
      const response = await fetch(`${SOCKET_URL}/api/verify-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (data.success) {
        setIsAdmin(true);
        setAdminPassword(password);
        setNotification({ message: 'Admin mode activated!', type: 'success' });
        return true;
      } else {
        setNotification({ message: 'Invalid admin password', type: 'danger' });
        return false;
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setNotification({ message: 'Failed to verify password', type: 'danger' });
      return false;
    }
  }, []);

  const handleAdminLogout = useCallback(() => {
    setIsAdmin(false);
    setAdminPassword('');
    setNotification({ message: 'Admin mode deactivated', type: 'info' });
  }, []);

  const hasActiveRequest = userRequestId !== null;

  return (
    <div className="app-wrapper">
      <div className="background-effects">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <Container fluid className="app-container">
        <Header isConnected={isConnected} queueLength={queue.length} />

        {connectionError && (
          <Alert variant="danger" className="notification-alert">
            {connectionError}
            <br />
            <small>Make sure the backend server is running on {SOCKET_URL}</small>
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
            />
            <AdminPanel
              isAdmin={isAdmin}
              onLogin={handleAdminLogin}
              onLogout={handleAdminLogout}
              onClearQueue={handleAdminClear}
            />
          </Col>
          <Col lg={8}>
            <QueueList
              queue={queue}
              userId={userId}
              isAdmin={isAdmin}
              onRemove={handleRemoveSong}
              onAdminRemove={handleAdminRemove}
              onAdminReorder={handleAdminReorder}
            />
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;