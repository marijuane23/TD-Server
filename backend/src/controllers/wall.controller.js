import { WallMessageModel } from '../models/wallMessage.model.js';
import { ModerationService } from '../services/moderation.service.js';

export const WallController = {
  // GET /wall (?after_id=&limit=)
  async getWallGreetings(req, res, next) {
    try {
      const { after_id, limit } = req.query;
      const items = await WallMessageModel.getWallMessages({ after_id, limit });

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

  // POST /wall
  async postGreeting(req, res, next) {
    try {
      // 1. Validate greeting text
      const messageText = req.body.message_text ? String(req.body.message_text).trim() : '';
      if (!messageText) {
        return res.status(400).json({ error: 'Greeting message is required.' });
      }
      if (messageText.length > 1000) {
        return res.status(400).json({ error: 'Greeting text cannot exceed 1,000 characters.' });
      }

      // 2. Screening via ModerationService (honeypot + profanity)
      ModerationService.validateSubmission({ text: messageText, body: req.body });

      const senderName = req.body.sender_name ? String(req.body.sender_name).trim() : 'Anonymous';

      const item = await WallMessageModel.create({
        sender_name: senderName,
        message_text: messageText,
      });

      res.status(201).json({
        success: true,
        message: 'Your greeting is now on the Public Wall!',
        data: item,
      });
    } catch (err) {
      next(err);
    }
  },
};
