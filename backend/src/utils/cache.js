import crypto from 'crypto';

/**
 * High-performance, zero-dependency in-memory cache suite for TD-Server:
 * 1. BufferLruCache: LRU binary cache for image LONGBLOBs with strict memory caps.
 * 2. ResponseTtlCache: In-memory TTL cache for JSON API responses.
 * 3. ETag Helpers: HTTP 304 conditional request validation.
 */

// ============================================================================
// 1. Buffer LRU Cache for MySQL BLOB Images (Max 60MB RAM footprint)
// ============================================================================
class BufferLruCache {
  constructor(maxBytes = 60 * 1024 * 1024) { // 60 MB default limit
    this.maxBytes = maxBytes;
    this.currentBytes = 0;
    this.cache = new Map(); // Key -> { data: Buffer, mime: string, etag: string, size: number }
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    // Refresh item to most-recently-used position in Map
    const item = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  set(key, { data, mime, etag }) {
    if (!data || !Buffer.isBuffer(data)) return;

    const size = data.length;
    // Don't cache single images larger than 10MB to avoid cache thrashing
    if (size > 10 * 1024 * 1024) return;

    // If key already exists, deduct previous size
    if (this.cache.has(key)) {
      this.currentBytes -= this.cache.get(key).size;
      this.cache.delete(key);
    }

    // Evict oldest items if exceeding memory cap
    while (this.currentBytes + size > this.maxBytes && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      const oldestItem = this.cache.get(oldestKey);
      this.currentBytes -= oldestItem.size;
      this.cache.delete(oldestKey);
    }

    const calculatedEtag = etag || generateETag(key, data);
    this.cache.set(key, {
      data,
      mime: mime || 'image/jpeg',
      etag: calculatedEtag,
      size,
    });
    this.currentBytes += size;
  }

  del(key) {
    if (this.cache.has(key)) {
      this.currentBytes -= this.cache.get(key).size;
      this.cache.delete(key);
    }
  }

  invalidate(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.del(key);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.currentBytes = 0;
  }

  getStats() {
    return {
      entries: this.cache.size,
      usedMb: +(this.currentBytes / (1024 * 1024)).toFixed(2),
      maxMb: +(this.maxBytes / (1024 * 1024)).toFixed(2),
    };
  }
}

// ============================================================================
// 2. Response TTL Cache for JSON API Responses (Colleges, Dropdowns, Wall)
// ============================================================================
class ResponseTtlCache {
  constructor() {
    this.cache = new Map(); // Key -> { value, expiresAt }
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds = 60) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  del(key) {
    this.cache.delete(key);
  }

  invalidate(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

// ============================================================================
// 3. ETag & Conditional Request Helpers
// ============================================================================
export function generateETag(identifier, buffer) {
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 16);
  return `W/"${identifier}-${buffer.length}-${hash}"`;
}

export function isFresh(req, etag) {
  if (!etag) return false;
  const clientEtag = req.headers['if-none-match'];
  if (!clientEtag) return false;

  // Handle weak or strong matches
  return clientEtag === etag || clientEtag.includes(etag);
}

// Export singleton instances
export const imageCache = new BufferLruCache();
export const apiCache = new ResponseTtlCache();
