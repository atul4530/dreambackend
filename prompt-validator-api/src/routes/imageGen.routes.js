const { Router } = require('express');
const { generateFromImage } = require('../controllers/imageGen.controller');
const { validateImageGenRequest } = require('../middleware/validateImageGenRequest');

const router = Router();

router.post('/generate', validateImageGenRequest, generateFromImage);

module.exports = router;