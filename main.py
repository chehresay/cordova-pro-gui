"""
Cordova Pro GUI - Version 2.0.0
Professional Cordova Project Management Tool

Author: Morad Chehresay
Email: chehresay@gmail.com
GitHub: https://github.com/chehresay/cordova-pro-gui
License: MIT

Donations:
  BTC: bc1q0r3gzt5xtlglerst36vh6567023thpv5huthrl
  ETH: 0xd77935cb0f1b03054720de9cb94c3d7df12b9d0e
"""

import eel
import os
import sys
import json
import subprocess
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime
import tkinter as tk
from tkinter import filedialog, messagebox
import webbrowser
import threading
import time
import hashlib
import base64
import re
import platform
import tempfile
import zipfile
import requests
from urllib.parse import urlparse
from PIL import Image
import io
import xml.etree.ElementTree as ET
import xml.dom.minidom as minidom
import re
import psutil


# ============================================================
# CONFIGURATION
# ============================================================

VERSION = "2.0.0"
APP_NAME = "Cordova Pro GUI"
AUTHOR = "Your Name"
GITHUB_URL = "https://github.com/yourusername/cordova-pro-gui"
DONATE_BTC = "1YourBitcoinAddressHere"
DONATE_ETH = "0xYourEthereumAddressHere"

# System paths
HOME_DIR = Path.home()
APP_DATA_DIR = HOME_DIR / ".cordova-pro-gui"
PROJECTS_DB = APP_DATA_DIR / "projects.json"
SETTINGS_FILE = APP_DATA_DIR / "settings.json"
CACHE_DIR = APP_DATA_DIR / "cache"
TEMPLATES_DIR = APP_DATA_DIR / "templates"

DEFAULT_SETTINGS = {
    "theme": "system",
    "accentColor": "#6366f1",
    "fontSize": "medium",
    "defaultPath": "",
    "defaultTemplate": "empty",
    "autoSave": True,
    "checkUpdates": True,
    "sdk_paths": {
        "android_sdk": "",
        "gradle": "",
        "java": ""
    },
    "keystore": {
        "path": "",
        "storePassword": "",
        "keyAlias": "",
        "keyPassword": ""
    }
}

# Create app directories
APP_DATA_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)
TEMPLATES_DIR.mkdir(exist_ok=True)

# Initialize Eel with web folder
eel.init('web')



# ============================================================
# PROCESS MANAGEMENT
# ============================================================
class ProcessManager:
    """Manage processes for cancellation without interfering with other code"""
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._pids = []
                    cls._instance._pids_lock = threading.Lock()
        return cls._instance

    def register(self, process):
        """Register a process for tracking"""
        with self._pids_lock:
            if hasattr(process, 'pid') and process.pid:
                if process.pid not in self._pids:
                    self._pids.append(process.pid)
                    print(f"📌 Registered process: {process.pid}")
        return process

    def unregister(self, pid):
        """Unregister a process"""
        with self._pids_lock:
            if pid in self._pids:
                self._pids.remove(pid)
                print(f"📌 Unregistered process: {pid}")

    def get_pids(self):
        """Get copy of tracked PIDs"""
        with self._pids_lock:
            return self._pids.copy()

    def clear(self):
        """Clear all tracked PIDs"""
        with self._pids_lock:
            self._pids.clear()

    def kill_process_tree(self, pid):
        """Kill a process and all its children"""
        try:
            if sys.platform == 'win32':
                subprocess.run(f'taskkill /F /T /PID {pid}', shell=True, capture_output=True, timeout=10)
            else:
                parent = psutil.Process(pid)
                for child in parent.children(recursive=True):
                    try:
                        child.kill()
                    except:
                        pass
                parent.kill()
            return True
        except Exception as e:
            print(f"⚠️ Could not kill process {pid}: {e}")
            return False

    def cancel_all(self):
        """Cancel all tracked operations"""
        try:
            killed = 0
            pids = self.get_pids()
            self.clear()

            for pid in pids:
                if self.kill_process_tree(pid):
                    killed += 1

            # Also kill any cordova processes
            try:
                for proc in psutil.process_iter(['pid', 'name']):
                    try:
                        name = proc.info['name'] or ''
                        if 'cordova' in name.lower():
                            if self.kill_process_tree(proc.info['pid']):
                                killed += 1
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
            except Exception as e:
                print(f"⚠️ Error during extra cleanup: {e}")

            return {
                "success": True,
                "message": f"Operation cancelled ({killed} processes killed)",
                "killed": killed
            }

        except Exception as e:
            return {"success": False, "message": str(e), "killed": 0}


# Create global instance
process_manager = ProcessManager()


def run_command_with_cancel(cmd, cwd=None, env=None, timeout=300):
    """Run a command with cancellation support (does NOT conflict with pm.run_command)"""
    try:
        process = subprocess.Popen(
            cmd,
            cwd=cwd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )

        # Register process
        process_manager.register(process)

        try:
            stdout, stderr = process.communicate(timeout=timeout)
            return {
                "success": True,
                "returncode": process.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "pid": process.pid
            }
        except subprocess.TimeoutExpired:
            process_manager.kill_process_tree(process.pid)
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": f"Command timed out after {timeout} seconds",
                "pid": process.pid,
                "timedout": True
            }
        finally:
            process_manager.unregister(process.pid)

    except Exception as e:
        return {
            "success": False,
            "returncode": -1,
            "stdout": "",
            "stderr": str(e),
            "pid": None
        }


@eel.expose
def cancel_current_operation():
    """Cancel all running operations - Eel exposed"""
    return process_manager.cancel_all()


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def check_command_exists(command):
    """Check if a command exists in PATH"""
    try:
        subprocess.run(
            command,
            shell=True,
            capture_output=True,
            check=False
        )
        return True
    except:
        return False


