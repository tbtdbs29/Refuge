import { DEFAULT_SETTINGS } from '../config/defaultSettings.js';
import { settingRepository } from '../repositories/settingRepository.js';

let cache;

export const settingsService = {
  get() {
    if (!cache) {
      const stored = settingRepository.all();
      cache = Object.fromEntries(
        Object.entries(DEFAULT_SETTINGS).map(([key, defaults]) => [key, { ...defaults, ...(stored[key] || {}) }]),
      );
    }
    return cache;
  },

  update(section, value) {
    if (!(section in DEFAULT_SETTINGS)) throw new Error(`Unknown settings section: ${section}`);
    settingRepository.set(section, value);
    cache = undefined;
  },

  resetCache() {
    cache = undefined;
  },
};
