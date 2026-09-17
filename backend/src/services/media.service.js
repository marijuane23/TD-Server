import { MessageMediaModel } from '../models/messageMedia.model.js';
import { MessageModel } from '../models/message.model.js';
import { TeacherModel } from '../models/teacher.model.js';

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

  async streamMedia(mediaId, isDownload = false, res) {
    const media = await MessageMediaModel.getById(mediaId);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const ext = this.getExtension(media.media_mime);
    let filename = `media-${media.id}.${ext}`;

    if (isDownload) {
      try {
        const message = await MessageModel.getById(media.message_id);
        if (message) {
          const teacher = await TeacherModel.getById(message.teacher_id);
          if (teacher) {
            filename = `${teacher.slug}-message-${media.id}.${ext}`;
          }
        }
      } catch (err) {
        // Fallback to default filename on error
      }
    }

    res.setHeader('Content-Type', media.media_mime);
    res.setHeader('Content-Length', media.media_data.length);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1-day client cache

    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }

    return res.end(media.media_data);
  },
};
