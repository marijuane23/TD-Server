// Utilities & validation helpers

export function generateSlug(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Honeypot check: bot traps commonly name fields "website", "hp_field", or "url"
export function checkHoneypot(body = {}) {
  const honeypotFields = ['website', 'hp_field', 'url'];
  for (const field of honeypotFields) {
    if (body[field] && String(body[field]).trim() !== '') {
      return false; // failed honeypot check (likely a bot)
    }
  }
  return true; // passed
}

// Basic profanity / spam keyword check
const PROFANITY_LIST = [
  'gago', 'tarantado', 'ulol', 'putangina', 'tangina', 'bobo', 'leche',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy'
];

export function hasProfanity(text = '') {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return PROFANITY_LIST.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lower);
  });
}

// Allowed media MIME types and max size (50MB)
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export function getMediaType(mime = '') {
  if (ALLOWED_IMAGE_MIMES.includes(mime)) return 'image';
  if (ALLOWED_VIDEO_MIMES.includes(mime)) return 'video';
  return null;
}
