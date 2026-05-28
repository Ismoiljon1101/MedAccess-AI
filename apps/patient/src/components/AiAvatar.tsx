import Lottie from 'lottie-react';
import doctorAvatarData from '../assets/doctor-avatar.json';

export type AvatarState = 'idle' | 'listening' | 'thinking';

interface Props {
  state?: AvatarState;
  size?: number;
  className?: string;
}

export function AiAvatar({ state = 'idle', size = 40, className = '' }: Props) {
  const speed =
    state === 'listening' ? 1.0 :
    state === 'thinking'  ? 1.6 : 0.5;

  return (
    <div
      className={`avatar-root ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Lottie clipped to circle */}
      <div className="absolute inset-0 rounded-full overflow-hidden ring-2 ring-white/10">
        <Lottie
          animationData={doctorAvatarData}
          loop
          autoplay
          speed={speed}
          style={{ width: '100%', height: '100%' }}
          rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
        />
      </div>

      {/* State rings — outside the clip */}
      {state === 'idle' && (
        <span className="avatar-ring avatar-ring-breathe" />
      )}
      {state === 'listening' && (
        <>
          <span className="avatar-ring avatar-ring-ripple" style={{ animationDelay: '0s' }} />
          <span className="avatar-ring avatar-ring-ripple" style={{ animationDelay: '0.5s' }} />
          <span className="avatar-ring avatar-ring-ripple" style={{ animationDelay: '1s' }} />
        </>
      )}
      {state === 'thinking' && (
        <span className="avatar-ring avatar-ring-spin" />
      )}
    </div>
  );
}
