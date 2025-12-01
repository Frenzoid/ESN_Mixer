import React, { useState } from 'react';
import { Card, Form, Button, InputGroup, Collapse } from 'react-bootstrap';

const AdminPanel = ({ isAdmin, onLogin, onLogout, onClearQueue }) => {
  const [password, setPassword] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    const success = await onLogin(password);
    setIsLoading(false);

    if (success) {
      setPassword('');
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the entire queue? This cannot be undone.')) {
      onClearQueue();
    }
  };

  return (
    <Card className="admin-card">
      <Card.Body>
        <div
          className="admin-header"
          onClick={() => setIsOpen(!isOpen)}
          role="button"
          aria-expanded={isOpen}
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
                <div className="admin-info">
                  <div className="admin-badge">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Admin Mode Active</span>
                  </div>
                  <p className="admin-hint">
                    You can now manage the queue: reorder songs, mark them as played, or remove them.
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
                    Clear Entire Queue
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
              </div>
            )}
          </div>
        </Collapse>
      </Card.Body>
    </Card>
  );
};

export default AdminPanel;