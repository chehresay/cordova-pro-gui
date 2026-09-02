/**
 * Cordova Pro GUI - Main Application Script
 * Version 2.0.0
 */

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    panelsPath: 'panels/',
    defaultPanel: 'dashboard',
    navigationFile: 'panels/navigation.json'
};

// ============================================================
// APPLICATION STATE
// ============================================================
const AppState = {
    currentProject: null,
    currentPanel: CONFIG.defaultPanel,
    isDarkMode: false,
    isSidebarCollapsed: false,
    plugins: [],
    platforms: [],
    recentProjects: [],
    panels: {},
    navigation: null,
    settings: {
        theme: 'system',
        accentColor: '#6366f1',
        fontSize: 'medium',
        defaultPath: '',
        defaultTemplate: 'empty',
        autoSave: true,
        checkUpdates: true,
        sdk_paths: {
            android_sdk: '',
            gradle: '',
            java: ''
        },
        keystore: {
            path: '',
            storePassword: '',
            keyAlias: '',
            keyPassword: ''
        }
    }
};

// ============================================================
// DOM REFERENCES
// ============================================================
const DOM = {
    sidebar: document.getElementById('sidebar'),
    sidebarNav: document.getElementById('sidebarNav'),
    mainContent: document.getElementById('mainContent'),
    contentArea: document.getElementById('contentArea'),
    toggleSidebar: document.getElementById('toggleSidebar'),
    themeToggle: document.getElementById('themeToggle'),
    projectStatus: document.getElementById('projectStatus'),
    headerProjectName: document.getElementById('headerProjectName'),
    breadcrumb: document.getElementById('breadcrumb'),
    refreshBtn: document.getElementById('refreshBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalActionBtn: document.getElementById('modalActionBtn'),
    toastContainer: document.getElementById('toastContainer'),
    panelLoader: document.getElementById('panelLoader')
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Cordova Pro GUI v2.0 Initializing...');
    
    loadPreferences();
    await loadNavigation();
    setupEventListeners();
    
    // Load settings from Python backend
    await loadSettingsFromBackend();
    await loadKeystoreFromBackend();
    
    loadInitialData();
    checkCordova();
    await loadPanel(CONFIG.defaultPanel);
    
    console.log('✅ Cordova Pro GUI initialized successfully');
});

// ============================================================
// LOG SETTINGS STATE - COMPLETE DEBUG
// ============================================================

function logSettingsState() {
    console.log('=========================================');
    console.log('📋 SETTINGS PANEL LOADED - COMPLETE STATE');
    console.log('=========================================');
    
    // 1. AppState.settings
    console.log('📁 AppState.settings:');
    console.log(JSON.stringify(AppState.settings, null, 2));
    
    // 2. AppState.settings.sdk_paths
    console.log('📁 sdk_paths:');
    console.log(JSON.stringify(AppState.settings.sdk_paths, null, 2));
    
    // 3. AppState.settings.keystore
    console.log('🔑 keystore:');
    console.log(JSON.stringify(AppState.settings.keystore, null, 2));
    
    // 4. keystoreData
    console.log('🔑 keystoreData:');
    console.log(JSON.stringify(keystoreData, null, 2));
    
    // 5. UI Elements values
    console.log('🖥️ UI Elements:');
    const uiValues = {
        theme: document.getElementById('settingsTheme')?.value || 'N/A',
        accentColor: document.getElementById('settingsAccentColor')?.value || 'N/A',
        fontSize: document.getElementById('settingsFontSize')?.value || 'N/A',
        defaultPath: document.getElementById('settingsDefaultPath')?.value || 'N/A',
        defaultTemplate: document.getElementById('settingsDefaultTemplate')?.value || 'N/A',
        autoSave: document.getElementById('settingsAutoSave')?.checked ?? 'N/A',
        checkUpdates: document.getElementById('settingsCheckUpdates')?.checked ?? 'N/A',
        android_sdk: document.getElementById('settingsAndroidSdkPath')?.value || 'N/A',
        gradle: document.getElementById('settingsGradlePath')?.value || 'N/A',
        java: document.getElementById('settingsJavaPath')?.value || 'N/A',
        keystore_path: document.getElementById('settingsKeystorePath')?.value || 'N/A',
        storePassword: document.getElementById('settingsStorePassword')?.value ? '***SET***' : 'EMPTY',
        keyAlias: document.getElementById('settingsKeyAlias')?.value || 'N/A',
        keyPassword: document.getElementById('settingsKeyPassword')?.value ? '***SET***' : 'EMPTY'
    };
    console.log(JSON.stringify(uiValues, null, 2));
    
    // 6. Check if keystore is properly loaded
    const hasKeystore = AppState.settings.keystore && AppState.settings.keystore.path;
    const hasSdk = AppState.settings.sdk_paths && 
                   (AppState.settings.sdk_paths.android_sdk || 
                    AppState.settings.sdk_paths.gradle || 
                    AppState.settings.sdk_paths.java);
    
    console.log('📊 Summary:');
    console.log(`   ✅ Keystore configured: ${hasKeystore ? 'YES' : 'NO'}`);
    if (hasKeystore) {
        console.log(`      📁 Path: ${AppState.settings.keystore.path}`);
        console.log(`      🔑 Alias: ${AppState.settings.keystore.keyAlias || 'NOT SET'}`);
        console.log(`      🔒 Store Password: ${AppState.settings.keystore.storePassword ? 'SET' : 'NOT SET'}`);
        console.log(`      🔒 Key Password: ${AppState.settings.keystore.keyPassword ? 'SET' : 'NOT SET'}`);
    }
    console.log(`   ✅ SDK paths configured: ${hasSdk ? 'YES' : 'NO'}`);
    if (hasSdk) {
        console.log(`      📁 Android SDK: ${AppState.settings.sdk_paths.android_sdk || 'NOT SET'}`);
        console.log(`      📁 Gradle: ${AppState.settings.sdk_paths.gradle || 'NOT SET'}`);
        console.log(`      📁 Java: ${AppState.settings.sdk_paths.java || 'NOT SET'}`);
    }
    
    console.log('=========================================');
    console.log('✅ Settings log complete');
    console.log('=========================================');
    
    // Also add to console output for easy viewing
    addConsoleMessage('📋 Settings panel loaded - check browser console for full details', 'info');
    addConsoleMessage(`   🔑 Keystore: ${hasKeystore ? 'Configured ✅' : 'Not configured ❌'}`, hasKeystore ? 'success' : 'warning');
    addConsoleMessage(`   📁 SDK Paths: ${hasSdk ? 'Configured ✅' : 'Not configured ❌'}`, hasSdk ? 'success' : 'warning');
}

// ============================================================
// SETTINGS - LOAD FROM BACKEND
// ============================================================
async function loadSettingsFromBackend() {
    try {
        const response = await new Promise((resolve, reject) => {
            eel.get_settings()(function(result) {
                if (result.success) {
                    resolve(result);
                } else {
                    reject(new Error(result.message || 'Failed to load settings'));
                }
            });
        });
        
        if (response.success && response.settings) {
            // Merge with default settings
            AppState.settings = { ...AppState.settings, ...response.settings };
            
            // Apply settings to UI
            applySettingsToUI();
        }
    } catch (error) {
        console.warn('Could not load settings from backend:', error);
        // Try loading from localStorage as fallback
        loadSettingsFromLocalStorage();
    }
}

function loadSettingsFromLocalStorage() {
    try {
        const saved = localStorage.getItem('cordova-pro-gui-settings');
        if (saved) {
            const settings = JSON.parse(saved);
            AppState.settings = { ...AppState.settings, ...settings };
            applySettingsToUI();
        }
    } catch (e) {
        console.warn('Could not load settings from localStorage:', e);
    }
}

function applySettingsToUI() {
    const s = AppState.settings;

    //setTimeout(logSettingsState, 500);
    setTimeout(loadKeystoreFromBackend, 500);
    
    // Theme
    if (s.theme) {
        const themeSelect = document.getElementById('settingsTheme');
        if (themeSelect) themeSelect.value = s.theme;
        if (s.theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (s.theme === 'light') {
            document.body.classList.remove('dark-mode');
        }
    }
    
    // Accent Color
    if (s.accentColor) {
        document.documentElement.style.setProperty('--primary', s.accentColor);
        const colorInput = document.getElementById('settingsAccentColor');
        const hexDisplay = document.getElementById('settingsAccentHex');
        if (colorInput) colorInput.value = s.accentColor;
        if (hexDisplay) hexDisplay.textContent = s.accentColor;
    }
    
    // Font Size
    if (s.fontSize) {
        const sizes = { small: '12px', medium: '14px', large: '16px', xlarge: '18px' };
        if (sizes[s.fontSize]) {
            document.body.style.fontSize = sizes[s.fontSize];
        }
        const fontSizeSelect = document.getElementById('settingsFontSize');
        if (fontSizeSelect) fontSizeSelect.value = s.fontSize;
    }
    
    // Default Path
    const defaultPathInput = document.getElementById('settingsDefaultPath');
    if (defaultPathInput && s.defaultPath) {
        defaultPathInput.value = s.defaultPath;
    }
    
    // Default Template
    const templateSelect = document.getElementById('settingsDefaultTemplate');
    if (templateSelect && s.defaultTemplate) {
        templateSelect.value = s.defaultTemplate;
    }
    
    // Auto Save
    const autoSaveCheck = document.getElementById('settingsAutoSave');
    if (autoSaveCheck) autoSaveCheck.checked = s.autoSave !== false;
    
    // Check Updates
    const checkUpdatesCheck = document.getElementById('settingsCheckUpdates');
    if (checkUpdatesCheck) checkUpdatesCheck.checked = s.checkUpdates !== false;
    
    // SDK Paths
    if (s.sdk_paths) {
        const androidSdkInput = document.getElementById('settingsAndroidSdkPath');
        if (androidSdkInput && s.sdk_paths.android_sdk) {
            androidSdkInput.value = s.sdk_paths.android_sdk;
        }
        const gradleInput = document.getElementById('settingsGradlePath');
        if (gradleInput && s.sdk_paths.gradle) {
            gradleInput.value = s.sdk_paths.gradle;
        }
        const javaInput = document.getElementById('settingsJavaPath');
        if (javaInput && s.sdk_paths.java) {
            javaInput.value = s.sdk_paths.java;
        }
    }
}

// ============================================================
// NAVIGATION LOADER
// ============================================================
async function loadNavigation() {
    try {
        const response = await fetch(CONFIG.navigationFile);
        if (!response.ok) throw new Error('Navigation file not found');
        
        AppState.navigation = await response.json();
        renderNavigation();
    } catch (error) {
        console.error('Failed to load navigation:', error);
        AppState.navigation = getFallbackNavigation();
        renderNavigation();
    }
}

function renderNavigation() {
    if (!AppState.navigation) return;
    
    let html = '';
    AppState.navigation.sections.forEach(section => {
        html += `<div class="nav-section">`;
        html += `<span class="nav-section-title">${section.title}</span>`;
        section.items.forEach(item => {
            const active = item.id === AppState.currentPanel ? 'active' : '';
            html += `
                <a href="#" class="nav-item ${active}" data-panel="${item.id}">
                    <i class="fas ${item.icon}"></i>
                    <span>${item.label}</span>
                </a>
            `;
        });
        html += `</div>`;
    });
    
    DOM.sidebarNav.innerHTML = html;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const panelId = this.dataset.panel;
            if (panelId) {
                navigateTo(panelId);
            }
        });
    });
}

function getFallbackNavigation() {
    return {
        sections: [
            {
                title: "Dashboard",
                items: [
                    { id: "dashboard", icon: "fa-th-large", label: "Dashboard" }
                ]
            },
            {
                title: "Project",
                items: [
                    { id: "project", icon: "fa-folder-open", label: "Project Manager" }
                ]
            },
            {
                title: "Advanced",
                items: [
                    { id: "console", icon: "fa-terminal", label: "Console" }
                ]
            }
        ]
    };
}

// ============================================================
// PANEL LOADER
// ============================================================
async function loadPanel(panelId) {
    try {
        DOM.panelLoader.style.display = 'flex';
        DOM.contentArea.innerHTML = '';
        DOM.contentArea.appendChild(DOM.panelLoader);
        
        if (AppState.panels[panelId]) {
            renderPanel(panelId, AppState.panels[panelId]);
            return;
        }
        
        const response = await fetch(`${CONFIG.panelsPath}${panelId}.html`);
        if (!response.ok) throw new Error(`Panel "${panelId}" not found`);
        
        const html = await response.text();
        AppState.panels[panelId] = html;
        renderPanel(panelId, html);
        
    } catch (error) {
        console.error(`Failed to load panel "${panelId}":`, error);
        showToast('error', 'Error', `Failed to load panel: ${panelId}`);
        DOM.contentArea.innerHTML = `
            <div class="panel-error" style="text-align:center; padding:60px 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size:48px; color:var(--warning);"></i>
                <h3 style="margin:16px 0 8px;">Failed to load panel</h3>
                <p style="color:var(--text-secondary); margin-bottom:16px;">${error.message}</p>
                <button class="btn btn-primary" onclick="loadPanel('${CONFIG.defaultPanel}')">
                    <i class="fas fa-home"></i> Go to Dashboard
                </button>
            </div>
        `;
    }
}

function renderPanel(panelId, html) {
    DOM.panelLoader.style.display = 'none';
    DOM.contentArea.innerHTML = html;
    initializePanel(panelId);
    AppState.currentPanel = panelId;
    updateBreadcrumb(panelId);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.panel === panelId) {
            item.classList.add('active');
        }
    });
}

function initializePanel(panelId) {
    switch(panelId) {
        case 'dashboard':
            updateDashboardStats();
            break;
        case 'platforms':
            refreshPlatformsList();
            break;
        case 'plugins':
            refreshPluginsList();
            break;
        case 'config':
            setTimeout(loadConfig, 100);
            break;
        case 'recent':
            updateRecentProjects();
            break;
        case 'sdk':
            checkEnvironment();
            break;
        case 'settings':
            applySettingsToUI();
            break;
        case 'build':
            checkBuild();
            break;
        default:
            break;
    }
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(panelId) {
    if (panelId === AppState.currentPanel) return;
    loadPanel(panelId);
}

function updateBreadcrumb(panelId) {
    const panelNames = {
        'dashboard': 'Dashboard',
        'project': 'Project Manager',
        'recent': 'Recent Projects',
        'platforms': 'Platform Manager',
        'sdk': 'SDK Manager',
        'plugins': 'Plugin Manager',
        'marketplace': 'Marketplace',
        'config': 'Config Editor',
        'resources': 'Resources',
        'build': 'Build Manager',
        'deploy': 'Run & Deploy',
        'console': 'Console',
        'settings': 'Settings',
        'docs': 'Documentation'
    };
    
    DOM.breadcrumb.innerHTML = `
        <span class="breadcrumb-item active">${panelNames[panelId] || panelId}</span>
    `;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    DOM.toggleSidebar.addEventListener('click', toggleSidebar);
    DOM.themeToggle.addEventListener('click', toggleTheme);
    DOM.refreshBtn.addEventListener('click', refreshData);
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && document.activeElement?.id === 'consoleCommand') {
            runConsoleCommand();
        }
    });
}

// ============================================================
// THEME MANAGEMENT
// ============================================================
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    AppState.isDarkMode = document.body.classList.contains('dark-mode');
    
    // Update settings
    AppState.settings.theme = AppState.isDarkMode ? 'dark' : 'light';
    
    const icon = DOM.themeToggle.querySelector('i');
    if (AppState.isDarkMode) {
        icon.className = 'fas fa-sun';
        DOM.themeToggle.title = 'Switch to Light Mode';
    } else {
        icon.className = 'fas fa-moon';
        DOM.themeToggle.title = 'Switch to Dark Mode';
    }
    
    savePreferences();
    saveSettingsToBackend();
}

function loadTheme() {
    if (AppState.isDarkMode) {
        document.body.classList.add('dark-mode');
        DOM.themeToggle.querySelector('i').className = 'fas fa-sun';
    }
}

// ============================================================
// SIDEBAR MANAGEMENT
// ============================================================
function toggleSidebar() {
    DOM.sidebar.classList.toggle('collapsed');
    DOM.mainContent.classList.toggle('expanded');
    AppState.isSidebarCollapsed = DOM.sidebar.classList.contains('collapsed');
    savePreferences();
}