def get_command_version(command):
    """Get version of a command"""
    try:
        result = subprocess.run(
            f"{command} --version",
            shell=True,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return result.stdout.strip().split('\n')[0]
        return None
    except:
        return None


def validate_package_id(package_id):
    """Validate Cordova package ID format"""
    pattern = r'^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    return re.match(pattern, package_id) is not None


def validate_version(version):
    """Validate semantic version format"""
    pattern = r'^\d+\.\d+\.\d+$'
    return re.match(pattern, version) is not None


def format_size(bytes):
    """Format file size in human readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024.0:
            return f"{bytes:.2f} {unit}"
        bytes /= 1024.0
    return f"{bytes:.2f} TB"


def get_file_hash(filepath):
    """Get SHA256 hash of a file"""
    try:
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except:
        return None


def fix_config_xml(config_path):
    """Complete fix for config.xml - handles both formatted and minified files"""
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()

        if 'ns0:' in content:
            import re

            content = re.sub(r'<ns0:(\w+)', r'<\1', content)
            content = re.sub(r'</ns0:(\w+)', r'</\1', content)
            content = re.sub(r'xmlns:ns0=', 'xmlns=', content)

            if 'xmlns:cdv' not in content and '<widget' in content:
                content = content.replace(
                    '<widget',
                    '<widget xmlns:cdv="http://cordova.apache.org/ns/1.0"',
                    1
                )

            with open(config_path, 'w', encoding='utf-8') as f:
                f.write(content)

            return True

        return True

    except Exception as e:
        print(f"❌ Error fixing config.xml: {e}")
        return False


# ============================================================
# ENVIRONMENT DETECTION
# ============================================================

def get_android_sdk_path():
    """Get Android SDK path from environment or common locations"""
    android_home = os.environ.get('ANDROID_HOME')
    android_sdk_root = os.environ.get('ANDROID_SDK_ROOT')

    if android_home and os.path.exists(android_home):
        return android_home
    if android_sdk_root and os.path.exists(android_sdk_root):
        return android_sdk_root

    common_paths = [
        Path.home() / 'AppData' / 'Local' / 'Android' / 'Sdk',
        Path('C:') / 'Android' / 'Sdk',
        Path('C:') / 'Program Files' / 'Android' / 'Sdk',
        Path('D:') / 'Android' / 'Sdk',
        Path('D:') / 'Program' / 'Android' / 'android-sdk',
    ]

    for path in common_paths:
        if path.exists():
            return str(path)

    return None


def get_gradle_home():
    """Get Gradle home from environment or common locations"""
    gradle_home = os.environ.get('GRADLE_HOME')
    if gradle_home and os.path.exists(gradle_home):
        return gradle_home

    common_paths = [
        Path('C:') / 'Gradle' / 'gradle-8.14.2',
        Path('C:') / 'Gradle' / 'gradle-8.14.1',
        Path('C:') / 'Gradle' / 'latest',
        Path.home() / 'gradle',
    ]

    for path in common_paths:
        if path.exists():
            return str(path)

    return None


def get_java_home():
    """Get Java home from environment or common locations"""
    java_home = os.environ.get('JAVA_HOME')
    if java_home and os.path.exists(java_home):
        return java_home

    common_paths = [
        Path('C:') / 'Program Files' / 'Java' / 'jdk-17',
        Path('C:') / 'Program Files' / 'Java' / 'jdk-11',
        Path('C:') / 'Program Files' / 'Java' / 'jdk-21',
        Path('C:') / 'Program Files' / 'Java' / 'jdk1.8.0_202',
        Path('C:') / 'Program Files (x86)' / 'Java' / 'jdk1.8.0_202',
    ]

    for path in common_paths:
        if path.exists():
            return str(path)

    return None


def get_env_for_subprocess():
    """Get environment variables for subprocess"""
    env = os.environ.copy()

    android_sdk = get_android_sdk_path()
    if android_sdk:
        env['ANDROID_HOME'] = android_sdk
        env['ANDROID_SDK_ROOT'] = android_sdk

    gradle_home = get_gradle_home()
    if gradle_home:
        env['GRADLE_HOME'] = gradle_home
        env['PATH'] = f"{gradle_home}\\bin;{env.get('PATH', '')}"

    java_home = get_java_home()
    if java_home:
        env['JAVA_HOME'] = java_home
        env['PATH'] = f"{java_home}\\bin;{env.get('PATH', '')}"

    return env


# ============================================================
# PROJECT MANAGER CLASS
# ============================================================

class ProjectManager:
    """Complete project management for Cordova applications"""

    def __init__(self):
        self.current_project = None
        self.projects = self.load_projects()
        self.settings = self.load_settings()
        self.build_history = self.load_build_history()

    # ---------- Data Management ----------

    def load_projects(self):
        """Load projects from database file"""
        if PROJECTS_DB.exists():
            try:
                with open(PROJECTS_DB, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return []
        return []

    def save_projects(self):
        """Save projects to database file"""
        try:
            with open(PROJECTS_DB, 'w', encoding='utf-8') as f:
                json.dump(self.projects, f, indent=2, ensure_ascii=False)
            return True
        except:
            return False

    def load_settings(self):
        """Load application settings with defaults"""
        if SETTINGS_FILE.exists():
            try:
                with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    merged = DEFAULT_SETTINGS.copy()
                    merged.update(loaded)
                    return merged
            except:
                return DEFAULT_SETTINGS.copy()
        return DEFAULT_SETTINGS.copy()

    def save_settings(self):
        """Save application settings"""
        try:
            if "sdk_paths" not in self.settings:
                self.settings["sdk_paths"] = {}

            SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)

            with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.settings, f, indent=2, ensure_ascii=False)
            return True

        except Exception as e:
            print(f"❌ Error saving settings: {e}")
            return False

    def load_build_history(self):
        """Load build history"""
        history_file = APP_DATA_DIR / "build_history.json"
        if history_file.exists():
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return []
        return []

    def save_build_history(self):
        """Save build history"""
        history_file = APP_DATA_DIR / "build_history.json"
        try:
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(self.build_history, f, indent=2, ensure_ascii=False)
            return True
        except:
            return False

    # ---------- Project CRUD ----------

    def create_project(self, name, package_id, path, template="empty", version="1.0.0"):
        """Create new Cordova project with proper config.xml"""
        try:
            if not name or not package_id or not path:
                return {"success": False, "message": "All fields are required"}

            if not validate_package_id(package_id):
                return {"success": False, "message": "Invalid package ID format"}

            if not validate_version(version):
                return {"success": False, "message": "Invalid version format"}

            project_path = Path(path) / name

            if project_path.exists():
                return {"success": False, "message": f"Project already exists at {project_path}"}

            # Create directories
            project_path.mkdir(parents=True, exist_ok=True)
            www_dir = project_path / "www"
            www_dir.mkdir(exist_ok=True)

            # Create config.xml with CORRECT format
            config_content = f'''<?xml version='1.0' encoding='utf-8'?>
<widget id="{package_id}" version="{version}" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>{name}</name>
    <description>A Cordova application</description>
    <author email="user@example.com" href="https://example.com">
        Your Name
    </author>
    <content src="index.html" />
    <access origin="*" />
    <allow-intent href="http://*/*" />
    <allow-intent href="https://*/*" />
    <allow-intent href="tel:*" />
    <allow-intent href="sms:*" />
    <allow-intent href="mailto:*" />
    <allow-intent href="geo:*" />
    <platform name="android">
        <allow-intent href="market:*" />
    </platform>
    <platform name="ios">
        <allow-intent href="itms:*" />
        <allow-intent href="itms-apps:*" />
    </platform>
</widget>'''

            config_path = project_path / "config.xml"
            with open(config_path, 'w', encoding='utf-8') as f:
                f.write(config_content)

            # Create index.html
            index_content = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>Hello World</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px; }
        h1 { color: #333; }
        .logo { font-size: 48px; margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="logo">📱</div>
    <h1>Hello Cordova!</h1>
    <p>Your app is ready.</p>
    <p style="color: #666; font-size: 14px; margin-top: 40px;">Powered by Cordova Pro GUI</p>
    <script>
        document.addEventListener('deviceready', function() {
            console.log('Device is ready');
            document.body.style.background = '#f0f7ff';
        }, false);
    </script>
</body>
</html>'''

            index_path = www_dir / "index.html"
            with open(index_path, 'w', encoding='utf-8') as f:
                f.write(index_content)

            # Create .gitignore
            gitignore_content = '''# Cordova
platforms/
plugins/
node_modules/
*.apk
*.ipa
*.log

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db
'''
            gitignore_path = project_path / ".gitignore"
            with open(gitignore_path, 'w', encoding='utf-8') as f:
                f.write(gitignore_content)

            # Apply template if specified
            if template != "empty":
                self.apply_template(project_path, template)

            # Save to projects list
            project_info = {
                "name": name,
                "package_id": package_id,
                "version": version,
                "path": str(project_path),
                "template": template,
                "created": datetime.now().isoformat(),
                "last_opened": datetime.now().isoformat(),
                "platforms": [],
                "plugins": []
            }

            self.projects.append(project_info)
            self.save_projects()
            self.current_project = str(project_path)

            return {
                "success": True,
                "message": "Project created successfully",
                "path": str(project_path),
                "project": project_info
            }

        except Exception as e:
            return {"success": False, "message": str(e)}

    def open_project(self, project_path):
        """Open existing project"""
        try:
            project_path = Path(project_path)
            config_path = project_path / "config.xml"

            if not config_path.exists():
                return {"success": False, "message": "Invalid Cordova project (config.xml not found)"}

            info = self.get_project_info(str(project_path))
            if not info:
                return {"success": False, "message": "Failed to read project info"}

            for project in self.projects:
                if project["path"] == str(project_path):
                    project["last_opened"] = datetime.now().isoformat()
                    break
            else:
                self.projects.append({
                    "name": info.get("name", project_path.name),
                    "package_id": info.get("id", ""),
                    "path": str(project_path),
                    "last_opened": datetime.now().isoformat()
                })

            self.save_projects()
            self.current_project = str(project_path)

            return {
                "success": True,
                "message": "Project opened successfully",
                "project": info
            }

        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_project_info(self, project_path):
        """Get detailed project information"""
        try:
            project_path = Path(project_path)
            config_path = project_path / "config.xml"

            if not config_path.exists():
                return None

            with open(config_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'ns0:' in content:
                    fix_config_xml(config_path)

            tree = ET.parse(config_path)
            root = tree.getroot()

            info = {
                "id": root.get('id', ''),
                "version": root.get('version', '1.0.0'),
                "name": "",
                "author": "",
                "email": "",
                "website": "",
                "description": "",
                "platforms": [],
                "plugins": [],
                "preferences": {}
            }

            name_elem = root.find('name')
            if name_elem is not None:
                info["name"] = name_elem.text or ""

            author_elem = root.find('author')
            if author_elem is not None:
                info["author"] = author_elem.text or ""
                info["email"] = author_elem.get('email', '')
                info["website"] = author_elem.get('href', '')

            desc_elem = root.find('description')
            if desc_elem is not None:
                info["description"] = desc_elem.text or ""

            for pref in root.findall('preference'):
                name = pref.get('name')
                value = pref.get('value')
                if name and value:
                    info["preferences"][name] = value

            platforms_path = project_path / "platforms"
            if platforms_path.exists():
                info["platforms"] = [
                    p.name for p in platforms_path.iterdir()
                    if p.is_dir() and not p.name.startswith('.')
                ]

            plugins_path = project_path / "plugins"
            if plugins_path.exists():
                for plugin_dir in plugins_path.iterdir():
                    if plugin_dir.is_dir() and not plugin_dir.name.startswith('.'):
                        version = "latest"
                        package_file = plugin_dir / "package.json"
                        if package_file.exists():
                            try:
                                with open(package_file, 'r', encoding='utf-8') as f:
                                    data = json.load(f)
                                    version = data.get('version', 'latest')
                            except:
                                pass
                        info["plugins"].append({
                            "name": plugin_dir.name,
                            "version": version
                        })

            try:
                total_size = sum(f.stat().st_size for f in project_path.rglob('*') if f.is_file())
                info["size"] = format_size(total_size)
            except:
                info["size"] = "Unknown"

            return info

        except Exception as e:
            print(f"Error getting project info: {e}")
            return None

    def delete_project(self, project_path):
        """Delete project from database (not from disk)"""
        try:
            self.projects = [p for p in self.projects if p["path"] != project_path]
            self.save_projects()

            if self.current_project == project_path:
                self.current_project = None

            return {"success": True, "message": "Project removed from list"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def delete_project_from_disk(self, project_path):
        """Delete project from disk"""
        try:
            project_path = Path(project_path)
            if not project_path.exists():
                return {"success": False, "message": "Project does not exist"}

            self.delete_project(str(project_path))
            shutil.rmtree(project_path)

            return {"success": True, "message": "Project deleted from disk"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # ---------- Templates ----------

    def apply_template(self, project_path, template):
        """Apply template to project"""
        templates = {
            "tabs": self._apply_tabs_template,
            "sidebar": self._apply_sidebar_template,
            "material": self._apply_material_template
        }

        if template in templates:
            templates[template](project_path)

    def _apply_tabs_template(self, project_path):
        """Apply tabs template"""
        try:
            www_dir = project_path / "www"
            index_html = www_dir / "index.html"

            if index_html.exists():
                content = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>Tabs App</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .tabs { display: flex; position: fixed; bottom: 0; width: 100%; background: #f8f9fa; border-top: 1px solid #dee2e6; }
        .tab { flex: 1; text-align: center; padding: 12px 0; cursor: pointer; transition: 0.3s; }
        .tab.active { color: #007bff; }
        .tab i { font-size: 24px; display: block; }
        .tab span { font-size: 12px; }
        .content { padding: 20px; padding-bottom: 80px; }
        .page { display: none; }
        .page.active { display: block; }
    </style>
</head>
<body>
    <div class="content">
        <div id="page1" class="page active">
            <h1>Home</h1>
            <p>Welcome to your Cordova app!</p>
        </div>
        <div id="page2" class="page">
            <h1>Settings</h1>
            <p>App settings will appear here.</p>
        </div>
        <div id="page3" class="page">
            <h1>Profile</h1>
            <p>User profile information.</p>
        </div>
    </div>
    <div class="tabs">
        <div class="tab active" data-page="page1">🏠<span>Home</span></div>
        <div class="tab" data-page="page2">⚙️<span>Settings</span></div>
        <div class="tab" data-page="page3">👤<span>Profile</span></div>
    </div>
    <script>
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                document.getElementById(this.dataset.page).classList.add('active');
            });
        });
    </script>
</body>
</html>'''
                with open(index_html, 'w', encoding='utf-8') as f:
                    f.write(content)
        except:
            pass

    def _apply_sidebar_template(self, project_path):
        """Apply sidebar template"""
        try:
            www_dir = project_path / "www"
            index_html = www_dir / "index.html"

            if index_html.exists():
                content = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>Sidebar App</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; }
        .sidebar { width: 250px; height: 100vh; background: #343a40; color: white; padding: 20px; position: fixed; left: 0; top: 0; }
        .sidebar h2 { margin-bottom: 30px; }
        .sidebar nav a { display: block; color: rgba(255,255,255,0.7); padding: 12px 0; text-decoration: none; transition: 0.3s; }
        .sidebar nav a:hover { color: white; }
        .content { margin-left: 250px; padding: 30px; flex: 1; }
        .page { display: none; }
        .page.active { display: block; }
    </style>
</head>
<body>
    <div class="sidebar">
        <h2>📱 My App</h2>
        <nav>
            <a href="#" data-page="home" class="active">🏠 Home</a>
            <a href="#" data-page="about">ℹ️ About</a>
            <a href="#" data-page="contact">📧 Contact</a>
        </nav>
    </div>
    <div class="content">
        <div id="home" class="page active"><h1>Home</h1><p>Welcome to your app!</p></div>
        <div id="about" class="page"><h1>About</h1><p>About this app.</p></div>
        <div id="contact" class="page"><h1>Contact</h1><p>Contact us.</p></div>
    </div>
    <script>
        document.querySelectorAll('.sidebar nav a').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                document.getElementById(this.dataset.page).classList.add('active');
            });
        });
    </script>
</body>
</html>'''
                with open(index_html, 'w', encoding='utf-8') as f:
                    f.write(content)
        except:
            pass

    def _apply_material_template(self, project_path):
        """Apply Material Design template"""
        try:
            www_dir = project_path / "www"
            index_html = www_dir / "index.html"

            if index_html.exists():
                content = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>Material App</title>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Roboto', sans-serif; background: #f5f5f5; }
        .app-bar { background: #6200ee; color: white; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .app-bar h1 { font-size: 24px; }
        .content { padding: 20px; }
        .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .fab { position: fixed; bottom: 24px; right: 24px; background: #6200ee; color: white; width: 56px; height: 56px; border-radius: 50%; border: none; font-size: 24px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.2); transition: 0.3s; }
        .fab:hover { transform: scale(1.1); }
    </style>
</head>
<body>
    <div class="app-bar"><h1>📱 Material App</h1></div>
    <div class="content">
        <div class="card"><h3>Welcome!</h3><p>This is a Material Design app.</p></div>
        <div class="card"><h3>Features</h3><ul><li>Modern design</li><li>Responsive</li><li>Fast</li></ul></div>
        <div class="card"><h3>Get Started</h3><p>Click the button below to start!</p></div>
    </div>
    <button class="fab">+</button>
</body>
</html>'''
                with open(index_html, 'w', encoding='utf-8') as f:
                    f.write(content)
        except:
            pass

    # ---------- Platform Management ----------

    def add_platform(self, platform):
        """Add platform to current project with cancel support"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            config_path = Path(self.current_project) / "config.xml"
            if config_path.exists():
                fix_config_xml(config_path)

            env = get_env_for_subprocess()

            cmd = f'cordova platform add {platform}'
            print(f"📦 Adding platform: {platform}")
            print(f"🔨 Running: {cmd}")

            result = run_command_with_cancel(
                cmd,
                cwd=self.current_project,
                env=env,
                timeout=300
            )

            if result.get("timedout"):
                return {
                    "success": False,
                    "message": f"Adding platform '{platform}' timed out after 5 minutes",
                    "output": result.get("stderr", "")
                }

            if result["returncode"] == 0:
                for project in self.projects:
                    if project["path"] == self.current_project:
                        if platform not in project["platforms"]:
                            project["platforms"].append(platform)
                        break
                self.save_projects()

                return {
                    "success": True,
                    "message": f"Platform '{platform}' added successfully",
                    "output": result["stdout"]
                }
            else:
                return {
                    "success": False,
                    "message": result["stderr"] or "Failed to add platform",
                    "output": result["stderr"]
                }

        except Exception as e:
            return {"success": False, "message": str(e)}

    def remove_platform(self, platform):
        """Remove platform from current project with cancel support"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            env = get_env_for_subprocess()

            cmd = f'cordova platform remove {platform}'
            print(f"🗑️ Removing platform: {platform}")
            print(f"🔨 Running: {cmd}")

            result = run_command_with_cancel(
                cmd,
                cwd=self.current_project,
                env=env,
                timeout=120
            )

            if result.get("timedout"):
                return {
                    "success": False,
                    "message": f"Removing platform '{platform}' timed out after 2 minutes",
                    "output": result.get("stderr", "")
                }

            if result["returncode"] == 0:
                for project in self.projects:
                    if project["path"] == self.current_project:
                        if platform in project["platforms"]:
                            project["platforms"].remove(platform)
                        break
                self.save_projects()

                return {
                    "success": True,
                    "message": f"Platform '{platform}' removed successfully",
                    "output": result["stdout"]
                }
            else:
                return {
                    "success": False,
                    "message": result["stderr"] or "Failed to remove platform",
                    "output": result["stderr"]
                }

        except Exception as e:
            return {"success": False, "message": str(e)}

    def list_platforms(self):
        """List available platforms"""
        return {
            "available": ["android", "ios", "windows", "browser", "electron"],
            "installed": self.get_installed_platforms()
        }

    def get_installed_platforms(self):
        """Get installed platforms for current project"""
        if not self.current_project:
            return []

        try:
            result = subprocess.run(
                'cordova platform list',
                cwd=self.current_project,
                shell=True,
                capture_output=True,
                text=True
            )

            platforms = []
            for line in result.stdout.split('\n'):
                if 'Installed platforms:' in line:
                    continue
                if 'Available platforms:' in line:
                    break
                if line.strip() and not line.startswith(' '):
                    platform = line.strip().split()[0]
                    if platform:
                        platforms.append(platform)
            return platforms
        except:
            return []

    # ---------- Plugin Management ----------

    def add_plugin(self, plugin_name, version="latest"):
        """Add plugin to current project"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        if not plugin_name:
            return {"success": False, "message": "Plugin name is required"}

        try:
            if version and version.lower() != "latest":
                cmd = f'cordova plugin add {plugin_name}@{version}'
            else:
                cmd = f'cordova plugin add {plugin_name}'

            result = subprocess.run(
                cmd,
                cwd=self.current_project,
                shell=True,
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                for project in self.projects:
                    if project["path"] == self.current_project:
                        existing = next((p for p in project["plugins"] if p["name"] == plugin_name), None)
                        if existing:
                            existing["version"] = version
                        else:
                            project["plugins"].append({
                                "name": plugin_name,
                                "version": version
                            })
                        break
                self.save_projects()

                return {
                    "success": True,
                    "message": f"Plugin '{plugin_name}' installed successfully",
                    "output": result.stdout
                }
            else:
                return {"success": False, "message": result.stderr or "Failed to install plugin"}

        except Exception as e:
            return {"success": False, "message": str(e)}

    def remove_plugin(self, plugin_name):
        """Remove plugin from current project"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            cmd = f'cordova plugin remove {plugin_name}'
            result = subprocess.run(
                cmd,
                cwd=self.current_project,
                shell=True,
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                for project in self.projects:
                    if project["path"] == self.current_project:
                        project["plugins"] = [p for p in project["plugins"] if p["name"] != plugin_name]
                        break
                self.save_projects()

                return {
                    "success": True,
                    "message": f"Plugin '{plugin_name}' removed successfully"
                }
            else:
                return {"success": False, "message": result.stderr or "Failed to remove plugin"}

        except Exception as e:
            return {"success": False, "message": str(e)}

    def list_plugins(self):
        """List installed plugins for current project"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            result = subprocess.run(
                'cordova plugin list',
                cwd=self.current_project,
                shell=True,
                capture_output=True,
                text=True
            )

            plugins = []
            for line in result.stdout.split('\n'):
                if line.strip():
                    parts = line.strip().split()
                    if len(parts) >= 2:
                        plugins.append({
                            "name": parts[0],
                            "version": parts[1] if len(parts) > 1 else "unknown"
                        })

            return {"success": True, "plugins": plugins}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def search_plugins(self, query):
        """Search for plugins in npm registry"""
        try:
            cmd = f'npm search cordova-plugin {query} --json'
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                try:
                    data = json.loads(result.stdout)
                    plugins = []
                    for item in data[:20]:
                        plugins.append({
                            "name": item.get("name", ""),
                            "version": item.get("version", "latest"),
                            "description": item.get("description", ""),
                            "author": item.get("author", {}).get("name", "Unknown")
                        })
                    return {"success": True, "plugins": plugins}
                except:
                    pass

            popular = [
                {"name": "cordova-plugin-camera", "version": "5.0.3", "description": "Camera plugin"},
                {"name": "cordova-plugin-geolocation", "version": "4.1.0", "description": "Geolocation plugin"},
                {"name": "cordova-plugin-file", "version": "6.0.2", "description": "File plugin"},
                {"name": "cordova-plugin-device", "version": "2.0.3", "description": "Device plugin"},
                {"name": "cordova-plugin-network-information", "version": "2.0.2", "description": "Network info"},
            ]
            return {"success": True, "plugins": popular}

        except Exception as e:
            return {"success": False, "message": str(e)}

    # ---------- Build Management ----------

    def build_project(self, platform="android", build_type="debug", flags=""):
        """Build project for specified platform with signing support"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        # Ensure icons exist in Android platform
        if platform == "android":
            # Check if icons are missing
            android_icon = Path(
                self.current_project) / "platforms" / "android" / "app" / "src" / "main" / "res" / "mipmap-mdpi" / "ic_launcher.png"

            if not android_icon.exists():
                print("⚠️ Icons missing in Android platform, copying...")
                result = copy_icons_to_platform()
                if not result.get("success"):
                    print(f"⚠️ Failed to copy icons: {result.get('message')}")

        try:
            import re
            env = get_env_for_subprocess()

            print(f"🔍 Building for platform: {platform}")
            print(f"🔍 Build type: {build_type}")
            print(f"🔍 Flags: {flags}")

            config_path = Path(self.current_project) / "config.xml"
            if config_path.exists():
                fix_config_xml(config_path)

            project_path = Path(self.current_project)
            result = None
            output_file = None
            output_file_size = None

            # ============================================================
            # ANDROID BUILD
            # ============================================================
            if platform == "android":
                apk_path = project_path / "platforms" / "android" / "app" / "build" / "outputs" / "apk"

                # ---------- RELEASE BUILD (with signing) ----------
                if build_type == "release":
                    gradlew_path = project_path / "platforms" / "android" / "gradlew.bat"

                    if gradlew_path.exists():
                        # Extract keystore parameters from flags
                        keystore_match = re.search(r'--keystore="([^"]+)"', flags)
                        storePass_match = re.search(r'--storePassword=([^\s]+)', flags)
                        keyAlias_match = re.search(r'--keyAlias=([^\s]+)', flags)
                        keyPass_match = re.search(r'--keyPassword=([^\s]+)', flags)

                        if keystore_match and storePass_match and keyAlias_match:
                            keystore_path = os.path.abspath(keystore_match.group(1))
                            keystore_path = os.path.normpath(keystore_path)

                            cmd = f'"{gradlew_path}" assembleRelease'
                            cmd += f' -Pandroid.injected.signing.store.file="{keystore_path}"'
                            cmd += f' -Pandroid.injected.signing.store.password={storePass_match.group(1)}'
                            cmd += f' -Pandroid.injected.signing.key.alias={keyAlias_match.group(1)}'
                            if keyPass_match:
                                cmd += f' -Pandroid.injected.signing.key.password={keyPass_match.group(1)}'
                            print(f"🔨 Using gradlew with signing: {cmd}")

                            result = subprocess.run(
                                cmd,
                                cwd=project_path / "platforms" / "android",
                                shell=True,
                                capture_output=True,
                                text=True,
                                env=env
                            )
                        else:
                            print(f"⚠️ Incomplete keystore params, building unsigned APK")
                            cmd = f'"{gradlew_path}" assembleRelease'
                            result = subprocess.run(
                                cmd,
                                cwd=project_path / "platforms" / "android",
                                shell=True,
                                capture_output=True,
                                text=True,
                                env=env
                            )
                    else:
                        # Fallback to cordova build
                        cmd = f'cordova build android --release'
                        if flags:
                            cmd += f' {flags}'
                        print(f"🔨 Using cordova build: {cmd}")
                        result = subprocess.run(
                            cmd,
                            cwd=self.current_project,
                            shell=True,
                            capture_output=True,
                            text=True,
                            env=env
                        )

                    # Find APK
                    if result and result.returncode == 0:
                        apk_path_release = apk_path / "release"
                        if apk_path_release.exists():
                            apk_files = list(apk_path_release.glob("*.apk"))
                            signed_apks = [f for f in apk_files if "unsigned" not in f.name]
                            if signed_apks:
                                output_file = str(signed_apks[0])
                                output_file_size = format_size(signed_apks[0].stat().st_size)
                            elif apk_files:
                                output_file = str(apk_files[0])
                                output_file_size = format_size(apk_files[0].stat().st_size)

                # ---------- DEBUG BUILD ----------
                else:
                    gradlew_path = project_path / "platforms" / "android" / "gradlew.bat"
                    if gradlew_path.exists():
                        cmd = f'"{gradlew_path}" assembleDebug'
                        if flags:
                            cmd += f' {flags}'
                        print(f"🔨 Using gradlew: {cmd}")
                        result = subprocess.run(
                            cmd,
                            cwd=project_path / "platforms" / "android",
                            shell=True,
                            capture_output=True,
                            text=True,
                            env=env
                        )
                    else:
                        cmd = f'cordova build android --debug'
                        if flags:
                            cmd += f' {flags}'
                        print(f"🔨 Using cordova build: {cmd}")
                        result = subprocess.run(
                            cmd,
                            cwd=self.current_project,
                            shell=True,
                            capture_output=True,
                            text=True,
                            env=env
                        )

                    # Find APK
                    if result and result.returncode == 0:
                        apk_path_debug = apk_path / "debug"
                        if apk_path_debug.exists():
                            apk_files = list(apk_path_debug.glob("*.apk"))
                            if apk_files:
                                output_file = str(apk_files[0])
                                output_file_size = format_size(apk_files[0].stat().st_size)

            # ============================================================
            # iOS BUILD (requires macOS)
            # ============================================================
            elif platform == "ios":
                if platform.system() != 'Darwin':
                    return {
                        "success": False,
                        "message": "iOS builds are only supported on macOS",
                        "output": "Platform: macOS required"
                    }

                cmd = f'cordova build ios --{build_type}'
                if flags:
                    cmd += f' {flags}'
                print(f"🔨 Building iOS: {cmd}")

                result = subprocess.run(
                    cmd,
                    cwd=self.current_project,
                    shell=True,
                    capture_output=True,
                    text=True,
                    env=env
                )

                # Find IPA
                if result and result.returncode == 0:
                    # Look for .ipa file
                    ipa_path = project_path / "platforms" / "ios" / "build" / "device"
                    if ipa_path.exists():
                        ipa_files = list(ipa_path.glob("*.ipa"))
                        if ipa_files:
                            output_file = str(ipa_files[0])
                            output_file_size = format_size(ipa_files[0].stat().st_size)
                    else:
                        # Maybe it's in build/emulator
                        ipa_path = project_path / "platforms" / "ios" / "build" / "emulator"
                        if ipa_path.exists():
                            app_files = list(ipa_path.glob("*.app"))
                            if app_files:
                                output_file = str(app_files[0])
                                output_file_size = format_size(app_files[0].stat().st_size)

            # ============================================================
            # WINDOWS BUILD
            # ============================================================
            elif platform == "windows":
                cmd = f'cordova build windows --{build_type}'
                if flags:
                    cmd += f' {flags}'
                print(f"🔨 Building Windows: {cmd}")

                result = subprocess.run(
                    cmd,
                    cwd=self.current_project,
                    shell=True,
                    capture_output=True,
                    text=True,
                    env=env
                )

                # Find APPX
                if result and result.returncode == 0:
                    appx_path = project_path / "platforms" / "windows" / "AppPackages"
                    if appx_path.exists():
                        appx_files = list(appx_path.glob("*.appx"))
                        if appx_files:
                            output_file = str(appx_files[0])
                            output_file_size = format_size(appx_files[0].stat().st_size)

            # ============================================================
            # BROWSER BUILD
            # ============================================================
            elif platform == "browser":
                cmd = f'cordova build browser --{build_type}'
                if flags:
                    cmd += f' {flags}'
                print(f"🔨 Building Browser: {cmd}")

                result = subprocess.run(
                    cmd,
                    cwd=self.current_project,
                    shell=True,
                    capture_output=True,
                    text=True,
                    env=env
                )

                # Find output
                if result and result.returncode == 0:
                    browser_path = project_path / "platforms" / "browser" / "www"
                    if browser_path.exists():
                        output_file = str(browser_path)
                        output_file_size = "N/A (web files)"

            # ============================================================
            # ELECTRON BUILD
            # ============================================================
            elif platform == "electron":
                cmd = f'cordova build electron --{build_type}'
                if flags:
                    cmd += f' {flags}'
                print(f"🔨 Building Electron: {cmd}")

                result = subprocess.run(
                    cmd,
                    cwd=self.current_project,
                    shell=True,
                    capture_output=True,
                    text=True,
                    env=env
                )

                # Find output
                if result and result.returncode == 0:
                    electron_path = project_path / "platforms" / "electron" / "build"
                    if electron_path.exists():
                        # Look for executable
                        exe_files = list(electron_path.glob("*.exe")) + list(electron_path.glob("*.AppImage"))
                        if exe_files:
                            output_file = str(exe_files[0])
                            output_file_size = format_size(exe_files[0].stat().st_size)
                        else:
                            output_file = str(electron_path)
                            output_file_size = "N/A (Electron build)"

            # ============================================================
            # UNKNOWN PLATFORM
            # ============================================================
            else:
                return {
                    "success": False,
                    "message": f"Unknown platform: {platform}",
                    "output": f"Supported platforms: android, ios, windows, browser, electron"
                }

            # ---------- Build Record ----------
            if result:
                build_record = {
                    "project": self.current_project,
                    "platform": platform,
                    "type": build_type,
                    "timestamp": datetime.now().isoformat(),
                    "success": result.returncode == 0,
                    "output": result.stdout + result.stderr
                }
                self.build_history.append(build_record)
                self.save_build_history()

            # ---------- Process Result ----------
            if result and result.returncode == 0:
                return {
                    "success": True,
                    "message": f"Build successful for {platform}",
                    "output": result.stdout + result.stderr,
                    "output_file": output_file,
                    "output_size": output_file_size
                }
            elif result:
                return {
                    "success": False,
                    "message": f"Build failed for {platform}",
                    "output": result.stderr or result.stdout
                }
            else:
                return {
                    "success": False,
                    "message": "No build result",
                    "output": "Build process did not return a result"
                }

        except Exception as e:
            return {"success": False, "message": str(e)}

    def run_app(self, platform="android", target="device"):
        """Run app on device or emulator"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            config_path = Path(self.current_project) / "config.xml"
            if config_path.exists():
                fix_config_xml(config_path)

            env = get_env_for_subprocess()

            # iOS requires special handling
            if platform == "ios" and platform.system() != 'Darwin':
                return {
                    "success": False,
                    "message": "iOS emulation is only supported on macOS",
                    "output": "Platform: macOS required"
                }

            if target == "emulator":
                cmd = f'cordova emulate {platform}'
            else:
                cmd = f'cordova run {platform}'

            print(f"🔨 Running: {cmd}")

            result = subprocess.run(
                cmd,
                cwd=self.current_project,
                shell=True,
                capture_output=True,
                text=True,
                env=env,
                timeout=300  # 5 minutes timeout
            )

            if result.returncode == 0:
                return {
                    "success": True,
                    "message": f"App running on {target}",
                    "output": result.stdout
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to run app",
                    "output": result.stderr or result.stdout
                }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": "Run command timed out",
                "output": "The command took too long to complete"
            }
        except Exception as e:
            return {"success": False, "message": str(e)}

    # ---------- Config Management ----------

    def load_config(self):
        """Load config.xml content - COMPLETE: reads ALL tags and preserves full XML"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            config_path = Path(self.current_project) / "config.xml"
            if not config_path.exists():
                return {"success": False, "message": "config.xml not found"}

            fix_config_xml(config_path)

            with open(config_path, 'r', encoding='utf-8') as f:
                full_xml = f.read()

            tree = ET.parse(config_path)
            root = tree.getroot()

            config = {
                "id": root.get('id', ''),
                "version": root.get('version', '1.0.0'),
                "name": "",
                "author": "",
                "email": "",
                "website": "",
                "description": "",
                "preferences": {},
                "permissions": [],
                "platforms": [],
                "fullXml": full_xml
            }

            name_elem = root.find('name')
            if name_elem is not None and name_elem.text:
                config["name"] = name_elem.text.strip()
            else:
                for elem in root.findall('.//{http://www.w3.org/ns/widgets}name'):
                    if elem.text:
                        config["name"] = elem.text.strip()
                        break

            author_elem = root.find('author')
            if author_elem is not None:
                if author_elem.text:
                    config["author"] = author_elem.text.strip()
                config["email"] = author_elem.get('email', '')
                config["website"] = author_elem.get('href', '')
            else:
                for elem in root.findall('.//{http://www.w3.org/ns/widgets}author'):
                    if elem.text:
                        config["author"] = elem.text.strip()
                    config["email"] = elem.get('email', '')
                    config["website"] = elem.get('href', '')
                    break

            desc_elem = root.find('description')
            if desc_elem is not None and desc_elem.text:
                config["description"] = desc_elem.text.strip()
            else:
                for elem in root.findall('.//{http://www.w3.org/ns/widgets}description'):
                    if elem.text:
                        config["description"] = elem.text.strip()
                        break

            for pref in root.findall('preference'):
                name = pref.get('name')
                value = pref.get('value')
                if name and value:
                    config["preferences"][name] = value

            for platform in root.findall('platform'):
                name = platform.get('name')
                if name:
                    config["platforms"].append(name)

            for perm in root.findall('.//uses-permission'):
                name = perm.get('{http://schemas.android.com/apk/res/android}name')
                if not name:
                    name = perm.get('name')
                if name and name not in config["permissions"]:
                    config["permissions"].append(name)

            return {"success": True, "config": config}

        except ET.ParseError as e:
            return {"success": False, "message": f"XML parsing error: {str(e)}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def save_config(self, config_data):
        """Save config.xml - PRESERVES ALL TAGS with proper formatting"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            config_path = Path(self.current_project) / "config.xml"

            full_xml = config_data.get('fullXml', '')

            if full_xml and full_xml.strip():
                try:
                    import xml.dom.minidom as minidom

                    xml_to_parse = full_xml

                    xml_decl_pattern = r'<\?xml[^?]*\?>'
                    declarations = re.findall(xml_decl_pattern, xml_to_parse)
                    if len(declarations) > 1:
                        xml_to_parse = declarations[0] + '\n' + re.sub(xml_decl_pattern, '', xml_to_parse, count=1)

                    dom = minidom.parseString(xml_to_parse)
                    root = dom.documentElement

                    if config_data.get('id'):
                        root.setAttribute('id', config_data['id'])
                    if config_data.get('version'):
                        root.setAttribute('version', config_data['version'])

                    name_elem = root.getElementsByTagName('name')
                    if name_elem and name_elem[0]:
                        name_elem[0].firstChild.data = config_data.get('name', '')
                    else:
                        name_elem = dom.createElement('name')
                        name_elem.appendChild(dom.createTextNode(config_data.get('name', '')))
                        root.appendChild(name_elem)

                    author_elem = root.getElementsByTagName('author')
                    if author_elem and author_elem[0]:
                        author_elem[0].firstChild.data = config_data.get('author', '')
                        if config_data.get('email'):
                            author_elem[0].setAttribute('email', config_data.get('email', ''))
                        if config_data.get('website'):
                            author_elem[0].setAttribute('href', config_data.get('website', ''))
                    else:
                        author_elem = dom.createElement('author')
                        author_elem.appendChild(dom.createTextNode(config_data.get('author', '')))
                        if config_data.get('email'):
                            author_elem.setAttribute('email', config_data.get('email', ''))
                        if config_data.get('website'):
                            author_elem.setAttribute('href', config_data.get('website', ''))
                        root.appendChild(author_elem)

                    desc_elem = root.getElementsByTagName('description')
                    if desc_elem and desc_elem[0]:
                        desc_elem[0].firstChild.data = config_data.get('description', '')
                    else:
                        desc_elem = dom.createElement('description')
                        desc_elem.appendChild(dom.createTextNode(config_data.get('description', '')))
                        root.appendChild(desc_elem)

                    for pref in root.getElementsByTagName('preference'):
                        root.removeChild(pref)

                    for pref_name, pref_value in config_data.get('preferences', {}).items():
                        if pref_name and pref_value:
                            pref = dom.createElement('preference')
                            pref.setAttribute('name', pref_name)
                            pref.setAttribute('value', pref_value)
                            root.appendChild(pref)

                    platform_elements = root.getElementsByTagName('platform')
                    platform_android = None
                    for p in platform_elements:
                        if p.getAttribute('name') == 'android':
                            platform_android = p
                            break

                    if platform_android is None:
                        platform_android = dom.createElement('platform')
                        platform_android.setAttribute('name', 'android')
                        root.appendChild(platform_android)

                    for perm in platform_android.getElementsByTagName('uses-permission'):
                        platform_android.removeChild(perm)

                    for perm in config_data.get('permissions', []):
                        if perm:
                            uses_perm = dom.createElement('uses-permission')
                            uses_perm.setAttribute('android:name', perm)
                            platform_android.appendChild(uses_perm)

                    pretty_xml = dom.toprettyxml(indent="    ", encoding="utf-8").decode('utf-8')

                    lines = []
                    for line in pretty_xml.split('\n'):
                        if not line.strip():
                            continue
                        if '/>' in line:
                            line = re.sub(r'\s+/>', '/>', line)
                        if 'standalone="yes"' in line:
                            line = line.replace('standalone="yes"', '')
                        if line.startswith('<?xml') and line != '<?xml version="1.0" encoding="utf-8"?>':
                            line = '<?xml version="1.0" encoding="utf-8"?>'
                        lines.append(line)

                    result = '\n'.join(lines)

                    if not result.startswith('<?xml'):
                        result = '<?xml version="1.0" encoding="utf-8"?>\n' + result

                    result = re.sub(r'(<\?xml[^?]*\?>)\s*(<\?xml[^?]*\?>)', r'\1', result)

                    with open(config_path, 'w', encoding='utf-8') as f:
                        f.write(result)

                    return {"success": True, "message": "Configuration saved successfully (pretty printed)"}

                except Exception as e:
                    print(f"⚠️ Could not preserve full XML, falling back to rebuild: {e}")

            return self._build_config_from_scratch(config_data, config_path)

        except Exception as e:
            return {"success": False, "message": str(e)}

    def _build_config_from_scratch(self, config_data, config_path):
        """Build config.xml from scratch with proper formatting"""
        try:
            package_id = config_data.get('id', 'com.example.app')
            version = config_data.get('version', '1.0.0')
            name = config_data.get('name', 'My App')
            author = config_data.get('author', '')
            email = config_data.get('email', '')
            website = config_data.get('website', '')
            description = config_data.get('description', 'A Cordova application')
            preferences = config_data.get('preferences', {})
            permissions = config_data.get('permissions', [])

            lines = []
            lines.append('<?xml version="1.0" encoding="utf-8"?>')
            lines.append(
                f'<widget id="{package_id}" version="{version}" '
                f'xmlns="http://www.w3.org/ns/widgets" '
                f'xmlns:cdv="http://cordova.apache.org/ns/1.0">'
            )

            lines.append(f'    <name>{name}</name>')
            lines.append(f'    <description>{description}</description>')

            author_attr = ''
            if email:
                author_attr += f' email="{email}"'
            if website:
                author_attr += f' href="{website}"'
            lines.append(f'    <author{author_attr}>{author}</author>')

            lines.append('    <content src="index.html" />')
            lines.append('    <access origin="*" />')

            lines.append('    <allow-intent href="http://*/*" />')
            lines.append('    <allow-intent href="https://*/*" />')
            lines.append('    <allow-intent href="tel:*" />')
            lines.append('    <allow-intent href="sms:*" />')
            lines.append('    <allow-intent href="mailto:*" />')
            lines.append('    <allow-intent href="geo:*" />')

            for pref_name, pref_value in preferences.items():
                if pref_name and pref_value:
                    lines.append(f'    <preference name="{pref_name}" value="{pref_value}" />')

            lines.append('    <platform name="android">')
            lines.append('        <allow-intent href="market:*" />')
            for perm in permissions:
                if perm:
                    lines.append(f'        <uses-permission android:name="{perm}" />')
            lines.append('    </platform>')

            lines.append('    <platform name="ios">')
            lines.append('        <allow-intent href="itms:*" />')
            lines.append('        <allow-intent href="itms-apps:*" />')
            lines.append('    </platform>')

            lines.append('</widget>')

            with open(config_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))

            return {"success": True, "message": "Configuration saved successfully (fallback)"}

        except Exception as e:
            return {"success": False, "message": str(e)}

    def _pretty_format_xml(self, xml_path):
        """Pretty format XML file - preserves proper indentation"""
        try:
            import xml.dom.minidom as minidom
            import re

            with open(xml_path, 'r', encoding='utf-8') as f:
                xml_str = f.read()

            dom = minidom.parseString(xml_str)
            pretty_xml = dom.toprettyxml(indent="    ", encoding="utf-8").decode('utf-8')

            lines = []
            for line in pretty_xml.split('\n'):
                if not line.strip():
                    continue
                if '/>' in line:
                    line = re.sub(r'\s+/>', '/>', line)
                if 'standalone="yes"' in line:
                    line = line.replace('standalone="yes"', '')
                if '<?xml' in line and 'standalone' in line:
                    line = re.sub(r'\s+standalone="[^"]*"', '', line)
                lines.append(line)

            result = '\n'.join(lines)

            if not result.startswith('<?xml'):
                result = '<?xml version="1.0" encoding="utf-8"?>\n' + result

            with open(xml_path, 'w', encoding='utf-8') as f:
                f.write(result)

            return True

        except Exception as e:
            print(f"⚠️ Warning: Could not pretty format XML: {e}")
            return False

    # ---------- Resource Management ----------

    def generate_icons(self, image_path):
        """Generate app icons from image"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            if not check_command_exists("cordova-res"):
                return {"success": False, "message": "cordova-res is not installed. Run: npm install -g cordova-res"}

            resources_dir = Path(self.current_project) / "resources"
            resources_dir.mkdir(exist_ok=True)

            cmd = f'cordova-res generate --icon "{image_path}"'
            result = subprocess.run(
                cmd,
                cwd=self.current_project,
                shell=True,
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                return {
                    "success": True,
                    "message": "Icons generated successfully",
                    "output": result.stdout
                }
            else:
                return {"success": False, "message": result.stderr or "Failed to generate icons"}

        except Exception as e:
            return {"success": False, "message": str(e)}

    def generate_splash(self, image_path):
        """Generate splash screens from image"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            if not check_command_exists("cordova-res"):
                return {"success": False, "message": "cordova-res is not installed. Run: npm install -g cordova-res"}

            cmd = f'cordova-res generate --splash "{image_path}"'
            result = subprocess.run(
                cmd,
                cwd=self.current_project,
                shell=True,
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                return {
                    "success": True,
                    "message": "Splash screens generated successfully",
                    "output": result.stdout
                }
            else:
                return {"success": False, "message": result.stderr or "Failed to generate splash screens"}

        except Exception as e:
            return {"success": False, "message": str(e)}

    # ---------- Export/Import ----------

    def export_project(self, project_path, export_path=None):
        """Export project as zip file"""
        try:
            project_path = Path(project_path)
            if not project_path.exists():
                return {"success": False, "message": "Project does not exist"}

            if export_path is None:
                export_path = project_path.parent / f"{project_path.name}.zip"

            with zipfile.ZipFile(export_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file in project_path.rglob('*'):
                    if file.is_file():
                        arcname = file.relative_to(project_path)
                        zipf.write(file, arcname)

            return {
                "success": True,
                "message": "Project exported successfully",
                "path": str(export_path)
            }

        except Exception as e:
            return {"success": False, "message": str(e)}

    def import_project(self, zip_path, extract_path):
        """Import project from zip file"""
        try:
            zip_path = Path(zip_path)
            if not zip_path.exists():
                return {"success": False, "message": "Zip file does not exist"}

            extract_path = Path(extract_path)
            extract_path.mkdir(parents=True, exist_ok=True)

            with zipfile.ZipFile(zip_path, 'r') as zipf:
                zipf.extractall(extract_path)

            for file in extract_path.rglob('config.xml'):
                project_root = file.parent
                return self.open_project(str(project_root))

            return {"success": False, "message": "No valid Cordova project found in zip"}

        except Exception as e:
            return {"success": False, "message": str(e)}

    # ---------- System Commands ----------

    def run_command(self, command):
        """Run custom command in project context"""
        try:
            cwd = self.current_project if self.current_project else None
            result = subprocess.run(
                command,
                cwd=cwd,
                shell=True,
                capture_output=True,
                text=True
            )

            return {
                "success": result.returncode == 0,
                "output": result.stdout + result.stderr,
                "returncode": result.returncode
            }

        except Exception as e:
            return {"success": False, "message": str(e)}

    def clean_project(self):
        """Clean project"""
        if not self.current_project:
            return {"success": False, "message": "No project is open"}

        try:
            env = get_env_for_subprocess()
            cmd = 'cordova clean'
            result = subprocess.run(
                cmd,
                cwd=self.current_project,
                shell=True,
                capture_output=True,
                text=True,
                env=env
            )

            if result.returncode == 0:
                return {
                    "success": True,
                    "message": "Project cleaned successfully",
                    "output": result.stdout
                }
            else:
                return {"success": False, "message": result.stderr or "Failed to clean project"}

        except Exception as e:
            return {"success": False, "message": str(e)}


# ============================================================
# CREATE GLOBAL PROJECT MANAGER INSTANCE
# ============================================================

pm = ProjectManager()


# ============================================================
# CONFIG MANAGEMENT - SIMPLE RAW XML (MODULE LEVEL)
# ============================================================

@eel.expose
def clean_xml_content(content):
    """Clean XML content"""
    import re

    if not content:
        return content

    # Remove duplicate declarations
    decl_pattern = r'<\?xml[^?]*\?>'
    declarations = re.findall(decl_pattern, content)
    if len(declarations) > 1:
        content = declarations[0] + '\n' + re.sub(decl_pattern, '', content, count=1).strip()

    # Remove standalone attribute
    content = re.sub(r'standalone="[^"]*"', '', content)

    # Fix self-closing tags (add space before /> if needed)
    content = re.sub(r'(\S)\/\>', r'\1 />', content)

    return content


@eel.expose
def write_pretty_xml(file_path, xml_content):
    """Write XML with pretty formatting"""
    try:
        import xml.dom.minidom as minidom
        import re

        # Parse and pretty print
        dom = minidom.parseString(xml_content)
        pretty_xml = dom.toprettyxml(indent="    ", encoding="utf-8").decode('utf-8')

        # Clean up
        lines = []
        for line in pretty_xml.split('\n'):
            if not line.strip():
                continue
            # Fix self-closing tags
            if '/>' in line:
                line = re.sub(r'\s+/>', '/>', line)
            # Remove standalone
            if 'standalone="yes"' in line:
                line = line.replace('standalone="yes"', '')
            # Remove duplicate declarations
            if line.startswith('<?xml') and 'standalone' in line:
                line = re.sub(r'\s+standalone="[^"]*"', '', line)
            lines.append(line)

        result = '\n'.join(lines)

        # Ensure single declaration
        if not result.startswith('<?xml'):
            result = '<?xml version="1.0" encoding="utf-8"?>\n' + result

        # Remove duplicate declarations
        result = re.sub(r'(<\?xml[^?]*\?>)\s*(<\?xml[^?]*\?>)', r'\1', result)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(result)

        return True

    except Exception as e:
        # Fallback: write as is
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(xml_content)
        return True


# ============================================================
# EEL EXPOSED CONFIG FUNCTIONS (MODULE LEVEL)
# ============================================================

@eel.expose
def load_raw_config():
    """Load config.xml raw content"""
    if not pm.current_project:
        return {"success": False, "message": "No project is open"}

    try:
        config_path = Path(pm.current_project) / "config.xml"
        if not config_path.exists():
            return {"success": False, "message": "config.xml not found"}

        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()

        content = clean_xml_content(content)

        return {"success": True, "content": content}

    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def save_raw_config(xml_content):
    """Save config.xml raw content"""
    if not pm.current_project:
        return {"success": False, "message": "No project is open"}

    try:
        config_path = Path(pm.current_project) / "config.xml"

        # Validate XML
        import xml.etree.ElementTree as ET
        try:
            ET.fromstring(xml_content)
        except ET.ParseError as e:
            return {"success": False, "message": f"Invalid XML: {str(e)}"}

        # Clean the content
        xml_content = clean_xml_content(xml_content)

        # Write with proper formatting
        write_pretty_xml(config_path, xml_content)

        return {"success": True, "message": "Config saved successfully"}

    except Exception as e:
        return {"success": False, "message": str(e)}


# ============================================================
# EEL EXPOSED FUNCTIONS
# ============================================================

# ---------- Project Management ----------

@eel.expose
def create_project(name, package_id, path, template="empty"):
    """Create new Cordova project"""
    result = pm.create_project(name, package_id, path, template)
    if result.get("success"):
        eel.showToast("success", "Success", "Project created successfully!")
    return result


@eel.expose
def select_project():
    """Select project using file dialog"""
    root = None
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)

        project_path = filedialog.askdirectory(
            title="Select Cordova Project",
            initialdir=str(Path.home())
        )

        if project_path:
            return pm.open_project(project_path)
        else:
            return {"success": False, "message": "No project selected"}

    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        if root:
            try:
                root.destroy()
            except:
                pass


@eel.expose
def select_folder():
    """Select folder using file dialog"""
    root = None
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)

        folder_path = filedialog.askdirectory(
            title="Select Folder",
            initialdir=str(Path.home())
        )

        return folder_path if folder_path else None

    except Exception as e:
        return None
    finally:
        if root:
            try:
                root.destroy()
            except:
                pass


