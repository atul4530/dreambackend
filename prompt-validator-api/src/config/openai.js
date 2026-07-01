const OpenAI = require('openai');
const logger = require('../utils/logger');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  logger.error('OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

module.exports = openai;
