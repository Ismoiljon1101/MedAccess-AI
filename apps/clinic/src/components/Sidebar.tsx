import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Pill,
  Settings,
  UserCircle,
  LogOut,
  Stethoscope,
  ShieldCheck,
  MessagesSquare,
  ClipboardList,
  FileImage,
  Activity,
} from 'lucide-react';
import { useAuthStore, type Role } from '@/store/auth';

type NavItem = { to: string; label: string; icon: React.ElementType };

const DOCTOR_NAV: NavItem[] = [
  { to: '/dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/patients',   label: 'Patient Queue',  icon: Users           },
  { to: '/interview',  label: 'Interview',       icon: MessagesSquare  },
  { to: '/symptoms',   label: 'Symptoms',        icon: ClipboardList   },
  { to: '/reports',    label: 'Reports',         icon: FileImage       },
  { to: '/triage',     label: 'Triage',          icon: Activity        },
];

const PHARMACIST_NAV: NavItem[] = [
  { to: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/prescriptions',  label: 'Prescriptions',  icon: Pill            },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/patients',  label: 'Patients',      icon: Users           },
  { to: '/interview', label: 'Interview',      icon: MessagesSquare  },
  { to: '/symptoms',  label: 'Symptoms',       icon: ClipboardList   },
  { to: '/reports',   label: 'Reports',        icon: FileImage       },
  { to: '/triage',    label: 'Triage',         icon: Activity        },
  // Staff module coming in v0.2
];

const BOTTOM_NAV: NavItem[] = [
  { to: '/profile',  label: 'Profile',  icon: UserCircle },
  { to: '/settings', label: 'Settings', icon: Settings   },
];

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  doctor:     DOCTOR_NAV,
  pharmacist: PHARMACIST_NAV,
  admin:      ADMIN_NAV,
};

const ROLE_META: Record<Role, { label: string; color: string; icon: React.ElementType }> = {
  doctor:     { label: 'Doctor',      color: 'text-accent-400 bg-accent-500/15 ring-accent-500/30',   icon: Stethoscope },
  pharmacist: { label: 'Pharmacist',  color: 'text-violet-400 bg-violet-500/15 ring-violet-500/30',   icon: Pill        },
  admin:      { label: 'Admin',       color: 'text-amber-400  bg-amber-500/15  ring-amber-500/30',    icon: ShieldCheck },
};

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function NavItems({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40',
              isActive
                ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30 font-medium'
                : 'text-ink-300 hover:bg-ink-800/80 hover:text-white',
            ].join(' ')
          }
        >
          <Icon size={16} />
          <span>{label}</span>
        </NavLink>
      ))}
    </>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  const roleMeta = ROLE_META[user.role];
  const RoleIcon = roleMeta.icon;
  const mainNav = NAV_BY_ROLE[user.role];

  return (
    <aside className="hidden w-60 shrink-0 border-r border-ink-700/60 bg-ink-900/80 backdrop-blur-sm md:flex md:flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-ink-700/60 px-4 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-ink-950 shadow-glow shrink-0">
          <Stethoscope size={16} strokeWidth={2.5} />
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-sm font-semibold text-white truncate">MedAccess AI</div>
          <div className="text-[10px] text-ink-400">Clinical Portal</div>
        </div>
      </div>

      {/* User card */}
      <div className="px-3 py-3 border-b border-ink-700/40">
        <div className="flex items-center gap-2.5 rounded-xl bg-ink-800/60 px-3 py-2.5">
          <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-ink-600 to-ink-700 grid place-items-center text-xs font-bold text-white ring-1 ring-ink-500/40">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-[10px] text-ink-400 truncate">{user.specialty || user.occupation || roleMeta.label}</p>
          </div>
          <div className={`shrink-0 grid place-items-center h-6 w-6 rounded-lg ring-1 ${roleMeta.color}`}>
            <RoleIcon size={12} />
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-3 overflow-y-auto">
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
          {roleMeta.label} Workspace
        </p>
        <NavItems items={mainNav} />
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-ink-700/40 px-3 py-3 space-y-0.5">
        <NavItems items={BOTTOM_NAV} />
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-400 hover:bg-danger-500/10 hover:text-danger-500 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
        <p className="px-3 pt-2 text-[10px] leading-relaxed text-ink-600">
          Decision-support copilot only. Not a medical device.
        </p>
      </div>
    </aside>
  );
}
