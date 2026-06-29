/**
 * Sift API utility layer.
 * Wraps all backend endpoints from Phase 2 & 3.
 * Base URL read from Vite env var (falls back to localhost:5051).
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5051';
const DEFAULT_PROFILE = 'default_user';

function headers(profile = DEFAULT_PROFILE) {
  return {
    'Content-Type': 'application/json',
    'x-user-profile': profile,
  };
}

async function request(method, path, body, profile) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(profile),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Phase 2 — Ingest a journal entry into memory */
export async function ingestEntry({ text, profile }) {
  return request('POST', '/api/memory/ingest', { text }, profile);
}

/** Phase 3 — Oracle: semantic recovery query */
export async function recoverMemory({ question, state, profile }) {
  return request('POST', '/api/memory/recover', { question, state }, profile);
}

/** Phase 3 — Blindspots: fetch long-term analytics */
export async function fetchBlindspots({ profile } = {}) {
  return request('GET', '/api/memory/blindspots', null, profile);
}

/** Phase 1 Overhaul — Update an existing journal entry in memory */
export async function updateEntry({ entryId, originalText, newText, profile }) {
  return request('PUT', '/api/memory/update', { entryId, originalText, newText }, profile);
}

/** Health check */
export async function healthCheck() {
  return request('GET', '/api/health');
}
