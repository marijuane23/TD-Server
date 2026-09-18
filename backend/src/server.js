import app from './app.js';
import { config } from './config/env.js';

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Teacher's Day Backend API running on port ${config.port}`);
  console.log(`🌐 Environment: ${config.nodeEnv}`);
  console.log(`📍 Public URL: ${config.backendPublicUrl}`);
  console.log(`🩺 Health check: ${config.backendPublicUrl}/health`);
  console.log(`====================================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
