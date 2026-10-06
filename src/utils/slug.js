export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, '-et-')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '') || 'sans-titre';
}

/** Returns a slug not yet used, according to the exists predicate. */
export function uniqueSlug(text, exists) {
  const base = slugify(text);
  let candidate = base;
  let suffix = 2;
  while (exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/** Async variant of uniqueSlug for database-backed checks. */
export async function findUniqueSlug(text, exists) {
  const base = slugify(text);
  let candidate = base;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
