# MeMo 💑

A beautiful, private couple space app built with Tauri v2, React, and TypeScript. Track periods, celebrate milestones, and stay in sync with your partner — all offline-first with complete privacy.

## Features

- **Her Space**: Private period & cycle tracking with smart predictions
- **Our Space**: Shared anniversaries, milestones & memories
- **Device Pairing**: Secure 6-digit code pairing between partners
- **Cross-device Sync**: Both partners can view and edit shared data
- **Liquid Glass UI**: Premium glassmorphism design with smooth animations
- **Offline-First**: All data stored locally with SQLite
- **Privacy-First**: No cloud, no tracking, no analytics
- **Smart Notifications**: Period, ovulation, milestone & anniversary reminders

## Tech Stack

- **Framework**: Tauri v2 (Rust + WebView)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Database**: SQLite (via tauri-plugin-sql)
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Mobile**: Android (minSdk 24) & iOS 15+

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.70+ (for Tauri)
- Android Studio (for Android development)
- Xcode 15+ (for iOS development, macOS only)

### Installation

```bash
# Clone and install dependencies
cd MeMo
npm install

# Install Rust dependencies
cd src-tauri
cargo build
cd ..

# Start development server
npm run tauri:dev
```

### Mobile Development

```bash
# Android
npm run tauri:android

# iOS (macOS only)
npm run tauri:ios
```

### Building for Production

```bash
# Build all platforms
npm run tauri:build

# Build specific platform
npm run tauri:android
npm run tauri:ios
```

## Project Structure

```
MeMo/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # Glass components, buttons, tabs
│   │   ├── period/          # Period calendar & logging
│   │   ├── milestone/       # Milestone & anniversary cards
│   │   ├── onboarding/      # Onboarding & pairing modals
│   │   └── settings/        # Settings modal
│   ├── screens/             # Main app screens
│   ├── stores/              # Zustand state stores
│   ├── lib/                 # Tauri API wrappers
│   ├── utils/               # Helpers & calculations
│   └── types/               # TypeScript definitions
├── src-tauri/               # Rust backend
│   ├── src/main.rs          # Tauri commands & setup
│   ├── migrations/          # SQL migrations
│   └── Cargo.toml           # Rust dependencies
├── public/                  # Static assets
└── Configuration files
```

## Key Features Implementation

### Period Tracking
- Calendar with visual period/fertile/ovulation indicators
- Flow tracking (light/medium/heavy)
- Symptom logging
- Smart cycle predictions using date-fns

### Milestones & Anniversaries
- Create shared memories with emojis, dates, notes
- Primary anniversary highlighted on home screen
- Upcoming milestones preview
- Both partners can add/edit

### Device Pairing
- 6-digit codes with 24-hour expiry
- Secure local pairing (no server)
- Cross-device data synchronization
- Role-based (boy/girl) for personalized UI

### Privacy & Data
- Local SQLite database only
- Export/import JSON backups
- No cloud sync, no analytics
- Complete data ownership

## Customization

### Themes
Edit `src/index.css` for color scheme changes:
```css
@theme {
  --color-primary: #F43F5E;
  --color-secondary: #7C3AED;
  --color-accent: #F59E0B;
  /* ... */
}
```

### Glass Effects
Modify `src/components/ui/GlassComponents.tsx` for glassmorphism presets.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run lint && npm run typecheck`
5. Submit a pull request

## Acknowledgments

- [Tauri](https://tauri.app/) for the amazing framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Lucide](https://lucide.dev/) for beautiful icons
- [date-fns](https://date-fns.org/) for date handling