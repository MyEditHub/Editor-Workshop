# Editor Workshop

A desktop toolbox application for video editors built with Tauri (Rust backend) and React (TypeScript frontend).

## Project Structure

```
myedithub/
├── src/                    # React frontend
│   ├── App.tsx            # Main app component with tab navigation
│   ├── App.css            # Global styles
│   ├── components/
│   │   ├── Dashboard.tsx  # Home dashboard
│   │   └── TheAnvil.tsx   # Premiere Pro project upgrader tool
│   ├── hooks/
│   │   ├── useChangelog.ts
│   │   └── useAutoUpdater.ts
│   └── icons/             # SVG icon components
├── src-tauri/             # Tauri/Rust backend
│   ├── src/
│   │   ├── lib.rs         # Tauri commands and plugin setup
│   │   └── main.rs        # Entry point
│   └── Cargo.toml         # Rust dependencies
├── public/                # Static assets
└── package.json           # Node dependencies
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7
- **Backend**: Tauri 2, Rust
- **Tauri Plugins**: updater, dialog, process, opener

## Development Commands

```bash
# Start development server (frontend only)
npm run dev

# Build for production
npm run build

# Run Tauri development (full app)
npm run tauri dev

# Build Tauri app for distribution
npm run tauri build

# Bump version across all files
npm run bump
```

## Key Features

### The Anvil - Premiere Pro Project Upgrader
Located in `src/components/TheAnvil.tsx`

- Upgrades .prproj files to different Premiere Pro versions (2018-2025)
- Uses browser-native DecompressionStream/CompressionStream for gzip
- Pure client-side processing (no server calls)
- Includes custom ZIP writer implementation for batch downloads
- Version mapping: version numbers 1-43 map to Premiere Pro CC 2018 through 2025

### Auto-updater
Located in `src/hooks/useAutoUpdater.ts`
Uses `@tauri-apps/plugin-updater` for in-app updates

## Version Info

Version is maintained in multiple locations:
- `package.json` (npm version)
- `src-tauri/Cargo.toml` (Rust crate version)
- `src-tauri/tauri.conf.json` (Tauri app version)
- `src/App.tsx` (displayed in UI)

Use `npm run bump` to update all locations.

## Coding Conventions

- React functional components with hooks
- TypeScript strict mode
- CSS in separate `.css` files (no CSS-in-JS)
- Inline styles used sparingly for dynamic values in components
- Icons are React components in `src/icons/index.tsx`

## Build Output

- macOS: `.dmg` installer
- Build artifacts in `src-tauri/target/release/`
- GitHub Actions workflow for automated builds