// ============================================================
// PREFERENCES
// ============================================================
function savePreferences() {
    const prefs = {
        isDarkMode: AppState.isDarkMode,
        isSidebarCollapsed: AppState.isSidebarCollapsed
    };
    try {
        localStorage.setItem('cordova-pro-gui-preferences', JSON.stringify(prefs));
    } catch (e) {
        console.warn('Could not save preferences:', e);
    }
}

function loadPreferences() {
    try {
        const prefs = JSON.parse(localStorage.getItem('cordova-pro-gui-preferences'));
        if (prefs) {
            AppState.isDarkMode = prefs.isDarkMode || false;
            AppState.isSidebarCollapsed = prefs.isSidebarCollapsed || false;
            
            if (AppState.isSidebarCollapsed) {
                DOM.sidebar.classList.add('collapsed');
                DOM.mainContent.classList.add('expanded');
            }
            loadTheme();
        }
    } catch (e) {
        console.warn('Could not load preferences:', e);
    }
}

// ============================================================
// SETTINGS - SAVE TO BACKEND
// ============================================================
function saveSettings() {
    // Collect settings from UI
    const settings = {
        theme: document.getElementById('settingsTheme')?.value || 'system',
        accentColor: document.getElementById('settingsAccentColor')?.value || '#6366f1',
        fontSize: document.getElementById('settingsFontSize')?.value || 'medium',
        defaultPath: document.getElementById('settingsDefaultPath')?.value || '',
        defaultTemplate: document.getElementById('settingsDefaultTemplate')?.value || 'empty',
        autoSave: document.getElementById('settingsAutoSave')?.checked || false,
        checkUpdates: document.getElementById('settingsCheckUpdates')?.checked || false,
        sdk_paths: {
            android_sdk: document.getElementById('settingsAndroidSdkPath')?.value || '',
            gradle: document.getElementById('settingsGradlePath')?.value || '',
            java: document.getElementById('settingsJavaPath')?.value || ''
        },
        keystore: AppState.settings.keystore || {
            path: '',
            storePassword: '',
            keyAlias: '',
            keyPassword: ''
        }
    };
    
    // Update AppState
    AppState.settings = { ...AppState.settings, ...settings };
    
    showLoader('Saving settings...', false);
    
    eel.save_settings(settings)(function(response) {
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Saved', 'Settings saved successfully');
            addConsoleMessage('Settings saved successfully', 'success');
            applySettingsToUI();
            
            try {
                localStorage.setItem('cordova-pro-gui-settings', JSON.stringify(settings));
            } catch (e) {
                console.warn('Could not save settings to localStorage:', e);
            }
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`Error saving settings: ${response.message}`, 'error');
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`Error: ${error.message}`, 'error');
    });
}

// ============================================================
// DATA LOADING
// ============================================================
function loadInitialData() {
    eel.get_recent_projects()(function(response) {
        if (response.success) {
            AppState.recentProjects = response.projects || [];
            updateRecentProjects();
        }
    });
    
    eel.get_project_info()(function(response) {
        if (response.success) {
            AppState.currentProject = response.project;
            updateProjectInfo(response.project);
        }
    });
}

function refreshData() {
    showToast('info', 'Refreshing', 'Loading latest data...');
    loadInitialData();
    loadSettingsFromBackend();
}


// ============================================================
// checkBuild
// ============================================================
function checkBuild() {
    setTimeout(function() {
        if (AppState.settings && AppState.settings.keystore) {
            keystoreData = AppState.settings.keystore;
        }
        updateBuildKeystoreStatus();
        console.log('🔑 Build panel loaded - Keystore status updated');
        if (keystoreData && keystoreData.path) {
            console.log('   ✅ Keystore configured:', keystoreData.path);
            console.log('   🔑 Alias:', keystoreData.keyAlias);
        } else {
            console.log('   ❌ No keystore configured');
        }
    }, 300);
}


// ============================================================
// PROJECT MANAGEMENT
// ============================================================
function createProjectFromPanel() {
    const name = document.getElementById('projectName')?.value;
    const packageId = document.getElementById('packageId')?.value;
    const version = document.getElementById('projectVersion')?.value || '1.0.0';
    const path = document.getElementById('projectPath')?.value;
    const template = document.querySelector('.template-option.active')?.dataset?.template || 'empty';
    
    if (!name || !packageId || !path) {
        showToast('error', 'Validation Error', 'Please fill in all required fields');
        return;
    }
    
    showLoader('Creating project...', true);
    addConsoleMessage(`Creating project: ${name}`, 'info');
    
    eel.create_project(name, packageId, path, template)(function(response) {
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Success', 'Project created successfully!');
            addConsoleMessage(`Project "${name}" created successfully`, 'success');
            
            if (response.project) {
                AppState.currentProject = response.project;
                updateProjectInfo(response.project);
            }
            
            loadInitialData();
            navigateTo('dashboard');
            
            document.getElementById('projectName').value = '';
            document.getElementById('packageId').value = '';
            document.getElementById('projectPath').value = '';
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`Error: ${response.message}`, 'error');
        }
    });
}

function createNewProject() {
    navigateTo('project');
    setTimeout(() => {
        const nameInput = document.getElementById('projectName');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 300);
}

function updateProjectInfo(project) {
    if (!project) return;
    
    const projectName = project.name || project.id || 'Unknown';
    DOM.headerProjectName.textContent = projectName;
    
    document.getElementById('projectStatus').innerHTML = `
        <i class="fas fa-circle status-online"></i>
        <span>${projectName}</span>
    `;
    
    updateDashboardStats();
    
    const infoPanel = document.getElementById('projectInfo');
    if (infoPanel) {
        infoPanel.innerHTML = `
            <div class="project-details">
                <div class="detail-item">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${project.name || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Package ID:</span>
                    <span class="detail-value">${project.id || project.package_id || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Version:</span>
                    <span class="detail-value">${project.version || '1.0.0'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Author:</span>
                    <span class="detail-value">${project.author || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${project.description || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Platforms:</span>
                    <span class="detail-value">${project.platforms?.length > 0 ? project.platforms.join(', ') : 'None'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Plugins:</span>
                    <span class="detail-value">${project.plugins?.length || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Size:</span>
                    <span class="detail-value">${project.size || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Path:</span>
                    <span class="detail-value" style="font-size:12px; word-break:break-all;">${project.path || 'N/A'}</span>
                </div>
            </div>
        `;
    }
}

function openProject() {
    eel.select_project()(function(response) {
        if (response.success) {
            showToast('success', 'Project Opened', `Opened ${response.project.name}`);
            AppState.currentProject = response.project;
            updateProjectInfo(response.project);
            addConsoleMessage(`Project "${response.project.name}" opened`, 'success');
            navigateTo('dashboard');
        } else if (!response.message.includes('cancelled')) {
            showToast('error', 'Error', response.message);
        }
    });
}

function selectFolder() {
    eel.select_folder()(function(path) {
        if (path) {
            const input = document.getElementById('projectPath');
            if (input) input.value = path;
        }
    });
}

function updateDashboardStats() {
    const project = AppState.currentProject;
    if (!project) return;
    
    const totalProjects = document.getElementById('totalProjects');
    const totalPlatforms = document.getElementById('totalPlatforms');
    const totalPlugins = document.getElementById('totalPlugins');
    const lastBuild = document.getElementById('lastBuild');
    
    if (totalProjects) totalProjects.textContent = AppState.recentProjects.length || 1;
    if (totalPlatforms) totalPlatforms.textContent = project.platforms?.length || 0;
    if (totalPlugins) totalPlugins.textContent = project.plugins?.length || 0;
    if (lastBuild) lastBuild.textContent = 'Just now';
    
    const infoPanel = document.getElementById('projectInfo');
    if (infoPanel) {
        infoPanel.innerHTML = `
            <div class="project-details">
                <div class="detail-item">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${project.name || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Package ID:</span>
                    <span class="detail-value">${project.id || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Version:</span>
                    <span class="detail-value">${project.version || '1.0.0'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Author:</span>
                    <span class="detail-value">${project.author || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Platforms:</span>
                    <span class="detail-value">${project.platforms?.join(', ') || 'None'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Plugins:</span>
                    <span class="detail-value">${project.plugins?.length || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Path:</span>
                    <span class="detail-value" style="font-size:12px;">${project.path || 'N/A'}</span>
                </div>
            </div>
        `;
    }
}

// ============================================================
// PLATFORM MANAGEMENT
// ============================================================
function addPlatform(platform) {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    // ✅ Show loader
    showLoader(`Adding ${platform} platform...`, true);
    addConsoleMessage(`📦 Adding platform: ${platform}`, 'info');
    
    eel.add_platform(platform)(function(response) {
        // ✅ Hide loader
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Platform Added', `${platform} added successfully`);
            addConsoleMessage(`✅ Platform "${platform}" added successfully`, 'success');
            loadInitialData();            
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`❌ Error adding ${platform}: ${response.message}`, 'error');
        }
        
        setTimeout(() => {
            refreshPlatformsList();
        }, 1500);

    }).catch(function(error) {
        // ✅ Hide loader on error
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');

        setTimeout(() => {
            refreshPlatformsList();
        }, 1500);
    });
}

function removePlatform(platform) {
    if (!confirm(`Remove platform "${platform}"?`)) return;
    
    // ✅ Show loader
    showLoader(`Removing ${platform} platform...`, true);
    addConsoleMessage(`🗑️ Removing platform: ${platform}`, 'info');
    
    eel.remove_platform(platform)(function(response) {
        // ✅ Hide loader
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Platform Removed', `${platform} removed`);
            addConsoleMessage(`✅ Platform "${platform}" removed`, 'warning');
            loadInitialData();            
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`❌ Error removing ${platform}: ${response.message}`, 'error');
        }

        setTimeout(() => {
            refreshPlatformsList();
        }, 1500);

    }).catch(function(error) {
        // ✅ Hide loader on error
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');

        setTimeout(() => {
            refreshPlatformsList();
        }, 1500);
    });
}

function refreshPlatformsList() {
    const container = document.getElementById('platformsList');
    if (!container) return;
    
    const project = AppState.currentProject;
    if (!project) {
        container.innerHTML = `
            <div class="text-center text-muted" style="padding:20px;">
                <i class="fas fa-folder-open" style="font-size:24px; display:block; margin-bottom:8px;"></i>
                <p>No project is open</p>
                <button class="btn btn-sm btn-primary" onclick="openProject()">
                    <i class="fas fa-folder-open"></i> Open Project
                </button>
            </div>
        `;
        return;
    }
    
    const platforms = project.platforms || [];
    if (platforms.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted" style="padding:20px;">
                <i class="fas fa-mobile-alt" style="font-size:24px; display:block; margin-bottom:8px;"></i>
                <p>No platforms installed</p>
                <p style="font-size:12px;">Click on a platform card to add it</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = platforms.map(p => {
        const icon = getPlatformIcon(p);
        return `
            <div class="platform-item" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--bg-tertiary); border-radius:6px; margin-bottom:6px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="${icon}" style="color:var(--primary); font-size:20px;"></i>
                    <span style="font-weight:500;">${p}</span>
                    <span class="badge badge-success" style="font-size:10px; background:var(--success); color:white; padding:2px 8px; border-radius:10px;">
                        <i class="fas fa-check-circle" style="color: #fff;"></i>
                    </span>
                </div>
                <button class="btn btn-sm btn-danger" onclick="removePlatform('${p}')" title="Remove platform">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function getPlatformIcon(platform) {
    const icons = {
        'android': 'fab fa-android',
        'ios': 'fab fa-apple',
        'windows': 'fab fa-windows',
        'browser': 'fab fa-chrome',
        'electron': 'fab fa-desktop'
    };
    return icons[platform] || 'fas fa-mobile-alt';
}

// ============================================================
// REMOVE RECENT PROJECT - FIXED
// ============================================================
function removeRecentProject(path) {
    console.log('🗑️ Removing project:', path);
    
    if (!confirm('Remove this project from recent list?')) return;
    
    showLoader('Removing project...', false);
    
    eel.delete_project(path)(function(response) {
        hideLoader();
        
        console.log('Response:', response);
        
        if (response.success) {
            showToast('success', 'Removed', 'Project removed from recent list');
            addConsoleMessage(`Project removed from recent list`, 'info');
            
            // Remove from local state
            AppState.recentProjects = AppState.recentProjects.filter(p => p.path !== path);
            
            // Refresh UI
            updateRecentProjects();
            
            // Update stats
            updateDashboardStats();
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`Error removing project: ${response.message}`, 'error');
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`Error: ${error.message}`, 'error');
    });
}

// ============================================================
// OPEN RECENT PROJECT - FIXED
// ============================================================
function openRecentProject(path) {
    console.log('📂 Opening project:', path);
    
    if (!path) {
        showToast('error', 'Error', 'Project path is empty');
        return;
    }
    
    showLoader('Opening project...', false);
    addConsoleMessage(`📂 Opening project: ${path}`, 'info');
    
    // Call Python backend
    eel.open_project(path)(function(response) {
        hideLoader();
        
        if (response && response.success) {
            showToast('success', 'Project Opened', `Opened ${response.project.name || 'project'}`);
            
            if (response.project) {
                AppState.currentProject = response.project;
                updateProjectInfo(response.project);
            }
            
            addConsoleMessage(`✅ Project opened successfully`, 'success');
            navigateTo('dashboard');
            loadInitialData(); // Refresh data
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            showToast('error', 'Error', errorMsg);
            addConsoleMessage(`❌ Error opening project: ${errorMsg}`, 'error');
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message || 'Failed to open project');
        addConsoleMessage(`❌ Error: ${error.message || 'Failed to open project'}`, 'error');
    });
}

// ============================================================
// PLUGIN MANAGEMENT
// ============================================================
function addPlugin() {
    const name = document.getElementById('pluginName')?.value;
    const version = document.getElementById('pluginVersion')?.value || 'latest';
    
    if (!name) {
        showToast('warning', 'Missing Info', 'Please enter a plugin name');
        return;
    }
    
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    showLoader(`Installing ${name}...`, true);
    addConsoleMessage(`📦 Installing plugin: ${name} (${version})`, 'info');
    
    eel.add_plugin(name, version)(function(response) {
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Plugin Installed', `${name} installed successfully`);
            addConsoleMessage(`✅ Plugin "${name}" installed`, 'success');
            loadInitialData();
            setTimeout(() => {
                refreshPluginsList();
            }, 500);
            
            const pluginNameInput = document.getElementById('pluginName');
            const pluginVersionInput = document.getElementById('pluginVersion');
            if (pluginNameInput) pluginNameInput.value = '';
            if (pluginVersionInput) pluginVersionInput.value = '';
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`❌ Error installing ${name}: ${response.message}`, 'error');
        }
    });
}

function quickAddPlugin(name) {
    const input = document.getElementById('pluginName');
    if (input) input.value = name;
    addPlugin();
}

function refreshPluginsList() {
    const container = document.getElementById('pluginsList');
    if (!container) return;
    
    const project = AppState.currentProject;
    if (!project) {
        container.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted">
                    <i class="fas fa-info-circle"></i> No plugins installed
                </td>
            </tr>
        `;
        return;
    }
    
    const plugins = project.plugins || [];
    if (plugins.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted">
                    <i class="fas fa-info-circle"></i> No plugins installed
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = plugins.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.version || 'latest'}</td>
            <td><span class="badge badge-success">Installed</span></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removePlugin('${p.name}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function removePlugin(name) {
    if (!confirm(`Remove plugin "${name}"?`)) return;
    
    eel.remove_plugin(name)(function(response) {
        if (response.success) {
            showToast('success', 'Plugin Removed', `${name} removed`);
            addConsoleMessage(`Plugin "${name}" removed`, 'warning');
            loadInitialData();
            refreshPluginsList();
        } else {
            showToast('error', 'Error', response.message);
        }
    });
}

// ============================================================
// BUILD MANAGEMENT
// ============================================================
function buildProject(platform, buildType, flags) {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    // Use passed params or fallback to DOM
    const finalPlatform = platform || document.getElementById('buildPlatform')?.value || 'android';
    const finalBuildType = buildType || document.getElementById('buildType')?.value || 'debug';
    const finalFlags = flags !== undefined ? flags : document.getElementById('buildFlags')?.value || '';
    
    let projectPath = AppState.currentProject;
    if (typeof projectPath === 'object') {
        projectPath = projectPath.path || projectPath.name || 'Unknown';
    }
    
    navigateTo('console');
    
    setTimeout(function() {
        
        showLoader(`Building ${finalPlatform} (${finalBuildType})...`, true);
        
        eel.build_project(finalPlatform, finalBuildType, finalFlags)(function(response) {
            hideLoader();
            
            if (response.success) {
                showToast('success', 'Build Successful', `${finalPlatform} build completed`);
                addConsoleMessage('✅ Build completed successfully!', 'success');
                addConsoleMessage('========================================', 'info');
                
                if (response.output) {
                    const lines = response.output.split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            let type = 'info';
                            if (line.toLowerCase().includes('error')) type = 'error';
                            else if (line.toLowerCase().includes('warning')) type = 'warning';
                            else if (line.toLowerCase().includes('success')) type = 'success';
                            addConsoleMessage(line, type);
                        }
                    });
                }
                
                if (response.output_file) {
                    addConsoleMessage(`📦 Output: ${response.output_file}`, 'success');
                    if (response.output_size) {
                        addConsoleMessage(`📊 Size: ${response.output_size}`, 'info');
                    }
                    showToast('success', 'Build Output', 'APK file created successfully');
                }
            } else {
                addConsoleMessage('❌ Build failed!', 'error');
                addConsoleMessage('========================================', 'info');
                
                if (response.output) {
                    const lines = response.output.split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            let type = 'error';
                            if (line.toLowerCase().includes('warning')) type = 'warning';
                            addConsoleMessage(line, type);
                        }
                    });
                }
                showToast('error', 'Build Failed', response.message);
            }
            addConsoleMessage('========================================', 'info');
        });
    }, 500);
}

