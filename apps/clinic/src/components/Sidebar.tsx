import { NavLink } from 'react-router-dom';
import {
  Activity,
  ClipboardList,
  FileImage,
  Home,
  MessagesSquare,
  Stethoscope,
  Users,
} from 'lucide-react';

const NAV = [
  { to: '/', label: 'Overview', icon: Home },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/interview', label: 'Interview', icon: MessagesSquare },
  { to: '/symptoms', label: 'Symptom Analysis', icon: ClipboardList },
  { to: '/reports', label: 'Report Reading', icon: FileImage },
  { to: '/triage', label: 'Triage', icon: Activity },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-ink-700/60 bg-ink-900/60 backdrop-blur-sm md:flex md:flex-col">
      <div className="flex items-center gap-2.5 border-b border-ink-700/60 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-ink-950 shadow-glow">
          <Stethoscope size={18} strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">MedAccess AI</div>
          <div className="text-xs text-ink-300">Doctor Copilot · v0.1</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                isActive
                  ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30'
                  : 'text-ink-200 hover:bg-ink-800/80 hover:text-white',
              ].join(' ')
            }
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ink-700/60 px-5 py-4 text-[11px] leading-relaxed text-ink-400">
        Not a medical device. Educational decision-support copilot only.
      </div>
    </aside>
  );
}
