import { TeacherModel } from '../models/teacher.model.js';
import { MessageModel } from '../models/message.model.js';
import { PhotoResolverService } from '../services/photoResolver.service.js';
import { config } from '../config/env.js';
import { imageCache, apiCache, isFresh, generateETag } from '../utils/cache.js';

export const TeachersController = {
  // GET /teachers (search, sort, pagination)
  async getTeachers(req, res, next) {
    try {
      const { q, college, sort, page, limit } = req.query;
      const cacheKey = `teachers:list:${q || ''}:${college || ''}:${sort || ''}:${page || '1'}:${limit || '12'}`;
      const cached = apiCache.get(cacheKey);

      if (cached) {
        return res.json(cached);
      }

      const result = await TeacherModel.getTeachers({ q, college, sort, page, limit });

      // Cache directory query for 2 minutes
      apiCache.set(cacheKey, result, 120);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // GET /teachers/:slug (teacher profile + timeline entries)
  async getTeacherBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const cacheKey = `teachers:profile:${slug}`;
      const cached = apiCache.get(cacheKey);

      if (cached) {
        return res.json(cached);
      }

      const teacher = await TeacherModel.getBySlug(slug);
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }

      const rawMessages = await MessageModel.getByTeacherId(teacher.id);

      // Transform messages with public media URLs
      const messages = rawMessages.map(m => ({
        id: m.id,
        teacher_id: m.teacher_id,
        sender_name: m.sender_name,
        message_text: m.message_text,
        created_at: m.created_at,
        media_id: m.media_id,
        media_type: m.media_type,
        media_mime: m.media_mime,
        media_size_bytes: m.media_size_bytes,
        media_url: m.media_id ? `${config.backendPublicUrl}/media/${m.media_id}` : null,
      }));

      const responseData = {
        teacher,
        messages,
      };

      // Cache profile for 60 seconds
      apiCache.set(cacheKey, responseData, 60);

      res.json(responseData);
    } catch (err) {
      next(err);
    }
  },

  // GET /teachers/:id/photo (stream stored LONGBLOB photo with LRU cache & ETag 304)
  async getTeacherPhoto(req, res, next) {
    try {
      const { id } = req.params;
      const cacheKey = `teacher_photo:${id}`;
      let cached = imageCache.get(cacheKey);

      let photoData;
      let photoMime;
      let etag;

      if (cached) {
        photoData = cached.data;
        photoMime = cached.mime;
        etag = cached.etag;
      } else {
        const photo = await TeacherModel.getPhotoById(id);
        if (!photo || !photo.photo_data) {
          return res.status(404).json({ error: 'Teacher photo not found' });
        }

        photoData = photo.photo_data;
        photoMime = photo.photo_mime || 'image/jpeg';
        etag = generateETag(cacheKey, photoData);

        imageCache.set(cacheKey, {
          data: photoData,
          mime: photoMime,
          etag,
        });
      }

      // Check HTTP Conditional Request
      if (isFresh(req, etag)) {
        return res.status(304).end();
      }

      res.setHeader('Content-Type', photoMime);
      res.setHeader('Content-Length', photoData.length);
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      return res.end(photoData);
    } catch (err) {
      next(err);
    }
  },

  // POST /teachers/:slug/photo (Upload or update profile picture from timeline)
  async updateTeacherPhoto(req, res, next) {
    try {
      const { slug } = req.params;
      const teacher = await TeacherModel.getBySlug(slug);
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }

      let photo_data = req.file?.buffer || null;
      let photo_mime = req.file?.mimetype || null;
      let photo_url = req.body?.photo_url ? String(req.body.photo_url).trim() : null;

      // If web URL is provided and no file uploaded, resolve and download image
      if (!photo_data && photo_url) {
        const resolved = await PhotoResolverService.resolveAndDownload(photo_url);
        if (resolved) {
          photo_data = resolved.buffer;
          photo_mime = resolved.mime;
          photo_url = resolved.resolvedUrl || photo_url;
        }
      }

      if (!photo_data && !photo_url) {
        return res.status(400).json({ error: 'Please select an image file or provide a valid photo URL.' });
      }

      const updated = await TeacherModel.updatePhoto({
        id: teacher.id,
        photo_data,
        photo_mime,
        photo_url,
      });

      // Invalidate image cache for this teacher
      imageCache.del(`teacher_photo:${teacher.id}`);
      // Invalidate teacher listings and profile
      apiCache.invalidate('teachers:');

      // Add cache-busting timestamp so browser re-renders the new image instantly
      const responseTeacher = { ...updated };
      if (responseTeacher.photo_url) {
        const separator = responseTeacher.photo_url.includes('?') ? '&' : '?';
        responseTeacher.photo_url = `${responseTeacher.photo_url}${separator}t=${Date.now()}`;
      }

      res.json({
        success: true,
        message: 'Teacher profile picture updated successfully.',
        teacher: responseTeacher,
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /teachers/resolve-preview (Instant preview for web links & Pinterest pins)
  async resolvePhotoPreview(req, res, next) {
    try {
      const url = req.body?.url ? String(req.body.url).trim() : '';
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const resolved = await PhotoResolverService.resolveAndDownload(url);
      if (!resolved) {
        return res.status(422).json({ error: 'Could not extract an image from this link. Please check the URL or upload a file.' });
      }

      const base64 = resolved.buffer.toString('base64');
      const dataUrl = `data:${resolved.mime};base64,${base64}`;

      res.json({
        success: true,
        previewUrl: dataUrl,
        mime: resolved.mime,
        size: resolved.buffer.length,
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /teachers/dropdown (Lightweight list of all teachers for dropdowns - cached 5 mins)
  async getDropdownList(req, res, next) {
    try {
      const cacheKey = 'teachers:dropdown';
      const cached = apiCache.get(cacheKey);

      if (cached) {
        return res.json(cached);
      }

      const teachers = await TeacherModel.getAllForDropdown();
      apiCache.set(cacheKey, teachers, 300); // 5 minutes TTL

      res.json(teachers);
    } catch (err) {
      next(err);
    }
  },
};

export default TeachersController;
