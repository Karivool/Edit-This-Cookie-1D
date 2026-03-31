/**
 * User preferences with default values
 */
var preferences_template = {
    // Show alerts when the user performs some operations such as deleting a cookie
    "showAlerts": {
        "default_value": false
    },
    // Show labels in the popup window next to some of the buttons
    "showCommandsLabels": {
        "default_value": false
    },
    // Show the domain in the accordion of the popup window next to each cookie's name
    "showDomain": {
        "default_value": true
    },
    // Show the domain before the name of the cookie in the accordion
    "showDomainBeforeName": {
        "default_value": true
    },
    // Show the BlockAndDeleteAll button in the popup window. This is an advanded operation, hence it's disabled by default
    "showFlagAndDeleteAll": {
        "default_value": false
    },
    // Show an option to open EditThisCookie as a separate tab in the context menu
    "showContextMenu": {
        "default_value": true
    },
    // If enabled, after submitting cookie changes, the active tab will be refreshed
    "refreshAfterSubmit": {
        "default_value": false
    },
    // If enabled, the cache will be bypassed when reloading a page
    "skipCacheRefresh": {
        "default_value": true
    },
    // ETC has a feature to limit the maximum age of any cookie that is being set by websites.
    // This feature is controlled by the next three variables:
    // If true, this feature is enabled
    "useMaxCookieAge": {
        "default_value": false
    },
    // The multiplier for maxCookieAge in order to obtain the right number of seconds. 3600 for hour, 86400 for day, ...
    // -1 if not set
    "maxCookieAgeType": {
        "default_value": -1
    },
    // The time basic unit, to be used in conjunction with the previous variable to calculate the maximum allowed age
    "maxCookieAge": {
        "default_value": 1
    },
    // If true, a custom locale is used rather than the default set by the brower
    "useCustomLocale": {
        "default_value": false
    },
    // The custom locale to use
    "customLocale": {
        "default_value": "en"
    },
    // The output format to use when exporting cookies to the clipboard.
    // Supported: netscape, json, semicolonPairs. For reference, see cookie_helpers.js -> "cookiesToString"
    "copyCookiesType": {
        "default_value": "json"
    },
    // If true, the standard icon on the toobar is changed for a christmassy one in certain periods of the year
    "showChristmasIcon": {
        "default_value": true
    },
    // How cookies will be sorted. Supported values:
    //          alpha:        alphabetic ordering by cookie name
    //          domain_alpha: alphabetic ordering by domain and cookie name
    "sortCookiesType": {
        "default_value": "domain_alpha"
    },
    // Whether to show the panel in the DevTools panel (e.g. panel shown when pressing F12)
    "showDevToolsPanel": {
        "default_value": true
    }
};

/**
 * User data with default values
 */
var data_template = {
    "filters": {
        "default_value": []
    },
    "readOnly": {
        "default_value": []
    },
    "nCookiesCreated": {
        "default_value": 0
    },
    "nCookiesChanged": {
        "default_value": 0
    },
    "nCookiesDeleted": {
        "default_value": 0
    },
    "nCookiesProtected": {
        "default_value": 0
    },
    "nCookiesFlagged": {
        "default_value": 0
    },
    "nCookiesShortened": {
        "default_value": 0
    },
    "nPopupClicked": {
        "default_value": 0
    },
    "nPanelClicked": {
        "default_value": 0
    },
    "nCookiesImported": {
        "default_value": 0
    },
    "nCookiesExported": {
        "default_value": 0
    },
    "lastVersionRun": {
        "default_value": undefined
    }
};

var preferences = {};
var data = {};
var preferences_prefix = "options_";
var data_prefix = "data_";

var updateCallback = undefined;
var dataToSync = {};
var syncTimeout = false;
var syncTime = 200;
var storageCache = {};
var firstRun = null;

function hasLegacyLocalStorage() {
    try {
        return typeof localStorage !== "undefined";
    } catch (e) {
        return false;
    }
}

function parseLegacyValue(rawValue, defaultValue) {
    try {
        return JSON.parse(rawValue);
    } catch (e) {
        return defaultValue;
    }
}

function queueSync(cID, cVal) {
    dataToSync[cID] = cVal;
    // Service workers can be suspended quickly, so avoid deferred writes there.
    if (typeof window === "undefined") {
        syncDataToStorage();
        return;
    }
    if (!syncTimeout)
        syncTimeout = setTimeout(syncDataToStorage, syncTime);
}

/**
 * Used to access settings and data in storage
 */
var ls = {
    /**
     * Stores an object in storage
     * @param name Name of the object to be stored
     * @param value Value of the object to be stored
     */
    set: function (name, value) {
        storageCache[name] = value;
        queueSync(name, value);
    },

    /**
     * Get an object from storage. If it doesn't exist, create one and add it to the storage
     * @param name Name of the object to fetch
     * @param default_value Value to assign to the object if it doesn't exist.
     * @return The fetched/created object
     */
    get: function (name, default_value) {
        if (Object.prototype.hasOwnProperty.call(storageCache, name)) {
            return storageCache[name];
        }

        if (hasLegacyLocalStorage() && localStorage[name] !== undefined) {
            var migratedValue = parseLegacyValue(localStorage.getItem(name), default_value);
            storageCache[name] = migratedValue;
            queueSync(name, migratedValue);
            return migratedValue;
        }

        if (default_value !== undefined) {
            storageCache[name] = default_value;
            queueSync(name, default_value);
            return default_value;
        }

        return null;
    },

    /**
     * Remove an object from storage
     * @param name Name of the object to delete
     */
    remove: function (name) {
        delete storageCache[name];
        chrome.storage.local.remove(name);
    }
};

