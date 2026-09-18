import { imageCache, apiCache, generateETag, isFresh } from '../src/utils/cache.js';

console.log('--- Testing TD-Server Caching Layer ---');

// 1. Test imageCache LRU Buffer Cache
const sampleBuffer1 = Buffer.from('fake-image-bytes-1');
const sampleBuffer2 = Buffer.from('fake-image-bytes-2');

imageCache.set('media:1', { data: sampleBuffer1, mime: 'image/jpeg' });
imageCache.set('wall_img:1', { data: sampleBuffer2, mime: 'image/png' });

const hit1 = imageCache.get('media:1');
if (!hit1 || hit1.data.toString() !== 'fake-image-bytes-1') {
  throw new Error('imageCache failed to store/retrieve sampleBuffer1');
}
console.log('✓ imageCache get & set verified. Current stats:', imageCache.getStats());

// 2. Test ETag generation and isFresh
const etag = generateETag('media:1', sampleBuffer1);
console.log('✓ Generated ETag:', etag);

const freshReq = { headers: { 'if-none-match': etag } };
const staleReq = { headers: { 'if-none-match': 'W/"different-etag"' } };

if (!isFresh(freshReq, etag)) {
  throw new Error('isFresh failed on exact match');
}
if (isFresh(staleReq, etag)) {
  throw new Error('isFresh returned true on mismatch');
}
console.log('✓ isFresh HTTP 304 logic verified');

// 3. Test apiCache TTL and Invalidation
apiCache.set('colleges:all', [{ id: 1, name: 'CTECH' }], 10);
apiCache.set('teachers:dropdown', [{ id: 1, name: 'Darrel' }], 10);
apiCache.set('teachers:list:all', [{ id: 1 }], 10);

if (!apiCache.get('colleges:all')) throw new Error('apiCache get failed');
console.log('✓ apiCache get & set verified');

apiCache.invalidate('teachers:');
if (apiCache.get('teachers:dropdown') !== null || apiCache.get('teachers:list:all') !== null) {
  throw new Error('apiCache.invalidate failed');
}
if (apiCache.get('colleges:all') === null) {
  throw new Error('apiCache.invalidate wrongly invalidated colleges');
}
console.log('✓ apiCache prefix invalidation verified');

console.log('All backend cache tests passed successfully!');
