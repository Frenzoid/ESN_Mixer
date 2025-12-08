import React, { useState } from 'react';
import { Card, Form, Button, InputGroup } from 'react-bootstrap';

// Validation constants (should match server)
const MAX_SONG_TITLE_LENGTH = 50;
const MAX_ARTIST_NAME_LENGTH = 20;
const MAX_REQUESTER_NAME_LENGTH = 20;

const SongRequestForm = ({ onSubmit, hasActiveRequest, isBanned, banReason }) => {
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!songTitle.trim()) {
      newErrors.songTitle = 'Song title is required';
    } else if (songTitle.trim().length > MAX_SONG_TITLE_LENGTH) {
      newErrors.songTitle = `Song title must be less than ${MAX_SONG_TITLE_LENGTH} characters`;
    }
    
    if (!artistName.trim()) {
      newErrors.artistName = 'Artist name is required';
    } else if (artistName.trim().length > MAX_ARTIST_NAME_LENGTH) {
      newErrors.artistName = `Artist name must be less than ${MAX_ARTIST_NAME_LENGTH} characters`;
    }
    
    if (requesterName.trim().length > MAX_REQUESTER_NAME_LENGTH) {
      newErrors.requesterName = `Name must be less than ${MAX_REQUESTER_NAME_LENGTH} characters`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isBanned || !validateForm()) {
      return;
    }

    setIsSubmitting(true);

    onSubmit({
      songTitle: songTitle.trim(),
      artistName: artistName.trim(),
      requesterName: requesterName.trim() || 'Anonymous'
    });

    // Reset form
    setSongTitle('');
    setArtistName('');
    setRequesterName('');
    setErrors({});
    setIsSubmitting(false);
  };

  const handleSongTitleChange = (e) => {
    setSongTitle(e.target.value);
    if (errors.songTitle) {
      setErrors(prev => ({ ...prev, songTitle: null }));
    }
  };

  const handleArtistNameChange = (e) => {
    setArtistName(e.target.value);
    if (errors.artistName) {
      setErrors(prev => ({ ...prev, artistName: null }));
    }
  };

  const handleRequesterNameChange = (e) => {
    setRequesterName(e.target.value);
    if (errors.requesterName) {
      setErrors(prev => ({ ...prev, requesterName: null }));
    }
  };

  return (
    <Card className="request-card">
      <Card.Body>
        <div className="card-header-custom">
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <h2 className="card-title-custom">Request a Song</h2>
        </div>

        {isBanned ? (
          <div className="banned-message">
            <div className="banned-icon-small">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </div>
            <p>You have been blocked from requesting songs</p>
            {banReason && (
              <div className="ban-reason">
                <span className="ban-reason-label">Reason: </span>
                <span className="ban-reason-text">{banReason}</span>
              </div>
            )}
            <span className="banned-hint-small">Please speak with the event organizers or the DJ if you believe this is a mistake.</span>
          </div>
        ) : hasActiveRequest ? (
          <div className="already-requested">
            <div className="already-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p>You already have a song in the queue!</p>
            <span className="already-hint">Remove it or wait for it to be played to request another.</span>
          </div>
        ) : (
          <Form onSubmit={handleSubmit} className="request-form">
            <Form.Group className="mb-1">
              <Form.Label className="form-label-custom">Song Title *</Form.Label>
              <InputGroup className={`custom-input-group ${errors.songTitle ? 'is-invalid' : ''}`}>
                <InputGroup.Text>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Enter song title"
                  value={songTitle}
                  onChange={handleSongTitleChange}
                  required
                  maxLength={MAX_SONG_TITLE_LENGTH}
                  className="custom-input"
                  isInvalid={!!errors.songTitle}
                />
              </InputGroup>
              {errors.songTitle && (
                <Form.Text className="text-danger">{errors.songTitle}</Form.Text>
              )}
              <Form.Text className="text-muted">
                {songTitle.length}/{MAX_SONG_TITLE_LENGTH}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-1">
              <Form.Label className="form-label-custom">Artist Name *</Form.Label>
              <InputGroup className={`custom-input-group ${errors.artistName ? 'is-invalid' : ''}`}>
                <InputGroup.Text>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Enter artist name"
                  value={artistName}
                  onChange={handleArtistNameChange}
                  required
                  maxLength={MAX_ARTIST_NAME_LENGTH}
                  className="custom-input"
                  isInvalid={!!errors.artistName}
                />
              </InputGroup>
              {errors.artistName && (
                <Form.Text className="text-danger">{errors.artistName}</Form.Text>
              )}
              <Form.Text className="text-muted">
                {artistName.length}/{MAX_ARTIST_NAME_LENGTH}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-1">
              <Form.Label className="form-label-custom">Your Name (optional)</Form.Label>
              <InputGroup className={`custom-input-group ${errors.requesterName ? 'is-invalid' : ''}`}>
                <InputGroup.Text>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Your name (shows as Anonymous if empty)"
                  value={requesterName}
                  onChange={handleRequesterNameChange}
                  maxLength={MAX_REQUESTER_NAME_LENGTH}
                  className="custom-input"
                  isInvalid={!!errors.requesterName}
                />
              </InputGroup>
              {errors.requesterName && (
                <Form.Text className="text-danger">{errors.requesterName}</Form.Text>
              )}
            </Form.Group>

            <Button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || !songTitle.trim() || !artistName.trim()}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Adding...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add to Queue
                </>
              )}
            </Button>
          </Form>
        )}
      </Card.Body>
    </Card>
  );
};

export default SongRequestForm;