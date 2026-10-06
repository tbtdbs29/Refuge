import { POST_CATEGORIES } from '../config/labels.js';
import { postRepository } from '../repositories/postRepository.js';
import { NotFoundError } from '../utils/errors.js';
import { excerpt, formatDate, nowWallClock, textToHtml } from '../utils/format.js';
import { findUniqueSlug } from '../utils/slug.js';
import { deleteImage, imageUrl, saveImage } from './imageService.js';
import { logger } from '../utils/logger.js';

const PAGE_SIZE = 9;

function decorate(post) {
  return {
    ...post,
    categoryLabel: POST_CATEGORIES[post.category],
    dateLabel: formatDate(post.published_at),
    summary: post.excerpt || excerpt(post.body, 200),
    bodyHtml: textToHtml(post.body),
    coverUrl: imageUrl(post.cover),
    coverThumb: imageUrl(post.cover, 'thumb'),
    url: `/actualites/${post.slug}`,
    isScheduled: post.published_at > nowWallClock(),
  };
}

export const postService = {
  PAGE_SIZE,

  async listPublic({ page = 1, category } = {}) {
    const publishedBefore = nowWallClock();
    const total = await postRepository.count({ publishedBefore, category });
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(Math.max(1, page), pages);
    const posts = (await postRepository.list({ publishedBefore, category, limit: PAGE_SIZE, offset: (current - 1) * PAGE_SIZE })).map(decorate);
    return { posts, page: current, pages, total };
  },

  async latest(limit = 3) {
    return (await postRepository.list({ publishedBefore: nowWallClock(), limit })).map(decorate);
  },

  async getPublic(slug) {
    const post = await postRepository.findBySlug(slug);
    if (!post || !post.published || post.published_at > nowWallClock()) throw new NotFoundError('Cet article n’existe pas ou plus.');
    return decorate(post);
  },

  async listAdmin() {
    return (await postRepository.list({ limit: 500 })).map(decorate);
  },

  async getById(id) {
    const post = await postRepository.findById(id);
    if (!post) throw new NotFoundError('Article introuvable.');
    return decorate(post);
  },

  async create(data, coverFile) {
    const slug = await findUniqueSlug(data.title, (candidate) => postRepository.slugExists(candidate));
    const cover = coverFile ? (await saveImage(coverFile.buffer, 'post')).filename : null;
    const id = await postRepository.create({ ...data, slug, cover });
    logger.info('post.created', { id });
    return id;
  },

  async update(id, data, coverFile, { removeCover = false } = {}) {
    const current = await this.getById(id);
    const patch = { ...data, example: 0 };
    if (data.title !== current.title) patch.slug = await findUniqueSlug(data.title, (candidate) => postRepository.slugExists(candidate, id));
    if (coverFile || removeCover) {
      patch.cover = coverFile ? (await saveImage(coverFile.buffer, 'post')).filename : null;
      await deleteImage(current.cover);
    }
    await postRepository.update(id, patch);
    logger.info('post.updated', { id });
  },

  async delete(id) {
    const post = await this.getById(id);
    await postRepository.delete(id);
    await deleteImage(post.cover);
    logger.info('post.deleted', { id });
  },
};
