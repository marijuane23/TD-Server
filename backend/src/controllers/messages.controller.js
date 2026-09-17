import { TeacherModel } from '../models/teacher.model.js';
import { MessageModel } from '../models/message.model.js';
import { MessageMediaModel } from '../models/messageMedia.model.js';
import { ModerationService } from '../services/moderation.service.js';
import { getMediaType } from '../utils/validators.js';
import { config } from '../config/env.js';

export const MessagesController = {
  // POST /teachers/:slug/messages
  async submitMessage(req, res, next) {
    try {
      const { slug } = req.params;
      const teacher = await TeacherModel.getBySlug(slug);
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }

      // 1. Validate message text
      const messageText = req.body.message_text ? String(req.body.message_text).trim() : '';
      if (!messageText) {
        return res.status(400).json({ error: 'Message text is required.' });
      }
      if (messageText.length > 5000) {
        return res.status(400).json({ error: 'Message text cannot exceed 5,000 characters.' });
      }

      // 2. Honeypot & profanity screening via ModerationService
      ModerationService.validateSubmission({ text: messageText, body: req.body });

      const senderName = req.body.sender_name ? String(req.body.sender_name).trim() : 'Anonymous';

      // 4. Insert message
      const messageId = await MessageModel.create({
        teacher_id: teacher.id,
        sender_name: senderName,
        message_text: messageText,
      });

      // 5. Handle optional media attachment (image or video)
      let mediaId = null;
      let mediaType = null;
      if (req.file) {
        mediaType = getMediaType(req.file.mimetype);
        if (!mediaType) {
          return res.status(400).json({ error: 'Unsupported media file type.' });
        }

        mediaId = await MessageMediaModel.create({
          message_id: messageId,
          media_data: req.file.buffer,
          media_type: mediaType,
          media_mime: req.file.mimetype,
          media_size_bytes: req.file.size,
        });
      }

      const mediaUrl = mediaId ? `${config.backendPublicUrl}/media/${mediaId}` : null;

      res.status(201).json({
        success: true,
        message: 'Your message has been posted to the timeline!',
        data: {
          id: messageId,
          teacher_id: teacher.id,
          sender_name: senderName,
          message_text: messageText,
          created_at: new Date().toISOString(),
          media_id: mediaId,
          media_type: mediaType,
          media_mime: req.file ? req.file.mimetype : null,
          media_size_bytes: req.file ? req.file.size : null,
          media_url: mediaUrl,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