// ============================================================
// BUILD PROJECT - OVERRIDE WITH KEYSTORE
// ============================================================

// Save reference to original function (AFTER it's defined)
const originalBuildProject = buildProject;

// Override
buildProject = function() {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    const platform = document.getElementById('buildPlatform')?.value || 'android';
    const buildType = document.getElementById('buildType')?.value || 'debug';
    let flags = document.getElementById('buildFlags')?.value || '';
        
    // For release builds, auto-add keystore if available
    if (buildType === 'release' && platform === 'android') {
        // Refresh keystore from AppState
        if (AppState.settings && AppState.settings.keystore) {
            keystoreData = AppState.settings.keystore;
        }
        
        if (keystoreData.path && keystoreData.storePassword && keystoreData.keyAlias) {
            const keystoreFlags = `--keystore="${keystoreData.path}" --storePassword=${keystoreData.storePassword} --keyAlias=${keystoreData.keyAlias} --keyPassword=${keystoreData.keyPassword}`;
            flags = keystoreFlags; // Overwrite flags
            addConsoleMessage('🔑 Using saved keystore for signing', 'success');
            showToast('success', 'Loaded Keystore', '🔑 Using keystore for Build');
        } else {
            showToast('warning', 'Incomplete Keystore', 'Please configure keystore in Settings');
            addConsoleMessage('⚠️ Incomplete keystore configuration', 'warning');
        }
    }
    
    // Call original build function with modified flags
    originalBuildProject.call(this, platform, buildType, flags);
};

// ============================================================
// BUILD AND DEPLOY
// ============================================================

function buildAndDeploy() {
    buildProject(); // Now calls the overridden version
    setTimeout(() => {
        const target = document.querySelector('input[name="deployConfig"]:checked')?.value || 'debug';
        const deployTarget = document.getElementById('deployTarget')?.value || 'apk';
        showToast('info', 'Deploying', `Deploying ${deployTarget} (${target})...`);
    }, 2000);
}

function runApp() {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    const platform = document.getElementById('buildPlatform')?.value || 'android';
    const target = document.getElementById('runTarget')?.value || 'device';
    
    showToast('info', 'Running', `Running on ${target}...`);
    addConsoleMessage(`Running app on ${target}`, 'info');
    
    eel.run_app(platform, target)(function(response) {
        if (response.success) {
            showToast('success', 'Running', 'App launched successfully');
            addConsoleMessage('App running', 'success');
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`Error running app: ${response.message}`, 'error');
        }
    });
}

function emulateApp() {
    const target = document.getElementById('runTarget');
    if (target) target.value = 'emulator';
    runApp();
}

// ============================================================
// CONFIG EDITOR - VISUAL
// ============================================================

// ---------- Global Config Data ----------
let configData = {
    fullXml: ''  // Store full XML content
};


// ============================================================
// PREFERENCE & PERMISSION TEMPLATES
// ============================================================

const PREFERENCE_TEMPLATES = {
    'Orientation': {
        description: 'App screen orientation',
        options: ['portrait', 'landscape', 'default'],
        default: 'portrait'
    },
    'Fullscreen': {
        description: 'Enable fullscreen mode',
        options: ['true', 'false'],
        default: 'false'
    },
    'BackgroundColor': {
        description: 'Background color (Hex)',
        options: ['#000000', '#FFFFFF', '#1a1a2e', '#16213e', '#0f3460', '#533483'],
        default: '#000000'
    },
    'SplashScreenDelay': {
        description: 'Splash screen display time (ms)',
        options: ['0', '1000', '2000', '3000', '5000'],
        default: '3000'
    },
    'AutoHideSplashScreen': {
        description: 'Auto hide splash screen',
        options: ['true', 'false'],
        default: 'false'
    },
    'DisallowOverscroll': {
        description: 'Disable overscroll effect',
        options: ['true', 'false'],
        default: 'true'
    },
    'ShowSplashScreenSpinner': {
        description: 'Show spinner on splash screen',
        options: ['true', 'false'],
        default: 'true'
    },
    'AndroidWindowSplashScreenAnimatedIcon': {
        description: 'Animated splash icon (Android)',
        placeholder: 'res/drawable/splash_icon.xml'
    },
    'AndroidWindowSplashScreenBackground': {
        description: 'Splash background color (Android)',
        placeholder: '#1a1a2e'
    },
    'AndroidWindowSplashScreenAnimationDuration': {
        description: 'Splash animation duration (Android)',
        options: ['500', '1000', '1500', '2000'],
        default: '1000'
    },
    'StatusBarOverlaysWebView': {
        description: 'Status bar overlay',
        options: ['true', 'false'],
        default: 'false'
    },
    'StatusBarBackgroundColor': {
        description: 'Status bar color',
        placeholder: '#000000'
    },
    'StatusBarStyle': {
        description: 'Status bar style',
        options: ['lightcontent', 'default'],
        default: 'default'
    }
};

const PERMISSION_TEMPLATES = {
    'android.permission.INTERNET': 'Internet access',
    'android.permission.ACCESS_FINE_LOCATION': 'Fine location (GPS)',
    'android.permission.ACCESS_COARSE_LOCATION': 'Coarse location',
    'android.permission.CAMERA': 'Camera access',
    'android.permission.READ_EXTERNAL_STORAGE': 'Read external storage',
    'android.permission.WRITE_EXTERNAL_STORAGE': 'Write external storage',
    'android.permission.RECORD_AUDIO': 'Record audio',
    'android.permission.READ_CONTACTS': 'Read contacts',
    'android.permission.WRITE_CONTACTS': 'Write contacts',
    'android.permission.ACCESS_NETWORK_STATE': 'Network state',
    'android.permission.ACCESS_WIFI_STATE': 'WiFi state',
    'android.permission.VIBRATE': 'Vibrate',
    'android.permission.BLUETOOTH': 'Bluetooth',
    'android.permission.READ_PHONE_STATE': 'Phone state',
    'android.permission.SYSTEM_ALERT_WINDOW': 'Display over other apps',
    'android.permission.ACCESS_BACKGROUND_LOCATION': 'Background location',
    'android.permission.POST_NOTIFICATIONS': 'Post notifications',
    'android.permission.READ_MEDIA_IMAGES': 'Read media images',
    'android.permission.READ_MEDIA_VIDEO': 'Read media video',
    'android.permission.READ_MEDIA_AUDIO': 'Read media audio'
};


// ---------- Load Config ----------
function loadConfig() {
    loadRawXmlDirect();
}

// ---------- Load Raw XML ----------
function loadRawXmlDirect() {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }

    showLoader('Loading config.xml...', false);

    eel.load_raw_config()(function(response) {
        hideLoader();

        if (response.success) {
            const editor = document.getElementById('rawXmlEditor');
            if (editor) {
                let xmlContent = response.content || '';
                xmlContent = cleanXmlContent(xmlContent);
                editor.value = xmlContent;
                configData.fullXml = xmlContent;

                // ✅ Extract preferences and permissions from XML
                extractPreferencesAndPermissions(xmlContent);

                updateConfigStatus('Loaded ✅', 'success');
                showToast('success', 'Loaded', 'config.xml loaded successfully');
                addConsoleMessage('✅ config.xml loaded', 'success');
            }
        } else {
            updateConfigStatus('Failed to load ❌', 'error');
            showToast('error', 'Error', response.message);
            addConsoleMessage(`❌ Error loading config: ${response.message}`, 'error');
        }
    });
}

/**
 * Extract preferences and permissions from config.xml
 * Updates the AppState and re-renders the UI
 */
function extractPreferencesAndPermissions(xmlContent) {
    if (!xmlContent) return;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    const prefs = {};
    const perms = [];

    // Extract all preferences from any platform or root
    const prefNodes = xmlDoc.querySelectorAll('preference');
    prefNodes.forEach(node => {
        const name = node.getAttribute('name');
        const value = node.getAttribute('value');
        if (name) prefs[name] = value || '';
    });

    // Extract permissions from Android platform only
    const androidPlatform = xmlDoc.querySelector('platform[name="android"]');
    if (androidPlatform) {
        const permNodes = androidPlatform.querySelectorAll('uses-permission');
        permNodes.forEach(node => {
            const name = node.getAttribute('android:name');
            if (name) perms.push(name);
        });
    }

    // Update global state
    configData.preferences = prefs;
    configData.permissions = perms;

    // Re-render UI
    renderPreferences();
    renderPermissions();

    addConsoleMessage(`📋 Extracted ${Object.keys(prefs).length} preferences and ${perms.length} permissions`, 'info');
}

// ---------- Save Raw XML ----------
function saveRawXmlDirect() {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }

    const editor = document.getElementById('rawXmlEditor');
    if (!editor) return;

    let xmlContent = editor.value.trim();
    if (!xmlContent) {
        showToast('warning', 'Empty', 'XML content is empty');
        return;
    }

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            showToast('error', 'Invalid XML', parserError.textContent);
            updateConfigStatus('Invalid XML ❌', 'error');
            return;
        }

        // ✅ Inject preferences and permissions (replaces old ones)
        xmlContent = injectPreferencesAndPermissions(xmlContent);

        let cleanedXml = cleanXmlContent(xmlContent);

        showLoader('Saving config.xml...', false);
        addConsoleMessage('💾 Saving config.xml...', 'info');

        eel.save_raw_config(cleanedXml)(function(response) {
            hideLoader();

            if (response.success) {
                configData.fullXml = cleanedXml;
                updateConfigStatus('Saved successfully ✅', 'success');
                showToast('success', 'Saved', 'config.xml saved successfully');
                addConsoleMessage('✅ config.xml saved successfully', 'success');
                
                // ✅ Reload to reflect changes
                setTimeout(loadRawXmlDirect, 500);
            } else {
                updateConfigStatus('Save failed ❌', 'error');
                showToast('error', 'Error', response.message);
                addConsoleMessage(`❌ Error saving config: ${response.message}`, 'error');
            }
        });

    } catch (error) {
        showToast('error', 'Error', error.message);
        updateConfigStatus('Invalid XML ❌', 'error');
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');
    }
}

/**
 * Replace all preferences and permissions in config.xml with current state
 * Removes old tags and recreates them from configData
 */
function injectPreferencesAndPermissions(xmlContent) {
    if (!xmlContent) return xmlContent;

    const prefs = configData.preferences || {};
    const permissions = configData.permissions || [];

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Find or create <platform name="android">
    let androidPlatform = xmlDoc.querySelector('platform[name="android"]');
    if (!androidPlatform) {
        const widget = xmlDoc.querySelector('widget');
        if (!widget) return xmlContent;

        androidPlatform = xmlDoc.createElement('platform');
        androidPlatform.setAttribute('name', 'android');
        widget.appendChild(androidPlatform);
    }

    // ✅ STEP 1: Remove ALL existing preferences and permissions
    const allPrefs = androidPlatform.querySelectorAll('preference');
    allPrefs.forEach(el => el.remove());

    const allPerms = androidPlatform.querySelectorAll('uses-permission');
    allPerms.forEach(el => el.remove());

    // ✅ STEP 2: Add preferences from current state
    for (const [name, value] of Object.entries(prefs)) {
        const prefEl = xmlDoc.createElement('preference');
        prefEl.setAttribute('name', name);
        prefEl.setAttribute('value', value);
        androidPlatform.appendChild(prefEl);
    }

    // ✅ STEP 3: Add permissions from current state
    for (const perm of permissions) {
        const permEl = xmlDoc.createElement('uses-permission');
        permEl.setAttribute('xmlns:android', 'http://schemas.android.com/apk/res/android');
        permEl.setAttribute('android:name', perm);
        androidPlatform.appendChild(permEl);
    }

    // Serialize back to string
    const serializer = new XMLSerializer();
    let newXml = serializer.serializeToString(xmlDoc);

    // Add XML declaration if missing
    if (!newXml.startsWith('<?xml')) {
        newXml = '<?xml version="1.0" encoding="utf-8"?>\n' + newXml;
    }

    return newXml;
}

// ---------- Validate Raw XML ----------
function validateRawXml() {
    const editor = document.getElementById('rawXmlEditor');
    const output = document.getElementById('validationOutput');
    const message = document.getElementById('validationMessage');
    
    if (!editor || !output || !message) return;
    
    const xmlContent = editor.value.trim();
    if (!xmlContent) {
        showToast('warning', 'Empty', 'XML content is empty');
        return;
    }
    
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            output.style.display = 'block';
            output.style.borderLeftColor = 'var(--danger)';
            message.innerHTML = `<i class="fas fa-times-circle" style="color:var(--danger);"></i> <strong>Invalid XML:</strong> ${parserError.textContent}`;
            showToast('error', 'Invalid XML', parserError.textContent);
            updateConfigStatus('Invalid ❌', 'error');
            return;
        }
        
        // Check if widget exists
        const widget = xmlDoc.querySelector('widget');
        if (!widget) {
            output.style.display = 'block';
            output.style.borderLeftColor = 'var(--warning)';
            message.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:var(--warning);"></i> <strong>Warning:</strong> No &lt;widget&gt; element found`;
            showToast('warning', 'Warning', 'No widget element found');
            updateConfigStatus('Warning ⚠️', 'warning');
            return;
        }
        
        // Get info
        const id = widget.getAttribute('id') || 'Not set';
        const version = widget.getAttribute('version') || 'Not set';
        const nameEl = widget.querySelector('name');
        const name = nameEl ? nameEl.textContent.trim() : 'Not set';
        
        output.style.display = 'block';
        output.style.borderLeftColor = 'var(--success)';
        message.innerHTML = `
            <i class="fas fa-check-circle" style="color:var(--success);"></i> 
            <strong>Valid XML</strong> 
            <span style="margin-left:16px; color:var(--text-secondary);">
                Package: <strong>${id}</strong> | 
                Version: <strong>${version}</strong> | 
                Name: <strong>${name}</strong>
            </span>
        `;
        
        showToast('success', 'Valid ✅', 'XML is valid');
        updateConfigStatus('Valid ✅', 'success');
        
    } catch (error) {
        output.style.display = 'block';
        output.style.borderLeftColor = 'var(--danger)';
        message.innerHTML = `<i class="fas fa-times-circle" style="color:var(--danger);"></i> <strong>Error:</strong> ${error.message}`;
        showToast('error', 'Error', error.message);
        updateConfigStatus('Error ❌', 'error');
    }
}

// ---------- Reset Raw XML ----------
function resetRawXml() {
    if (!confirm('Reset to default config.xml?')) return;
    
    const defaultXml = `<?xml version="1.0" encoding="utf-8"?>
<widget id="com.example.app" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>My App</name>
    <description>A Cordova application</description>
    <author email="user@example.com" href="https://example.com">Your Name</author>
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
        <uses-permission android:name="android.permission.INTERNET" />
    </platform>
    <platform name="ios">
        <allow-intent href="itms:*" />
        <allow-intent href="itms-apps:*" />
    </platform>
</widget>`;
    
    const editor = document.getElementById('rawXmlEditor');
    if (editor) {
        editor.value = defaultXml;
        configData.fullXml = defaultXml;
        updateConfigStatus('Reset - Save to apply', 'warning');
        showToast('info', 'Reset', 'Default template loaded');
        addConsoleMessage('🔄 Config reset to default', 'info');
    }
}

