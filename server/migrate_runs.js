const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

function runMigration(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  console.log('Running migration on', targetPath);
  const db = new DatabaseSync(targetPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS fetch_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_type TEXT NOT NULL DEFAULT 'all',
      target_name TEXT NOT NULL DEFAULT 'All Components',
      status TEXT NOT NULL DEFAULT 'completed',
      total_items INTEGER DEFAULT 0,
      changed_count INTEGER DEFAULT 0,
      unchanged_count INTEGER DEFAULT 0,
      baseline_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );
  `);

  try {
    db.exec('ALTER TABLE fetch_history ADD COLUMN run_id INTEGER REFERENCES fetch_runs(id) ON DELETE SET NULL;');
    console.log('Added run_id column to fetch_history.');
  } catch (e) {
    console.log('run_id column already exists or skipped.');
  }

  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_fetch_history_run_id ON fetch_history(run_id);');
  } catch (e) {}

  const unlinked = db.prepare('SELECT id, fetched_at, change_status FROM fetch_history WHERE run_id IS NULL ORDER BY id ASC').all();
  console.log('Unlinked history rows to backfill:', unlinked.length);

  if (unlinked.length > 0) {
    const clusters = [];
    let current = [];
    for (const r of unlinked) {
      const t = new Date(r.fetched_at).getTime();
      if (current.length === 0) {
        current.push(r);
      } else {
        const lastT = new Date(current[current.length - 1].fetched_at).getTime();
        if (Math.abs(t - lastT) < 180000) {
          current.push(r);
        } else {
          clusters.push(current);
          current = [r];
        }
      }
    }
    if (current.length) clusters.push(current);

    const insertRunStmt = db.prepare(`
      INSERT INTO fetch_runs (
        trigger_type, target_name, status, total_items, changed_count, unchanged_count, baseline_count, error_count, started_at, completed_at
      ) VALUES (?, ?, 'completed', ?, ?, ?, ?, 0, ?, ?)
    `);
    const updateHistoryStmt = db.prepare('UPDATE fetch_history SET run_id = ? WHERE id = ?');

    for (const cluster of clusters) {
      const total = cluster.length;
      const changed = cluster.filter(x => x.change_status === 'changed').length;
      const unchanged = cluster.filter(x => x.change_status === 'unchanged').length;
      const baseline = cluster.filter(x => x.change_status === 'baseline').length;
      const startedAt = cluster[0].fetched_at;
      const completedAt = cluster[cluster.length - 1].fetched_at;
      const triggerType = total === 1 ? 'single' : (total > 20 ? 'all' : 'folder');
      const targetName = total === 1 ? 'Single Component' : (triggerType === 'all' ? 'All Components' : 'Batch Check');

      const runRes = insertRunStmt.run(triggerType, targetName, total, changed, unchanged, baseline, startedAt, completedAt);
      const runId = runRes.lastInsertRowid;
      for (const r of cluster) {
        updateHistoryStmt.run(runId, r.id);
      }
    }
    console.log(`Successfully clustered and backfilled ${clusters.length} historical run records.`);
  }
}

runMigration(path.join(__dirname, 'data.db'));
runMigration(path.join(__dirname, '..', 'data.db'));
console.log('Migration finished for all databases.');
