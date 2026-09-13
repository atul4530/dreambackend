const { Router } = require('express');
const adminAuth = require('../middleware/adminAuth');
const {
  createAdminTrendController,
  createAdminCategoryController,
} = require('../controllers/adminTrend.controller');

const router = Router();
const trendController = createAdminTrendController();
const categoryController = createAdminCategoryController();

// All admin endpoints require the X-Admin-Key header (see middleware/adminAuth.js).
router.use(adminAuth);

router.use('/categories', categoryController);
router.use('/', trendController);

module.exports = router;