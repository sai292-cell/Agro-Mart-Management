/**
 * One-Time Owner Provisioning Script
 * Shivshree Agro Mart OS
 *
 * Usage:
 *   node src/scripts/provisionOwner.js --name="Owner Name" --email="owner@example.com" --password="YourStrongPassword123!"
 * Or via environment variables:
 *   OWNER_NAME="..." OWNER_EMAIL="..." OWNER_PASSWORD="..." node src/scripts/provisionOwner.js
 */

import { connectToDatabase, closeDbConnection } from '../config/db.js';
import { Shop } from '../models/Shop.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { hashPassword } from '../utils/tokenUtils.js';

// Parse command line arguments (--key=value)
function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key && value !== undefined) {
        args[key] = value;
      }
    }
  }
  return args;
}

const args = parseArgs();
const name = args.name || process.env.OWNER_NAME;
const email = (args.email || process.env.OWNER_EMAIL || '').toLowerCase().trim();
const phone = (args.phone || process.env.OWNER_PHONE || '').trim();
const password = args.password || process.env.OWNER_PASSWORD;

function validatePasswordStrength(pwd) {
  if (!pwd || typeof pwd !== 'string') return false;
  if (pwd.length < 10) return false;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

async function runProvisioning() {
  console.log('🌾 Shivshree Agro Mart OS — One-Time Owner Provisioning');
  console.log('-------------------------------------------------------');

  if (!name || (!email && !phone) || !password) {
    console.error('❌ Missing required parameters.');
    console.error('Required:');
    console.error('  --name="<Owner Full Name>"');
    console.error('  --email="<Owner Email>" (or --phone="<Mobile Number>")');
    console.error('  --password="<Strong Password>"');
    console.error('\nExample:');
    console.error('  node src/scripts/provisionOwner.js --name="Sai Gite" --email="owner@shivshreeagro.com" --password="SuperSecurePassword123!"');
    process.exit(1);
  }

  if (!validatePasswordStrength(password)) {
    console.error('❌ Password does not satisfy security requirements:');
    console.error('  - Minimum 10 characters long');
    console.error('  - At least 1 uppercase letter (A-Z)');
    console.error('  - At least 1 lowercase letter (a-z)');
    console.error('  - At least 1 number (0-9)');
    console.error('  - At least 1 special character (!@#$%^&* etc.)');
    process.exit(1);
  }

  try {
    await connectToDatabase();

    // 1. Find or initialize the primary Mart shop
    let shop = await Shop.findOne({ name: 'Shivshree Agro Mart' });
    if (!shop) {
      console.log('ℹ️ Default shop record not found. Creating primary shop "Shivshree Agro Mart"...');
      shop = await Shop.create({
        name: 'Shivshree Agro Mart',
        displayName: 'Shivshree Agro Mart',
        state: 'Maharashtra',
        country: 'India',
        preferredLanguage: 'mr',
        active: true,
      });
      console.log(`✅ Shop initialized with ID: ${shop._id}`);
    }

    // 2. Security Check: Refuse if OWNER account already exists for this shop
    const existingOwner = await User.findOne({
      shopId: shop._id,
      role: 'OWNER',
    });

    if (existingOwner) {
      console.error(`❌ SECURITY REJECTION: An OWNER account already exists for shop "${shop.name}".`);
      console.error(`Existing Owner ID: ${existingOwner._id} | Registered: ${existingOwner.createdAt.toISOString()}`);
      console.error('One-time provisioning cannot overwrite or duplicate existing Owner accounts.');
      await closeDbConnection();
      process.exit(1);
    }

    // 3. Hash password securely
    const passwordHash = await hashPassword(password);

    // 4. Create primary Owner account
    const owner = await User.create({
      shopId: shop._id,
      name,
      email: email || undefined,
      phone: phone || undefined,
      passwordHash,
      role: 'OWNER',
      active: true,
      emailVerified: !!email,
      phoneVerified: !!phone,
    });

    // 5. Audit Log entry
    await AuditLog.create({
      shopId: shop._id,
      actorUserId: owner._id,
      action: 'OWNER_PROVISIONED',
      entityType: 'USER',
      entityId: owner._id.toString(),
      reason: 'Initial primary shop owner account provisioning via CLI setup script',
      metadata: {
        ownerName: owner.name,
        role: 'OWNER',
        shopName: shop.name,
      },
    });

    console.log('-------------------------------------------------------');
    console.log('🎉 Primary Shop Owner successfully provisioned!');
    console.log(`👤 Name:     ${owner.name}`);
    console.log(`📧 Email:    ${owner.email || '[Not provided]'}`);
    console.log(`📱 Phone:    ${owner.phone || '[Not provided]'}`);
    console.log(`🛡️ Role:     ${owner.role}`);
    console.log(`🏪 Shop:     ${shop.name} (${shop._id})`);
    console.log('🔒 Password: [SECURED & HASHED - NEVER EXPOSED]');
    console.log('-------------------------------------------------------');

    await closeDbConnection();
    process.exit(0);
  } catch (err) {
    console.error('❌ Provisioning failed:', err.message);
    await closeDbConnection();
    process.exit(1);
  }
}

runProvisioning();
