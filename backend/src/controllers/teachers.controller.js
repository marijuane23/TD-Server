import { TeacherModel } from '../models/teacher.model.js';
import { MessageModel } from '../models/message.model.js';
import { PhotoResolverService } from '../services/photoResolver.service.js';
import { config } from '../config/env.js';

export const TeachersController = {
  // GET /teachers (search, sort, pagination)
  async getTeachers(req, res, next) {
    try {
      const { q, college, sort, page, limit } = req.query;
      const result = await TeacherModel.getTeachers({ q, college, sort, page, limit });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // GET /teachers/:slug (teacher profile + timeline entries)
  async getTeacherBySlug(req, res, next) {
    try {
      const { slug } = req.params;
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

      res.json({
        teacher,
        messages,
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /teachers/:id/photo (stream stored LONGBLOB photo)
  async getTeacherPhoto(req, res, next) {
    try {
      const { id } = req.params;
      const photo = await TeacherModel.getPhotoById(id);
      if (!photo || !photo.photo_data) {
        return res.status(404).json({ error: 'Teacher photo not found' });
      }

      res.set('Content-Type', photo.photo_mime || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(photo.photo_data);
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
};

export default TeachersController;
