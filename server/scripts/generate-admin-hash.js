#!/usr/bin/env node

/**
 * Generate bcrypt hash for admin password
 * Usage: node scripts/generate-admin-hash.js "your-secure-password"
 */

import bcrypt from 'bcrypt';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/generate-admin-hash.js "your-secure-password"');
  process.exit(1);
}

if (password.length < 12) {
  console.error('❌ Password must be at least 12 characters long');
  process.exit(1);
}

const saltRounds = 12;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  
  console.log('✅ Admin password hash generated:');
  console.log('');
  console.log('Add this to your environment variables:');
  console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
  console.log('');
  console.log('🔒 Keep this hash secure and never commit it to version control!');
});