import { config } from '../config/index.js';

const SENSITIVE = /pass(word)?|token|secret|authorization|cookie|session|api_?key/i;

function sanitize(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE.test(key) ? '[redacted]' : sanitize(item)]));
}

function write(level, message, meta) {
  if (config.isTest && level !== 'error') return;
  const line = { time: new Date().toISOString(), level, message, ...sanitize(meta) };
  (level === 'error' ? console.error : console.log)(JSON.stringify(line));
}

export const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};
