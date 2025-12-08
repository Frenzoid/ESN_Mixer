import React, { useState } from 'react';
import { Card, Button, Badge, Modal, Form } from 'react-bootstrap';

const QueueList = ({
  queue,
  userId,
  isAdmin,
  onRemove,
  onAdminRemove,
  onAdminReorder,
  onBanUser
}) => {
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('');

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isUserSong = (song) => song.userId === userId;

  const handleBanClick = (song) => {
    setBanTarget(song);
    setBanReason('');
    setShowBanModal(true);
  };

  const handleBanConfirm = () => {
    if (banTarget && onBanUser) {
      onBanUser(banTarget.userId, banReason || 'Inappropriate behavior');
    }
    setShowBanModal(false);
    setBanTarget(null);
    setBanReason('');
  };

  const handleBanCancel = () => {
    setShowBanModal(false);
    setBanTarget(null);
    setBanReason('');
  };

  return (
    <>
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
                          variant="outline-warning"
                          size="sm"
                          className="action-button ban-button"
                          onClick={() => handleBanClick(song)}
                          title="Ban this user"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        </Button>

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

      {/* Ban Confirmation Modal */}
      <Modal show={showBanModal} onHide={handleBanCancel} centered className="ban-modal">
        <Modal.Header closeButton>
          <Modal.Title>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            Ban User
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {banTarget && (
            <>
              <p>
                Are you sure you want to ban the user who requested:
              </p>
              <div className="ban-target-info">
                <strong>{banTarget.songTitle}</strong> by {banTarget.artistName}
                <br />
                <small className="text-muted">Requested by: {banTarget.requesterName}</small>
              </div>
              <Form.Group className="mt-3">
                <Form.Label>Reason for ban (optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="e.g., Inappropriate song requests"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </Form.Group>
              <p className="mt-3 text-danger">
                <small>
                  This will remove their current song and prevent them from making new requests.
                </small>
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleBanCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleBanConfirm}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            Ban User
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default QueueList;