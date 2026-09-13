const { Router } = require('express');
const { listTrends, getTrend, getTrendImage, listCategories } = require('../controllers/trend.controller');

const router = Router();

router.get('/categories', listCategories);
router.get('/', listTrends);
router.get('/:id/image', getTrendImage);
router.get('/:id', getTrend);

module.exports = router;