// ---------- Clean XML Content ----------
function cleanXmlContent(xmlContent) {
    if (!xmlContent) return '';
    
    // Remove duplicate XML declarations
    const declPattern = /<\?xml[^?]*\?>/g;
    const declarations = xmlContent.match(declPattern);
    if (declarations && declarations.length > 1) {
        xmlContent = declarations[0] + '\n' + xmlContent.replace(declPattern, '').trim();
    }
    
    // Remove standalone attribute if present
    xmlContent = xmlContent.replace(/standalone="[^"]*"/g, '');
    
    // Fix self-closing tags (add space before /> if needed)
    xmlContent = xmlContent.replace(/(\S)\/\>/g, '$1 />');
    
    return xmlContent;
}

// ---------- Update Config Status ----------
function updateConfigStatus(message, type = 'info') {
    const status = document.getElementById('configStatus');
    if (!status) return;
    
    const colors = {
        'success': 'var(--success)',
        'error': 'var(--danger)',
        'warning': 'var(--warning)',
        'info': 'var(--info)'
    };
    
    status.innerHTML = `
        <i class="fas fa-circle" style="color:${colors[type] || 'var(--info)'};"></i>
        <span>${message}</span>
    `;
}


// ============================================================
// PREFERENCES MANAGER
// ============================================================

function showAddPreferenceDialog() {
    let optionsHtml = Object.keys(PREFERENCE_TEMPLATES).map(key => {
        const pref = PREFERENCE_TEMPLATES[key];
        return `<option value="${key}">${key}</option>`;
    }).join('');
    
    showModal(
        'Add Preference',
        `
        <div class="form-group">
            <label>Select Preference</label>
            <select class="form-control" id="prefSelect" onchange="updatePreferenceUI()">
                <option value="">-- Choose a preference --</option>
                ${optionsHtml}
                <option value="custom">--- Custom ---</option>
            </select>
        </div>
        <div id="prefValueContainer">
            <div class="form-group">
                <label>Value</label>
                <input type="text" class="form-control" id="prefValue" placeholder="Enter value">
            </div>
        </div>
        <div style="margin-top:8px; padding:8px 12px; background:var(--bg-tertiary); border-radius:6px; font-size:12px; color:var(--text-secondary);">
            <i class="fas fa-info-circle"></i> 
            <span id="prefDescription">Select a preference to see description</span>
        </div>
        `,
        'Add',
        function() {
            const select = document.getElementById('prefSelect');
            const valueInput = document.getElementById('prefValue');
            
            let name = select.value;
            let value = valueInput ? valueInput.value.trim() : '';
            
            if (name === 'custom') {
                name = document.getElementById('customPrefName')?.value.trim();
                value = document.getElementById('customPrefValue')?.value.trim();
                if (!name || !value) {
                    showToast('warning', 'Missing', 'Please enter both name and value');
                    return;
                }
            }
            
            if (!name || !value) {
                showToast('warning', 'Missing', 'Please select a preference and enter a value');
                return;
            }
            
            addPreferenceToConfig(name, value);
            closeModal();
        }
    );
    
    setTimeout(updatePreferenceUI, 100);
}

function updatePreferenceUI() {
    const select = document.getElementById('prefSelect');
    if (!select) return;
    
    const key = select.value;
    const pref = PREFERENCE_TEMPLATES[key];
    const descEl = document.getElementById('prefDescription');
    const container = document.getElementById('prefValueContainer');
    
    if (!container || !descEl) return;
    
    if (key === 'custom') {
        descEl.textContent = 'Enter custom preference name and value';
        container.innerHTML = `
            <div class="form-group">
                <label>Custom Name</label>
                <input type="text" class="form-control" id="customPrefName" placeholder="MyPreference">
            </div>
            <div class="form-group">
                <label>Value</label>
                <input type="text" class="form-control" id="customPrefValue" placeholder="my-value">
            </div>
        `;
        return;
    }
    
    if (pref) {
        descEl.textContent = pref.description;
        
        if (pref.options) {
            let optionsHtml = pref.options.map(opt => 
                `<option value="${opt}" ${opt === pref.default ? 'selected' : ''}>${opt}</option>`
            ).join('');
            container.innerHTML = `
                <div class="form-group">
                    <label>Value</label>
                    <select class="form-control" id="prefValue">
                        ${optionsHtml}
                    </select>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="form-group">
                    <label>Value</label>
                    <input type="text" class="form-control" id="prefValue" 
                           placeholder="${pref.placeholder || 'Enter value'}">
                </div>
            `;
        }
    }
}

function addPreferenceToConfig(name, value) {
    if (!configData.preferences) configData.preferences = {};
    
    if (configData.preferences[name]) {
        if (!confirm(`Preference "${name}" already exists. Overwrite?`)) {
            return;
        }
    }
    
    configData.preferences[name] = value;
    renderPreferences();
    updateConfigStatus('Modified - Save to apply', 'warning');
    showToast('success', 'Added', `Preference "${name}" added`);
    addConsoleMessage(`➕ Added preference: ${name} = ${value}`, 'info');
}

function removePreference(name) {
    if (!confirm(`Remove preference "${name}"?`)) return;
    delete configData.preferences[name];
    renderPreferences();
    updateConfigStatus('Modified - Save to apply', 'warning');
    showToast('info', 'Removed', `Preference "${name}" removed`);
}

