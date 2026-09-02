# 🚀 Cordova Pro GUI

<div align="center">

![Cordova Pro GUI](https://img.shields.io/badge/version-2.0.0-blue)
![Python](https://img.shields.io/badge/python-3.8+-green)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

**A professional, user-friendly GUI for Apache Cordova project management**

[![GitHub stars](https://img.shields.io/github/stars/chehresay/cordova-pro-gui)](https://github.com/chehresay/cordova-pro-gui/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/chehresay/cordova-pro-gui)](https://github.com/chehresay/cordova-pro-gui/issues)
[![GitHub forks](https://img.shields.io/github/forks/chehresay/cordova-pro-gui)](https://github.com/chehresay/cordova-pro-gui/network)

</div>

---

## 📖 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage Guide](#-usage-guide)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Donations](#-donations)
- [License](#-license)
- [Author](#-author)

---

## 📱 About

**Cordova Pro GUI** is a powerful desktop application that provides a modern, intuitive interface for managing Apache Cordova projects. Built with Python and Eel, it eliminates the need to use the command line for common Cordova tasks.

Whether you're a beginner looking for an easy way to start with Cordova or an experienced developer wanting to streamline your workflow, Cordova Pro GUI has you covered.

### Why Cordova Pro GUI?

- 🎯 **No CLI needed** - All common tasks are accessible through the GUI
- 🚀 **Boost productivity** - Create, build, and deploy projects faster
- 🎨 **Modern UI** - Clean design with dark/light mode support
- 🔌 **Plugin management** - Install/uninstall plugins with one click
- 📱 **Multi-platform** - Work with Android, iOS, Windows, and more

---

## ✨ Features

### Core Features
- ✅ **Project Management** - Create, open, and manage multiple Cordova projects
- ✅ **Platform Manager** - Add/remove platforms (Android, iOS, Windows, Browser, Electron)
- ✅ **Plugin Manager** - Install/uninstall plugins with version control
- ✅ **Config Editor** - Visual editing of config.xml with raw XML support
- ✅ **Build System** - Build and run your apps with debug/release options
- ✅ **Resource Generator** - Generate icons and splash screens (no cordova-res required)
- ✅ **SDK Manager** - Detect and configure Android SDK, Gradle, and Java
- ✅ **Maven Fix** - Fix Maven repository issues with one click
- ✅ **WiFi Debugging** - Connect to Android devices wirelessly
- ✅ **Device Deployment** - Deploy apps to connected devices

### Advanced Features
- 🔑 **Keystore Management** - Create and manage signing keys for release builds
- 🔄 **Background Operations** - Cancel long-running operations
- 📊 **Build History** - Track your build history
- 🎨 **Themes** - Dark/Light/System mode
- 🌐 **Cross-platform** - Works on Windows, macOS, and Linux
- 🐍 **Pure Python** - No external dependencies for resource generation

---

## 🖥️ Screenshots

> *Coming soon...*

---

## 📋 Requirements

### Minimum Requirements
- **Python** 3.8 or higher
- **Node.js** 14 or higher
- **npm** 6 or higher

### Platform-Specific Requirements

| Platform | Requirements |
|----------|--------------|
| **Android** | Android SDK (via Android Studio) |
| **iOS** | macOS + Xcode |
| **Windows** | Visual Studio (for Windows builds) |
| **Browser** | No additional requirements |
| **Electron** | npm (electron-builder will be installed) |

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/chehresay/cordova-pro-gui.git
cd cordova-pro-gui
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or manually:

```bash
pip install eel pillow psutil
```

### 3. Install Cordova CLI

```bash
npm install -g cordova
```

### 4. Run the Application

```bash
python main.py
```

### 5. (Optional) Build Executable

```bash
# Install PyInstaller
pip install pyinstaller

# For Windows
pyinstaller --onefile --windowed --name "CordovaProGUI" main.py

# For macOS/Linux
pyinstaller --onefile --windowed --name "CordovaProGUI" main.py
```

---

## 🎯 Quick Start

1. **Launch the application**: `python main.py`
2. **Create a new project**: Click "New Project" in the dashboard
3. **Fill in project details**:
   - Name: Your app name
   - Package ID: com.yourcompany.app
   - Path: Where to create the project
4. **Add a platform**: Click on Android, iOS, or other platforms
5. **Install plugins**: Use the Plugin Manager
6. **Build your app**: Click "Build" and select the platform
7. **Run on device**: Connect your device and click "Run"

---

## 📖 Usage Guide

### Dashboard
The dashboard provides an overview of your projects, recent activity, and quick actions.

### Project Manager
- **Create Project**: Fill in the form and click "Create"
- **Open Project**: Click "Open Project" and select a Cordova project folder
- **Recent Projects**: Quick access to your recently opened projects

### Platform Manager
- **Add Platform**: Click on any platform card
- **Remove Platform**: Click the trash icon next to an installed platform
- **Supported Platforms**: Android, iOS, Windows, Browser, Electron

### Plugin Manager
- **Install Plugin**: Enter plugin name and click "Install"
- **Popular Plugins**: Quick install from the list
- **Marketplace**: Search for available plugins

### Build Manager
- **Select Platform**: Choose your target platform
- **Build Type**: Debug or Release
- **Keystore**: Configure keystore for release builds
- **Run**: Deploy to device or emulator

### Resources
- **Icons**: Generate app icons from a single image
- **Splash Screens**: Generate splash screens from a single image
- **No external dependencies**: Uses Python's PIL library

### Settings
- **Theme**: Dark, Light, or System
- **SDK Paths**: Configure Android SDK, Gradle, Java
- **Keystore**: Manage signing keys
- **Maven**: Fix Maven repository issues

---

## 📁 Project Structure

```
cordova-pro-gui/
├── main.py              # Main application entry point
├── web/                 # Web assets
│   ├── script.js            # Frontend JavaScript
│   ├── index.html           # Main HTML
│   ├── css/             # Stylesheets
│   ├── panels/          # Panel HTML files
│   └── panels/navigation.json
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Areas for Contribution
- 🐛 **Bug fixes**
- ✨ **New features**
- 📚 **Documentation**
- 🎨 **UI/UX improvements**
- 🌐 **Translations**

---

## 💝 Donations

If you find Cordova Pro GUI useful, please consider supporting its development:

### Cryptocurrency

| Currency | Address |
|----------|---------|
| **Bitcoin (BTC)** | `bc1q0r3gzt5xtlglerst36vh6567023thpv5huthrl` |
| **Ethereum (ETH)** | `0xd77935cb0f1b03054720de9cb94c3d7df12b9d0e` |

### Other Ways to Support
- ⭐ **Star** the project on GitHub
- 🐛 **Report** bugs and suggest features
- 📝 **Write** documentation or tutorials
- 🔀 **Contribute** code via pull requests

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

---

## 👤 Author

**Morad Chehresay**

- 📧 Email: [chehresay@gmail.com](mailto:chehresay@gmail.com)
- 🐙 GitHub: [@chehresay](https://github.com/chehresay)
- 🔗 LinkedIn: [chehresay](https://linkedin.com/in/chehresay)

---

## 🙏 Acknowledgments

- [Apache Cordova](https://cordova.apache.org/) - The mobile app development framework
- [Eel](https://github.com/ChrisKnott/Eel) - Python to JavaScript bridge
- [Pillow](https://python-pillow.org/) - Python Imaging Library
- All contributors and users of this project

---

## 📊 Statistics

![GitHub repo size](https://img.shields.io/github/repo-size/chehresay/cordova-pro-gui)
![GitHub last commit](https://img.shields.io/github/last-commit/chehresay/cordova-pro-gui)
![GitHub contributors](https://img.shields.io/github/contributors/chehresay/cordova-pro-gui)

---

<div align="center">

**⭐ Made with ❤️ by [Morad Chehresay](https://github.com/chehresay) ⭐**

</div>