// client/src/components/Header.tsx
import React from 'react';
import { TokenStatusInfo, DataSource } from '../types';

interface HeaderProps {
  tokenStatus: TokenStatusInfo;
  activeDataSource?: DataSource | null;
  onOpenDataSources?: () => void;
  onOpenHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tokenStatus,
  activeDataSource,
  onOpenDataSources,
  onOpenHistory
}) => {
  return (
    <header class-name="app-header" className="app-header">
      <div className="header-left">
        <div className="logo-badge">
          <svg width="24" height="24" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z"
              fill="#1ABCFE"
            />
            <path
              d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z"
              fill="#0ACF83"
            />
            <path
              d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z"
              fill="#FF7262"
            />
            <path
              d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z"
              fill="#F24E1E"
            />
            <path
              d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z"
              fill="#A259FF"
            />
            {/* Bottom Right: Changes Badge */}
            <circle cx="28.5" cy="47.5" r="9.5" fill="#FFC700" />
            <g transform="translate(28.5, 47.5) scale(0.56) translate(-12, -12)" fill="#18181B">
              <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
            </g>
          </svg>
        </div>
        <div>
          <h1>Figma Changes Detector</h1>
          <p className="subtitle">SQLite-backed visual regression tracker for Figma components</p>
        </div>
      </div>
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {activeDataSource && onOpenDataSources && (
          <button
            type="button"
            className="btn-pill"
            onClick={onOpenDataSources}
            title="Switch or manage workspaces"
            style={{
              padding: '0.35rem 0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(26, 188, 254, 0.1)',
              color: '#007bb0',
              border: '1px solid rgba(26, 188, 254, 0.3)'
            }}
          >
            📁 <span>{activeDataSource.name}</span> <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>▾</span>
          </button>
        )}
        {onOpenHistory && (
          <button
            type="button"
            className="btn-pill"
            onClick={onOpenHistory}
            style={{ padding: '0.35rem 0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            📋 Running History &amp; Report
          </button>
        )}
        <span id="tokenStatusBadge" className={`status-badge ${tokenStatus.className}`}>
          {tokenStatus.label}
        </span>
      </div>
    </header>
  );
};
