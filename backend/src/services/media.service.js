import { MessageMediaModel } from '../models/messageMedia.model.js';
import { MessageModel } from '../models/message.model.js';
import { TeacherModel } from '../models/teacher.model.js';
import { imageCache, isFresh, generateETag } from '../utils/cache.js';

export const MediaService = {
  // Map mime to file extension
  getExtension(mime = '') {
    const map = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
    };
    return map[mime] || 'bin';
  },

  async streamMedia(mediaId, isDownload = false, res, req = null) {
    const cacheKey = `media:${mediaId}`;
    let cached = imageCache.get(cacheKey);

    let mediaData;
    let mediaMime;
    let etag;

    if (cached) {
      mediaData = cached.data;
      mediaMime = cached.mime;
      etag = cached.etag;
    } else {
      const media = await MessageMediaModel.getById(mediaId);
      if (!media || !media.media_data) {
        return res.status(404).json({ error: 'Media not found' });
      }

      mediaData = media.media_data;
      mediaMime = media.media_mime;
      etag = generateETag(cacheKey, mediaData);

      // Cache the binary buffer in Node memory
      imageCache.set(cacheKey, {
        data: mediaData,
        mime: mediaMime,
        etag,
      });
    }

    // 1. Check HTTP Conditional Cache (ETag / If-None-Match)
    if (req && isFresh(req, etag)) {
      return res.status(304).end();
    }

    // 2. Set long-lived client cache headers with stale-while-revalidate
    res.setHeader('Content-Type', mediaMime);
    res.setHeader('Content-Length', mediaData.length);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');

    if (isDownload) {
      let filename = `media-${mediaId}.${this.getExtension(mediaMime)}`;
      try {
        const mediaMeta = await MessageMediaModel.getById(mediaId);
        if (mediaMeta) {
          const message = await MessageModel.getById(mediaMeta.message_id);
          if (message) {
            const teacher = await TeacherModel.getById(message.teacher_id);
            if (teacher) {
              filename = `${teacher.slug}-message-${mediaId}.${this.getExtension(mediaMime)}`;
            }
          }
        }
      } catch (err) {
        // Fallback to default filename on error
      }
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }

    return res.end(mediaData);
  },
};