@eel.expose
def open_project(project_path):
    """Open a project by path (for recent projects)"""
    return pm.open_project(project_path)


@eel.expose
def get_project_info():
    """Get current project info"""
    if pm.current_project:
        info = pm.get_project_info(pm.current_project)
        if info:
            info["path"] = pm.current_project
            return {"success": True, "project": info}
    return {"success": False, "message": "No project is open"}


@eel.expose
def get_recent_projects():
    """Get list of recent projects"""
    recent = pm.projects[-10:]
    return {"success": True, "projects": recent}


@eel.expose
def delete_project(project_path):
    """Delete project from list"""
    return pm.delete_project(project_path)


@eel.expose
def delete_project_from_disk(project_path):
    """Delete project from disk"""
    return pm.delete_project_from_disk(project_path)


# ---------- Platform Management ----------

@eel.expose
def add_platform(platform):
    """Add platform to current project"""
    return pm.add_platform(platform)


@eel.expose
def remove_platform(platform):
    """Remove platform from current project"""
    return pm.remove_platform(platform)


@eel.expose
def list_platforms():
    """List available and installed platforms"""
    return pm.list_platforms()


# ---------- Plugin Management ----------

@eel.expose
def add_plugin(plugin_name, version="latest"):
    """Add plugin to current project"""
    return pm.add_plugin(plugin_name, version)


