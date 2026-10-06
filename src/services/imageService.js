import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config/index.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif', 'gif']);
const SIZES = { full: 1600, thumb: 640 };

/**
 * Validates an uploaded buffer by decoding it, then writes a large and a thumbnail WebP version.
 * Returns the base filename (without size suffix) and the full-size dimensions.
 */
export async function saveImage(buffer, prefix = 'img') {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ValidationError({ photo: 'Ce fichier n’est pas une image lisible.' });
  }
  if (!ACCEPTED_FORMATS.has(metadata.format)) {
    throw new ValidationError({ photo: 'Formats acceptés : JPEG, PNG, WebP, HEIC.' });
  }

  await fs.mkdir(config.uploadDir, { recursive: true });
  const base = `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
  const pipeline = sharp(buffer, { failOn: 'error' }).rotate();

  const full = await pipeline
    .clone()
    .resize({ width: SIZES.full, height: SIZES.full, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(config.uploadDir, `${base}.webp`));
  await pipeline
    .clone()
    .resize({ width: SIZES.thumb, height: SIZES.thumb, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(config.uploadDir, `${base}-thumb.webp`));

  logger.info('image.saved', { base, width: full.width, height: full.height });
  return { filename: base, width: full.width, height: full.height };
}

export async function deleteImage(base) {
  if (!base || !/^[a-z]+-[a-z0-9]+-[a-f0-9]+$/.test(base)) return;
  for (const name of [`${base}.webp`, `${base}-thumb.webp`]) {
    await fs.rm(path.join(config.uploadDir, name), { force: true });
  }
}

export function imageUrl(base, size = 'full') {
  if (!base) return null;
  return `/uploads/${base}${size === 'thumb' ? '-thumb' : ''}.webp`;
}
