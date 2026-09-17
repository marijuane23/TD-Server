import { CollegesModel } from '../models/colleges.model.js';

export const CollegesController = {
  // GET /colleges
  async getColleges(req, res, next) {
    try {
      const colleges = await CollegesModel.getAll();
      res.json(colleges);
    } catch (err) {
      next(err);
    }
  },
};

export default CollegesController;
