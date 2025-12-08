import React from 'react';
import { Badge } from 'react-bootstrap';

const Header = ({ isConnected, queueLength, theme, onToggleTheme, onlineUsers }) => {
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
            <h1 className="app-title">ESN Lugano Karaoke Song Queue</h1>
            <p className="app-subtitle">
              Request your favorite tracks 🎶 - Made by{' '}
              <a className="text-warning" href="https://frenzoid.dev/">
                Frenzoid
              </a>{' '}
              with ❤️ for{' '}
              <a className="text-warning" href="https://chat.whatsapp.com/HRUUfqgjdjn24IUrI23hwd">
                ESN Lugano
              </a>{' '}
              🦢
            </p>
          </div>
        </div>

        <div className="status-section">
          {/* Theme Toggle Button */}
          <button
            className="theme-toggle-button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>

          {/* Online Users Badge */}
          <Badge className="header-badge header-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            <span className="badge-value">{onlineUsers}</span>
            <span className="badge-label">online</span>
          </Badge>

          {/* Queue Count */}
          <Badge className="header-badge header-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span className="badge-value">{queueLength}</span>
            <span className="badge-label">in queue</span>
          </Badge>

          {/* Connection Status */}
          <Badge
            bg={isConnected ? 'success' : 'danger'}
            className="header-badge header-badge"
          >
            <span className={`status-dot ${isConnected ? 'connected' : 'offline'}`}></span>
            <span className="badge-label">{isConnected ? 'On' : 'Off'}</span>
          </Badge>

        </div>
      </div>
    </header>
  );
};

export default Header;