const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Ensure migrations directory exists
const migrationsDir = path.join(__dirname, '..', 'src', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// Get migration name from command line arguments
const migrationName = process.argv[2];
if (!migrationName) {
  console.error('Please provide a migration name (e.g., npm run migrate:create -- add_users_table)');
  process.exit(1);
}

// Format migration name (replace spaces and special characters with underscores)
const formattedName = migrationName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// Create timestamp for the migration filename
const now = new Date();
const timestamp = now.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const fileName = `${timestamp}_${formattedName}.sql`;
const filePath = path.join(migrationsDir, fileName);

// Create migration file with a template
const template = `-- Migration: ${formattedName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
-- Created: ${now.toISOString()}
-- Migration ID: ${uuidv4()}

-- Add your SQL below this line
BEGIN;

-- Your migration SQL here

COMMIT;
`;

// Write the migration file
fs.writeFileSync(filePath, template, 'utf8');
console.log(`Created migration: ${fileName}`);
