// @ts-check
// Конфигурация для Dropbox интеграции
// AICODE-WHY: Load Dropbox secrets from developer .env so credentials never land in git history [2025-10-23]

const DEFAULT_TARGET_FOLDER = '/Apps/EPUB Exporter';
const ENV_KEY_MAP = {
    APP_KEY: 'DROPBOX_APP_KEY',
    APP_SECRET: 'DROPBOX_APP_SECRET',
    REFRESH_TOKEN: 'DROPBOX_REFRESH_TOKEN',
    TARGET_FOLDER: 'DROPBOX_TARGET_FOLDER'
};

let cachedConfigPromise = null;

/**
 * Загружает конфигурацию Dropbox, отдавая приоритет .env и глобальным значениям.
 * @returns {Promise<{APP_KEY: string, APP_SECRET: string, REFRESH_TOKEN: string, TARGET_FOLDER: string}>}
 */
export async function loadDropboxConfig() {
    if (!cachedConfigPromise) {
        cachedConfigPromise = resolveDropboxConfig();
    }
    const config = await cachedConfigPromise;

    if (typeof globalThis !== 'undefined') {
        globalThis.DROPBOX_CONFIG = config;
    }

    return config;
}

async function resolveDropboxConfig() {
    // 1. Учитываем заранее установленные глобальные значения (например, в тестах)
    if (typeof globalThis !== 'undefined' && globalThis.DROPBOX_CONFIG) {
        return normalizeConfig(globalThis.DROPBOX_CONFIG);
    }

    // 2. Поддержка process.env (Node.js, тесты, build scripts)
    const processEnvConfig = loadFromProcessEnv();
    if (processEnvConfig) {
        return normalizeConfig(processEnvConfig);
    }

    // 3. Попытка загрузить .env файл из пакета расширения
    const envFileConfig = await loadFromEnvFile();
    if (envFileConfig) {
        return normalizeConfig(envFileConfig);
    }

    // 4. По умолчанию возвращаем пустые значения, чтобы остальные модули могли обработать отсутствие конфигурации
    return normalizeConfig({});
}

function loadFromProcessEnv() {
    if (typeof process === 'undefined' || !process?.env) {
        return null;
    }

    /** @type {Record<string, string>} */
    const result = {};
    let hasValue = false;

    for (const [key, envKey] of Object.entries(ENV_KEY_MAP)) {
        const value = process.env[envKey];
        if (typeof value === 'string' && value.trim() !== '') {
            result[key] = value.trim();
            hasValue = true;
        }
    }

    return hasValue ? result : null;
}

async function loadFromEnvFile() {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.getURL) {
        return null;
    }

    try {
        const url = chrome.runtime.getURL('.env');
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            return null;
        }
        const text = await response.text();
        const parsed = parseEnvString(text);
        /** @type {Record<string, string>} */
        const result = {};
        for (const [key, envKey] of Object.entries(ENV_KEY_MAP)) {
            const value = parsed[envKey];
            if (typeof value === 'string' && value.trim() !== '') {
                result[key] = value.trim();
            }
        }
        return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
        console.warn('[dropbox-config] Не удалось загрузить .env файл', error);
        return null;
    }
}

/**
 * @param {unknown} rawConfig
 */
function normalizeConfig(rawConfig) {
    const configObject = typeof rawConfig === 'object' && rawConfig !== null ? rawConfig : {};

    const normalized = {
        APP_KEY: readConfigValue(configObject, ['APP_KEY', ENV_KEY_MAP.APP_KEY]),
        APP_SECRET: readConfigValue(configObject, ['APP_SECRET', ENV_KEY_MAP.APP_SECRET]),
        REFRESH_TOKEN: readConfigValue(configObject, ['REFRESH_TOKEN', ENV_KEY_MAP.REFRESH_TOKEN]),
        TARGET_FOLDER: readConfigValue(configObject, ['TARGET_FOLDER', ENV_KEY_MAP.TARGET_FOLDER]) || DEFAULT_TARGET_FOLDER
    };

    return normalized;
}

/**
 * @param {Record<string, unknown>} config
 * @param {string[]} keys
 */
function readConfigValue(config, keys) {
    for (const key of keys) {
        const value = config[key];
        if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
        }
    }
    return '';
}

/**
 * Минимальный парсер .env строк
 * @param {string} input
 */
function parseEnvString(input) {
    /** @type {Record<string, string>} */
    const result = {};

    if (typeof input !== 'string') {
        return result;
    }

    const lines = input.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) {
            continue;
        }
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (!key) {
            continue;
        }
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }

    return result;
}

export default loadDropboxConfig;
