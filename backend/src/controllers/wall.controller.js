import { WallMessageModel } from '../models/wallMessage.model.js';
import { ModerationService } from '../services/moderation.service.js';
import { TeacherModel } from '../models/teacher.model.js';
import { MessageModel } from '../models/message.model.js';
import { MessageMediaModel } from '../models/messageMedia.model.js';
import { config } from '../config/env.js';

export const WallController = {
  // GET /wall (?after_id=&limit=)
  async getWallGreetings(req, res, next) {
    try {
      const { after_id, limit } = req.query;
      const rawItems = await WallMessageModel.getWallMessages({ after_id, limit });

      const items = rawItems.map(item => ({
        id: item.id,
        sender_name: item.sender_name,
        message_text: item.message_text,
        created_at: item.created_at,
        teacher_id: item.teacher_id,
        teacher_name: item.teacher_name || null,
        teacher_slug: item.teacher_slug || null,
        image_url: item.has_media ? `${config.backendPublicUrl}/wall/${item.id}/image` : null,
      }));

      const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

      res.json({
        items,
        count: items.length,
        nextCursor,
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /wall/:id/image (stream attached image blob)
  async getWallImage(req, res, next) {
    try {
      const { id } = req.params;
      const media = await WallMessageModel.getImageById(id);
      if (!media || !media.media_data) {
        return res.status(404).json({ error: 'Image not found' });
      }

      res.set('Content-Type', media.media_mime || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(media.media_data);
    } catch (err) {
      next(err);
    }
  },

  // POST /wall (submit new greeting, optional photo, optional teacher dedication)
  async postGreeting(req, res, next) {
    try {
      // 1. Validate greeting text
      const messageText = req.body.message_text ? String(req.body.message_text).trim() : '';
      if (!messageText) {
        return res.status(400).json({ error: 'Greeting message is required.' });
      }
      if (messageText.length > 2000) {
        return res.status(400).json({ error: 'Greeting text cannot exceed 2,000 characters.' });
      }

      // 2. Screening via ModerationService (honeypot + profanity)
      ModerationService.validateSubmission({ text: messageText, body: req.body });

      const senderName = req.body.sender_name ? String(req.body.sender_name).trim() : 'Anonymous';

      // 3. Optional Teacher Dedication
      let teacherId = null;
      let teacher = null;
      if (req.body.teacher_id && req.body.teacher_id !== 'none' && req.body.teacher_id !== '') {
        const parsedId = parseInt(req.body.teacher_id, 10);
        if (!isNaN(parsedId)) {
          teacher = await TeacherModel.getById(parsedId);
          if (teacher) {
            teacherId = teacher.id;
          }
        }
      }

      // 4. Optional Image Attachment
      let mediaData = null;
      let mediaMime = null;
      let mediaSize = null;
      if (req.file) {
        mediaData = req.file.buffer;
        mediaMime = req.file.mimetype;
        mediaSize = req.file.size;
      }

      // 5. Create wall greeting entry
      const item = await WallMessageModel.create({
        teacher_id: teacherId,
        sender_name: senderName,
        message_text: messageText,
        media_data: mediaData,
        media_mime: mediaMime,
        media_size_bytes: mediaSize,
      });

      // 6. Cross-post to Teacher's Timeline if teacher selected
      if (teacherId) {
        try {
          const messageId = await MessageModel.create({
            teacher_id: teacherId,
            sender_name: senderName,
            message_text: messageText,
          });

          if (mediaData) {
            await MessageMediaModel.create({
              message_id: messageId,
              media_data: mediaData,
              media_type: 'image',
              media_mime: mediaMime,
              media_size_bytes: mediaSize,
            });
          }
        } catch (crossErr) {
          console.error('Error cross-posting to teacher timeline:', crossErr);
        }
      }

      const responseItem = {
        id: item.id,
        sender_name: item.sender_name,
        message_text: item.message_text,
        created_at: item.created_at,
        teacher_id: item.teacher_id,
        teacher_name: item.teacher_name || (teacher ? teacher.name : null),
        teacher_slug: item.teacher_slug || (teacher ? teacher.slug : null),
        image_url: item.has_media ? `${config.backendPublicUrl}/wall/${item.id}/image` : null,
      };

      res.status(201).json({
        success: true,
        message: teacher
          ? `Your greeting has been posted to the Open Wall and to ${teacher.name}'s Timeline!`
          : 'Your greeting is now on the Public Wall!',
        data: responseItem,
      });
    } catch (err) {
      next(err);
    }
  },
};

