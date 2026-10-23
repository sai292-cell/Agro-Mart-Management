import app from './app.js';
import { env } from './config/env.js';
import { connectToDatabase, closeDbConnection } from './config/db.js';

let server;
let reconnectTimer;

async function startServer() {
  // Attempt database connection at startup
  try {
    await connectToDatabase();
  } catch (err) {
    console.error(`⚠️ Server starting with database in offline state. Will periodically retry connecting in background.`);
  }

  // Periodic background reconnect attempt if database is offline
  reconnectTimer = setInterval(async () => {
    try {
      const { isDbConnected } = await import('./config/db.js');
      if (!isDbConnected()) {
        await connectToDatabase();
      }
    } catch (retryErr) {
      // Retrying silently in background
    }
  }, 10000);

  server = app.listen(env.PORT, () => {
    console.log(`=======================================================`);
    console.log(`🌾 Shivshree Agro Mart OS — Server API`);
    console.log(`📡 Status: Running on port ${env.PORT}`);
    console.log(`🌐 Environment: ${env.NODE_ENV}`);
    console.log(`🔗 Health Liveness:  http://localhost:${env.PORT}${env.API_PREFIX}/health`);
    console.log(`🔗 Health Readiness: http://localhost:${env.PORT}${env.API_PREFIX}/health/ready`);
    console.log(`=======================================================`);
  });
}

// Graceful shutdown handling
const handleShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Closing server safely...`);

  if (reconnectTimer) {
    clearInterval(reconnectTimer);
  }

  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed.');
    });
  }

  // Gracefully close database connection
  await closeDbConnection();

  console.log('✅ Process terminating safely.');
  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();
