const { Router } = require('express');
const { validatePrompt } = require('../controllers/prompt.controller');
const validateRequest = require('../middleware/validateRequest');

const router = Router();

router.post('/validate', validateRequest, validatePrompt);

module.exports = router;
