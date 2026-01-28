# Editor Workshop 🔨

A Toolbox for video editors. Save time and streamline your workflow.

## ✨ Features

### The Anvil - Premiere Pro Project Upgrader
- **Batch Processing** - Upgrade multiple .prproj files at once
- **Version Selection** - Choose your target Premiere Pro version (2018-2025)
- **Drag & Drop** - Simple interface for adding files
- **Folder Support** - Select entire folders of project files
- **ZIP Export** - Download all upgraded projects in a single archive

## 📥 Download

**Latest Release:** [v0.1.4](https://github.com/MyEdithub/Editor-workshop/releases/latest)

### System Requirements
- macOS 10.15 (Catalina) or later
- 12 MB free disk space

## 🚀 Installation

1. Download the latest `.dmg` file from [Releases](https://github.com/MyEditHub/Editor-workshop/releases)
2. Open the `.dmg` file
3. Drag "Editor Workshop" to your Applications folder
4. Launch the app (you may need to allow it in System Preferences → Security & Privacy)

## 🎯 Usage

### Quick Start
1. Launch Editor Workshop
2. Navigate to **The Anvil** tab
3. Select your target Premiere Pro version (e.g., Version 43 for Premiere Pro 2025)
4. Drag and drop your `.prproj` files or select a folder
5. Click **"Upgrade All"** to process files
6. Download the upgraded projects as a ZIP file

### Supported Versions

The Anvil supports upgrading to these Premiere Pro versions:

| Version | Premiere Pro Release |
|---------|---------------------|
| 1-2     | CC 2018 (12.x)      |
| 36      | 2022 (22.0)         |
| 37      | 2022 (22.1-22.6)    |
| 38      | 2023 (23.0-23.5)    |
| 39      | 2023 (23.6)         |
| 40      | 2024 (24.0-24.2)    |
| 41      | 2024 (24.3-24.5)    |
| 42      | 2024 (24.6)         |
| 43      | 2025 (25.0)         |

### How It Works

1. **Upload** - Add your Premiere Pro project files (.prproj)
2. **Select Version** - Choose the target version number
3. **Process** - The app decompresses, updates the version metadata, and recompresses
4. **Download** - Get all upgraded files in a convenient ZIP archive

Your original files are never modified - upgraded versions are created as new files.

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Changelog

### v0.1.4 (2025-01-28)
- Initial public release
- The Anvil: Premiere Pro project upgrader
- Support for Premiere Pro versions 2018-2025
- Batch processing with drag & drop
- ZIP export for upgraded projects


## ⚠️ Important Notes

- **Always backup your original project files before upgrading**
- Upgraded projects are saved with `_upgraded_vXX` suffix
- Original files are never modified
- All processing happens locally on your machine

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- UI powered by [React](https://react.dev/)
- Icons from [Lucide](https://lucide.dev/)

**From Editor to Editor**

