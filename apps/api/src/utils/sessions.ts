import type { ChatMessage } from '@medaccess/shared';
import { Interview, dbReady } from '@medaccess/db';

// Minimal in-memory session store for MVP.
// Production should swap this for Redis with a TTL.

const SESSION_TTL_MS = (Number(process.env.SESSION_TTL_MIN) || 60) * 60 * 1000;

interface Session {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const store = new Map<string, Session>();

function now(): number {
  return Date.now();
}

function sweep(): void {
  const cutoff = now() - SESSION_TTL_MS;
  for (const [id, session] of store) {
    if (session.updatedAt < cutoff) store.delete(id);
  }
}

const timer = setInterval(sweep, 5 * 60 * 1000);
timer.unref?.();

export function newSessionId(): string {
  return `s_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function getSession(id: string | undefined): Session | null {
  if (!id) return null;
  const session = store.get(id);
  if (!session) {
    // Fallback: try loading from MongoDB (non-blocking check)
    // Note: This is async but we call it without await to maintain sync API.
    // In production, refactor to use async/await throughout the chat routes.
    if (dbReady()) {
      Interview.findOne({ sessionId: id }).lean().then((doc) => {
        if (doc) {
          const cached: Session = {
            id,
            messages: doc.messages || [],
            // reason: Mongoose FlattenMaps doesn't expose timestamps without explicit generic — cast to any
            createdAt: (doc as any).createdAt?.getTime?.() || now(),
            updatedAt: (doc as any).updatedAt?.getTime?.() || now(),
          };
          store.set(id, cached);
        }
      }).catch(() => {
        /* non-fatal */
      });
    }
    return null;
  }
  if (now() - session.updatedAt > SESSION_TTL_MS) {
    store.delete(id);
    return null;
  }
  return session;
}

/**
 * Like getSession, but awaits the MongoDB load on a cache miss instead of firing
 * it and returning null. Prevents the chat routes from creating an EMPTY session
 * (and answering with no history) right after an API restart (C7).
 */
export async function getOrLoadSession(id: string | undefined): Promise<Session | null> {
  if (!id) return null;
  const cached = store.get(id);
  if (cached) {
    if (now() - cached.updatedAt > SESSION_TTL_MS) { store.delete(id); return null; }
    return cached;
  }
  if (dbReady()) {
    try {
      const doc = await Interview.findOne({ sessionId: id }).lean();
      if (doc) {
        const loaded: Session = {
          id,
          messages: doc.messages || [],
          createdAt: (doc as any).createdAt?.getTime?.() || now(),
          updatedAt: (doc as any).updatedAt?.getTime?.() || now(),
        };
        store.set(id, loaded);
        return loaded;
      }
    } catch { /* non-fatal */ }
  }
  return null;
}

export function ensureSession(id: string): Session {
  const existing = getSession(id);
  if (existing) return existing;
  const fresh: Session = { id, messages: [], createdAt: now(), updatedAt: now() };
  store.set(id, fresh);
  return fresh;
}

export function appendMessage(id: string, message: ChatMessage): Session {
  const session = ensureSession(id);
  session.messages.push(message);
  session.updatedAt = now();
  store.set(id, session);
  return session;
}

export function replaceMessages(id: string, messages: ChatMessage[]): Session {
  const session = ensureSession(id);
  session.messages = messages;
  session.updatedAt = now();
  store.set(id, session);
  return session;
}
