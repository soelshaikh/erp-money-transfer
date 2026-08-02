'use strict';

/**
 * One-time seed script — creates the super_admin user in the 'system' tenant.
 * Run: node scripts/seed-super-admin.js
 * Safe to run multiple times — uses upsert.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

if (!MONGODB_URI || !SUPER_ADMIN_PASSWORD) {
  console.error('MONGODB_URI and SUPER_ADMIN_PASSWORD must be set in .env');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Require models after connection
  const TenantModel = require('../src/infrastructure/db/models/Tenant.model');
  const UserModel = require('../src/infrastructure/db/models/User.model');

  // Upsert system tenant
  const tenant = await TenantModel.findOneAndUpdate(
    { slug: 'system' },
    {
      $setOnInsert: {
        name: 'System',
        slug: 'system',
        contactEmail: 'admin@system.internal',
        status: 'active',
      },
    },
    { upsert: true, new: true }
  );

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  // Upsert super_admin user
  const user = await UserModel.findOneAndUpdate(
    { tenantId: tenant._id, username: 'superadmin' },
    {
      $setOnInsert: {
        tenantId: tenant._id,
        username: 'superadmin',
        passwordHash,
        role: 'super_admin',
        name: 'Super Admin',
        status: 'active',
        createdBy: tenant._id, // self-reference for seed
      },
    },
    { upsert: true, new: true }
  );

  console.log(`Super admin ready — tenantSlug: system | username: superadmin | id: ${user._id}`);
  await mongoose.connection.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
