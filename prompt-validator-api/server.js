require('dotenv').config();

const app = require('./src/app');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: reason.message || reason });
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  server.close(() => process.exit(1));
});