@eel.expose
def remove_plugin(plugin_name):
    """Remove plugin from current project"""
    return pm.remove_plugin(plugin_name)


@eel.expose
def list_plugins():
    """List installed plugins"""
    return pm.list_plugins()


@eel.expose
def search_plugins(query):
    """Search for plugins"""
    return pm.search_plugins(query)


# ---------- Build Management ----------

@eel.expose
def build_project(platform="android", build_type="debug", flags=""):
    """Build project for specified platform"""
    return pm.build_project(platform, build_type, flags)


@eel.expose
def run_app(platform="android", target="device"):
    """Run app on device or emulator"""
    return pm.run_app(platform, target)


@eel.expose
def get_build_history():
    """Get build history"""
    return {"success": True, "history": pm.build_history}


@eel.expose
def clean_project():
    """Clean project"""
    return pm.clean_project()


# ---------- Config Management ----------

@eel.expose
def load_config():
    """Load config.xml content"""
    return pm.load_config()


@eel.expose
def save_config(config_data):
    """Save config.xml content"""
    return pm.save_config(config_data)


# ---------- Resource Management ----------

# ============================================================
# CORDOVA-RES MANAGEMENT - FIXED VERSION
# ============================================================

@eel.expose
def check_cordova_res():
    """Check if cordova-res is installed (check both global and npx)"""
    try:
        import subprocess

        # Check 1: Try cordova-res directly
        result = subprocess.run(
            'cordova-res --version',
            shell=True,
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            version = result.stdout.strip() or result.stderr.strip() or 'unknown'
            return {
                "installed": True,
                "version": version,
                "method": "global"
            }

        # Check 2: Try npx cordova-res
        result2 = subprocess.run(
            'npx cordova-res --version',
            shell=True,
            capture_output=True,
            text=True,
            timeout=15
        )

        if result2.returncode == 0:
            version = result2.stdout.strip() or result2.stderr.strip() or 'unknown'
            return {
                "installed": True,
                "version": version,
                "method": "npx"
            }

        return {"installed": False}

    except Exception as e:
        return {"installed": False, "error": str(e)}


@eel.expose
def install_cordova_res():
    """Install cordova-res globally via npm with refresh"""
    try:
        import subprocess
        import sys
        import os

        # Check if npm is available
        npm_check = subprocess.run(
            'npm --version',
            shell=True,
            capture_output=True,
            text=True
        )

        if npm_check.returncode != 0:
            return {
                "success": False,
                "message": "npm is not installed. Please install Node.js first."
            }

        # Install cordova-res globally
        result = subprocess.run(
            'npm install -g cordova-res',
            shell=True,
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode == 0:
            # Try to find where cordova-res was installed
            where_result = subprocess.run(
                'where cordova-res' if sys.platform == 'win32' else 'which cordova-res',
                shell=True,
                capture_output=True,
                text=True
            )

            install_path = where_result.stdout.strip() if where_result.returncode == 0 else 'unknown'

            return {
                "success": True,
                "message": "cordova-res installed successfully",
                "output": result.stdout,
                "install_path": install_path
            }
        else:
            return {
                "success": False,
                "message": result.stderr or "Failed to install cordova-res",
                "output": result.stderr
            }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "message": "Installation timed out. Please try again."
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


def update_config_xml_for_resources(project_path, resource_type="icon"):
    """Update config.xml with icon or splash references - KEEP OTHER TYPE"""
    config_path = Path(project_path) / "config.xml"
    if not config_path.exists():
        return False

    try:
        import xml.etree.ElementTree as ET
        import xml.dom.minidom as minidom
        import re

        # Fix ns0 prefixes first
        fix_config_xml(config_path)

        # Parse the fixed config
        tree = ET.parse(config_path)
        root = tree.getroot()

        # ✅ ONLY remove elements of the SAME type
        elements_to_remove = []
        for element in root:
            tag_name = element.tag
            if '}' in tag_name:
                tag_name = tag_name.split('}')[1]

            # Only remove the type we're updating
            if tag_name == resource_type:
                elements_to_remove.append(element)

        for element in elements_to_remove:
            root.remove(element)

        # Add new elements (only for the requested type)
        if resource_type == "icon":
            icons = [
                {"src": "resources/icon.png", "platform": "android", "density": "mdpi"},
                {"src": "resources/icon.png", "platform": "android", "density": "hdpi"},
                {"src": "resources/icon.png", "platform": "android", "density": "xhdpi"},
                {"src": "resources/icon.png", "platform": "android", "density": "xxhdpi"},
                {"src": "resources/icon.png", "platform": "android", "density": "xxxhdpi"},
                {"src": "resources/icon.png", "platform": "ios", "width": "20", "height": "20"},
                {"src": "resources/icon.png", "platform": "ios", "width": "29", "height": "29"},
                {"src": "resources/icon.png", "platform": "ios", "width": "40", "height": "40"},
                {"src": "resources/icon.png", "platform": "ios", "width": "60", "height": "60"},
                {"src": "resources/icon.png", "platform": "ios", "width": "76", "height": "76"},
                {"src": "resources/icon.png", "platform": "ios", "width": "83.5", "height": "83.5"},
            ]

            for icon_attr in icons:
                icon_elem = ET.Element("icon")
                for key, value in icon_attr.items():
                    icon_elem.set(key, str(value))
                root.append(icon_elem)

        elif resource_type == "splash":
            splashes = [
                {"src": "resources/splash.png", "platform": "android", "density": "port-ldpi"},
                {"src": "resources/splash.png", "platform": "android", "density": "port-mdpi"},
                {"src": "resources/splash.png", "platform": "android", "density": "port-hdpi"},
                {"src": "resources/splash.png", "platform": "android", "density": "port-xhdpi"},
                {"src": "resources/splash.png", "platform": "android", "density": "port-xxhdpi"},
                {"src": "resources/splash.png", "platform": "android", "density": "port-xxxhdpi"},
                {"src": "resources/splash.png", "platform": "ios", "width": "640", "height": "1136"},
                {"src": "resources/splash.png", "platform": "ios", "width": "750", "height": "1334"},
                {"src": "resources/splash.png", "platform": "ios", "width": "1242", "height": "2208"},
                {"src": "resources/splash.png", "platform": "ios", "width": "1125", "height": "2436"},
                {"src": "resources/splash.png", "platform": "ios", "width": "768", "height": "1024"},
                {"src": "resources/splash.png", "platform": "ios", "width": "1024", "height": "768"},
            ]

            for splash_attr in splashes:
                splash_elem = ET.Element("splash")
                for key, value in splash_attr.items():
                    splash_elem.set(key, str(value))
                root.append(splash_elem)

        # Pretty print XML
        xml_str = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_str)
        pretty_xml = dom.toprettyxml(indent="    ")

        # Clean up
        pretty_xml = re.sub(r'(<\?xml[^?]*\?>)\s*(<\?xml[^?]*\?>)', r'\1', pretty_xml)
        pretty_xml = re.sub(r'standalone="[^"]*"', '', pretty_xml)
        pretty_xml = re.sub(r'(\S)\/\>', r'\1 />', pretty_xml)

        # Remove empty lines
        lines = [line for line in pretty_xml.split('\n') if line.strip()]
        pretty_xml = '\n'.join(lines)

        with open(config_path, 'w', encoding='utf-8') as f:
            f.write(pretty_xml)

        return True

    except Exception as e:
        print(f"❌ Error updating config.xml: {e}")
        return False


@eel.expose
def generate_icons_from_base64(file_info):
    """Generate ONLY app icons - NO splash screens (including Windows)"""
    if not pm.current_project:
        return {"success": False, "message": "No project is open"}

    try:
        import shutil

        # Decode Base64 data
        image_data = base64.b64decode(file_info['data'])

        # Load image with PIL
        img = Image.open(io.BytesIO(image_data))

        project_path = Path(pm.current_project)
        resources_dir = project_path / "resources"
        resources_dir.mkdir(exist_ok=True)

        generated_files = []

        # ============================================
        # 1. MAIN ICON (resources/icon.png)
        # ============================================
        standard_icon = resources_dir / "icon.png"
        img_copy = img.copy()
        img_copy.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        img_copy.save(standard_icon, "PNG", optimize=True)
        generated_files.append(str(standard_icon))

        # ============================================
        # 2. ANDROID ADAPTIVE ICONS
        # ============================================
        android_dir = resources_dir / "android"
        android_dir.mkdir(exist_ok=True)

        # 2a. icon-foreground.png (432x432)
        foreground = android_dir / "icon-foreground.png"
        img_foreground = img.copy()
        img_foreground.thumbnail((432, 432), Image.Resampling.LANCZOS)
        img_foreground.save(foreground, "PNG", optimize=True)
        generated_files.append(str(foreground))

        # 2b. icon-background.png (432x432 - white background)
        background = android_dir / "icon-background.png"
        bg_img = Image.new('RGB', (432, 432), 'white')
        bg_img.save(background, "PNG", optimize=True)
        generated_files.append(str(background))

        # ============================================
        # 3. ANDROID ICON FOLDER (resources/android/icon/)
        # ============================================
        android_icon_dir = android_dir / "icon"
        android_icon_dir.mkdir(parents=True, exist_ok=True)

        # Clear existing files
        for old_file in android_icon_dir.glob("*.png"):
            try:
                old_file.unlink()
                print(f"🗑️ Removed old icon: {old_file.name}")
            except:
                pass

        # Generate all Android icon sizes
        android_icon_sizes = {
            "mdpi": 48,
            "hdpi": 72,
            "xhdpi": 96,
            "xxhdpi": 144,
            "xxxhdpi": 192,
        }

        for density, size in android_icon_sizes.items():
            icon_file = android_icon_dir / f"icon-{density}.png"
            resized = img.copy()
            resized.thumbnail((size, size), Image.Resampling.LANCZOS)
            resized.save(icon_file, "PNG", optimize=True)
            generated_files.append(str(icon_file))

        # ============================================
        # 4. iOS ICONS (resources/ios/icon/)
        # ============================================
        ios_dir = resources_dir / "ios"
        ios_icon_dir = ios_dir / "icon"
        ios_icon_dir.mkdir(parents=True, exist_ok=True)

        # Clear existing files
        for old_file in ios_icon_dir.glob("*.png"):
            try:
                old_file.unlink()
            except:
                pass

        ios_icon_sizes = [
            ("icon-20x20", 20),
            ("icon-29x29", 29),
            ("icon-40x40", 40),
            ("icon-60x60", 60),
            ("icon-76x76", 76),
            ("icon-83.5x83.5", 83.5),
        ]

        for name, size in ios_icon_sizes:
            icon_file = ios_icon_dir / f"{name}.png"
            resized = img.copy()
            resized.thumbnail((int(size), int(size)), Image.Resampling.LANCZOS)
            resized.save(icon_file, "PNG", optimize=True)
            generated_files.append(str(icon_file))

        # ============================================
        # 5. WINDOWS ICONS (resources/windows/icon/)
        # ============================================
        windows_dir = resources_dir / "windows"
        windows_icon_dir = windows_dir / "icon"
        windows_icon_dir.mkdir(parents=True, exist_ok=True)

        # Clear existing files
        for old_file in windows_icon_dir.glob("*.png"):
            try:
                old_file.unlink()
            except:
                pass

        # Windows icon sizes (from Cordova Windows documentation)
        windows_icon_sizes = [
            ("icon-44x44", 44),
            ("icon-50x50", 50),
            ("icon-150x150", 150),
        ]

        for name, size in windows_icon_sizes:
            icon_file = windows_icon_dir / f"{name}.png"
            resized = img.copy()
            resized.thumbnail((size, size), Image.Resampling.LANCZOS)
            resized.save(icon_file, "PNG", optimize=True)
            generated_files.append(str(icon_file))

        # ============================================
        # 6. UPDATE CONFIG.XML
        # ============================================
        config_updated = update_config_xml_for_resources(pm.current_project, "icon")

        return {
            "success": True,
            "message": f"Icons generated successfully ({len(generated_files)} files) and config.xml {'updated' if config_updated else 'updated manually'}",
            "files": generated_files,
            "config_updated": config_updated,
            "count": len(generated_files)
        }

    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def generate_splash_from_base64(file_info):
    """Generate ONLY splash screens - NO icons (including Windows)"""
    if not pm.current_project:
        return {"success": False, "message": "No project is open"}

    try:
        # Decode Base64 data
        image_data = base64.b64decode(file_info['data'])

        # Load image with PIL
        img = Image.open(io.BytesIO(image_data))

        project_path = Path(pm.current_project)
        resources_dir = project_path / "resources"
        resources_dir.mkdir(exist_ok=True)

        generated_files = []

        # ============================================
        # 1. MAIN SPLASH (resources/splash.png)
        # ============================================
        standard_splash = resources_dir / "splash.png"
        img_copy = img.copy()
        img_copy.thumbnail((2732, 2732), Image.Resampling.LANCZOS)
        img_copy.save(standard_splash, "PNG", optimize=True)
        generated_files.append(str(standard_splash))

        # ============================================
        # 2. ANDROID SPLASH FOLDER (resources/android/splash/)
        # ============================================
        android_splash_dir = resources_dir / "android" / "splash"
        android_splash_dir.mkdir(parents=True, exist_ok=True)

        # Clear existing files
        for old_file in android_splash_dir.glob("*.png"):
            try:
                old_file.unlink()
            except:
                pass

        android_splash_sizes = {
            "port-ldpi": (320, 200),
            "port-mdpi": (480, 320),
            "port-hdpi": (800, 480),
            "port-xhdpi": (1280, 720),
            "port-xxhdpi": (1920, 1080),
            "port-xxxhdpi": (3840, 2160),
        }

        for density, (width, height) in android_splash_sizes.items():
            splash_file = android_splash_dir / f"splash-{density}.png"

            # Resize and crop
            resized = img.copy()
            img_ratio = resized.width / resized.height
            target_ratio = width / height

            if img_ratio > target_ratio:
                new_height = resized.height
                new_width = int(resized.height * target_ratio)
                left = (resized.width - new_width) // 2
                resized = resized.crop((left, 0, left + new_width, new_height))
            else:
                new_width = resized.width
                new_height = int(resized.width / target_ratio)
                top = (resized.height - new_height) // 2
                resized = resized.crop((0, top, new_width, top + new_height))

            resized = resized.resize((width, height), Image.Resampling.LANCZOS)
            resized.save(splash_file, "PNG", optimize=True)
            generated_files.append(str(splash_file))

        # ============================================
        # 3. iOS SPLASH (resources/ios/splash/)
        # ============================================
        ios_splash_dir = resources_dir / "ios" / "splash"
        ios_splash_dir.mkdir(parents=True, exist_ok=True)

        # Clear existing files
        for old_file in ios_splash_dir.glob("*.png"):
            try:
                old_file.unlink()
            except:
                pass

        ios_splash_sizes = [
            ("Default-568h", 640, 1136),
            ("Default-667h", 750, 1334),
            ("Default-736h", 1242, 2208),
            ("Default-Landscape-736h", 2208, 1242),
            ("Default-Portrait-736h", 1242, 2208),
            ("Default-Portrait", 768, 1024),
            ("Default-Landscape", 1024, 768),
            ("Default-Portrait-2436h", 1125, 2436),
            ("Default-Landscape-2436h", 2436, 1125),
        ]

        for name, width, height in ios_splash_sizes:
            splash_file = ios_splash_dir / f"{name}.png"

            # Resize and crop
            resized = img.copy()
            img_ratio = resized.width / resized.height
            target_ratio = width / height

            if img_ratio > target_ratio:
                new_height = resized.height
                new_width = int(resized.height * target_ratio)
                left = (resized.width - new_width) // 2
                resized = resized.crop((left, 0, left + new_width, new_height))
            else:
                new_width = resized.width
                new_height = int(resized.width / target_ratio)
                top = (resized.height - new_height) // 2
                resized = resized.crop((0, top, new_width, top + new_height))

            resized = resized.resize((width, height), Image.Resampling.LANCZOS)
            resized.save(splash_file, "PNG", optimize=True)
            generated_files.append(str(splash_file))

        # ============================================
        # 4. WINDOWS SPLASH (resources/windows/splash/)
        # ============================================
        windows_splash_dir = resources_dir / "windows" / "splash"
        windows_splash_dir.mkdir(parents=True, exist_ok=True)

        # Clear existing files
        for old_file in windows_splash_dir.glob("*.png"):
            try:
                old_file.unlink()
            except:
                pass

        # Windows splash sizes (from Cordova Windows documentation)
        windows_splash_sizes = [
            ("splash-620x300", 620, 300),
            ("splash-1152x1920", 1152, 1920),
            ("splash-1920x1152", 1920, 1152),
        ]

        for name, width, height in windows_splash_sizes:
            splash_file = windows_splash_dir / f"{name}.png"

            # Resize and crop
            resized = img.copy()
            img_ratio = resized.width / resized.height
            target_ratio = width / height

            if img_ratio > target_ratio:
                new_height = resized.height
                new_width = int(resized.height * target_ratio)
                left = (resized.width - new_width) // 2
                resized = resized.crop((left, 0, left + new_width, new_height))
            else:
                new_width = resized.width
                new_height = int(resized.width / target_ratio)
                top = (resized.height - new_height) // 2
                resized = resized.crop((0, top, new_width, top + new_height))

            resized = resized.resize((width, height), Image.Resampling.LANCZOS)
            resized.save(splash_file, "PNG", optimize=True)
            generated_files.append(str(splash_file))

        # ============================================
        # 5. UPDATE CONFIG.XML
        # ============================================
        config_updated = update_config_xml_for_resources(pm.current_project, "splash")

        return {
            "success": True,
            "message": f"Splash screens generated successfully ({len(generated_files)} files) and config.xml {'updated' if config_updated else 'updated manually'}",
            "files": generated_files,
            "config_updated": config_updated,
            "count": len(generated_files)
        }

    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def copy_icons_to_platform():
    """Copy icons from resources to Android platform"""
    if not pm.current_project:
        return {"success": False, "message": "No project is open"}

    try:
        project_path = Path(pm.current_project)
        resources_dir = project_path / "resources"
        android_dir = project_path / "platforms" / "android"

        if not android_dir.exists():
            return {"success": False, "message": "Android platform not found. Please add platform first."}

        # Define icon mappings (source -> destination)
        icon_mappings = {
            # mipmap folders
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "mipmap-mdpi" / "ic_launcher.png",
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "mipmap-hdpi" / "ic_launcher.png",
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "mipmap-xhdpi" / "ic_launcher.png",
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "mipmap-xxhdpi" / "ic_launcher.png",
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "mipmap-xxxhdpi" / "ic_launcher.png",
            # Also copy to drawable folders (for older devices)
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "drawable-mdpi" / "ic_launcher.png",
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "drawable-hdpi" / "ic_launcher.png",
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "drawable-xhdpi" / "ic_launcher.png",
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "drawable-xxhdpi" / "ic_launcher.png",
            resources_dir / "icon.png": android_dir / "app" / "src" / "main" / "res" / "drawable-xxxhdpi" / "ic_launcher.png",
        }

        copied_files = []
        for src, dst in icon_mappings.items():
            if src.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
                copied_files.append(str(dst))
            else:
                print(f"⚠️ Source not found: {src}")

        # Also create adaptive icons
        adaptive_dir = android_dir / "app" / "src" / "main" / "res" / "mipmap-anydpi-v26"
        adaptive_dir.mkdir(parents=True, exist_ok=True)

        # Create ic_launcher.xml for adaptive icons
        adaptive_icon_content = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>'''

        adaptive_file = adaptive_dir / "ic_launcher.xml"
        with open(adaptive_file, 'w', encoding='utf-8') as f:
            f.write(adaptive_icon_content)

        # Create ic_launcher_round.xml
        adaptive_round_file = adaptive_dir / "ic_launcher_round.xml"
        with open(adaptive_round_file, 'w', encoding='utf-8') as f:
            f.write(adaptive_icon_content.replace("ic_launcher", "ic_launcher_round"))

        # Create colors.xml for background
        colors_dir = android_dir / "app" / "src" / "main" / "res" / "values"
        colors_dir.mkdir(parents=True, exist_ok=True)

        colors_file = colors_dir / "colors.xml"
        colors_content = '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#6366f1</color>
</resources>'''

        with open(colors_file, 'w', encoding='utf-8') as f:
            f.write(colors_content)

        return {
            "success": True,
            "message": f"Icons copied to Android platform ({len(copied_files)} files)",
            "copied_files": copied_files
        }

    except Exception as e:
        return {"success": False, "message": str(e)}

# ---------- Export/Import ----------

@eel.expose
def export_project(export_path=None):
    """Export current project"""
    if not pm.current_project:
        return {"success": False, "message": "No project is open"}
    return pm.export_project(pm.current_project, export_path)


@eel.expose
def import_project(zip_path, extract_path):
    """Import project from zip"""
    return pm.import_project(zip_path, extract_path)


# ---------- Deploy ----------

# ============================================================
# WIFI DEBUGGING - ADB OVER WIFI
# ============================================================

@eel.expose
def connect_wifi_adb(ip_address, port=5555):
    """Connect to a device over WiFi using ADB"""
    try:
        env = get_env_for_subprocess()

        # First, try to connect directly
        result = subprocess.run(
            f'adb connect {ip_address}:{port}',
            shell=True,
            capture_output=True,
            text=True,
            env=env
        )

        stdout_lower = result.stdout.lower()

        if "connected" in stdout_lower or "already connected" in stdout_lower:
            return {"success": True, "message": f"Connected to {ip_address}:{port}", "output": result.stdout}
        elif "unable to connect" in stdout_lower or "failed" in stdout_lower:
            return {"success": False, "message": result.stdout.strip() or "Failed to connect. Try pairing first."}
        else:
            return {"success": False, "message": result.stdout.strip() or "Failed to connect"}

    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def pair_wifi_device(ip_address, port, pairing_code):
    """Pair with a device using the pairing code (Android 11+)"""
    try:
        env = get_env_for_subprocess()

        result = subprocess.run(
            f'adb pair {ip_address}:{port}',
            shell=True,
            input=pairing_code + '\n',
            capture_output=True,
            text=True,
            env=env
        )

        stdout_lower = result.stdout.lower()

        if "successfully paired" in stdout_lower or "paired" in stdout_lower:
            return {"success": True, "message": "Device paired successfully", "output": result.stdout}
        else:
            return {"success": False, "message": result.stdout.strip() or "Pairing failed"}

    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def get_connected_devices():
    """Get list of connected Android devices via ADB (both USB and WiFi)"""
    try:
        env = get_env_for_subprocess()

        # Get ADB devices list with -l for more details
        result = subprocess.run(
            'adb devices -l',
            shell=True,
            capture_output=True,
            text=True,
            env=env
        )

        devices = []
        lines = result.stdout.strip().split('\n')

        for line in lines[1:]:  # Skip "List of devices attached"
            if not line.strip():
                continue

            parts = line.split()
            if len(parts) >= 2:
                serial = parts[0]
                status = parts[1]

                # Extract model from -l output
                model = "Unknown"
                device_type = "USB"

                # Check if it's a WiFi device (contains colon)
                if ':' in serial:
                    device_type = "WiFi"

                for part in parts:
                    if part.startswith('model:'):
                        model = part.replace('model:', '')
                    elif part.startswith('product:'):
                        if model == "Unknown":
                            model = part.replace('product:', '')
                    elif part.startswith('device:'):
                        if model == "Unknown":
                            model = part.replace('device:', '')

                # Check if it's emulator
                if serial.startswith('emulator-'):
                    model = "Emulator"
                    device_type = "Emulator"

                devices.append({
                    "serial": serial,
                    "status": status,
                    "model": model,
                    "type": device_type
                })

        return {"success": True, "devices": devices}

    except Exception as e:
        return {"success": False, "message": str(e), "devices": []}


@eel.expose
def deploy_to_device(device_id, platform="android"):
    """Deploy app to specific device (supports Android, iOS, Windows)"""
    try:
        if not pm.current_project:
            return {"success": False, "message": "No project is open"}

        # ============================================================
        # ANDROID DEPLOYMENT
        # ============================================================
        if platform == "android":
            # Check if device is connected
            devices_result = get_connected_devices()
            if not devices_result.get("success"):
                return {"success": False, "message": "Failed to check connected devices"}

            device_found = False
            for device in devices_result.get("devices", []):
                if device["serial"] == device_id and device["status"] == "device":
                    device_found = True
                    break

            if not device_found:
                return {"success": False, "message": f"Device {device_id} is not connected or not authorized"}

            env = get_env_for_subprocess()
            output_lines = []

            # First, build the project if needed
            apk_path = Path(
                pm.current_project) / "platforms" / "android" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"

            if not apk_path.exists():
                output_lines.append("📦 Building project...")
                build_result = pm.build_project(platform, "debug")
                if not build_result.get("success"):
                    return {"success": False,
                            "message": f"Build failed: {build_result.get('message', 'Unknown error')}"}

                output_lines.append("✅ Build completed")
                # Try to find APK again
                apk_path = Path(
                    pm.current_project) / "platforms" / "android" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"

                if not apk_path.exists():
                    return {"success": False, "message": "APK not found after build"}

            # Get package name from config
            package_id = "com.example.app"
            config_path = Path(pm.current_project) / "config.xml"
            if config_path.exists():
                try:
                    import xml.etree.ElementTree as ET
                    tree = ET.parse(config_path)
                    root = tree.getroot()
                    package_id = root.get('id', 'com.example.app')
                except:
                    pass

            output_lines.append(f"📱 Installing APK on {device_id}...")

            # Install APK on device
            result = subprocess.run(
                f'adb -s {device_id} install -r "{apk_path}"',
                shell=True,
                capture_output=True,
                text=True,
                env=env
            )

            if "Success" in result.stdout or result.returncode == 0:
                output_lines.append("✅ APK installed successfully")

                # Launch the app
                output_lines.append(f"🚀 Launching {package_id}...")
                subprocess.run(
                    f'adb -s {device_id} shell monkey -p {package_id} -c android.intent.category.LAUNCHER 1',
                    shell=True,
                    capture_output=True,
                    text=True,
                    env=env
                )

                output_lines.append("✅ App launched successfully!")
                output_lines.append(f"📱 Device: {device_id}")
                output_lines.append(f"📦 Package: {package_id}")

                return {
                    "success": True,
                    "message": "App deployed and launched successfully",
                    "output": "\n".join(output_lines)
                }
            else:
                return {
                    "success": False,
                    "message": result.stderr or "Failed to install APK",
                    "output": "\n".join(output_lines) + f"\n❌ Error: {result.stderr}"
                }

        # ============================================================
        # iOS DEPLOYMENT (requires macOS + Xcode)
        # ============================================================
        elif platform == "ios":
            if platform.system() != 'Darwin':
                return {
                    "success": False,
                    "message": "iOS deployment is only supported on macOS with Xcode",
                    "output": "Platform: macOS required"
                }

            output_lines = []
            output_lines.append("🍎 Deploying to iOS device...")

            # Build for iOS device
            output_lines.append("📦 Building iOS project...")
            build_result = pm.build_project(platform, "debug")
            if not build_result.get("success"):
                return {"success": False, "message": f"Build failed: {build_result.get('message', 'Unknown error')}"}

            output_lines.append("✅ Build completed")

            # Check if device is connected via idevice_id or instruments
            try:
                # Try to get connected iOS devices
                result = subprocess.run(
                    'idevice_id -l',
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=10
                )

                if result.returncode == 0 and result.stdout.strip():
                    device_udid = result.stdout.strip().split('\n')[0]
                    output_lines.append(f"📱 Found iOS device: {device_udid}")
                else:
                    # Fallback: use instruments
                    result = subprocess.run(
                        'instruments -s devices',
                        shell=True,
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    if result.returncode == 0 and result.stdout:
                        output_lines.append("📱 iOS devices found (check Xcode Devices window)")
                    else:
                        return {
                            "success": False,
                            "message": "No iOS device found. Please connect your device and try again.",
                            "output": "\n".join(output_lines)
                        }
            except:
                return {
                    "success": False,
                    "message": "Could not detect iOS device. Please ensure libimobiledevice is installed.",
                    "output": "\n".join(output_lines)
                }

            # Deploy using cordova run
            output_lines.append("🚀 Deploying to iOS device...")
            result = subprocess.run(
                f'cordova run ios --device',
                cwd=pm.current_project,
                shell=True,
                capture_output=True,
                text=True,
                env=get_env_for_subprocess(),
                timeout=300
            )

            if result.returncode == 0:
                output_lines.append("✅ App deployed successfully!")
                return {
                    "success": True,
                    "message": "iOS app deployed successfully",
                    "output": "\n".join(output_lines) + "\n" + result.stdout
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to deploy to iOS device",
                    "output": "\n".join(output_lines) + f"\n❌ Error: {result.stderr}"
                }

        # ============================================================
        # WINDOWS DEPLOYMENT
        # ============================================================
        elif platform == "windows":
            output_lines = []
            output_lines.append("🪟 Deploying to Windows...")

            # Build for Windows
            output_lines.append("📦 Building Windows project...")
            build_result = pm.build_project(platform, "debug")
            if not build_result.get("success"):
                return {"success": False, "message": f"Build failed: {build_result.get('message', 'Unknown error')}"}

            output_lines.append("✅ Build completed")

            # Deploy using cordova run
            output_lines.append("🚀 Deploying Windows app...")
            result = subprocess.run(
                f'cordova run windows',
                cwd=pm.current_project,
                shell=True,
                capture_output=True,
                text=True,
                env=get_env_for_subprocess(),
                timeout=300
            )

            if result.returncode == 0:
                output_lines.append("✅ Windows app deployed successfully!")
                return {
                    "success": True,
                    "message": "Windows app deployed successfully",
                    "output": "\n".join(output_lines) + "\n" + result.stdout
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to deploy Windows app",
                    "output": "\n".join(output_lines) + f"\n❌ Error: {result.stderr}"
                }

        # ============================================================
        # BROWSER DEPLOYMENT (just serve)
        # ============================================================
        elif platform == "browser":
            output_lines = []
            output_lines.append("🌐 Preparing browser deployment...")

            # Build for browser
            output_lines.append("📦 Building browser project...")
            build_result = pm.build_project(platform, "debug")
            if not build_result.get("success"):
                return {"success": False, "message": f"Build failed: {build_result.get('message', 'Unknown error')}"}

            output_lines.append("✅ Build completed")

            # Serve the app using a simple HTTP server
            browser_path = Path(pm.current_project) / "platforms" / "browser" / "www"
            if browser_path.exists():
                output_lines.append(f"📂 App available at: {browser_path}")

                # Open in default browser
                import webbrowser
                index_html = browser_path / "index.html"
                if index_html.exists():
                    webbrowser.open(f"file://{index_html.absolute()}")
                    output_lines.append("✅ App opened in browser!")

                    return {
                        "success": True,
                        "message": "Browser app opened successfully",
                        "output": "\n".join(output_lines),
                        "path": str(browser_path)
                    }
                else:
                    return {
                        "success": False,
                        "message": "index.html not found in browser build",
                        "output": "\n".join(output_lines)
                    }
            else:
                return {
                    "success": False,
                    "message": "Browser build not found",
                    "output": "\n".join(output_lines)
                }

        # ============================================================
        # ELECTRON DEPLOYMENT
        # ============================================================
        elif platform == "electron":
            output_lines = []
            output_lines.append("⚡ Deploying Electron app...")

            # Build for Electron
            output_lines.append("📦 Building Electron project...")
            build_result = pm.build_project(platform, "debug")
            if not build_result.get("success"):
                return {"success": False, "message": f"Build failed: {build_result.get('message', 'Unknown error')}"}

            output_lines.append("✅ Build completed")

            # Run Electron app
            output_lines.append("🚀 Launching Electron app...")

            # Try to find Electron executable
            electron_path = Path(pm.current_project) / "platforms" / "electron" / "build"
            if electron_path.exists():
                # Look for executable
                exe_files = list(electron_path.glob("*.exe")) + list(electron_path.glob("*.AppImage"))
                if exe_files:
                    output_lines.append(f"📂 Executable: {exe_files[0]}")
                    # Try to run it
                    try:
                        subprocess.Popen(
                            str(exe_files[0]),
                            shell=True,
                            cwd=pm.current_project
                        )
                        output_lines.append("✅ Electron app launched!")
                        return {
                            "success": True,
                            "message": "Electron app launched successfully",
                            "output": "\n".join(output_lines),
                            "path": str(exe_files[0])
                        }
                    except Exception as e:
                        return {
                            "success": False,
                            "message": f"Failed to launch Electron app: {str(e)}",
                            "output": "\n".join(output_lines)
                        }
                else:
                    # Try using cordova run
                    result = subprocess.run(
                        f'cordova run electron',
                        cwd=pm.current_project,
                        shell=True,
                        capture_output=True,
                        text=True,
                        env=get_env_for_subprocess()
                    )
                    if result.returncode == 0:
                        output_lines.append("✅ Electron app launched!")
                        return {
                            "success": True,
                            "message": "Electron app launched successfully",
                            "output": "\n".join(output_lines) + "\n" + result.stdout
                        }
                    else:
                        return {
                            "success": False,
                            "message": "Failed to launch Electron app",
                            "output": "\n".join(output_lines) + f"\n❌ Error: {result.stderr}"
                        }
            else:
                return {
                    "success": False,
                    "message": "Electron build not found",
                    "output": "\n".join(output_lines)
                }

        # ============================================================
        # UNKNOWN PLATFORM
        # ============================================================
        else:
            return {
                "success": False,
                "message": f"Deployment for {platform} is not yet supported",
                "output": f"Supported platforms: android, ios, windows, browser, electron"
            }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "message": "Deployment timed out",
            "output": "The deployment took too long to complete"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def deploy_to_android_device(device_id):
    """Deploy app to specific Android device (convenience function)"""
    return deploy_to_device(device_id, "android")


@eel.expose
def deploy_to_ios_device(device_id=None):
    """Deploy app to iOS device"""
    return deploy_to_device(device_id, "ios")


# ---------- Console ----------

@eel.expose
def run_command(command):
    """Run custom command"""
    return pm.run_command(command)


# ---------- System ----------

@eel.expose
def check_cordova():
    """Check if Cordova is installed"""
    if check_command_exists("cordova"):
        version = get_command_version("cordova")
        return {
            "installed": True,
            "version": version or "unknown"
        }
    return {
        "installed": False,
        "version": None
    }


@eel.expose
def get_donation_info():
    """Get donation addresses"""
    return {
        "btc": DONATE_BTC,
        "eth": DONATE_ETH
    }


# ---------- Settings ----------

@eel.expose
def get_settings():
    """Get application settings"""
    return {"success": True, "settings": pm.settings}


@eel.expose
def save_keystore(keystore):
    """Save keystore independently - prevents conflict with general settings"""
    try:
        if not keystore.get('path'):
            return {"success": False, "message": "Keystore path is required"}
        if not keystore.get('keyAlias'):
            return {"success": False, "message": "Key alias is required"}

        # Validate file exists
        if keystore['path'] and not Path(keystore['path']).exists():
            return {"success": False, "message": f"Keystore file not found: {keystore['path']}"}

        # Update settings directly
        pm.settings['keystore'] = keystore
        if "sdk_paths" not in pm.settings:
            pm.settings["sdk_paths"] = {}

        if pm.save_settings():
            return {"success": True, "message": "Keystore saved successfully"}
        else:
            return {"success": False, "message": "Failed to write settings file"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def save_settings(settings):
    """Save all settings - preserve existing keystore if not provided"""
    try:
        # ✅ Keep existing keystore if not sent in request
        if 'keystore' not in settings or not settings['keystore']:
            settings['keystore'] = pm.settings.get('keystore', {})

        # ✅ Keep existing sdk_paths if not sent
        if 'sdk_paths' not in settings:
            settings['sdk_paths'] = pm.settings.get('sdk_paths', {})

        pm.settings.update(settings)

        if pm.save_settings():
            return {"success": True, "message": "Settings saved successfully"}
        else:
            return {"success": False, "message": "Failed to write settings file"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}


# ============================================================
# INSTALL CORDOVA HELPER
# ============================================================

@eel.expose
def install_cordova():
    """Install Cordova CLI via npm"""
    try:
        if not check_command_exists("npm"):
            return {"success": False, "message": "npm is not installed. Please install Node.js first."}

        result = subprocess.run(
            "npm install -g cordova",
            shell=True,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            return {"success": True, "message": "Cordova installed successfully"}
        else:
            return {"success": False, "message": result.stderr or "Failed to install Cordova"}

    except Exception as e:
        return {"success": False, "message": str(e)}


# ============================================================
# SDK MANAGEMENT FUNCTIONS
# ============================================================

@eel.expose
def get_system_info():
    """Get system information including environment variables"""
    try:
        import subprocess
        import re

        info = {
            "os": platform.system(),
            "os_version": platform.version(),
            "python_version": platform.python_version(),
            "machine": platform.machine(),
            "node_version": None,
            "npm_version": None,
            "java_version": None,
            "android_home": os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
        }

        try:
            result = subprocess.run(['node', '--version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                info['node_version'] = result.stdout.strip().replace('v', '')
        except:
            pass

        try:
            result = subprocess.run(['npm', '--version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                info['npm_version'] = result.stdout.strip()
        except:
            pass

        try:
            result = subprocess.run(['java', '-version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                lines = result.stderr.split('\n')
                if lines:
                    match = re.search(r'version "([^"]+)"', lines[0])
                    if match:
                        info['java_version'] = match.group(1)
        except:
            pass

        return info
    except Exception as e:
        return {"error": str(e)}


@eel.expose
def detect_android_sdk():
    """Detect Android SDK installation"""
    try:
        possible_paths = [
            Path(os.environ.get('ANDROID_HOME', '')),
            Path(os.environ.get('ANDROID_SDK_ROOT', '')),
            Path.home() / 'AppData' / 'Local' / 'Android' / 'Sdk',
            Path.home() / 'Library' / 'Android' / 'sdk',
            Path.home() / 'Android' / 'Sdk',
            Path('C:') / 'Android' / 'Sdk',
            Path('C:') / 'Program Files' / 'Android' / 'Sdk',
        ]

        for path in possible_paths:
            if path and path.exists():
                platforms_dir = path / 'platforms'
                api_level = '33'
                if platforms_dir.exists():
                    platforms = [p.name for p in platforms_dir.iterdir() if p.is_dir()]
                    if platforms:
                        api_numbers = []
                        for p in platforms:
                            try:
                                num = int(p.replace('android-', ''))
                                api_numbers.append(num)
                            except:
                                pass
                        if api_numbers:
                            api_level = str(max(api_numbers))
                        else:
                            api_level = platforms[-1].replace('android-', '')

                build_tools_dir = path / 'build-tools'
                build_tools = '33.0.0'
                if build_tools_dir.exists():
                    tools = [p.name for p in build_tools_dir.iterdir() if p.is_dir()]
                    if tools:
                        tools.sort(reverse=True)
                        build_tools = tools[0]

                return {
                    "success": True,
                    "path": str(path),
                    "api_level": api_level,
                    "build_tools": build_tools
                }

        return {"success": False, "message": "Android SDK not found. Please install Android Studio."}
    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def set_android_sdk_path(path):
    """Set Android SDK path in environment"""
    try:
        os.environ['ANDROID_HOME'] = path
        os.environ['ANDROID_SDK_ROOT'] = path
        return {"success": True, "message": "Android SDK path set"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def open_xcode():
    """Open Xcode on macOS"""
    try:
        if platform.system() != 'Darwin':
            return {"success": False, "message": "Xcode is only available on macOS"}

        subprocess.run(['open', '-a', 'Xcode'], check=True)
        return {"success": True, "message": "Xcode opened"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def check_android_sdk():
    """Check if Android SDK is installed and return detailed info"""
    try:
        android_home = os.environ.get('ANDROID_HOME')
        android_sdk_root = os.environ.get('ANDROID_SDK_ROOT')

        if android_home:
            path = Path(android_home)
        elif android_sdk_root:
            path = Path(android_sdk_root)
        else:
            detect_result = detect_android_sdk()
            if detect_result.get('success'):
                return detect_result
            return {"success": False, "message": "Android SDK not found"}

        if not path.exists():
            return {"success": False, "message": f"Android SDK path '{path}' does not exist"}

        platforms_dir = path / 'platforms'
        api_level = '33'
        if platforms_dir.exists():
            platforms = [p.name for p in platforms_dir.iterdir() if p.is_dir()]
            if platforms:
                api_numbers = []
                for p in platforms:
                    try:
                        num = int(p.replace('android-', ''))
                        api_numbers.append(num)
                    except:
                        pass
                if api_numbers:
                    api_level = str(max(api_numbers))

        build_tools_dir = path / 'build-tools'
        build_tools = '33.0.0'
        if build_tools_dir.exists():
            tools = [p.name for p in build_tools_dir.iterdir() if p.is_dir()]
            if tools:
                tools.sort(reverse=True)
                build_tools = tools[0]

        return {
            "success": True,
            "path": str(path),
            "api_level": api_level,
            "build_tools": build_tools
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


# ============================================================
# SDK SETTINGS - Save & Load
# ============================================================

@eel.expose
def save_sdk_paths(settings):
    """Save SDK paths to settings"""
    try:
        pm.settings['sdk_paths'] = settings
        pm.save_settings()
        return {"success": True, "message": "SDK paths saved"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def detect_all_sdks():
    """Detect all SDK paths automatically"""
    try:
        result = {
            "success": True,
            "android_sdk": get_android_sdk_path(),
            "gradle": get_gradle_home(),
            "java": get_java_home()
        }
        return result
    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def get_sdk_paths():
    """Get saved SDK paths from settings"""
    try:
        sdk_paths = pm.settings.get('sdk_paths', {})
        return {
            "success": True,
            "android_sdk": sdk_paths.get('android_sdk', ''),
            "gradle": sdk_paths.get('gradle', ''),
            "java": sdk_paths.get('java', '')
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def fix_maven_repositories():
    """Fix Maven repositories in Cordova project with full mirror list"""
    try:
        if not pm.current_project:
            return {"success": False, "message": "No project is open"}

        project_path = Path(pm.current_project)
        output = []

        repo_content = get_maven_repositories_content()

        repo_files = [
            project_path / "platforms" / "android" / "repositories.gradle",
            project_path / "platforms" / "android" / "app" / "repositories.gradle",
            project_path / "platforms" / "android" / "CordovaLib" / "repositories.gradle"
        ]

        updated_count = 0
        for repo_file in repo_files:
            try:
                repo_file.parent.mkdir(parents=True, exist_ok=True)
                with open(repo_file, 'w', encoding='utf-8') as f:
                    f.write(repo_content)
                output.append(f"✅ Updated: {repo_file.relative_to(project_path)}")
                updated_count += 1
            except Exception as e:
                output.append(f"❌ Error updating {repo_file.relative_to(project_path)}: {e}")

        build_gradle_files = [
            project_path / "platforms" / "android" / "build.gradle",
            project_path / "platforms" / "android" / "app" / "build.gradle",
            project_path / "platforms" / "android" / "CordovaLib" / "build.gradle"
        ]

        for build_file in build_gradle_files:
            if build_file.exists():
                try:
                    with open(build_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                    if 'allprojects {' in content and 'repositories {' not in content:
                        content = content.replace(
                            'allprojects {',
                            'allprojects {\n    repositories {\n        google()\n        mavenCentral()\n        maven { url "https://maven.google.com" }\n        maven { url "https://maven.myket.ir" }\n        maven { url "https://repo.maven.apache.org/maven2" }\n        maven { url "https://jitpack.io" }\n    }'
                        )
                        with open(build_file, 'w', encoding='utf-8') as f:
                            f.write(content)
                        output.append(f"✅ Updated: {build_file.relative_to(project_path)}")
                        updated_count += 1
                except Exception as e:
                    output.append(f"⚠️ Could not update {build_file.relative_to(project_path)}: {e}")

        gradle_props = project_path / "platforms" / "android" / "gradle.properties"
        if not gradle_props.exists():
            props_content = '''# Cordova Gradle Properties
android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx2048m
org.gradle.parallel=true
org.gradle.caching=true
# Repository settings
org.gradle.configureondemand=true
android.enableDexingArtifactTransform=true
'''
            with open(gradle_props, 'w', encoding='utf-8') as f:
                f.write(props_content)
            output.append(f"✅ Created: {gradle_props.relative_to(project_path)}")
            updated_count += 1

        return {
            "success": True,
            "message": f"Maven repositories fixed with mirrors ({updated_count} files updated)",
            "output": "\n".join(output)
        }

    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def check_maven_repositories():
    """Check if Maven repositories are configured correctly with detailed info"""
    try:
        if not pm.current_project:
            return {"success": False, "message": "No project is open"}

        project_path = Path(pm.current_project)
        output = []
        fixed = True
        repo_status = {}

        repo_files = {
            "android": project_path / "platforms" / "android" / "repositories.gradle",
            "app": project_path / "platforms" / "android" / "app" / "repositories.gradle",
            "CordovaLib": project_path / "platforms" / "android" / "CordovaLib" / "repositories.gradle"
        }

        for name, repo_file in repo_files.items():
            if repo_file.exists():
                with open(repo_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                has_google = 'google()' in content
                has_maven_central = 'mavenCentral()' in content
                has_maven_google = 'maven.google.com' in content
                has_myket = 'myket.ir' in content
                has_jitpack = 'jitpack.io' in content

                repo_status[name] = {
                    "exists": True,
                    "google": has_google,
                    "mavenCentral": has_maven_central,
                    "mavenGoogle": has_maven_google,
                    "myket": has_myket,
                    "jitpack": has_jitpack
                }

                status_emoji = "✅" if has_google else "❌"
                output.append(f"{status_emoji} {name}: google() {'found' if has_google else 'MISSING'}")

                if not has_google:
                    fixed = False

                if has_myket:
                    output.append(f"   🇮🇷 Myket: found")
                if has_jitpack:
                    output.append(f"   📦 JitPack: found")

            else:
                output.append(f"⚠️ {name}: file not found")
                fixed = False

        build_files = {
            "build.gradle": project_path / "platforms" / "android" / "build.gradle",
            "app/build.gradle": project_path / "platforms" / "android" / "app" / "build.gradle",
        }

        for name, build_file in build_files.items():
            if build_file.exists():
                with open(build_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                if 'google()' in content:
                    output.append(f"✅ {name}: google() found")
                elif 'maven {' in content and 'google' in content.lower():
                    output.append(f"✅ {name}: google repository found")
                else:
                    output.append(f"⚠️ {name}: may need google() repository")

        output.append("")
        output.append("=" * 40)
        if fixed:
            output.append("✅ ALL repositories are configured correctly!")
        else:
            output.append("❌ Some repositories need to be fixed.")
            output.append("   Click 'Fix Maven' button to resolve.")

        return {
            "success": True,
            "fixed": fixed,
            "output": "\n".join(output),
            "details": repo_status
        }

    except Exception as e:
        return {"success": False, "message": str(e)}


def get_maven_repositories_content():
    """Get complete Maven repositories configuration with all mirrors"""
    return '''/* Licensed to the Apache Software Foundation (ASF) under one
   or more contributor license agreements.  See the NOTICE file
   for more details.
*/

ext.repos = {
    // Official Google repositories
    google()
    mavenCentral()
    maven { url "https://maven.google.com" }
    maven { url "https://dl.google.com/dl/android/maven2" }

    // Official Apache Maven repositories
    maven { url "https://repo.maven.apache.org/maven2" }
    maven { url "https://repo1.maven.org/maven2" }
    maven { url "https://repo.maven.apache.org" }

    // Iran mirrors (for faster access)
    maven { url "https://maven.myket.ir" }
    maven { url "https://android-sdk.is.com" }

    // Third-party repositories
    maven { url "https://developer.huawei.com/repo" }
    maven { url "https://dl.bintray.com/tapsellorg/maven" }
    maven { url "https://artifactory-external.vkpartner.ru/artifactory/maven/" }
    maven { url "https://s01.oss.sonatype.org/content/repositories/releases/" }
    maven { url "https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea" }
    maven { url "https://jitpack.io" }
}'''


# ============================================================
# KEYSTORE MANAGEMENT
# ============================================================

@eel.expose
def get_keystore():
    """Get saved keystore from settings"""
    try:
        keystore = pm.settings.get('keystore', {})
        return {"success": True, "keystore": keystore}
    except Exception as e:
        return {"success": False, "message": str(e)}




@eel.expose
def clear_keystore():
    """Clear keystore from settings"""
    try:
        if 'keystore' in pm.settings:
            del pm.settings['keystore']
            pm.save_settings()
        return {"success": True, "message": "Keystore cleared"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def check_keystore(path, store_password, alias, key_password):
    """Test if keystore is valid"""
    try:
        # Check if file exists
        if not Path(path).exists():
            return {"success": False, "message": f"Keystore file not found: {path}"}

        # Test with keytool
        import subprocess
        cmd = f'keytool -list -keystore "{path}" -storepass {store_password}'
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            # Check if alias exists
            if alias:
                cmd2 = f'keytool -list -keystore "{path}" -storepass {store_password} -alias {alias}'
                result2 = subprocess.run(
                    cmd2,
                    shell=True,
                    capture_output=True,
                    text=True
                )
                if result2.returncode != 0:
                    return {"success": False, "message": f"Alias '{alias}' not found in keystore"}

            return {"success": True, "message": "Keystore is valid"}
        else:
            return {"success": False, "message": result.stderr or "Invalid keystore or password"}

    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def create_keystore(path, store_password, alias, key_password, info):
    """Create a new keystore"""
    try:
        # Check if file already exists
        if Path(path).exists():
            return {"success": False, "message": f"Keystore already exists: {path}"}

        # Check if keytool is available
        import subprocess
        keytool_check = subprocess.run(
            'keytool -help',
            shell=True,
            capture_output=True,
            text=True
        )
        if keytool_check.returncode != 0:
            return {"success": False, "message": "keytool not found. Please install Java JDK."}

        # Build keytool command
        cmd = f'keytool -genkey -v -keystore "{path}" -alias {alias} -keyalg RSA -keysize 2048 -validity 10000'
        cmd += f' -storepass {store_password} -keypass {key_password}'
        cmd += f' -dname "CN={info.get("name", "Unknown")}, OU={info.get("unit", "Development")}, L={info.get("city", "Unknown")}, ST={info.get("state", "Unknown")}, C={info.get("country", "US")}"'

        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            return {"success": True, "message": "Keystore created successfully"}
        else:
            return {"success": False, "message": result.stderr or "Failed to create keystore"}

    except Exception as e:
        return {"success": False, "message": str(e)}


@eel.expose
def select_file():
    """Select file using file dialog"""
    root = None
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)

        file_path = filedialog.askopenfilename(
            title="Select Keystore",
            filetypes=[
                ("Keystore files", "*.keystore *.jks"),
                ("All files", "*.*")
            ]
        )

        return file_path if file_path else None

    except Exception as e:
        return None
    finally:
        if root:
            try:
                root.destroy()
            except:
                pass



# ============================================================
# MAIN APPLICATION
# ============================================================

if __name__ == "__main__":
    try:
        print(f"""
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  🚀 Cordova Pro GUI v{VERSION}                          ║
║  Professional Cordova Project Management Tool            ║
║                                                          ║
║  📂 {APP_DATA_DIR}                                      ║
║                                                          ║
║  Starting application...                                 ║
║  Press Ctrl+C to stop                                    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
        """)

        eel.start(
            'index.html',
            size=(1280, 800),
            position=(50, 50),
            port=8000,
            disable_cache=True,
            cmdline_args=['--disable-web-security']
        )

    except KeyboardInterrupt:
        print("\nShutting down...")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        input("Press Enter to exit...")
        sys.exit(1)


# Create EXE File
# pyinstaller --onefile --windowed --name "CordovaProGUI" --icon="icon.ico" --add-data "web;web" --add-data "web/panels;web/panels" --hidden-import "eel" --hidden-import "PIL" --hidden-import "psutil" --hidden-import "xml.etree.ElementTree" --hidden-import "xml.dom.minidom" --hidden-import "tkinter" --hidden-import "tkinter.filedialog" main.py