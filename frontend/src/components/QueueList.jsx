import React from 'react';
import { Card, Button, Badge } from 'react-bootstrap';

const QueueList = ({
  queue,
  userId,
  isAdmin,
  onRemove,
  onAdminRemove,
  onAdminReorder
}) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isUserSong = (song) => song.userId === userId;

  return (
    <Card className="queue-card">
      <Card.Body>
        <div className="card-header-custom">
          <div className="card-icon queue-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <h2 className="card-title-custom">Song Queue</h2>
          <Badge bg="primary" className="queue-count-badge">
            {queue.length} {queue.length === 1 ? 'song' : 'songs'}
          </Badge>
        </div>

        {queue.length === 0 ? (
          <div className="empty-queue">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="empty-text">The queue is empty</p>
            <span className="empty-hint">Be the first to request a song!</span>
          </div>
        ) : (
          <div className="queue-list">
            {queue.map((song, index) => (
              <div
                key={song.id}
                className={`queue-item ${isUserSong(song) ? 'user-song' : ''} ${index === 0 ? 'next-up' : ''}`}
              >
                <div className="queue-position">
                  {index === 0 ? (
                    <div className="next-badge">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </div>
                  ) : (
                    <span className="position-number">{index + 1}</span>
                  )}
                </div>

                <div className="song-info">
                  <div className="song-main">
                    <h3 className="song-title">{song.songTitle}</h3>
                    <span className="song-artist">{song.artistName}</span>
                  </div>
                  <div className="song-meta">
                    <span className="requester">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {song.requesterName}
                    </span>
                    <span className="timestamp">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12,6 12,12 16,14" />
                      </svg>
                      {formatTime(song.timestamp)}
                    </span>
                  </div>
                </div>

                <div className="song-actions">
                  {isUserSong(song) && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="action-button remove-button"
                      onClick={() => onRemove(song.id)}
                      title="Remove your request"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                      <span>Remove</span>
                    </Button>
                  )}

                  {isAdmin && (
                    <div className="admin-actions">
                      <div className="reorder-buttons">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="action-button reorder-button"
                          onClick={() => onAdminReorder(song.id, 'up')}
                          disabled={index === 0}
                          title="Move up"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="18,15 12,9 6,15" />
                          </svg>
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="action-button reorder-button"
                          onClick={() => onAdminReorder(song.id, 'down')}
                          disabled={index === queue.length - 1}
                          title="Move down"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6,9 12,15 18,9" />
                          </svg>
                        </Button>
                      </div>

                      <Button
                        variant="outline-danger"
                        size="sm"
                        className="action-button delete-button"
                        onClick={() => onAdminRemove(song.id)}
                        title="Delete from queue"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6" />
                          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" />
                        </svg>
                      </Button>
                    </div>
                  )}

                  {isUserSong(song) && (
                    <Badge bg="info" className="your-song-badge">Your Request</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default QueueList;