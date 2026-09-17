import { MessageModel } from '../models/message.model.js';
import { MessageMediaModel } from '../models/messageMedia.model.js';
import { WallMessageModel } from '../models/wallMessage.model.js';
import { hasProfanity, checkHoneypot } from '../utils/validators.js';

export const ModerationService = {
  // Automated content screening for public submissions
  validateSubmission({ text = '', body = {} } = {}) {
    // 1. Honeypot bot check
    if (!checkHoneypot(body)) {
      const err = new Error('Spam submission detected.');
      err.status = 400;
      throw err;
    }

    // 2. Profanity / offensive language filter
    if (hasProfanity(text)) {
      const err = new Error('Please ensure your submission contains respectful language.');
      err.status = 400;
      throw err;
    }

    return true;
  },

  // Post-hoc moderation: Delete entire message + cascade attached media
  async deleteMessage(messageId) {
    const deleted = await MessageModel.deleteById(messageId);
    if (!deleted) {
      const err = new Error('Message not found');
      err.status = 404;
      throw err;
    }
    return true;
  },

  // Post-hoc moderation: Delete only media attachment, preserving text message
  async deleteMedia(mediaId) {
    const deleted = await MessageMediaModel.deleteById(mediaId);
    if (!deleted) {
      const err = new Error('Media not found');
      err.status = 404;
      throw err;
    }
    return true;
  },

  // Post-hoc moderation: Delete public wall greeting
  async deleteWallGreeting(wallId) {
    const deleted = await WallMessageModel.deleteById(wallId);
    if (!deleted) {
      const err = new Error('Wall greeting not found');
      err.status = 404;
      throw err;
    }
    return true;
  },
};

export default ModerationService;
