import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(scriptDir, '../../.env') });

const { connectToDatabase, closeDbConnection } = await import('../config/db.js');
const { Shop } = await import('../models/Shop.js');
const { User } = await import('../models/User.js');

try {
  await connectToDatabase();

  const shopCount = await Shop.countDocuments();
  const ownerCount = await User.countDocuments({ role: 'OWNER' });

  console.log('Total shops:', shopCount);
  console.log('Total owner accounts:', ownerCount);
} catch (error) {
  console.error('Read-only check failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDbConnection();
}
