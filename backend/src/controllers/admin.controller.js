import { AuthService } from '../services/auth.service.js';
import { TeacherModel } from '../models/teacher.model.js';
import { MessageModel } from '../models/message.model.js';
import { TeacherExcelService } from '../services/teacherExcel.service.js';
import { ModerationService } from '../services/moderation.service.js';
import { PhotoResolverService } from '../services/photoResolver.service.js';
import { generateSlug } from '../utils/validators.js';
import { config } from '../config/env.js';

export const AdminController = {
  // POST /admin/login
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      const result = await AuthService.login(username, password);
      res.json({
        success: true,
        token: result.token,
        admin: result.admin,
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /admin/teachers (search, sort, pagination)
  async getTeachers(req, res, next) {
    try {
      const { q, sort, page, limit } = req.query;
      const result = await TeacherModel.getTeachers({ q, sort, page, limit });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // POST /admin/teachers (Add single teacher)
  async addTeacher(req, res, next) {
    try {
      const name = req.body.name ? String(req.body.name).trim() : '';
      const department = req.body.department ? String(req.body.department).trim() : null;
      const college_id = req.body.college_id ? parseInt(req.body.college_id, 10) : null;
      let photo_url = req.body.photo_url ? String(req.body.photo_url).trim() : null;
      let photo_data = req.file?.buffer || null;
      let photo_mime = req.file?.mimetype || null;

      if (!name) {
        return res.status(400).json({ error: 'Teacher name is required.' });
      }

      // If web URL is provided and no file uploaded, resolve and download image into database
      if (!photo_data && photo_url) {
        const resolved = await PhotoResolverService.resolveAndDownload(photo_url);
        if (resolved) {
          photo_data = resolved.buffer;
          photo_mime = resolved.mime;
          photo_url = resolved.resolvedUrl || photo_url;
        }
      }

      // Unique slug check & generation
      const baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;

      while (true) {
        const existing = await TeacherModel.getBySlug(slug);
        if (!existing) break;
        counter++;
        slug = `${baseSlug}-${counter}`;
      }

      const newTeacher = await TeacherModel.create({
        name,
        department,
        college_id,
        photo_url,
        slug,
        photo_data,
        photo_mime,
      });

      res.status(201).json({
        success: true,
        message: 'Teacher added successfully.',
        data: newTeacher,
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /admin/teachers/import (Bulk import via .xlsx)
  async importTeachers(req, res, next) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Please upload an .xlsx file to import.' });
      }

      const result = await TeacherExcelService.importFromBuffer(req.file.buffer);
      res.json({
        success: true,
        message: `Import completed: ${result.createdCount} teachers added.`,
        createdCount: result.createdCount,
        skipped: result.skipped,
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /admin/teachers/export (Export current/filtered teacher list to .xlsx)
  async exportTeachers(req, res, next) {
    try {
      const { q, sort } = req.query;
      const buffer = await TeacherExcelService.exportToBuffer({ q, sort });
      const dateStr = new Date().toISOString().split('T')[0];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="teachers-${dateStr}.xlsx"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  // GET /admin/teachers/template (Download import template)
  async downloadTemplate(req, res, next) {
    try {
      const buffer = await TeacherExcelService.generateTemplateBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="teacher-import-template.xlsx"');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  // GET /admin/teachers/:id/messages (Oversight list of messages for moderation)
  async getTeacherMessages(req, res, next) {
    try {
      const teacherId = parseInt(req.params.id, 10);
      const teacher = await TeacherModel.getById(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }

      const rawMessages = await MessageModel.getByTeacherId(teacherId);
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

  // DELETE /admin/teachers/:id (Delete single teacher and cascade-delete tributes/media)
  async deleteTeacher(req, res, next) {
    try {
      const { id } = req.params;
      const teacher = await TeacherModel.getById(id);
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found.' });
      }
      await TeacherModel.delete(id);
      res.json({
        success: true,
        message: `Teacher "${teacher.name}" deleted successfully.`,
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /admin/teachers/bulk-delete (Bulk delete teachers by ID array)
  async bulkDeleteTeachers(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of teacher IDs to delete.' });
      }
      const count = await TeacherModel.deleteMany(ids);
      res.json({
        success: true,
        message: `Successfully deleted ${count} teacher(s).`,
        deletedCount: count,
      });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /admin/messages/:id (Delete full message + attached media via cascade)
  async deleteMessage(req, res, next) {
    try {
      const messageId = parseInt(req.params.id, 10);
      await ModerationService.deleteMessage(messageId);
      res.json({
        success: true,
        message: 'Message and any associated media deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /admin/media/:id (Delete only media attachment, keep text message)
  async deleteMedia(req, res, next) {
    try {
      const mediaId = parseInt(req.params.id, 10);
      await ModerationService.deleteMedia(mediaId);
      res.json({
        success: true,
        message: 'Attached media removed successfully. Text message remains intact.',
      });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /admin/wall/:id (Post-hoc moderation of public wall greeting)
  async deleteWallGreeting(req, res, next) {
    try {
      const wallId = parseInt(req.params.id, 10);
      await ModerationService.deleteWallGreeting(wallId);
      res.json({
        success: true,
        message: 'Wall greeting deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  },
};
