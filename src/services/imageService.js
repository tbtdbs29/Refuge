import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { del, put } from '@vercel/blob';
import { config } from '../config/index.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif', 'gif']);
const SIZES = { full: 1600, thumb: 640 };

// Stored photo reference ("base"): a bare name like "animal-xyz" for files on local disk,
// or the Vercel Blob URL without ".webp" when photos live in Blob storage.

async function store(name, buffer) {
  if (config.blobToken) {
    const { url } = await put(`uploads/${name}`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'image/webp',
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      token: config.blobToken,
    });
    return url;
  }
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, name), buffer);
  return name;
}

/**
 * Validates an uploaded buffer by decoding it, then stores a large and a thumbnail WebP version.
 * Returns the stored base reference (without size suffix) and the full-size dimensions.
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

  const name = `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
  const pipeline = sharp(buffer, { failOn: 'error' }).rotate();

  const full = await pipeline
    .clone()
    .resize({ width: SIZES.full, height: SIZES.full, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await pipeline
    .clone()
    .resize({ width: SIZES.thumb, height: SIZES.thumb, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const fullRef = await store(`${name}.webp`, full.data);
  await store(`${name}-thumb.webp`, thumb);
  const base = fullRef.replace(/\.webp$/, '');

  logger.info('image.saved', { name, width: full.info.width, height: full.info.height });
  return { filename: base, width: full.info.width, height: full.info.height };
}

const LOCAL_NAME = /^[a-z]+-[a-z0-9]+-[a-f0-9]+$/;
const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/[a-z]+-[a-z0-9]+-[a-f0-9]+$/i;

export async function deleteImage(base) {
  if (!base) return;
  try {
    if (BLOB_URL.test(base) && config.blobToken) {
      await del([`${base}.webp`, `${base}-thumb.webp`], { token: config.blobToken });
    } else if (LOCAL_NAME.test(base)) {
      for (const name of [`${base}.webp`, `${base}-thumb.webp`]) await fs.rm(path.join(config.uploadDir, name), { force: true });
    }
  } catch (error) {
    // The database row is already gone; an orphan file is harmless, so do not fail the request.
    logger.warn('image.delete_failed', { error: error.message });
  }
}

export function imageUrl(base, size = 'full') {
  if (!base) return null;
  const suffix = `${size === 'thumb' ? '-thumb' : ''}.webp`;
  return /^https:\/\//.test(base) ? `${base}${suffix}` : `/uploads/${base}${suffix}`;
}
