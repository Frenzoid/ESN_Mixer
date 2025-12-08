import React, { useState } from 'react';
import { Card, Form, Button, InputGroup, Collapse, Tab, Tabs, Badge } from 'react-bootstrap';

const AdminPanel = ({ 
  isAdmin, 
  onLogin, 
  onLogout, 
  onClearQueue, 
  onUnbanAll,
  blockedUsers = [],
  onUnbanUser
}) => {
  const [password, setPassword] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('controls');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    try {
      const success = await onLogin(password);
      if (success) {
        setPassword('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the entire queue? This cannot be undone.')) {
      onClearQueue();
    }
  };

  const handleUnbanAll = () => {
    if (window.confirm('Are you sure you want to unban all users?')) {
      onUnbanAll();
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateId = (id) => {
    if (!id) return 'Unknown';
    return id.length > 8 ? `${id.substring(0, 8)}...` : id;
  };

  return (
    <Card className="admin-card">
      <Card.Body>
        <div
          className="admin-header"
          onClick={() => setIsOpen(!isOpen)}
          role="button"
          aria-expanded={isOpen}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
        >
          <div className="admin-header-left">
            <div className={`card-icon admin-icon ${isAdmin ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h3 className="admin-title">Admin Controls</h3>
              {isAdmin && <span className="admin-status">Logged in as Admin</span>}
            </div>
          </div>
          <div className={`toggle-icon ${isOpen ? 'open' : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6,9 12,15 18,9" />
            </svg>
          </div>
        </div>

        <Collapse in={isOpen}>
          <div className="admin-content">
            {!isAdmin ? (
              <Form onSubmit={handleSubmit} className="admin-form">
                <Form.Group>
                  <Form.Label className="form-label-custom">Admin Password</Form.Label>
                  <InputGroup className="custom-input-group">
                    <InputGroup.Text>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </InputGroup.Text>
                    <Form.Control
                      type="password"
                      placeholder="Enter admin password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="custom-input"
                      autoComplete="current-password"
                    />
                  </InputGroup>
                </Form.Group>
                <Button
                  type="submit"
                  className="admin-login-button"
                  disabled={isLoading || !password.trim()}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                      </svg>
                      Login as Admin
                    </>
                  )}
                </Button>
              </Form>
            ) : (
              <div className="admin-controls">
                <Tabs
                  activeKey={activeTab}
                  onSelect={(k) => setActiveTab(k)}
                  className="admin-tabs mb-3"
                >
                  <Tab 
                    eventKey="controls" 
                    title={
                      <span className="tab-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                        </svg>
                        Controls
                      </span>
                    }
                  >
                    <div className="admin-info">
                      <div className="admin-badge">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>Admin Mode Active</span>
                      </div>
                      <p className="admin-hint">
                        Manage the queue: reorder songs, remove them, or ban users.
                      </p>
                    </div>

                    <div className="admin-buttons">
                      <Button
                        variant="outline-danger"
                        className="clear-queue-button"
                        onClick={handleClear}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6" />
                          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        Clear Queue
                      </Button>

                      <Button
                        variant="outline-success"
                        className="unban-all-button"
                        onClick={handleUnbanAll}
                        disabled={blockedUsers.length === 0}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 00-3-3.87" />
                          <path d="M16 3.13a4 4 0 010 7.75" />
                        </svg>
                        Unban All ({blockedUsers.length})
                      </Button>

                      <Button
                        variant="outline-secondary"
                        className="logout-button"
                        onClick={onLogout}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                        Logout
                      </Button>
                    </div>
                  </Tab>

                  <Tab 
                    eventKey="blocked" 
                    title={
                      <span className="tab-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                        Blocked
                        {blockedUsers.length > 0 && (
                          <Badge bg="danger" className="ms-1">{blockedUsers.length}</Badge>
                        )}
                      </span>
                    }
                  >
                    <div className="blocked-users-section">
                      {blockedUsers.length === 0 ? (
                        <div className="no-blocked-users">
                          <div className="no-blocked-icon">
                            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 00-3-3.87" />
                              <path d="M16 3.13a4 4 0 010 7.75" />
                            </svg>
                          </div>
                          <p>No blocked users</p>
                          <span className="no-blocked-hint">Users you ban will appear here</span>
                        </div>
                      ) : (
                        <div className="blocked-users-list">
                          {blockedUsers.map((user) => (
                            <div key={user.id} className="blocked-user-item">
                              <div className="blocked-user-info">
                                <div className="blocked-user-icon">
                                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                  </svg>
                                </div>
                                <div className="blocked-user-details">
                                  <span className="blocked-user-id">
                                    User ID: {truncateId(user.oduserId)}
                                  </span>
                                  <span className="blocked-user-reason">
                                    {user.reason || 'No reason provided'}
                                  </span>
                                  <span className="blocked-user-date">
                                    Blocked: {formatDate(user.blockedAt)}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="outline-success"
                                size="sm"
                                className="unban-button"
                                onClick={() => onUnbanUser(user.oduserId)}
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="20,6 9,17 4,12" />
                                </svg>
                                Unban
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Tab>
                </Tabs>
              </div>
            )}
          </div>
        </Collapse>
      </Card.Body>
    </Card>
  );
};

export default AdminPanel;