import React from 'react';
import { Badge } from 'react-bootstrap';

const Header = ({ isConnected, queueLength }) => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-section">
          <div className="esn-logo-container">
            <img
              src="https://eebe.upc.edu/en/incoming/incoming-documents/esn-logo-star.png/@@images/image.png"
              alt="ESN Star Logo"
              className="esn-star-logo"
            />
          </div>
          <div className="title-section">
            <h1 className="app-title">ESN Lugano Song Queue</h1>
            <p className="app-subtitle">Request your favorite tracks 🎶 - Made by <a className='text-warning' href="https://frenzoid.dev/"> Frenzoid</a> with ❤️</p>
          </div>
        </div>

        <div className="status-section">
          <Badge
            bg={isConnected ? 'success' : 'danger'}
            className="status-badge"
          >
            <span className={`status-dot ${isConnected ? 'connected' : ''}`}></span>
            {isConnected ? 'Live' : 'Offline'}
          </Badge>
          <Badge bg="secondary" className="queue-badge">
            <span className="queue-count">{queueLength}</span>
            <span className="queue-label">in queue</span>
          </Badge>
        </div>
      </div>
    </header>
  );
};

export default Header;