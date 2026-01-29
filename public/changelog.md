# Changelog

## [0.1.5] - 2026-01-29
- Version bump to 0.1.5


## [0.1.5] - 2026-01-28
- Version bump to 0.1.5


All notable changes to The Editors Workshop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

---

## Upcoming Features

### Planned
- The Forge - Additional video editing tools
- The Hammer - File conversion utilities
- The Chisel - Precision editing tools
- Cloud backup integration
- Project templates library
- Batch operation history
- Advanced keyboard shortcuts customization
