# Changelog

All notable changes to The Editors Workshop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.3.2] - 2026-02-03


### Fixed
- Auto-updater now works correctly (added missing Tauri plugin permissions)

### Changed
- Release notes now appear in update dialog


## [0.3.2] - 2026-02-03

### Fixed
- **Auto-updater now works** - Added missing Tauri plugin permissions (updater:default, process:default)

### Changed
- Release notes now appear in update dialog (pulled from changelog.md)
- GitHub Release page shows version-specific notes at the top

## [0.3.1] - 2026-02-02


### Added
- **Audio preview playback** - Click play button to preview audio files directly in The Smelter
- **Rescan files command** - Re-read metadata from disk after external edits
- **Automated changelog workflow** - Release notes from NEXT_RELEASE.md staging file
- **Cache migrations system** - One-time migrations for schema updates
- **File size tracking** in metadata cache for better change detection

### Changed
- Improved bump-version.sh to read release notes from NEXT_RELEASE.md
- Cleaned up changelog with proper entries for 0.2.0 and 0.3.0
- Enhanced cache invalidation with file size + modification time checks
- Audio playback automatically stops when switching tabs

### Fixed
- Dialog permissions for Smelter browse buttons (added dialog:default capability)
- User-friendly error messages in organize.rs and metadata.rs
- Stale cache data cleared via migration for fresh metadata reads

## [0.3.0] - 2026-02-02

### Added
- **Compact launcher UI** - App starts in a small 600×280 window showing only header and tabs
- Window expands to full size (1000×700) when a tool is selected
- **Telemetry & analytics** (optional, user can opt-out in Settings)
  - Sentry integration for crash reporting and error tracking
  - PostHog integration for anonymous usage analytics
  - Offline event queue - events stored locally in SQLite, synced when online
- **Error boundary** - Catches React crashes with user-friendly recovery UI
- **ESLint setup** - TypeScript/React linting with eslint.config.js
- **CI linting workflow** - Runs on every push and PR

### Changed
- The Anvil converted to dark theme (matching The Smelter style)
- Improved error messages throughout the app

## [0.2.0] - 2026-02-02

### Added
- **The Smelter** - Music library organizer (new tool!)
  - Organizes MP3/WAV files by genre or mood using embedded ID3 metadata
  - Works 100% offline - no API keys needed
  - Supports Epidemic Sound's rich ID3 tags (TCON, TIT1, TIT3, TBPM)
  - Browse dropdown with "Select Files" / "Select Folder" options
  - Drag-drop support for files and folders (recursive scanning)
  - Inline metadata editing (double-click to edit genre/mood)
  - Per-file organize-by override (click Genre/Mood cell to override)
  - Duplicate detection with delete/skip options
  - Unknown files warning modal before organizing
  - Auto-updating preview when files or settings change
  - SQLite caching for faster repeated scans
- Keyboard shortcut Cmd+3 for The Smelter

### Changed
- Dashboard updated with The Smelter listing

## [0.1.6] - 2026-01-31

### Fixed
- Auto-updater signing key configuration
- GitHub Actions release workflow improvements

## [0.1.5] - 2026-01-29

### Fixed
- PKG installer improvements
- Gatekeeper bypass documentation

## [0.1.4] - 2025-01-28

### Added
- Auto-update system integration using Tauri updater plugin
- "Check for Updates" button in Settings panel
- Changelog viewer toggle in Settings panel
- useAutoUpdater hook for automatic update detection and installation
- useChangelog hook for fetching and displaying changelog content
- Update dialog prompts with version info and release notes
- Automatic update check on app launch (production builds only)

### Changed
- Settings panel now includes update management features
- Improved Settings layout with dedicated sections for About, Shortcuts, Preferences, and Changelog

## [0.1.3] - 2025-01-28

### Changed
- Updated color scheme to teal accent (#267b8e) from blue
- Changed background to solid dark charcoal (#2a2a2f) for better focus
- Simplified Dashboard statistics to 2 cards (Files Processed, Success Rate)

### Updated
- Version number displayed in Settings panel

## [0.1.2] - 2025-01-28

### Changed
- Complete UI redesign with professional dark theme
- Renamed application to "The Editors Workshop"
- Simplified navigation to 2 main tabs (Dashboard, The Anvil)
- Moved settings to overlay panel (accessible via Cmd+, or settings icon)
- Redesigned Dashboard with modern card-based statistics layout
- Updated color scheme to dark gradient background with blue accents
- Reorganized icons into dedicated directory structure (src/icons/)

### Updated
- Keyboard shortcuts now: Cmd+1 (Dashboard), Cmd+2 (The Anvil), Cmd+, (Settings)
- Improved visual hierarchy and spacing throughout the app
- Enhanced hover states and transitions

### Removed
- The Workbench as a separate tab (moved to Settings overlay)

## [0.1.1] - 2025-01-28

### Added
- Complete MyEditHub Workshop framework
- Dashboard with lifetime statistics tracking
- The Workbench (Settings & Information)
- Changelog viewer in settings
- Auto-update functionality placeholder
- DMG installer configuration
- Keyboard shortcuts (Cmd+1, Cmd+2, Cmd+3)
- Work Sans font integration

### Tools Included
- **The Anvil** - Premiere Pro Project File Upgrader
  - Supports Premiere Pro CC 2018 to 2025 (versions 1-43)
  - Batch processing with ZIP export
  - Folder upload support
  - Drag & drop file handling
  - Real-time processing status
  - Version detection and upgrade

### Theme
- Workshop/Craftsman aesthetic throughout
- Professional dark color scheme
- Tools named after workshop equipment

## [0.1.0] - 2025-01-27

### Added
- Initial Tauri + React + TypeScript project setup
- Basic project structure
- Vite build configuration
- Development environment setup