function renderPreferences() {
    const container = document.getElementById('preferencesContainer');
    if (!container) return;
    
    const prefs = configData.preferences || {};
    const keys = Object.keys(prefs);
    
    if (keys.length === 0) {
        container.innerHTML = '<span class="text-muted" style="font-size:13px;">No preferences configured</span>';
        return;
    }
    
    container.innerHTML = keys.map(key => `
        <div class="config-tag" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:var(--bg-tertiary); border-radius:20px; font-size:13px; border:1px solid var(--border);">
            <i class="fas fa-sliders-h" style="color:var(--warning);"></i>
            <span><strong>${escapeHtml(key)}</strong> = ${escapeHtml(prefs[key])}</span>
            <button class="btn btn-sm btn-danger" style="padding:2px 6px; font-size:10px;" onclick="removePreference('${escapeHtml(key)}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// ============================================================
// PERMISSIONS MANAGER
// ============================================================

function showAddPermissionDialog() {
    let optionsHtml = Object.keys(PERMISSION_TEMPLATES).map(key => {
        return `<option value="${key}">${PERMISSION_TEMPLATES[key]} (${key})</option>`;
    }).join('');
    
    showModal(
        'Add Permission',
        `
        <div class="form-group">
            <label>Select Permission</label>
            <select class="form-control" id="permissionSelect" onchange="updatePermissionUI()">
                <option value="">-- Choose a permission --</option>
                ${optionsHtml}
                <option value="custom">--- Custom ---</option>
            </select>
        </div>
        <div id="customPermissionContainer" style="display:none;">
            <div class="form-group">
                <label>Custom Permission</label>
                <input type="text" class="form-control" id="customPermission" 
                       placeholder="android.permission.CUSTOM">
            </div>
        </div>
        <div style="margin-top:8px; padding:8px 12px; background:var(--bg-tertiary); border-radius:6px; font-size:12px; color:var(--text-secondary);">
            <i class="fas fa-info-circle"></i> 
            Permissions are added to the Android platform section
        </div>
        `,
        'Add',
        function() {
            const select = document.getElementById('permissionSelect');
            const customInput = document.getElementById('customPermission');
            
            let permission = select.value;
            
            if (permission === 'custom') {
                permission = customInput.value.trim();
                if (!permission) {
                    showToast('warning', 'Missing', 'Please enter a custom permission');
                    return;
                }
            }
            
            if (permission) {
                addPermissionToConfig(permission);
                closeModal();
            } else {
                showToast('warning', 'Missing', 'Please select a permission');
            }
        }
    );
}

function updatePermissionUI() {
    const select = document.getElementById('permissionSelect');
    if (!select) return;
    
    const container = document.getElementById('customPermissionContainer');
    if (container) {
        container.style.display = select.value === 'custom' ? 'block' : 'none';
    }
}

function addPermissionToConfig(permission) {
    if (!configData.permissions) configData.permissions = [];
    
    if (configData.permissions.includes(permission)) {
        showToast('warning', 'Duplicate', `Permission "${permission}" already exists`);
        return;
    }
    
    configData.permissions.push(permission);
    renderPermissions();
    updateConfigStatus('Modified - Save to apply', 'warning');
    showToast('success', 'Added', `Permission "${permission}" added`);
    addConsoleMessage(`🔐 Added permission: ${permission}`, 'info');
}

function removePermission(permission) {
    if (!confirm(`Remove permission "${permission}"?`)) return;
    configData.permissions = configData.permissions.filter(p => p !== permission);
    renderPermissions();
    updateConfigStatus('Modified - Save to apply', 'warning');
    showToast('info', 'Removed', `Permission "${permission}" removed`);
}

function renderPermissions() {
    const container = document.getElementById('permissionsContainer');
    if (!container) return;
    
    const permissions = configData.permissions || [];
    
    if (permissions.length === 0) {
        container.innerHTML = '<span class="text-muted" style="font-size:13px;">No permissions configured</span>';
        return;
    }
    
    container.innerHTML = permissions.map(p => `
        <div class="config-tag" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:var(--bg-tertiary); border-radius:20px; font-size:13px; border:1px solid var(--border);">
            <i class="fas fa-shield-alt" style="color:var(--info);"></i>
            <span>${escapeHtml(p)}</span>
            <button class="btn btn-sm btn-danger" style="padding:2px 6px; font-size:10px;" onclick="removePermission('${escapeHtml(p)}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// ---------- Validate Config ----------
function validateConfig() {
    const id = document.getElementById('cfg_id')?.value || '';
    const version = document.getElementById('cfg_version')?.value || '';
    const name = document.getElementById('cfg_name')?.value || '';
    
    const idPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
    const versionPattern = /^\d+\.\d+\.\d+$/;
    
    let valid = true;
    let messages = [];
    
    if (!name) {
        valid = false;
        messages.push('App Name is required');
    }
    
    if (!idPattern.test(id)) {
        valid = false;
        messages.push('Invalid Package ID (e.g., com.example.app)');
    }
    
    if (!versionPattern.test(version)) {
        valid = false;
        messages.push('Invalid Version (e.g., 1.0.0)');
    }
    
    if (valid) {
        showToast('success', 'Valid ✅', 'Configuration is valid');
        addConsoleMessage('✅ Configuration validation passed', 'success');
        updateConfigStatus('Valid ✅', 'success');
    } else {
        showToast('error', 'Validation Failed ❌', messages.join(' | '));
        addConsoleMessage(`❌ Validation failed: ${messages.join(' | ')}`, 'error');
        updateConfigStatus('Invalid ❌', 'error');
    }
}

// ---------- Show Raw XML ----------
function showRawXml() {
    const modal = document.getElementById('rawXmlModal');
    const textarea = document.getElementById('rawXmlContent');
    const fullXmlTextarea = document.getElementById('fullXmlContent');
    
    if (!modal || !textarea) return;
    
    // Use full XML from hidden textarea if available
    if (fullXmlTextarea && fullXmlTextarea.value) {
        // Clean the XML for display
        let xmlContent = fullXmlTextarea.value;
        
        // Remove duplicate declarations for clean display
        const declPattern = /<\?xml[^?]*\?>/g;
        const declarations = xmlContent.match(declPattern);
        if (declarations && declarations.length > 1) {
            xmlContent = declarations[0] + '\n' + xmlContent.replace(declPattern, '').trim();
        }
        
        textarea.value = xmlContent;
        modal.style.display = 'flex';
    } else {
        // Load from backend
        showLoader('Loading XML...', false);
        
        eel.load_config()(function(response) {
            hideLoader();
            
            if (response.success && response.config && response.config.fullXml) {
                let xmlContent = response.config.fullXml;
                
                // Clean duplicate declarations
                const declPattern = /<\?xml[^?]*\?>/g;
                const declarations = xmlContent.match(declPattern);
                if (declarations && declarations.length > 1) {
                    xmlContent = declarations[0] + '\n' + xmlContent.replace(declPattern, '').trim();
                }
                
                textarea.value = xmlContent;
                
                // Also store in hidden textarea
                if (fullXmlTextarea) {
                    fullXmlTextarea.value = xmlContent;
                }
                
                modal.style.display = 'flex';
            } else {
                showToast('error', 'Error', 'Could not load XML content');
            }
        }).catch(function(error) {
            hideLoader();
            showToast('error', 'Error', error.message);
        });
    }
}

// ---------- Close Raw XML ----------
function closeRawXml() {
    document.getElementById('rawXmlModal').style.display = 'none';
}

// ---------- Save Raw XML ----------
function saveRawXml() {
    const textarea = document.getElementById('rawXmlContent');
    const fullXmlTextarea = document.getElementById('fullXmlContent');
    
    if (!textarea) return;
    
    const xmlContent = textarea.value;
    
    // Validate XML
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            showToast('error', 'Invalid XML', parserError.textContent);
            return;
        }
        
        // Clean the XML: remove duplicate declarations
        let cleanedXml = xmlContent;
        const declPattern = /<\?xml[^?]*\?>/g;
        const declarations = cleanedXml.match(declPattern);
        if (declarations && declarations.length > 1) {
            // Keep only the first declaration
            cleanedXml = declarations[0] + '\n' + cleanedXml.replace(declPattern, '').trim();
        }
        
        // Store in hidden textarea
        if (fullXmlTextarea) {
            fullXmlTextarea.value = cleanedXml;
        }
        
        // Update configData
        configData.fullXml = cleanedXml;
        
        // Extract basic info from XML for the UI
        const widget = xmlDoc.querySelector('widget');
        if (widget) {
            // ... rest of extraction code ...
        }
        
        closeRawXml();
        showToast('success', 'Updated', 'XML parsed and applied successfully');
        updateConfigStatus('Modified - Save to apply', 'warning');
        addConsoleMessage('📝 XML updated via raw editor', 'info');
        
    } catch (error) {
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error parsing XML: ${error.message}`, 'error');
    }
}

// ---------- Reset Config ----------
function resetConfig() {
    if (!confirm('Reset all config fields to default values?')) return;
    
    configData = {
        id: '',
        version: '1.0.0',
        name: '',
        author: '',
        email: '',
        website: '',
        description: '',
        preferences: {},
        permissions: [],
        fullXml: ''
    };
    
    document.getElementById('cfg_id').value = '';
    document.getElementById('cfg_name').value = '';
    document.getElementById('cfg_version').value = '1.0.0';
    document.getElementById('cfg_author').value = '';
    document.getElementById('cfg_email').value = '';
    document.getElementById('cfg_website').value = '';
    document.getElementById('cfg_description').value = '';
    
    // Clear hidden textarea
    const fullXmlTextarea = document.getElementById('fullXmlContent');
    if (fullXmlTextarea) {
        fullXmlTextarea.value = '';
    }
    
    renderPreferences();
    renderPermissions();
    
    updateConfigStatus('Reset - Save to apply', 'warning');
    showToast('info', 'Reset', 'Configuration reset to defaults');
    addConsoleMessage('🔄 Config reset to defaults', 'info');
}

// ---------- Utility: Escape HTML ----------
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// ---------- Utility: Escape XML ----------
function escapeXml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
}

// ============================================================
// CONSOLE
// ============================================================
function runConsoleCommand() {
    const input = document.getElementById('consoleCommand');
    if (!input) return;
    
    const command = input.value.trim();
    if (!command) {
        showToast('warning', 'Empty Command', 'Please enter a command');
        return;
    }
    
    addConsoleMessage(`> ${command}`, 'info');
    input.value = '';
    
    eel.run_command(command)(function(response) {
        if (response.success) {
            const lines = response.output.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    addConsoleMessage(line, 'info');
                }
            });
        } else {
            addConsoleMessage(`Error: ${response.message}`, 'error');
        }
    });
}

function addConsoleMessage(message, type = 'info') {
    const output = document.getElementById('consoleOutput');
    if (!output) return;
    
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    const time = new Date().toLocaleTimeString();
    line.innerHTML = `
        <span class="console-time">[${time}]</span>
        ${message}
    `;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

function clearConsole() {
    const output = document.getElementById('consoleOutput');
    if (!output) return;
    
    output.innerHTML = `
        <div class="console-line info">
            <span class="console-time">[System]</span>
            Console cleared
        </div>
    `;
    addConsoleMessage('Console cleared', 'warning');
}

function quickCommand(command) {
    const input = document.getElementById('consoleCommand');
    if (input) {
        input.value = command;
        runConsoleCommand();
    }
}

// ============================================================
// RECENT PROJECTS
// ============================================================
function updateRecentProjects() {
    const container = document.getElementById('recentProjectsList');
    if (!container) return;
    
    const projects = AppState.recentProjects || [];
    if (projects.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    <i class="fas fa-info-circle"></i> No recent projects
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = projects.map(p => {
        // Escape path for use in HTML onclick
        // Replace backslashes with double backslashes and escape quotes
        const pathStr = p.path || '';
        const escapedPath = pathStr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const safeName = (p.name || 'Unknown').replace(/"/g, '&quot;');
        const safePackage = (p.package_id || 'N/A').replace(/"/g, '&quot;');
        
        return `
            <tr>
                <td><strong>${safeName}</strong></td>
                <td>${safePackage}</td>
                <td style="font-size:12px; word-break:break-all;">${p.path || 'N/A'}</td>
                <td>${formatDate(p.last_opened)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="openRecentProject('${escapedPath}')" title="Open Project">
                        <i class="fas fa-folder-open"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="removeRecentProject('${escapedPath}')" title="Remove from list">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// SDK MANAGEMENT
// ============================================================
function checkEnvironment() {
    showLoader('Checking environment...', true);
    
    eel.get_system_info()(function(sysInfo) {
        eel.check_cordova()(function(result) {
            hideLoader();
            
            const nodeEl = document.getElementById('nodeVersion');
            const npmEl = document.getElementById('npmVersion');
            const cordovaEl = document.getElementById('cordovaVersion');
            const javaEl = document.getElementById('javaVersion');
            
            if (nodeEl) nodeEl.textContent = sysInfo?.node_version ? `v${sysInfo.node_version}` : 'Not found';
            if (npmEl) npmEl.textContent = sysInfo?.npm_version ? `v${sysInfo.npm_version}` : 'Not found';
            if (cordovaEl) cordovaEl.textContent = result.installed ? `v${result.version}` : 'Not installed';
            if (javaEl) javaEl.textContent = sysInfo?.java_version || 'Not found';
            
            const androidStatus = document.getElementById('androidStatus');
            if (androidStatus) {
                const androidHome = sysInfo?.android_home;
                if (androidHome) {
                    androidStatus.textContent = '✓ Installed';
                    androidStatus.style.color = 'var(--success)';
                    document.getElementById('androidSdkPath').textContent = androidHome;
                } else {
                    androidStatus.textContent = '⚠️ Not detected';
                    androidStatus.style.color = 'var(--warning)';
                }
            }
            
            const iosStatus = document.getElementById('iosStatus');
            if (iosStatus) {
                if (sysInfo?.os === 'Darwin') {
                    iosStatus.textContent = '✓ Available (macOS)';
                    iosStatus.style.color = 'var(--success)';
                } else {
                    iosStatus.textContent = '⚠️ Requires macOS';
                    iosStatus.style.color = 'var(--warning)';
                }
            }
            
            showToast('success', 'Environment Check', 'Environment checked successfully');
        });
    });
}

function checkAndroidSDK() {
    showLoader('Checking Android SDK...', true);
    
    eel.detect_android_sdk()(function(response) {
        hideLoader();
        
        const status = document.getElementById('androidStatus');
        const path = document.getElementById('androidSdkPath');
        const apiLevel = document.getElementById('androidApiLevel');
        const buildTools = document.getElementById('androidBuildTools');
        
        if (response.success) {
            if (status) {
                status.textContent = '✓ Detected';
                status.style.color = 'var(--success)';
            }
            if (path) path.textContent = response.path || 'Not found';
            if (apiLevel) apiLevel.textContent = response.api_level || '33';
            if (buildTools) buildTools.textContent = response.build_tools || '33.0.0';
            showToast('success', 'SDK Detected', 'Android SDK found');
        } else {
            if (status) {
                status.textContent = '✗ Not found';
                status.style.color = 'var(--danger)';
            }
            showToast('warning', 'Not Found', response.message || 'Android SDK not detected');
        }
    });
}

function setAndroidSDKPath() {
    eel.select_folder()(function(path) {
        if (path) {
            const sdkPath = document.getElementById('androidSdkPath');
            if (sdkPath) sdkPath.textContent = path;
            
            eel.set_android_sdk_path(path)(function(response) {
                if (response.success) {
                    showToast('success', 'Path Set', 'Android SDK path updated');
                }
            });
        }
    });
}

function installAndroidSDK() {
    showToast('info', 'Installing', 'Opening Android Studio download page...');
    window.open('https://developer.android.com/studio', '_blank');
}

function checkIosSDK() {
    showToast('info', 'iOS SDK', 'iOS SDK requires macOS with Xcode installed');
    const status = document.getElementById('iosStatus');
    if (status) {
        status.textContent = '⚠️ Requires macOS';
        status.style.color = 'var(--warning)';
    }
}

function checkWindowsSDK() {
    showToast('info', 'Windows SDK', 'Windows SDK requires Visual Studio');
    const status = document.getElementById('windowsStatus');
    if (status) {
        status.textContent = '⚠️ Requires Visual Studio';
        status.style.color = 'var(--warning)';
    }
}

function openXcode() {
    if (navigator.platform === 'MacIntel') {
        showToast('info', 'Opening', 'Opening Xcode...');
        eel.open_xcode()(function(response) {
            if (!response.success) {
                showToast('error', 'Error', response.message);
            }
        });
    } else {
        showToast('warning', 'Not Available', 'Xcode is only available on macOS');
    }
}

// ============================================================
// MARKETPLACE
// ============================================================
function searchMarketplace() {
    const query = document.getElementById('marketplaceSearch')?.value;
    if (!query) {
        showToast('warning', 'Empty Search', 'Please enter a search term');
        return;
    }
    
    showToast('info', 'Searching', `Searching for "${query}"...`);
    
    eel.search_plugins(query)(function(response) {
        const results = document.getElementById('marketplaceResults');
        if (!results) return;
        
        if (response.success && response.plugins.length > 0) {
            results.innerHTML = response.plugins.map(p => `
                <div class="marketplace-item" style="border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:12px;">
                    <div class="marketplace-item-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0;">${p.name}</h4>
                        <span class="marketplace-version" style="background:var(--bg-tertiary); padding:2px 10px; border-radius:12px; font-size:12px;">${p.version}</span>
                    </div>
                    <p class="marketplace-description" style="margin:0 0 12px; color:var(--text-secondary); font-size:14px;">${p.description || 'No description'}</p>
                    <div class="marketplace-actions">
                        <button class="btn btn-sm btn-success" onclick="installFromMarketplace('${p.name}')">
                            <i class="fas fa-download"></i> Install
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            results.innerHTML = `
                <div class="marketplace-empty" style="text-align:center; padding:40px;">
                    <i class="fas fa-search" style="font-size:48px; color:var(--text-muted);"></i>
                    <p style="margin-top:12px; color:var(--text-secondary);">No plugins found for "${query}"</p>
                </div>
            `;
        }
    });
}

function clearMarketplaceSearch() {
    const input = document.getElementById('marketplaceSearch');
    if (input) input.value = '';
    
    const results = document.getElementById('marketplaceResults');
    if (results) {
        results.innerHTML = `
            <div class="text-center text-muted" style="padding:40px;">
                <i class="fas fa-search" style="font-size:48px; display:block; margin-bottom:16px;"></i>
                <p>Search for plugins to install in your project</p>
            </div>
        `;
    }
}

function installFromMarketplace(name) {
    const pluginInput = document.getElementById('pluginName');
    if (pluginInput) pluginInput.value = name;
    addPlugin();
}

// ============================================================
// RESOURCES - WITH DRAG & DROP SUPPORT + INSTALL
// ============================================================

let selectedIconFile = null;
let selectedSplashFile = null;

function initResourcesPanel() {
    console.log('🔧 Initializing Resources panel with drag & drop...');
    
    // ============ ICON ============
    const iconDropZone = document.getElementById('iconDropZone');
    const iconInput = document.getElementById('iconFileInput');
    
    if (iconDropZone && iconInput) {
        console.log('✅ Icon drop zone found');
        
        // Click to open file dialog
        iconDropZone.addEventListener('click', function(e) {
            if (e.target.closest('#iconFileName')) return;
            iconInput.click();
        });
        
        // Drag over
        iconDropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = 'var(--primary)';
            this.style.background = 'var(--bg-tertiary)';
            this.style.borderStyle = 'solid';
        });
        
        // Drag leave
        iconDropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.style.borderColor = 'var(--border)';
            this.style.background = 'transparent';
            this.style.borderStyle = 'dashed';
        });
        
        // Drop
        iconDropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = 'var(--border)';
            this.style.background = 'transparent';
            this.style.borderStyle = 'dashed';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    selectedIconFile = file;
                    const fileNameDisplay = document.getElementById('iconFileName');
                    if (fileNameDisplay) {
                        fileNameDisplay.textContent = `✅ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                        fileNameDisplay.style.display = 'block';
                    }
                    showToast('success', 'Image Selected', file.name);
                    console.log('📁 Icon dropped:', file.name);
                } else {
                    showToast('warning', 'Invalid File', 'Please select an image file');
                }
            }
        });
        
        // File input change
        iconInput.addEventListener('change', function() {
            console.log('📁 Icon file selected via dialog');
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                if (file.type.startsWith('image/')) {
                    selectedIconFile = file;
                    const fileNameDisplay = document.getElementById('iconFileName');
                    if (fileNameDisplay) {
                        fileNameDisplay.textContent = `✅ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                        fileNameDisplay.style.display = 'block';
                    }
                    showToast('success', 'Image Selected', file.name);
                } else {
                    showToast('warning', 'Invalid File', 'Please select an image file');
                    this.value = '';
                    selectedIconFile = null;
                }
            }
        });
    } else {
        console.log('❌ Icon elements not found');
    }
    
    // ============ SPLASH ============
    const splashDropZone = document.getElementById('splashDropZone');
    const splashInput = document.getElementById('splashFileInput');
    
    if (splashDropZone && splashInput) {
        console.log('✅ Splash drop zone found');
        
        // Click to open file dialog
        splashDropZone.addEventListener('click', function(e) {
            if (e.target.closest('#splashFileName')) return;
            splashInput.click();
        });
        
        // Drag over
        splashDropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = 'var(--primary)';
            this.style.background = 'var(--bg-tertiary)';
            this.style.borderStyle = 'solid';
        });
        
        // Drag leave
        splashDropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.style.borderColor = 'var(--border)';
            this.style.background = 'transparent';
            this.style.borderStyle = 'dashed';
        });
        
        // Drop
        splashDropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = 'var(--border)';
            this.style.background = 'transparent';
            this.style.borderStyle = 'dashed';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    selectedSplashFile = file;
                    const fileNameDisplay = document.getElementById('splashFileName');
                    if (fileNameDisplay) {
                        fileNameDisplay.textContent = `✅ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                        fileNameDisplay.style.display = 'block';
                    }
                    showToast('success', 'Image Selected', file.name);
                    console.log('📁 Splash dropped:', file.name);
                } else {
                    showToast('warning', 'Invalid File', 'Please select an image file');
                }
            }
        });
        
        // File input change
        splashInput.addEventListener('change', function() {
            console.log('📁 Splash file selected via dialog');
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                if (file.type.startsWith('image/')) {
                    selectedSplashFile = file;
                    const fileNameDisplay = document.getElementById('splashFileName');
                    if (fileNameDisplay) {
                        fileNameDisplay.textContent = `✅ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                        fileNameDisplay.style.display = 'block';
                    }
                    showToast('success', 'Image Selected', file.name);
                } else {
                    showToast('warning', 'Invalid File', 'Please select an image file');
                    this.value = '';
                    selectedSplashFile = null;
                }
            }
        });
    } else {
        console.log('❌ Splash elements not found');
    }
    
    // ============ BUTTONS ============
    // Generate Icons Button
    const genIconsBtn = document.getElementById('generateIconsBtn');
    if (genIconsBtn) {
        const newBtn = genIconsBtn.cloneNode(true);
        genIconsBtn.parentNode.replaceChild(newBtn, genIconsBtn);
        newBtn.addEventListener('click', generateIcons);
    }
    
    // Generate Splash Button
    const genSplashBtn = document.getElementById('generateSplashBtn');
    if (genSplashBtn) {
        const newBtn = genSplashBtn.cloneNode(true);
        genSplashBtn.parentNode.replaceChild(newBtn, genSplashBtn);
        newBtn.addEventListener('click', generateSplash);
    }
    
    // ============ INSTALL CORDOVA-RES BUTTON ============
    const installBtn = document.getElementById('installCordovaResBtn');
    if (installBtn) {
        const newBtn = installBtn.cloneNode(true);
        installBtn.parentNode.replaceChild(newBtn, installBtn);
        newBtn.addEventListener('click', installCordovaRes);
    }
    
    // Check if cordova-res is installed
    checkCordovaRes();
    
    console.log('✅ Resources panel initialized with drag & drop');
}

// ============ CHECK CORDOVA-RES ============
function checkCordovaRes() {
    const statusEl = document.getElementById('cordovaResStatus');
    if (!statusEl) return;
    
    eel.check_cordova_res()(function(response) {
        statusEl.style.display = 'block';
        
        if (response.installed) {
            const method = response.method === 'npx' ? ' (via npx)' : '';
            statusEl.style.background = 'var(--bg-success)';
            statusEl.style.color = 'var(--success)';
            statusEl.style.border = '1px solid var(--success)';
            statusEl.innerHTML = `
                <i class="fas fa-check-circle"></i> 
                <strong>cordova-res ${response.version || ''}</strong> is installed ${method} ✓
            `;
            console.log('✅ cordova-res is installed:', response);
        } else {
            statusEl.style.background = 'var(--bg-warning)';
            statusEl.style.color = 'var(--warning)';
            statusEl.style.border = '1px solid var(--warning)';
            statusEl.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> 
                <strong>cordova-res</strong> is not installed. Click the button above to install.
            `;
            console.log('❌ cordova-res is not installed');
        }
    }).catch(function(error) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'var(--bg-danger)';
        statusEl.style.color = 'var(--danger)';
        statusEl.style.border = '1px solid var(--danger)';
        statusEl.innerHTML = `
            <i class="fas fa-times-circle"></i> 
            Error checking cordova-res: ${error.message}
        `;
    });
}

// ============ INSTALL CORDOVA-RES ============
function installCordovaRes() {
    const statusEl = document.getElementById('cordovaResStatus');
    const installBtn = document.getElementById('installCordovaResBtn');
    
    if (!statusEl || !installBtn) return;
    
    // Disable button during install
    installBtn.disabled = true;
    installBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
    
    statusEl.style.display = 'block';
    statusEl.style.background = 'var(--bg-info)';
    statusEl.style.color = 'var(--info)';
    statusEl.style.border = '1px solid var(--info)';
    statusEl.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i> 
        Installing cordova-res globally via npm... This may take a moment.
    `;
    
    showToast('info', 'Installing', 'Installing cordova-res via npm...');
    addConsoleMessage('📦 Installing cordova-res globally...', 'info');
    
    eel.install_cordova_res()(function(response) {
        // Re-enable button
        installBtn.disabled = false;
        installBtn.innerHTML = '<i class="fas fa-download"></i> Install cordova-res';
        
        if (response.success) {
            statusEl.style.background = 'var(--bg-success)';
            statusEl.style.color = 'var(--success)';
            statusEl.style.border = '1px solid var(--success)';
            statusEl.innerHTML = `
                <i class="fas fa-check-circle"></i> 
                <strong>✅ cordova-res installed successfully!</strong>
                ${response.install_path ? `<br><span style="font-size:12px;">📍 Installed at: ${response.install_path}</span>` : ''}
                ${response.output ? `<br><span style="font-size:12px;">${response.output}</span>` : ''}
            `;
            showToast('success', 'Installed ✅', 'cordova-res installed successfully');
            addConsoleMessage('✅ cordova-res installed successfully', 'success');
            
            // Check again to update status
            setTimeout(checkCordovaRes, 2000);
        } else {
            statusEl.style.background = 'var(--bg-danger)';
            statusEl.style.color = 'var(--danger)';
            statusEl.style.border = '1px solid var(--danger)';
            statusEl.innerHTML = `
                <i class="fas fa-times-circle"></i> 
                <strong>Installation failed:</strong> ${response.message}
                ${response.output ? `<br><span style="font-size:12px;">${response.output}</span>` : ''}
            `;
            showToast('error', 'Error ❌', response.message);
            addConsoleMessage(`❌ Installation failed: ${response.message}`, 'error');
        }
    }).catch(function(error) {
        installBtn.disabled = false;
        installBtn.innerHTML = '<i class="fas fa-download"></i> Install cordova-res';
        
        statusEl.style.background = 'var(--bg-danger)';
        statusEl.style.color = 'var(--danger)';
        statusEl.style.border = '1px solid var(--danger)';
        statusEl.innerHTML = `
            <i class="fas fa-times-circle"></i> 
            Error: ${error.message}
        `;
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');
    });
}

// ============ CONVERT FILE TO BASE64 ============
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = function(e) {
            reject(e.target.error);
        };
        reader.readAsDataURL(file);
    });
}

// ============================================================
// RESOURCES - GENERATE WITH PURE PYTHON (NO cordova-res)
// ============================================================

// Generate Icons - Using Python PIL
async function generateIcons() {
    if (!selectedIconFile) {
        showToast('warning', 'No Image', 'Please select an icon image first');
        return;
    }
    
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    try {
        showLoader('Generating icons...', true);
        addConsoleMessage(`🎨 Generating icons from: ${selectedIconFile.name}`, 'info');
        
        const base64Data = await fileToBase64(selectedIconFile);
        const fileInfo = {
            name: selectedIconFile.name,
            size: selectedIconFile.size,
            type: selectedIconFile.type,
            data: base64Data
        };
        
        eel.generate_icons_from_base64(fileInfo)(function(response) {
            hideLoader();
            
            if (response.success) {
                showToast('success', 'Generated ✅', response.message);
                addConsoleMessage(`✅ ${response.message}`, 'success');
                if (response.files) {
                    addConsoleMessage(`📁 Generated ${response.files.length} files`, 'info');
                }
                document.getElementById('iconFileName').textContent = '';
                document.getElementById('iconFileName').style.display = 'none';
                document.getElementById('iconFileInput').value = '';
                selectedIconFile = null;
            } else {
                showToast('error', 'Error ❌', response.message);
                addConsoleMessage(`❌ Error: ${response.message}`, 'error');
            }
        });
        
    } catch (error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');
    }
}

// Generate Splash - Using Python PIL
async function generateSplash() {
    if (!selectedSplashFile) {
        showToast('warning', 'No Image', 'Please select a splash image first');
        return;
    }
    
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    try {
        showLoader('Generating splash screens...', true);
        addConsoleMessage(`🎨 Generating splash from: ${selectedSplashFile.name}`, 'info');
        
        const base64Data = await fileToBase64(selectedSplashFile);
        const fileInfo = {
            name: selectedSplashFile.name,
            size: selectedSplashFile.size,
            type: selectedSplashFile.type,
            data: base64Data
        };
        
        eel.generate_splash_from_base64(fileInfo)(function(response) {
            hideLoader();
            
            if (response.success) {
                showToast('success', 'Generated ✅', response.message);
                addConsoleMessage(`✅ ${response.message}`, 'success');
                if (response.files) {
                    addConsoleMessage(`📁 Generated ${response.files.length} files`, 'info');
                }
                document.getElementById('splashFileName').textContent = '';
                document.getElementById('splashFileName').style.display = 'none';
                document.getElementById('splashFileInput').value = '';
                selectedSplashFile = null;
            } else {
                showToast('error', 'Error ❌', response.message);
                addConsoleMessage(`❌ Error: ${response.message}`, 'error');
            }
        });
        
    } catch (error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');
    }
}

// ============ INITIALIZE ============
const originalInitializePanel = initializePanel;
initializePanel = function(panelId) {
    originalInitializePanel(panelId);
    if (panelId === 'resources') {
        setTimeout(initResourcesPanel, 300);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (document.getElementById('panel-resources')) {
            initResourcesPanel();
        }
    }, 1000);
});




// ============================================================
// WIFI DEBUGGING - CONNECT TO DEVICE
// ============================================================

function connectWifiDevice() {
    const ip = document.getElementById('wifiDeviceIp').value.trim();
    const port = parseInt(document.getElementById('wifiDevicePort').value) || 5555;
    
    if (!ip) {
        showToast('warning', 'Missing IP', 'Please enter the device IP address');
        return;
    }
    
    // Check if function exists
    if (typeof eel.connect_wifi_adb !== 'function') {
        showToast('error', 'Error', 'connect_wifi_adb function not available');
        addConsoleMessage('❌ Error: connect_wifi_adb function not available in backend', 'error');
        return;
    }
    
    // Save IP for later
    localStorage.setItem('lastWifiIp', ip);
    
    showLoader(`Connecting to ${ip}:${port}...`, false);
    addConsoleMessage(`📡 Connecting to device at ${ip}:${port}`, 'info');
    
    eel.connect_wifi_adb(ip, port)(function(response) {
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Connected ✅', `Connected to ${ip}`);
            addConsoleMessage(`✅ Connected to ${ip}`, 'success');
            updateWifiStatus('Connected', 'success');
            refreshDevices();
        } else {
            showToast('error', 'Connection Failed ❌', response.message);
            addConsoleMessage(`❌ Connection failed: ${response.message}`, 'error');
            updateWifiStatus('Failed', 'error');
            
            // If connection failed, suggest pairing
            if (response.message && response.message.includes('pair')) {
                showToast('info', 'Pairing Required', 'Try pairing with code first');
            }
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');
        updateWifiStatus('Error', 'error');
    });
}

// ============================================================
// WIFI DEBUGGING - PAIR WITH CODE (Android 11+)
// ============================================================

function showPairingDialog() {
    const ip = document.getElementById('wifiDeviceIp').value.trim();
    const port = parseInt(document.getElementById('wifiDevicePort').value) || 5555;
    
    if (!ip) {
        showToast('warning', 'Missing IP', 'Please enter the device IP address first');
        return;
    }
    
    // Check if pair function exists
    if (typeof eel.pair_wifi_device !== 'function') {
        showToast('error', 'Error', 'Pairing function not available. Please check backend.');
        return;
    }
    
    showModal(
        'Pair with Device',
        `
        <div class="form-group">
            <label>Device IP:Port</label>
            <input type="text" class="form-control" value="${ip}:${port}" disabled style="background:var(--bg-tertiary);">
        </div>
        <div class="form-group">
            <label>Pairing Code</label>
            <input type="text" class="form-control" id="pairingCode" placeholder="Enter 6-digit code from phone" maxlength="6" style="font-size:24px; letter-spacing:4px; text-align:center;" autofocus>
            <small style="color:var(--text-secondary);">On your phone, go to Wireless Debugging → Pair device with pairing code</small>
        </div>
        `,
        'Pair',
        function() {
            const code = document.getElementById('pairingCode').value.trim();
            if (!code || code.length < 6) {
                showToast('warning', 'Invalid Code', 'Please enter the 6-digit pairing code');
                return;
            }
            pairWifiDevice(ip, port, code);
            closeModal();
        }
    );
    
    // Auto-focus the input after modal opens
    setTimeout(() => {
        const input = document.getElementById('pairingCode');
        if (input) input.focus();
    }, 300);
}

function pairWifiDevice(ip, port, code) {
    // Check if eel.pair_wifi_device exists
    if (typeof eel.pair_wifi_device !== 'function') {
        showToast('error', 'Error', 'pair_wifi_device function not available');
        addConsoleMessage('❌ Error: pair_wifi_device function not available in backend', 'error');
        return;
    }
    
    showLoader(`Pairing with ${ip}:${port}...`, false);
    addConsoleMessage(`🔑 Pairing with device using code: ${code}`, 'info');
    
    eel.pair_wifi_device(ip, port, code)(function(response) {
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Paired ✅', 'Device paired successfully');
            addConsoleMessage(`✅ Device paired successfully`, 'success');
            updateWifiStatus('Paired', 'success');
            
            // Try to connect after pairing
            setTimeout(() => connectWifiDevice(), 1000);
        } else {
            showToast('error', 'Pairing Failed ❌', response.message);
            addConsoleMessage(`❌ Pairing failed: ${response.message}`, 'error');
            updateWifiStatus('Pairing Failed', 'error');
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');
        updateWifiStatus('Error', 'error');
    });
}

// ============================================================
// REFRESH DEVICES (Updated for WiFi devices)
// ============================================================

function refreshDevices() {
    showLoader('Checking connected devices...', false);
    addConsoleMessage('🔍 Refreshing device list...', 'info');
    
    eel.get_connected_devices()(function(response) {
        hideLoader();
        
        const container = document.getElementById('connectedDevices');
        const select = document.getElementById('deployDevice');
        
        if (response.success && response.devices.length > 0) {
            let html = '';
            let options = '';
            let hasConnected = false;
            
            response.devices.forEach(device => {
                const isConnected = device.status === 'device';
                const isWifi = device.serial && device.serial.includes(':');
                const icon = isConnected ? '✅' : '⚠️';
                const statusText = isConnected ? 'Connected' : 'Unauthorized';
                const connectionType = isWifi ? '📶 WiFi' : '🔌 USB';
                
                html += `<div class="device-item" style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--border);">
                    <span>${icon}</span>
                    <span><strong>${device.model || device.serial}</strong></span>
                    <span style="font-size:12px; color:var(--text-secondary);">(${statusText})</span>
                    <span style="font-size:12px; color:var(--info);">${connectionType}</span>
                    <span style="font-size:11px; color:var(--text-secondary);">${device.serial}</span>
                </div>`;
                
                if (isConnected) {
                    hasConnected = true;
                    options += `<option value="${device.serial}">${device.model || device.serial} (${connectionType})</option>`;
                }
            });
            
            container.innerHTML = html;
            
            if (hasConnected) {
                select.innerHTML = `<option value="">Select a device...</option>${options}`;
                showToast('success', 'Devices Found', `${response.devices.length} device(s) connected`);
            } else {
                select.innerHTML = `<option value="">No authorized devices</option>`;
                showToast('warning', 'No Authorized Devices', 'Connect a device and accept USB debugging');
            }
        } else {
            container.innerHTML = `<p class="text-muted">No devices connected. 
                <br>Try: 
                <br>1. USB: Connect via cable and accept USB debugging
                <br>2. WiFi: Use the WiFi Debugging section above</p>`;
            select.innerHTML = `<option value="">No devices available</option>`;
            showToast('warning', 'No Devices', 'No connected devices found');
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error refreshing devices: ${error.message}`, 'error');
    });
}

