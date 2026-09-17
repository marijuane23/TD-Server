// Service to resolve, download, and extract images from web URLs (including Pinterest shortlinks, OpenGraph pages, and direct image links)

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export const PhotoResolverService = {
  /**
   * Resolve an image URL or webpage link (e.g. Pinterest pin.it, Imgur, direct image URL)
   * Downloads the raw binary image buffer and detects MIME type.
   * @param {string} inputUrl - The URL provided by the user
   * @returns {Promise<{ buffer: Buffer, mime: string, resolvedUrl: string } | null>}
   */
  async resolveAndDownload(inputUrl) {
    if (!inputUrl || typeof inputUrl !== 'string') return null;

    let targetUrl = inputUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return null;
    }

    try {
      // 1. Initial fetch to check content type or follow redirects
      const initialRes = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (!initialRes.ok) {
        console.warn(`[PhotoResolver] Initial request failed with status ${initialRes.status} for ${targetUrl}`);
        return null;
      }

      const contentType = (initialRes.headers.get('content-type') || '').toLowerCase();

      // 2. If it is already a direct image
      if (contentType.startsWith('image/')) {
        const arrayBuffer = await initialRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = contentType.split(';')[0].trim();
        return { buffer, mime, resolvedUrl: initialRes.url || targetUrl };
      }

      // 3. If it is an HTML webpage (e.g. Pinterest pin.it redirect, social page, etc.)
      if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
        const html = await initialRes.text();
        const extractedImageUrl = this.extractImageFromHtml(html, initialRes.url || targetUrl);

        if (extractedImageUrl) {
          const imgRes = await fetch(extractedImageUrl, {
            headers: {
              'User-Agent': BROWSER_USER_AGENT,
              'Referer': initialRes.url || targetUrl,
              'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
          });

          if (imgRes.ok) {
            const imgContentType = (imgRes.headers.get('content-type') || 'image/jpeg').toLowerCase();
            const arrayBuffer = await imgRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mime = imgContentType.split(';')[0].trim();
            return { buffer, mime, resolvedUrl: extractedImageUrl };
          }
        }
      }

      return null;
    } catch (err) {
      console.error('[PhotoResolver] Error resolving photo URL:', err.message);
      return null;
    }
  },

  /**
   * Helper to parse OpenGraph, Twitter, and Pinterest images from HTML
   */
  extractImageFromHtml(html, baseUrl) {
    if (!html) return null;

    // Pattern 1: <meta ... property="og:image" ... content="..." /> (any attribute order)
    const ogRegex1 = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
    const ogRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;

    let match = html.match(ogRegex1) || html.match(ogRegex2);
    if (match && match[1]) return this.normalizeUrl(match[1], baseUrl);

    // Pattern 2: Twitter image
    const twRegex1 = /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i;
    const twRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i;
    match = html.match(twRegex1) || html.match(twRegex2);
    if (match && match[1]) return this.normalizeUrl(match[1], baseUrl);

    // Pattern 3: Pinterest specific full-size originals or 736x CDN images
    const pinimgOriginals = html.match(/https:\/\/i\.pinimg\.com\/originals\/[a-zA-Z0-9_\-\/]+\.(?:jpg|jpeg|png|webp)/i);
    if (pinimgOriginals && pinimgOriginals[0]) return pinimgOriginals[0];

    const pinimg736 = html.match(/https:\/\/i\.pinimg\.com\/736x\/[a-zA-Z0-9_\-\/]+\.(?:jpg|jpeg|png|webp)/i);
    if (pinimg736 && pinimg736[0]) return pinimg736[0];

    // Pattern 4: link rel="image_src"
    const linkMatch = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);
    if (linkMatch && linkMatch[1]) return this.normalizeUrl(linkMatch[1], baseUrl);

    return null;
  },

  normalizeUrl(candidateUrl, baseUrl) {
    if (!candidateUrl) return null;
    // Decode HTML entities like &amp;
    let clean = candidateUrl.replace(/&amp;/g, '&');
    try {
      return new URL(clean, baseUrl).href;
    } catch {
      return clean.startsWith('http') ? clean : null;
    }
  },
};

export default PhotoResolverService;
