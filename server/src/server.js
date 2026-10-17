import app from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌾 Shivshree Agro Mart OS — Server API`);
  console.log(`📡 Status: Running on port ${env.PORT}`);
  console.log(`🌐 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 Health Check: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  console.log(`=======================================================`);
});

// Graceful shutdown handling
const handleShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Closing HTTP server gracefully...`);
  server.close(() => {
    console.log('✅ HTTP server closed. Process terminating safely.');
    process.exit(0);
  });

  // Force close after 10s timeout
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating server after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