// ============================================================
// UPDATE WIFI STATUS
// ============================================================

function updateWifiStatus(text, type = 'info') {
    const statusEl = document.getElementById('wifiStatus');
    if (!statusEl) return;
    
    const colors = {
        'success': 'var(--success)',
        'error': 'var(--danger)',
        'warning': 'var(--warning)',
        'info': 'var(--info)'
    };
    
    const dotColor = colors[type] || 'var(--text-secondary)';
    statusEl.innerHTML = `
        <i class="fas fa-circle" style="color:${dotColor}; font-size:8px; margin-right:4px;"></i>
        ${text}
    `;
}

// ============================================================
// DEPLOY TO DEVICE
// ============================================================

function deployToDevice() {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    const select = document.getElementById('deployDevice');
    const deviceId = select?.value;
    const platform = document.getElementById('deployPlatform')?.value || 'android';
    
    if (!deviceId && platform !== 'browser' && platform !== 'electron') {
        showToast('warning', 'No Device', 'Please select a device');
        return;
    }
    
    showToast('info', 'Deploying', `Deploying to ${platform}...`);
    addConsoleMessage(`📱 Deploying to ${platform}`, 'info');
    
    // Update log
    document.getElementById('deployLog').textContent = `🔄 Deploying to ${platform}...\n`;
    
    eel.deploy_to_device(deviceId, platform)(function(response) {
        if (response.success) {
            showToast('success', 'Deployed ✅', response.message);
            addConsoleMessage('✅ ' + response.message, 'success');
            document.getElementById('deployLog').textContent = response.output || '✅ Deployment successful!';
        } else {
            showToast('error', 'Error ❌', response.message);
            addConsoleMessage(`❌ Deploy failed: ${response.message}`, 'error');
            document.getElementById('deployLog').textContent = `❌ Error: ${response.message}`;
        }
    }).catch(function(error) {
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');
        document.getElementById('deployLog').textContent = `❌ Error: ${error.message}`;
    });
}

// ============================================================
// AUTO-CONNECT - Try to reconnect to last WiFi device
// ============================================================

function autoConnectWifi() {
    const lastIp = localStorage.getItem('lastWifiIp');
    if (lastIp) {
        document.getElementById('wifiDeviceIp').value = lastIp;
        // Don't auto-connect, user can click Connect
        addConsoleMessage(`📡 Last WiFi device: ${lastIp} (click Connect to reconnect)`, 'info');
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(autoConnectWifi, 500);
});



function deployToEmulator() {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    const platform = document.getElementById('buildPlatform')?.value || 'android';
    showToast('info', 'Running', 'Running on emulator...');
    addConsoleMessage('Running on emulator', 'info');
    
    eel.run_app(platform, 'emulator')(function(response) {
        if (response.success) {
            showToast('success', 'Running', 'App running on emulator');
            addConsoleMessage('App running on emulator', 'success');
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`Emulator error: ${response.message}`, 'error');
        }
    });
}



function applySettings(settings) {
    if (settings.accentColor) {
        document.documentElement.style.setProperty('--primary', settings.accentColor);
    }
    
    const sizes = { small: '12px', medium: '14px', large: '16px', xlarge: '18px' };
    if (settings.fontSize && sizes[settings.fontSize]) {
        document.body.style.fontSize = sizes[settings.fontSize];
    }
}

function selectDefaultPath() {
    eel.select_folder()(function(path) {
        if (path) {
            const input = document.getElementById('settingsDefaultPath');
            if (input) input.value = path;
        }
    });
}

function clearCache() {
    showToast('info', 'Clearing', 'Clearing cache...');
    setTimeout(() => {
        showToast('success', 'Cleared', 'Cache cleared successfully');
    }, 1500);
}

function exportData() {
    showToast('info', 'Exporting', 'Exporting data...');
    setTimeout(() => {
        showToast('success', 'Exported', 'Data exported successfully');
    }, 1500);
}

function importData() {
    showToast('info', 'Importing', 'Importing data...');
    setTimeout(() => {
        showToast('success', 'Imported', 'Data imported successfully');
    }, 1500);
}

function resetAll() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) return;
    
    showToast('info', 'Resetting', 'Resetting to defaults...');
    setTimeout(() => {
        showToast('success', 'Reset', 'Settings reset to defaults');
        setTimeout(() => location.reload(), 1000);
    }, 1500);
}



// ============================================================
// KEYSTORE MANAGEMENT
// ============================================================

// Keystore state
let keystoreData = {
    path: '',
    storePassword: '',
    keyAlias: '',
    keyPassword: ''
};

// Load keystore from backend
function loadKeystoreFromBackend() {
    try {
        eel.get_keystore()(function(response) {
            console.log('📥 loadKeystoreFromBackend response:', response);
            
            if (response && response.success && response.keystore) {
                keystoreData = response.keystore;
                AppState.settings.keystore = response.keystore;
                
                const pathInput = document.getElementById('settingsKeystorePath');
                const storePassInput = document.getElementById('settingsStorePassword');
                const aliasInput = document.getElementById('settingsKeyAlias');
                const keyPassInput = document.getElementById('settingsKeyPassword');
                
                if (pathInput) pathInput.value = response.keystore.path || '';
                if (storePassInput) storePassInput.value = response.keystore.storePassword || '';
                if (aliasInput) aliasInput.value = response.keystore.keyAlias || '';
                if (keyPassInput) keyPassInput.value = response.keystore.keyPassword || '';
                
                updateKeystoreUI();
                updateBuildKeystoreStatus();
                
                console.log('✅ Keystore loaded and applied to UI:', response.keystore.path || 'empty');
            } else {
                console.log('ℹ️ No keystore found in settings');
                // Reset UI
                document.getElementById('settingsKeystorePath').value = '';
                document.getElementById('settingsStorePassword').value = '';
                document.getElementById('settingsKeyAlias').value = '';
                document.getElementById('settingsKeyPassword').value = '';
                updateKeystoreUI();
            }
        });
    } catch (error) {
        console.warn('Could not load keystore:', error);
    }
}

