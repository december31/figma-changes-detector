# Figma Changes Detector

A SQLite-backed web application that calls the Figma REST API to fetch component images, saves every fetched version on disk under `/assets`, automatically compares each new fetch against the previous fetch to detect visual changes, and maintains a persistent watchlist for one-click batch checking.

---

## Features

- **SQLite Persistent Memory (`data.db`)**:
  - `tracked_components`: Stores your list of components (`name`, `file_key`, `node_id`, `format`, `scale`, `figma_url`) for one-time setup.
  - `fetch_history`: Records every fetch with image paths, SHA-256 hashes, dimensions, diff pixel counts, diff percentages, and timestamps.
- **Local Asset Storage (`/assets`)**:
  - Every fetched component image is saved to `assets/snapshots/`.
  - Generated pixel-diff highlight images are saved to `assets/diffs/`.
- **Automatic Change Detection**:
  - Every time a component is fetched, it is automatically compared against its **last fetched image**.
  - Uses SHA-256 hash checking and `pixelmatch` pixel-by-pixel comparison to calculate exact changed pixel count and percentage, plus a highlighted red diff image.
- **One-Click Batch Check & Watchlist Management**:
  - Set up your list of components once ("+ Save to Watchlist"), then click **Check All Components for Changes** anytime to fetch and compare the entire list in one click.
  - Edit any tracked component's label, file key, node ID, format, scale, or Figma URL anytime with the built-in edit modal (`✎`).

---

## Quick Start

### 1. Configure `.env`
Open `.env` and add your Figma Personal Access Token:
```env
FIGMA_ACCESS_TOKEN=your_figma_personal_access_token
PORT=3000
```

### 2. Start the App
```bash
npm start
```
Then open **http://localhost:3000**.
