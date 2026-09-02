/**
 * Cordova Pro GUI - Utility Functions
 */

// ============================================================
// STRING UTILITIES
// ============================================================
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str, length = 50) {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.slice(0, length) + '...';
}

function slugify(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// ============================================================
// DATE UTILITIES
// ============================================================
function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    return 'Just now';
}

// ============================================================
// DOM UTILITIES
// ============================================================
function $(selector, context = document) {
    return context.querySelector(selector);
}

function $$(selector, context = document) {
    return context.querySelectorAll(selector);
}

function createElement(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
}

// ============================================================
// FILE UTILITIES
// ============================================================
function getFileExtension(filename) {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
}

function getFileNameWithoutExtension(filename) {
    if (!filename) return '';
    return filename.split('.').slice(0, -1).join('.');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================
// ARRAY UTILITIES
// ============================================================
function unique(array) {
    return [...new Set(array)];
}

function groupBy(array, key) {
    return array.reduce((result, item) => {
        const group = item[key];
        if (!result[group]) result[group] = [];
        result[group].push(item);
        return result;
    }, {});
}

function sortBy(array, key, ascending = true) {
    return array.sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal) return ascending ? -1 : 1;
        if (aVal > bVal) return ascending ? 1 : -1;
        return 0;
    });
}

// ============================================================
// VALIDATION UTILITIES
// ============================================================
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function isValidPackageId(id) {
    return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(id);
}

function isValidVersion(version) {
    return /^\d+\.\d+\.\d+$/.test(version);
}

// ============================================================
// COLOR UTILITIES
// ============================================================
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function getContrastColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#000000';
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

// ============================================================
// DEBOUNCE & THROTTLE
// ============================================================
function debounce(func, wait = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================================
// STORAGE UTILITIES
// ============================================================
function saveToStorage(key, data) {
    try {
        localStorage.setItem(`cordova-${key}`, JSON.stringify(data));
        return true;
    } catch {
        return false;
    }
}

function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(`cordova-${key}`);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

function removeFromStorage(key) {
    try {
        localStorage.removeItem(`cordova-${key}`);
        return true;
    } catch {
        return false;
    }
}

// ============================================================
// EXPORT
// ============================================================
// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        capitalize,
        truncate,
        slugify,
        timeAgo,
        getFileExtension,
        getFileNameWithoutExtension,
        formatFileSize,
        unique,
        groupBy,
        sortBy,
        isValidEmail,
        isValidUrl,
        isValidPackageId,
        isValidVersion,
        hexToRgb,
        rgbToHex,
        getContrastColor,
        debounce,
        throttle,
        saveToStorage,
        loadFromStorage,
        removeFromStorage
    };
}