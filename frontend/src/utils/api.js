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
    let errPayload = { message: res.statusText };
    try {
      errPayload = await res.json();
    } catch (e) {
      // Non-JSON response
    }
    console.error("Frontend Network Rejection:", errPayload);
    throw new Error(errPayload.message || errPayload.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Phase 2 — Ingest a journal entry into memory */
export async function ingestEntry({ text, isSnippet, timestamp, profile }) {
  const entryTimestamp = timestamp || new Date().toISOString();
  return request('POST', '/api/memory/ingest', { text, isSnippet, timestamp: entryTimestamp }, profile);
}

/** Phase 3 — Oracle: semantic recovery query */
export async function recoverMemory({ question, state, profile }) {
  return request('POST', '/api/memory/recover', { question, state }, profile);
}

/** Phase 3 — Blindspots: fetch long-term analytics */
export async function fetchBlindspots({ profile, force_refresh } = {}) {
  const path = force_refresh ? '/api/memory/blindspots?force_refresh=true' : '/api/memory/blindspots';
  return request('GET', path, null, profile);
}

/** Phase 1 Overhaul — Update an existing journal entry in memory */
export async function updateEntry({ entryId, originalText, newText, profile }) {
  return request('PUT', '/api/memory/update', { entryId, originalText, newText }, profile);
}

/** Phase 7B — Intentional Forgetting: Dissolve a semantic connection */
export async function forgetMemory({ topic, entryId, profile }) {
  return request('POST', '/api/memory/forget', { topic, entryId }, profile);
}

/** Phase 7B — Oracle Optimization: Reinforce graph weights based on feedback */
export async function improveMemory({ helpful, context, profile }) {
  return request('POST', '/api/memory/improve', { helpful, context }, profile);
}

/** Generate feedback text via LLM */
export async function generateFeedback({ helpful, context, scenario, profile }) {
  return request('POST', '/api/memory/generate_feedback', { helpful, context, scenario }, profile);
}

/** Fetch historical timeline from Supabase */
export async function fetchTimeline({ profile } = {}) {
  return request('GET', '/api/memory/timeline', null, profile);
}

/** Health check */
export async function healthCheck() {
  return request('GET', '/api/health');
}
