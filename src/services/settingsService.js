import { DEFAULT_SETTINGS } from '../config/defaultSettings.js';
import { settingRepository } from '../repositories/settingRepository.js';

// Short cache: on serverless hosting several instances may run, so another instance's
// update becomes visible here within a few seconds.
const TTL_MS = 10_000;
let cache;
let cachedAt = 0;

export const settingsService = {
  async get() {
    if (!cache || Date.now() - cachedAt > TTL_MS) {
      const stored = await settingRepository.all();
      cache = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, defaults]) => [key, { ...defaults, ...(stored[key] || {}) }]));
      cachedAt = Date.now();
    }
    return cache;
  },

  async update(section, value) {
    if (!(section in DEFAULT_SETTINGS)) throw new Error(`Unknown settings section: ${section}`);
    await settingRepository.set(section, value);
    cache = undefined;
  },

  resetCache() {
    cache = undefined;
  },
};
