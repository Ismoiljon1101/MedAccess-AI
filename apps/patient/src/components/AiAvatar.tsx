import Lottie from 'lottie-react';
import doctorAvatarData from '../assets/doctor-avatar.json';

export type AvatarState = 'idle' | 'listening' | 'thinking';

interface Props {
  state?: AvatarState;
  /** px size — applied as width & height */
  size?: number;
  className?: string;
}

/**
 * AI Doctor avatar backed by Lottie animation.
 *
 * State mapping (no markers in this file — we use speed + CSS rings):
 *   idle      → 0.4× speed, subtle breathing ring  (slow, calming)
 *   listening → 1.0× speed, ripple rings            (active, attentive)
 *   thinking  → 1.6× speed, spinning arc ring       (processing)
 */
export function AiAvatar({ state = 'idle', size = 72, className = '' }: Props) {
  const speed =
    state === 'listening' ? 1.0 :
    state === 'thinking'  ? 1.6 : 0.4;

  return (
    <div
      className={`avatar-root ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* ── Lottie doctor animation ───────────────────────────── */}
      <Lottie
        animationData={doctorAvatarData}
        loop
        autoplay
        speed={speed}
        style={{ width: '100%', height: '100%' }}
        rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
      />

      {/* ── State rings (CSS-driven) ──────────────────────────── */}

      {/* Idle: single very slow breathing ring */}
      {state === 'idle' && (
        <span className="avatar-ring avatar-ring-breathe" />
      )}

      {/* Listening: three staggered ripple rings */}
      {state === 'listening' && (
        <>
          <span className="avatar-ring avatar-ring-ripple" style={{ animationDelay: '0s' }} />
          <span className="avatar-ring avatar-ring-ripple" style={{ animationDelay: '0.5s' }} />
          <span className="avatar-ring avatar-ring-ripple" style={{ animationDelay: '1s' }} />
        </>
      )}

      {/* Thinking: spinning arc overlay */}
      {state === 'thinking' && (
        <span className="avatar-ring avatar-ring-spin" />
      )}
    </div>
  );
}
