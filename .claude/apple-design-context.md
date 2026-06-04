# Apple Design Context — MedAccess AI

## Product
- **Name**: MedAccess AI (Patient Portal)
- **Description**: AI-powered medical triage and care coordination PWA for underserved communities
- **Category**: Health
- **Stage**: Development (v0.1 pre-release)

## Platforms
| Platform | Supported | Min OS | Notes |
|----------|-----------|--------|-------|
| iOS (PWA) | Yes | iOS 16+ | Primary target — installed to home screen |
| Android (PWA) | Yes | Android 10+ | Secondary target |
| macOS (browser) | Yes | — | Desktop fallback |

## Technology
- **UI Framework**: React 18 (not SwiftUI — web PWA)
- **Styling**: Tailwind CSS + custom ink-* token system
- **Architecture**: Single-page app, bottom tab navigation
- **Key capabilities**: MediaRecorder (voice), Geolocation, Web Speech API, PWA manifest

## Design System
- **Base**: Custom (ink-950 dark base, teal brand #22b8a3)
- **Brand Colors**: brand-400/500/600 (teal), danger (red), warn (amber), ok (green)
- **Typography**: Plus Jakarta Sans (UI), DM Serif Display (headings)
- **Dark Mode**: Supported via data-theme="dark/light"
- **Dynamic Type**: Via font-size classes (sm/md/lg) on html element

## HIG Rules Applied (web equivalents)
- **Touch targets**: Minimum 44×44px on all interactive elements
- **Tap target spacing**: 8px minimum between adjacent targets
- **Primary actions**: One per screen, visually prominent
- **Destructive actions**: Require confirmation dialog
- **Navigation**: 4 tabs (Chat | Find Care | Records | Settings) — within HIG 3-5 range
- **Safe areas**: env(safe-area-inset-*) applied to header and bottom nav
- **Feedback**: All async operations show loading state

## Accessibility
- **Target Level**: WCAG 2.1 AA
- **Key Considerations**:
  - All icon-only buttons need aria-label
  - Interactive divs need role="button" + tabIndex + keyboard handler
  - Color contrast: 4.5:1 for normal text, 3:1 for large text
  - Focus indicators visible in both themes

## Users
- **Primary Persona**: Non-specialist patient in underserved area, using phone as primary device
- **Key Use Cases**: Symptom assessment, emergency triage, booking appointments, reviewing past consultations
- **Known Challenges**: Touch accuracy on small screens, one-handed use, stress context (medical emergency)

## Navigation Structure
```
Bottom nav (always visible):
  / (Chat)       → main entry point
  /find-care     → facility search + My Appointments
  /records       → consultations + appointments history
  /settings      → preferences + profile link

Header (persistent):
  Logo → home
  Emergency phone button → /emergency
  Profile avatar → /profile

Modal/overlay pages (no tab):
  /voice         → full-screen voice mode
  /emergency     → triage assessment
  /profile       → profile editor
```