/**
 * This function is called regularly every "syncTime" ms.
 * The purpose of the following logic is to allow users of storage to modify user preferences and data
 * without having to worry about manually updating persistent storage. It will be synced across all open
 * pages of the extension and the service worker.
 */
function syncDataToStorage() {
    syncTimeout = false;
    var toWrite = dataToSync;
    dataToSync = {};

    if (Object.keys(toWrite).length === 0)
        return;

    chrome.storage.local.set(toWrite, function () {
        if (chrome.runtime.lastError) {
            console.error("Failed to write data to storage.");
            console.error(chrome.runtime.lastError.message);
        }
    });
}

/**
 * Fetch data from storage based on the previously declared templates (preferences_template and data_template).
 */
function fetchData() {
    var key;
    for (key in preferences_template) {
        var defaultValue = preferences_template[key].default_value;
        preferences[key] = ls.get(preferences_prefix + key, defaultValue);

        /**
         * When a preference change is detected, it will be added to the queue (dataToSync).
         * Once the timer ticks in, data is taken off the queue and stored in persistent storage.
         * @param id Name of the element being modified
         * @param oldval Old value
         * @param newval New value
         */
        var onPreferenceChange = function (id, oldval, newval) {
            queueSync(preferences_prefix + id, newval);
            return newval;
        };

        /**
         * When a preference is read, mark it as dirty.
         * @param id  Name of the element being read
         */
        var onPreferenceRead = function (id) {
            preferences_template[id].used = true;
        };

        // Monitor the preferences for changes
        preferences.watch(key, onPreferenceChange, onPreferenceRead);
    }

    for (key in data_template) {
        defaultValue = data_template[key].default_value;
        data[key] = ls.get(data_prefix + key, defaultValue);

        /**
         * When data change is detected, it will be added to the queue (dataToSync).
         * Once the timer ticks in, data is taken off the queue and stored in persistent storage.
         * @param id Name of the element being modified
         * @param oldval Old value
         * @param newval New value
         */
        var onDataChange = function (id, oldval, newval) {
            queueSync(data_prefix + id, newval);
            return newval;
        };

        /**
         * When data is read, mark it as dirty.
         * @param id  Name of the element being read
         */
        var onDataRead = function (id) {
            data_template[id].used = true;
        };

        // Monitor the data for changes
        data.watch(key, onDataChange, onDataRead);
    }
}

function applyStorageEvent(storageKey, newValue) {
    var varUsed = false;
    var varChanged = false;
    var key;

    if (storageKey.indexOf(preferences_prefix) === 0) {
        key = storageKey.substring(preferences_prefix.length);
        if (preferences_template[key] === undefined)
            return;

        varUsed = !!preferences_template[key].used;
        varChanged = preferences[key] !== newValue;
        preferences[key] = (newValue === undefined) ? preferences_template[key].default_value : newValue;
        preferences_template[key].used = varUsed;
    } else if (storageKey.indexOf(data_prefix) === 0) {
        key = storageKey.substring(data_prefix.length);
        if (data_template[key] === undefined)
            return;

        varUsed = (data_template[key].used !== undefined && data_template[key].used);
        varChanged = data[key] !== newValue;
        data[key] = (newValue === undefined) ? data_template[key].default_value : newValue;
        data_template[key].used = varUsed;
    } else {
        return;
    }

    if (varUsed && varChanged && updateCallback !== undefined) {
        updateCallback();
    }
}

chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== "local")
        return;

    try {
        for (var key in changes) {
            var newValue = changes[key].newValue;
            if (newValue === undefined)
                delete storageCache[key];
            else
                storageCache[key] = newValue;
            applyStorageEvent(key, newValue);
        }
    } catch (e) {
        console.error("Failed to call on the updateCallback.");
        console.error(e.message);
    }
});

function loadStorageCache() {
    return new Promise(function (resolve) {
        chrome.storage.local.get(null, function (items) {
            storageCache = items || {};
            resolve();
        });
    });
}

function initializeData() {
    return loadStorageCache().then(function () {
        fetchData();

        firstRun = ls.get("status_firstRun");
        if (firstRun !== null) {
            data.lastVersionRun = chrome.runtime.getManifest().version;
        }
    });
}

var dataReady = initializeData();

function waitForData(callback) {
    if (typeof callback === "function") {
        dataReady
            .then(function () {
                callback();
            })
            .catch(function (e) {
                console.error("Failed waiting for data initialization.");
                console.error(e.message);
            });
    }
    return dataReady;
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", function () {
        syncDataToStorage();
    });
}