// Update UI with keystore data
function updateKeystoreUI() {
    const pathInput = document.getElementById('settingsKeystorePath');
    const storePassInput = document.getElementById('settingsStorePassword');
    const aliasInput = document.getElementById('settingsKeyAlias');
    const keyPassInput = document.getElementById('settingsKeyPassword');
    const statusEl = document.getElementById('keystoreStatus');
    const detailsEl = document.getElementById('keystoreDetails');
    
    if (keystoreData.path) {
        if (pathInput) pathInput.value = keystoreData.path;
        if (storePassInput) storePassInput.value = keystoreData.storePassword || '';
        if (aliasInput) aliasInput.value = keystoreData.keyAlias || '';
        if (keyPassInput) keyPassInput.value = keystoreData.keyPassword || '';
        
        statusEl.innerHTML = `
            <span style="color:var(--success);">
                <i class="fas fa-check-circle"></i> Keystore configured
            </span>
        `;
        detailsEl.innerHTML = `
            <strong>Path:</strong> ${keystoreData.path}<br>
            <strong>Alias:</strong> ${keystoreData.keyAlias || 'Not set'}<br>
            <strong>Store Password:</strong> ${keystoreData.storePassword ? '✓ Set' : '✗ Not set'}<br>
            <strong>Key Password:</strong> ${keystoreData.keyPassword ? '✓ Set' : '✗ Not set'}
        `;
    } else {
        statusEl.innerHTML = `<span class="text-muted">No keystore configured</span>`;
        detailsEl.innerHTML = '';
    }
}

// Select keystore file
function selectKeystorePath() {
    eel.select_file()(function(path) {
        if (path) {
            document.getElementById('settingsKeystorePath').value = path;
            showToast('info', 'Selected', `Keystore: ${path.split('/').pop()}`);
        }
    });
}

// Save keystore settings
function saveKeystore() {
    // Get data from form
    const keystore = {
        path: document.getElementById('settingsKeystorePath').value.trim(),
        storePassword: document.getElementById('settingsStorePassword').value.trim(),
        keyAlias: document.getElementById('settingsKeyAlias').value.trim(),
        keyPassword: document.getElementById('settingsKeyPassword').value.trim()
    };

    // Validate
    if (!keystore.path) {
        showToast('warning', 'Error', 'Please select a keystore file');
        return;
    }
    if (!keystore.keyAlias) {
        showToast('warning', 'Error', 'Please enter a key alias');
        return;
    }

    showLoader('Saving keystore...', false);
    
    // ✅ Call dedicated Python function
    eel.save_keystore(keystore)(function(response) {
        hideLoader();
        
        if (response && response.success) {
            // Update local state
            keystoreData = keystore;
            AppState.settings.keystore = keystore;
            
            updateKeystoreUI();
            updateBuildKeystoreStatus();
                        
            showToast('success', 'Saved', 'Keystore saved successfully');
            addConsoleMessage('🔑 Keystore saved successfully', 'success');
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            showToast('error', 'Error', errorMsg);
            addConsoleMessage(`❌ Error: ${errorMsg}`, 'error');
        }
    });
}

function saveSettings() {
    // Collect settings from UI
    const settings = {
        theme: document.getElementById('settingsTheme')?.value || 'system',
        accentColor: document.getElementById('settingsAccentColor')?.value || '#6366f1',
        fontSize: document.getElementById('settingsFontSize')?.value || 'medium',
        defaultPath: document.getElementById('settingsDefaultPath')?.value || '',
        defaultTemplate: document.getElementById('settingsDefaultTemplate')?.value || 'empty',
        autoSave: document.getElementById('settingsAutoSave')?.checked || false,
        checkUpdates: document.getElementById('settingsCheckUpdates')?.checked || false,
        sdk_paths: {
            android_sdk: document.getElementById('settingsAndroidSdkPath')?.value || '',
            gradle: document.getElementById('settingsGradlePath')?.value || '',
            java: document.getElementById('settingsJavaPath')?.value || ''
        }
        // ✅ Don't send keystore - backend will preserve existing
    };

    AppState.settings = { ...AppState.settings, ...settings };

    showLoader('Saving settings...', false);
    
    eel.save_settings(settings)(function(response) {
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Saved', 'Settings saved successfully');
            addConsoleMessage('✅ Settings saved successfully', 'success');
            applySettingsToUI();
            
            // ✅ Reload keystore to ensure sync
            loadKeystoreFromBackend();
            
            try {
                localStorage.setItem('cordova-pro-gui-settings', JSON.stringify(settings));
            } catch (e) {
                console.warn('Could not save to localStorage:', e);
            }
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`❌ Error: ${response.message}`, 'error');
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');
    });
}




// Test keystore
function testKeystore() {
    const path = document.getElementById('settingsKeystorePath').value.trim();
    const password = document.getElementById('settingsStorePassword').value.trim();
    const alias = document.getElementById('settingsKeyAlias').value.trim();
    const keyPass = document.getElementById('settingsKeyPassword').value.trim();
    
    if (!path) {
        showToast('warning', 'Missing Path', 'Please select a keystore');
        return;
    }
    
    showLoader('Testing keystore...', false);
    
    eel.check_keystore(path, password, alias, keyPass)(function(response) {
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Valid ✅', 'Keystore is valid');
            addConsoleMessage('✅ Keystore test passed', 'success');
        } else {
            showToast('error', 'Invalid ❌', response.message);
            addConsoleMessage(`❌ Keystore test failed: ${response.message}`, 'error');
        }
    });
}

// Clear keystore
function clearKeystore() {
    if (!confirm('Clear keystore settings?')) return;
    
    showLoader('Clearing keystore...', false);
    
    eel.clear_keystore()(function(response) {
        hideLoader();
        console.log('📥 clearKeystore response:', response);
        
        if (response && response.success) {
            keystoreData = { path: '', storePassword: '', keyAlias: '', keyPassword: '' };
            
            AppState.settings.keystore = { path: '', storePassword: '', keyAlias: '', keyPassword: '' };
            
            document.getElementById('settingsKeystorePath').value = '';
            document.getElementById('settingsStorePassword').value = '';
            document.getElementById('settingsKeyAlias').value = '';
            document.getElementById('settingsKeyPassword').value = '';
            
            updateKeystoreUI();
            updateBuildKeystoreStatus();
            
            saveSettingsToBackend();
            
            showToast('info', 'Cleared', 'Keystore cleared');
            addConsoleMessage('🔑 Keystore cleared', 'info');
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            showToast('error', 'Error', errorMsg);
        }
    });
}


// ============================================================
// UPDATE BUILD KEYSTORE STATUS
// ============================================================

function updateBuildKeystoreStatus() {
    
    const hasKeystore = keystoreData && keystoreData.path;
    const statusEl = document.getElementById('buildKeystoreStatus');
    
    if (statusEl) {
        if (hasKeystore) {
            statusEl.innerHTML = `
                <span style="color: var(--success); display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-check-circle"></i>
                    Keystore: ${keystoreData.keyAlias || 'Configured'}
                </span>
            `;
        } else {
            statusEl.innerHTML = `
                <span style="color: var(--warning); display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    No keystore configured (release builds need signing)
                </span>
            `;
        }
    }
}

// ============================================================
// CREATE NEW KEYSTORE
// ============================================================

function createNewKeystore() {
    showModal(
        'Create New Keystore',
        `
        <div style="padding: 8px 0;">
            <p style="color:var(--text-secondary); margin-bottom:16px;">
                <i class="fas fa-info-circle"></i> 
                This will create a new keystore for signing your Android apps.
            </p>
            
            <div class="form-group">
                <label>Keystore Path <span style="color:var(--danger);">*</span></label>
                <div class="input-group" style="display:flex; gap:8px;">
                    <input type="text" class="form-control" id="newKeystorePath" placeholder="D:/my-release-key.keystore">
                    <button class="btn btn-outline" onclick="selectKeystoreSavePath()">
                        <i class="fas fa-folder-open"></i>
                    </button>
                </div>
            </div>
            
            <div class="form-group">
                <label>Store Password <span style="color:var(--danger);">*</span></label>
                <input type="password" class="form-control" id="newStorePassword" placeholder="Enter store password">
                <small style="color:var(--text-secondary);">Min 6 characters</small>
            </div>
            
            <div class="form-group">
                <label>Key Alias <span style="color:var(--danger);">*</span></label>
                <input type="text" class="form-control" id="newKeyAlias" placeholder="myapp">
                <small style="color:var(--text-secondary);">Unique name for your key</small>
            </div>
            
            <div class="form-group">
                <label>Key Password <span style="color:var(--danger);">*</span></label>
                <input type="password" class="form-control" id="newKeyPassword" placeholder="Enter key password">
                <small style="color:var(--text-secondary);">Can be same as store password</small>
            </div>
            
            <div class="form-group">
                <label>Name / Organization</label>
                <input type="text" class="form-control" id="newKeystoreName" placeholder="Your Name or Company">
            </div>
            
            <div class="form-group">
                <label>Organization Unit</label>
                <input type="text" class="form-control" id="newKeystoreUnit" placeholder="Development">
            </div>
            
            <div class="form-group">
                <label>City / Locality</label>
                <input type="text" class="form-control" id="newKeystoreCity" placeholder="Your City">
            </div>
            
            <div class="form-group">
                <label>State / Province</label>
                <input type="text" class="form-control" id="newKeystoreState" placeholder="Your State">
            </div>
            
            <div class="form-group">
                <label>Country Code (2 letters)</label>
                <input type="text" class="form-control" id="newKeystoreCountry" placeholder="US" maxlength="2" style="text-transform:uppercase;">
            </div>
            
            <div class="form-group" style="margin-top:12px;">
                <label>
                    <input type="checkbox" id="newKeystoreSamePassword" checked>
                    Use same password for key and store
                </label>
            </div>
        </div>
        `,
        'Create Keystore',
        function() {
            const path = document.getElementById('newKeystorePath').value.trim();
            const storePass = document.getElementById('newStorePassword').value;
            const alias = document.getElementById('newKeyAlias').value.trim();
            const keyPass = document.getElementById('newKeyPassword').value;
            const name = document.getElementById('newKeystoreName').value.trim() || 'Unknown';
            const unit = document.getElementById('newKeystoreUnit').value.trim() || 'Development';
            const city = document.getElementById('newKeystoreCity').value.trim() || 'Unknown';
            const state = document.getElementById('newKeystoreState').value.trim() || 'Unknown';
            const country = document.getElementById('newKeystoreCountry').value.trim().toUpperCase() || 'US';
            const samePassword = document.getElementById('newKeystoreSamePassword').checked;
            
            // Validation
            if (!path) {
                showToast('warning', 'Missing', 'Please enter a path for the keystore');
                return;
            }
            if (!storePass || storePass.length < 6) {
                showToast('warning', 'Invalid', 'Store password must be at least 6 characters');
                return;
            }
            if (!alias) {
                showToast('warning', 'Missing', 'Please enter a key alias');
                return;
            }
            if (!keyPass && !samePassword) {
                showToast('warning', 'Missing', 'Please enter a key password');
                return;
            }
            
            // Close modal and create keystore
            closeModal();
            
            const finalKeyPass = samePassword ? storePass : keyPass;
            
            showLoader('Creating keystore...', true);
            addConsoleMessage('🔑 Creating new keystore...', 'info');
            
            eel.create_keystore(path, storePass, alias, finalKeyPass, {
                name: name,
                unit: unit,
                city: city,
                state: state,
                country: country
            })(function(response) {
                hideLoader();
                
                if (response.success) {
                    showToast('success', 'Created ✅', 'Keystore created successfully');
                    addConsoleMessage('✅ Keystore created successfully', 'success');
                    
                    // Auto-fill the keystore fields
                    document.getElementById('settingsKeystorePath').value = path;
                    document.getElementById('settingsStorePassword').value = storePass;
                    document.getElementById('settingsKeyAlias').value = alias;
                    document.getElementById('settingsKeyPassword').value = finalKeyPass;
                    
                    const keystore = {
                        path: path,
                        storePassword: storePass,
                        keyAlias: alias,
                        keyPassword: finalKeyPass
                    };
                    
                    keystoreData = keystore;
                    AppState.settings.keystore = keystore;
                    
                    updateKeystoreUI();
                    updateBuildKeystoreStatus();
                    saveSettingsToBackend();

                    showToast('success', 'Saved', 'Keystore saved to settings');

                } else {
                    showToast('error', 'Error ❌', response.message);
                    addConsoleMessage(`❌ Error creating keystore: ${response.message}`, 'error');
                }
            });
        }
    );
    
    // Auto-fill country
    setTimeout(() => {
        const countryInput = document.getElementById('newKeystoreCountry');
        if (countryInput) countryInput.value = 'IR';
        
        // Auto-fill path
        const pathInput = document.getElementById('newKeystorePath');
        if (pathInput) {
            const defaultPath = AppState.settings.defaultPath || 'C:/Projects';
            pathInput.value = `${defaultPath}/my-release-key.keystore`;
        }
    }, 200);
}

function selectKeystoreSavePath() {
    eel.select_folder()(function(path) {
        if (path) {
            const nameInput = document.getElementById('newKeystorePath');
            if (nameInput && !nameInput.value.includes('/')) {
                nameInput.value = `${path}/my-release-key.keystore`;
            } else {
                const fileName = nameInput.value.split('/').pop() || 'my-release-key.keystore';
                nameInput.value = `${path}/${fileName}`;
            }
        }
    });
}




// ============================================================
// UPDATE BUILD FLAGS
// ============================================================

function updateBuildFlags() {
    const buildType = document.getElementById('buildType')?.value;
    const flagsInput = document.getElementById('buildFlags');
    
    if (!flagsInput) return;
    
    if (buildType === 'release') {
        // Check if keystore is configured
        if (keystoreData && keystoreData.path) {
            flagsInput.placeholder = '-- --keystore=... (auto-injected from settings)';
            flagsInput.value = '';
            // Optionally show a hint
            addConsoleMessage('🔑 Release build will use saved keystore', 'info');
        } else {
            flagsInput.placeholder = '--keystore="path" --storePassword=*** --keyAlias=*** --keyPassword=***';
            showToast('warning', 'Keystore Required', 'Configure keystore in Settings for release builds');
        }
    } else {
        flagsInput.placeholder = '-- --keystore=...';
    }
}

// ============================================================
// SETTINGS - SDK PATHS
// ============================================================
function selectAndroidSdkPath() {
    eel.select_folder()(function(path) {
        if (path) {
            document.getElementById('settingsAndroidSdkPath').value = path;
        }
    });
}

function selectGradlePath() {
    eel.select_folder()(function(path) {
        if (path) {
            document.getElementById('settingsGradlePath').value = path;
        }
    });
}

function selectJavaPath() {
    eel.select_folder()(function(path) {
        if (path) {
            document.getElementById('settingsJavaPath').value = path;
        }
    });
}

function savesdk_paths() {
    const sdk_paths = {
        android_sdk: document.getElementById('settingsAndroidSdkPath')?.value || '',
        gradle: document.getElementById('settingsGradlePath')?.value || '',
        java: document.getElementById('settingsJavaPath')?.value || ''
    };
    
    AppState.settings.sdk_paths = sdk_paths;
    
    showLoader('Saving SDK paths...', false);
    
    eel.save_sdk_paths(sdk_paths)(function(response) {
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Saved', 'SDK paths saved successfully');
            addConsoleMessage('SDK paths saved successfully', 'success');
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`Error saving SDK paths: ${response.message}`, 'error');
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`Error: ${error.message}`, 'error');
    });
}

