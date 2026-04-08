/**
 * Leaderboard Store
 *
 * JSON file storage with serialized writes to prevent race conditions
 * when multiple benchmarks complete simultaneously.
 */

const fs = require('fs');
const path = require('path');

const LEADERBOARD_PATH = path.join(__dirname, '../../reports/leaderboard.json');

// Write lock — serializes all writes through a promise chain
let writeLock = Promise.resolve();

function _ensureDir() {
  const dir = path.dirname(LEADERBOARD_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function _readRaw() {
  _ensureDir();
  if (!fs.existsSync(LEADERBOARD_PATH)) {
    return { entries: [], comparisons: [], lastUpdated: new Date().toISOString() };
  }
  try {
    return JSON.parse(fs.readFileSync(LEADERBOARD_PATH, 'utf8'));
  } catch {
    return { entries: [], comparisons: [], lastUpdated: new Date().toISOString() };
  }
}

function _writeRaw(data) {
  _ensureDir();
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify(data, null, 2));
}

/**
 * Get all leaderboard entries, sorted by score descending.
 */
function getEntries() {
  const data = _readRaw();
  return data.entries.sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * Get a single entry by ID.
 */
function getEntryById(id) {
  const data = _readRaw();
  return data.entries.find(e => e.id === id) || null;
}

/**
 * Get a single entry by domain.
 */
function getEntryByDomain(domain) {
  const data = _readRaw();
  return data.entries.find(e => e.domain === domain) || null;
}

/**
 * Get a single entry by URL.
 */
function getEntryByUrl(url) {
  const data = _readRaw();
  return data.entries.find(e => e.url === url) || null;
}

/**
 * Upsert an entry (insert or update by URL).
 * Uses write lock to prevent concurrent write corruption.
 *
 * @param {object} entry - The leaderboard entry
 * @returns {Promise<object>} The upserted entry
 */
function upsertEntry(entry) {
  writeLock = writeLock.then(() => {
    const data = _readRaw();
    const existingIdx = data.entries.findIndex(e => e.url === entry.url);

    if (existingIdx >= 0) {
      // Update existing
      data.entries[existingIdx] = { ...data.entries[existingIdx], ...entry };
    } else {
      // Insert new
      data.entries.push(entry);
    }

    _writeRaw(data);
    return entry;
  }).catch(err => {
    console.error('[leaderboard-store] Write error:', err.message);
    throw err;
  });

  return writeLock;
}

/**
 * Check if a URL was benchmarked within the last N milliseconds.
 */
function wasBenchmarkedRecently(url, withinMs = 24 * 60 * 60 * 1000) {
  const entry = getEntryByUrl(url);
  if (!entry) return false;
  const benchmarkedAt = new Date(entry.benchmarkedAt).getTime();
  return Date.now() - benchmarkedAt < withinMs;
}

/**
 * Get the total number of entries.
 */
function getCount() {
  const data = _readRaw();
  return data.entries.length;
}

module.exports = {
  getEntries,
  getEntryById,
  getEntryByDomain,
  getEntryByUrl,
  upsertEntry,
  wasBenchmarkedRecently,
  getCount,
};
