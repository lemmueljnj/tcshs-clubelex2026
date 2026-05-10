// Offline vote queue stored in localStorage. Synced when connectivity restored.
import { api } from './api';

const KEY = 'cv_pending_votes';

export function getPending() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function setPending(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function queueVote(electionId, payload) {
  const items = getPending();
  items.push({ electionId, payload, queued_at: new Date().toISOString() });
  setPending(items);
}

export async function flushPending() {
  const items = getPending();
  if (!items.length) return { sent: 0 };
  const remaining = [];
  let sent = 0;
  for (const item of items) {
    try {
      await api.post(`/elections/${item.electionId}/vote`, item.payload);
      sent += 1;
    } catch (err) {
      // If the server rejects with a 4xx (already voted, closed, etc.), drop it.
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500) {
        // drop it
      } else {
        remaining.push(item);
      }
    }
  }
  setPending(remaining);
  return { sent, remaining: remaining.length };
}

export function pendingCount() {
  return getPending().length;
}
