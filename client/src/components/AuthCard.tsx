// client/src/components/AuthCard.tsx
import React, { useState } from 'react';
import { TokenStatusInfo } from '../types';

interface AuthCardProps {
  token: string;
  onTokenChange: (newToken: string) => void;
  saveToLocalStorage: boolean;
  onSaveToLocalStorageChange: (save: boolean) => void;
  tokenStatus: TokenStatusInfo;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  token,
  onTokenChange,
  saveToLocalStorage,
  onSaveToLocalStorageChange,
  tokenStatus
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const handleClear = () => {
    onTokenChange('');
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="step-num">1</span>
        <h2>Figma Authentication</h2>
      </div>
      <div className="form-group">
        <label htmlFor="figmaToken">
          Personal Access Token{' '}
          <a
            href="https://www.figma.com/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="label-link"
          >
            Get token from Figma &rarr;
          </a>
        </label>
        <div className="input-with-button">
          <input
            type={showPassword ? 'text' : 'password'}
            id="figmaToken"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder={tokenStatus.placeholder}
            autoComplete="off"
          />
          <button
            type="button"
            id="toggleTokenVisibility"
            className="btn-icon"
            title="Toggle visibility"
            onClick={() => setShowPassword(!showPassword)}
          >
            👁
          </button>
        </div>
        <div className="checkbox-row">
          <label className="custom-checkbox">
            <input
              type="checkbox"
              id="saveTokenCheck"
              checked={saveToLocalStorage}
              onChange={(e) => onSaveToLocalStorageChange(e.target.checked)}
            />
            <span>Save token locally in browser</span>
          </label>
          <button type="button" id="clearTokenBtn" className="btn-text" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