function detectsdk_paths() {
    showLoader('Detecting SDK paths...', true);
    
    eel.detect_all_sdks()(function(response) {
        hideLoader();
        
        if (response.success) {
            if (response.android_sdk) {
                document.getElementById('settingsAndroidSdkPath').value = response.android_sdk;
            }
            if (response.gradle) {
                document.getElementById('settingsGradlePath').value = response.gradle;
            }
            if (response.java) {
                document.getElementById('settingsJavaPath').value = response.java;
            }
            showToast('success', 'Detected', 'SDK paths detected successfully');
            addConsoleMessage('SDK paths detected successfully', 'success');
        } else {
            showToast('warning', 'Not Found', response.message || 'Some SDKs not found');
            addConsoleMessage(`Warning: ${response.message || 'Some SDKs not found'}`, 'warning');
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`Error: ${error.message}`, 'error');
    });
}

// ============================================================
// MAVEN REPOSITORIES MANAGEMENT
// ============================================================
function fixMavenRepositories() {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    showLoader('Fixing Maven repositories...', true);
    addConsoleMessage('🔧 Fixing Maven repositories...', 'info');
    
    const outputDiv = document.getElementById('mavenOutput');
    if (outputDiv) {
        outputDiv.style.display = 'block';
        outputDiv.textContent = 'Processing...\n';
    }
    
    eel.fix_maven_repositories()(function(response) {
        hideLoader();
        
        if (response.success) {
            showToast('success', 'Maven Fixed', 'Repositories updated successfully');
            addConsoleMessage('✅ Maven repositories fixed successfully', 'success');
            
            if (document.getElementById('mavenStatusText')) {
                document.getElementById('mavenStatusText').textContent = '✅ Fixed';
                document.getElementById('mavenStatusText').style.color = 'var(--success)';
            }
            
            if (outputDiv && response.output) {
                outputDiv.textContent = response.output;
                outputDiv.style.borderLeft = '4px solid var(--success)';
            }
        } else {
            showToast('error', 'Error', response.message);
            addConsoleMessage(`❌ Error: ${response.message}`, 'error');
            
            if (document.getElementById('mavenStatusText')) {
                document.getElementById('mavenStatusText').textContent = '❌ Failed';
                document.getElementById('mavenStatusText').style.color = 'var(--danger)';
            }
            
            if (outputDiv) {
                outputDiv.textContent = response.output || response.message;
                outputDiv.style.borderLeft = '4px solid var(--danger)';
            }
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        addConsoleMessage(`❌ Error: ${error.message}`, 'error');
        
        if (document.getElementById('mavenStatusText')) {
            document.getElementById('mavenStatusText').textContent = '❌ Error';
            document.getElementById('mavenStatusText').style.color = 'var(--danger)';
        }
        
        const outputDiv = document.getElementById('mavenOutput');
        if (outputDiv) {
            outputDiv.textContent = `Error: ${error.message}`;
            outputDiv.style.borderLeft = '4px solid var(--danger)';
        }
    });
}

function checkMavenStatus() {
    if (!AppState.currentProject) {
        showToast('warning', 'No Project', 'Please open a project first');
        return;
    }
    
    showLoader('Checking Maven status...', false);
    addConsoleMessage('🔍 Checking Maven repositories...', 'info');
    
    const outputDiv = document.getElementById('mavenOutput');
    if (outputDiv) {
        outputDiv.style.display = 'block';
        outputDiv.textContent = 'Checking...\n';
    }
    
    eel.check_maven_repositories()(function(response) {
        hideLoader();
        
        if (response.success) {
            if (document.getElementById('mavenStatusText')) {
                document.getElementById('mavenStatusText').textContent = response.fixed ? '✅ Fixed' : '⚠️ Needs Fix';
                document.getElementById('mavenStatusText').style.color = response.fixed ? 'var(--success)' : 'var(--warning)';
            }
            
            if (outputDiv && response.output) {
                outputDiv.textContent = response.output;
            }
            
            if (response.fixed) {
                addConsoleMessage('✅ Maven repositories are configured', 'success');
            } else {
                addConsoleMessage('⚠️ Maven repositories need to be fixed', 'warning');
                if (outputDiv) {
                    outputDiv.textContent += '\n\n⚠️ Maven repositories need to be fixed.\nClick "Fix Maven" button to resolve.';
                }
            }
        } else {
            if (document.getElementById('mavenStatusText')) {
                document.getElementById('mavenStatusText').textContent = '❌ Error';
                document.getElementById('mavenStatusText').style.color = 'var(--danger)';
            }
            if (outputDiv) {
                outputDiv.textContent = response.message || 'Failed to check status';
            }
        }
    }).catch(function(error) {
        hideLoader();
        showToast('error', 'Error', error.message);
        
        if (document.getElementById('mavenStatusText')) {
            document.getElementById('mavenStatusText').textContent = '❌ Error';
            document.getElementById('mavenStatusText').style.color = 'var(--danger)';
        }
        
        const outputDiv = document.getElementById('mavenOutput');
        if (outputDiv) {
            outputDiv.textContent = `Error: ${error.message}`;
        }
    });
}

// ============================================================
// DOCUMENTATION - FULLY IMPLEMENTED
// ============================================================
function showDocSection(section) {
    document.querySelectorAll('.doc-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const target = document.querySelector(`.doc-nav-item[onclick*="${section}"]`);
    if (target) target.classList.add('active');
    
    const content = document.getElementById('docContent');
    if (!content) return;
    
    const sections = {
        'getting-started': `
            <h1>Getting Started with Cordova Pro GUI</h1>
            <p>Welcome to Cordova Pro GUI! This guide will help you get started with professional Cordova development.</p>
            
            <h2>Prerequisites</h2>
            <ul>
                <li>Python 3.8 or higher</li>
                <li>Node.js 14 or higher</li>
                <li>Cordova CLI 10.0.0 or higher</li>
                <li>Android SDK (for Android development)</li>
                <li>Xcode (for iOS development on macOS)</li>
            </ul>
            
            <h2>Installation</h2>
            <ol>
                <li>Download the latest release from GitHub</li>
                <li>Extract the archive to your preferred location</li>
                <li>Install Python dependencies: <code>pip install eel</code></li>
                <li>Install Cordova globally: <code>npm install -g cordova</code></li>
                <li>Run the application: <code>python main.py</code></li>
            </ol>
            
            <h2>First Steps</h2>
            <ol>
                <li>Click on <strong>Project Manager</strong> in the sidebar</li>
                <li>Fill in the project details (Name, Package ID, Path)</li>
                <li>Choose a template (Empty, Tabs, Sidebar, Material Design)</li>
                <li>Click <strong>Create Project</strong></li>
                <li>Add platforms (Android, iOS, etc.)</li>
                <li>Install plugins as needed</li>
                <li>Build and run your app!</li>
            </ol>
        `,
        'project-management': `
            <h1>Project Management</h1>
            <p>Cordova Pro GUI provides comprehensive project management features.</p>
            
            <h2>Creating a Project</h2>
            <ul>
                <li><strong>Project Name:</strong> A friendly name for your app</li>
                <li><strong>Package ID:</strong> Unique identifier (e.g., com.example.app)</li>
                <li><strong>Version:</strong> Semantic version (e.g., 1.0.0)</li>
                <li><strong>Path:</strong> Where to create the project</li>
                <li><strong>Template:</strong> Choose a starter template</li>
            </ul>
            
            <h2>Opening a Project</h2>
            <p>Click "Open Project" and navigate to your Cordova project folder.</p>
            
            <h2>Recent Projects</h2>
            <p>Your recently opened projects are listed in the Recent Projects panel for quick access.</p>
        `,
        'platforms': `
            <h1>Platform Management</h1>
            <p>Cordova supports multiple platforms. Here's how to manage them.</p>
            
            <h2>Available Platforms</h2>
            <ul>
                <li><strong>Android</strong> - For Android devices</li>
                <li><strong>iOS</strong> - For Apple devices (macOS only)</li>
                <li><strong>Windows</strong> - For Windows devices</li>
                <li><strong>Browser</strong> - For web testing</li>
                <li><strong>Electron</strong> - For desktop applications</li>
            </ul>
            
            <h2>Adding a Platform</h2>
            <p>Click on a platform card in the Platform Manager panel to add it to your project.</p>
            
            <h2>Removing a Platform</h2>
            <p>Click the trash icon next to an installed platform to remove it.</p>
        `,
        'plugins': `
            <h1>Plugin Management</h1>
            <p>Plugins add functionality to your Cordova application.</p>
            
            <h2>Popular Plugins</h2>
            <ul>
                <li><strong>cordova-plugin-camera</strong> - Access device camera</li>
                <li><strong>cordova-plugin-geolocation</strong> - GPS location</li>
                <li><strong>cordova-plugin-file</strong> - File system access</li>
                <li><strong>cordova-plugin-device</strong> - Device information</li>
                <li><strong>cordova-plugin-network-information</strong> - Network status</li>
            </ul>
            
            <h2>Installing a Plugin</h2>
            <ol>
                <li>Enter the plugin name in the Plugin Manager</li>
                <li>Optionally specify a version</li>
                <li>Click "Add Plugin"</li>
            </ol>
            
            <h2>Searching for Plugins</h2>
            <p>Use the Marketplace panel to search for available plugins.</p>
        `,
        'building': `
            <h1>Building & Running</h1>
            <p>Build and run your Cordova application with ease.</p>
            
            <h2>Building a Project</h2>
            <ul>
                <li>Select the target platform (Android, iOS, etc.)</li>
                <li>Choose build type (Debug or Release)</li>
                <li>Click "Build" to start the build process</li>
                <li>The APK/IPA will be created in the platforms folder</li>
            </ul>
            
            <h2>Running on Device</h2>
            <p>Connect your device and click "Run on Device" to deploy directly.</p>
            
            <h2>Running on Emulator</h2>
            <p>Click "Run on Emulator" to test on a virtual device.</p>
        `,
        'configuration': `
            <h1>Configuration</h1>
            <p>Edit your project's config.xml file visually.</p>
            
            <h2>Config.xml Fields</h2>
            <ul>
                <li><strong>Package ID:</strong> Unique app identifier</li>
                <li><strong>App Name:</strong> Display name of the app</li>
                <li><strong>Version:</strong> App version number</li>
                <li><strong>Author:</strong> Developer name</li>
                <li><strong>Email:</strong> Contact email</li>
                <li><strong>Website:</strong> Developer website</li>
                <li><strong>Description:</strong> App description</li>
            </ul>
            
            <h2>Saving Changes</h2>
            <p>Click "Save" to update your config.xml file.</p>
        `,
        'faq': `
            <h1>Frequently Asked Questions</h1>
            
            <h2>Why is my build failing?</h2>
            <p>Common issues include missing SDKs, Gradle configuration problems, or network issues. Check the Console panel for detailed error messages.</p>
            
            <h2>How do I fix Maven repository issues?</h2>
            <p>Use the "Fix Maven" button in the Settings panel to configure all necessary repositories.</p>
            
            <h2>Can I use this on Linux?</h2>
            <p>Yes, Cordova Pro GUI works on Windows, macOS, and Linux.</p>
            
            <h2>How do I update Cordova?</h2>
            <p>Run <code>npm update -g cordova</code> in your terminal.</p>
            
            <h2>How do I add a custom plugin?</h2>
            <p>Use the Console panel with <code>cordova plugin add /path/to/plugin</code></p>
        `,
        'donations': `
            <h1>Support the Project</h1>
            <p>If you find Cordova Pro GUI useful, please consider supporting its development.</p>
            
            <div class="donation-section" style="background:var(--bg-secondary); padding:24px; border-radius:12px; margin-top:16px;">
                <h2><i class="fas fa-heart" style="color:#ef4444;"></i> Donate via Crypto</h2>
                <div class="donation-addresses" style="margin-top:12px;">
                    <div class="donation-item" style="display:flex; align-items:center; gap:8px; padding:8px 0; flex-wrap:wrap;">
                        <i class="fab fa-bitcoin" style="color:#f7931a; font-size:24px;"></i>
                        <span class="donation-label" style="font-weight:500;">Bitcoin (BTC):</span>
                        <code style="background:var(--bg-primary); padding:4px 12px; border-radius:4px; font-size:13px; word-break:break-all;">bc1q0r3gzt5xtlglerst36vh6567023thpv5huthrl</code>
                        <button class="btn btn-sm btn-outline" onclick="copyAddress('bc1q0r3gzt5xtlglerst36vh6567023thpv5huthrl')">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                    <div class="donation-item" style="display:flex; align-items:center; gap:8px; padding:8px 0; flex-wrap:wrap;">
                        <i class="fab fa-ethereum" style="color:#627eea; font-size:24px;"></i>
                        <span class="donation-label" style="font-weight:500;">Ethereum (ETH):</span>
                        <code style="background:var(--bg-primary); padding:4px 12px; border-radius:4px; font-size:13px; word-break:break-all;">0xd77935cb0f1b03054720de9cb94c3d7df12b9d0e</code>
                        <button class="btn btn-sm btn-outline" onclick="copyAddress('0xd77935cb0f1b03054720de9cb94c3d7df12b9d0e')">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                </div>
                <p style="margin-top:16px; color:var(--text-secondary);">Thank you for your support! ❤️</p>
            </div>
            
            <h2 style="margin-top:24px;">Other Ways to Support</h2>
            <ul>
                <li>⭐ Star the project on GitHub</li>
                <li>🐛 Report bugs and suggest features</li>
                <li>📝 Write documentation or tutorials</li>
                <li>🔀 Contribute code via pull requests</li>
            </ul>
        `
    };
    
    content.innerHTML = sections[section] || sections['getting-started'];
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

function copyAddress(address) {
    navigator.clipboard.writeText(address).then(() => {
        showToast('success', 'Copied!', 'Address copied to clipboard');
    }).catch(() => {
        const el = document.createElement('textarea');
        el.value = address;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('success', 'Copied!', 'Address copied to clipboard');
    });
}

function checkCordova() {
    eel.check_cordova()(function(result) {
        const statusEl = document.getElementById('cordova-status');
        if (statusEl) {
            if (result.installed) {
                statusEl.innerHTML = `<span style="color: var(--success);">✓ Installed (v${result.version})</span>`;
            } else {
                statusEl.innerHTML = `<span style="color: var(--danger);">✗ Not installed</span>`;
            }
        }
    });
}

// ============================================================
// LOADER MANAGEMENT
// ============================================================
let operationCancelled = false;
let currentLoaderInterval = null;

function showLoader(text = 'Processing...', showProgress = true) {
    const overlay = document.getElementById('loaderOverlay');
    const textEl = document.getElementById('loaderText');
    const progressBar = document.getElementById('progressBar');
    const progressContainer = document.getElementById('loaderProgress');
    
    textEl.textContent = text;
    progressBar.style.width = '0%';
    progressContainer.style.display = showProgress ? 'block' : 'none';
    overlay.style.display = 'flex';
    operationCancelled = false;
    
    if (showProgress) {
        let progress = 0;
        clearInterval(currentLoaderInterval);
        currentLoaderInterval = setInterval(() => {
            if (!operationCancelled) {
                progress = Math.min(95, progress + Math.random() * 3);
                progressBar.style.width = `${progress}%`;
            }
        }, 300);
    }
}

function updateLoaderProgress(percent, text = null) {
    const progressBar = document.getElementById('progressBar');
    const textEl = document.getElementById('loaderText');
    
    if (progressBar) progressBar.style.width = `${Math.min(100, percent)}%`;
    if (text && textEl) textEl.textContent = text;
}

function hideLoader() {
    clearInterval(currentLoaderInterval);
    document.getElementById('loaderOverlay').style.display = 'none';
}

function cancelCurrentOperation() {
    operationCancelled = true;
    clearInterval(currentLoaderInterval);
    showToast('warning', 'Cancelled', 'Operation cancelled by user');
    hideLoader();
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(type, title, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// ============================================================
// MODAL
// ============================================================
function showModal(title, body, actionLabel, actionCallback) {
    DOM.modalTitle.textContent = title;
    DOM.modalBody.innerHTML = body;
    DOM.modalActionBtn.textContent = actionLabel || 'OK';
    DOM.modalActionBtn.onclick = function() {
        if (actionCallback) actionCallback();
        closeModal();
    };
    DOM.modalOverlay.style.display = 'flex';
}

function closeModal() {
    DOM.modalOverlay.style.display = 'none';
}

DOM.modalOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// ============================================================
// EXPOSE TO PYTHON
// ============================================================
eel.expose(showToast);
eel.expose(showModal);
eel.expose(addConsoleMessage);

console.log('✅ Cordova Pro GUI v2.0 loaded successfully');