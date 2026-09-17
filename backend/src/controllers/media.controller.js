import { MediaService } from '../services/media.service.js';

export const MediaController = {
  // GET /media/:media_id (?download=1)
  async getMedia(req, res, next) {
    try {
      const { media_id } = req.params;
      const isDownload = req.query.download === '1' || req.query.download === 'true';
      await MediaService.streamMedia(media_id, isDownload, res);
    } catch (err) {
      next(err);
    }
  },
};
