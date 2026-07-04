/**
 * Déjà API utility layer.
 * Profile is read from the Supabase session (user UUID).
 * Falls back to 'default_user' for unauthenticated contexts.
 */

import { supabase } from '../lib/supabase';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5051';

/** Get the current user's ID to use as the profile key, plus access token */
async function getProfileAndToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    profile: session?.user?.id || 'default_user',
    token: session?.access_token || null
  };
}

function headers(profile, token) {
  const h = {
    'Content-Type': 'application/json',
    'x-user-profile': profile,
  };
  if (token) {
    h['x-user-token'] = token;
  }
  return h;
}

async function request(method, path, body, profileOverride) {
  const { profile, token } = await getProfileAndToken();
  const finalProfile = profileOverride || profile;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(finalProfile, token),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let errPayload = { message: res.statusText };
    try {
      errPayload = await res.json();
    } catch (e) {
      // Non-JSON response
    }
    console.error('Frontend Network Rejection:', errPayload);
    throw new Error(errPayload.message || errPayload.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Phase 2 — Ingest a journal entry into memory */
export async function ingestEntry({ text, isSnippet, timestamp, force_save }) {
  const entryTimestamp = timestamp || new Date().toISOString();
  return request('POST', '/api/memory/ingest', { text, isSnippet, timestamp: entryTimestamp, force_save });
}

/** Phase 3 — Oracle: semantic recovery query */
export async function recoverMemory({ question, state }) {
  return request('POST', '/api/memory/recover', { question, state });
}

/** Phase 3 — Blindspots: fetch long-term analytics */
export async function fetchBlindspots({ force_refresh } = {}) {
  const path = force_refresh ? '/api/memory/blindspots?force_refresh=true' : '/api/memory/blindspots';
  return request('GET', path, null);
}

/** Phase 1 Overhaul — Update an existing journal entry in memory */
export async function updateEntry({ entryId, originalText, newText }) {
  return request('PUT', '/api/memory/update', { entryId, originalText, newText });
}

/** Phase 7B — Intentional Forgetting: Dissolve a semantic connection */
export async function forgetMemory({ topic, entryId }) {
  return request('POST', '/api/memory/forget', { topic, entryId });
}

/** Phase 7B — Oracle Optimization: Reinforce graph weights based on feedback */
export async function improveMemory({ helpful, context }) {
  return request('POST', '/api/memory/improve', { helpful, context });
}

/** Generate feedback text via LLM */
export async function generateFeedback({ helpful, context, scenario }) {
  return request('POST', '/api/memory/generate_feedback', { helpful, context, scenario });
}

/** Fetch historical timeline from Supabase */
export async function fetchTimeline() {
  return request('GET', '/api/memory/timeline', null);
}

/** Health check */
export async function healthCheck() {
  return request('GET', '/api/health');
}
