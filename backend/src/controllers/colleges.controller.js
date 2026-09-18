import { CollegesModel } from '../models/colleges.model.js';
import { apiCache } from '../utils/cache.js';

export const CollegesController = {
  // GET /colleges (cached in memory for 15 minutes)
  async getColleges(req, res, next) {
    try {
      const cacheKey = 'colleges:all';
      const cached = apiCache.get(cacheKey);

      if (cached) {
        return res.json(cached);
      }

      const colleges = await CollegesModel.getAll();
      apiCache.set(cacheKey, colleges, 900); // 15 minutes TTL

      res.json(colleges);
    } catch (err) {
      next(err);
    }
  },
};

export default CollegesController;
