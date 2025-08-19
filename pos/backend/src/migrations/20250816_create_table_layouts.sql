-- Create table_layouts table
CREATE TABLE IF NOT EXISTS `table_layouts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `is_active` BOOLEAN DEFAULT FALSE,
  `floor_plan_image` VARCHAR(255),
  `width` INT DEFAULT 1000,
  `height` INT DEFAULT 800,
  `background_color` VARCHAR(20) DEFAULT '#f5f5f5',
  `grid_size` INT DEFAULT 10,
  `created_by` VARCHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create table_blocks table if it doesn't exist
CREATE TABLE IF NOT EXISTS `table_blocks` (
  `id` VARCHAR(64) PRIMARY KEY,
  `table_id` VARCHAR(64) NOT NULL,
  `block_type` VARCHAR(50) NOT NULL,
  `position_x` INT DEFAULT 0,
  `position_y` INT DEFAULT 0,
  `width` INT DEFAULT 100,
  `height` INT DEFAULT 100,
  `rotation` INT DEFAULT 0,
  `z_index` INT DEFAULT 1,
  `settings` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- First check if columns exist before adding them
SET @dbname = DATABASE();
SET @tablename = 'table_blocks';

-- Add layout_id column if it doesn't exist
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname 
   AND TABLE_NAME = @tablename 
   AND COLUMN_NAME = 'layout_id') = 0,
  'ALTER TABLE table_blocks ADD COLUMN layout_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci AFTER id',
  'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add other columns with the same pattern
-- Add x column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname 
   AND TABLE_NAME = @tablename 
   AND COLUMN_NAME = 'x') = 0,
  'ALTER TABLE table_blocks ADD COLUMN x INT DEFAULT 0 AFTER layout_id',
  'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add y column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname 
   AND TABLE_NAME = @tablename 
   AND COLUMN_NAME = 'y') = 0,
  'ALTER TABLE table_blocks ADD COLUMN y INT DEFAULT 0 AFTER x',
  'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add width column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname 
   AND TABLE_NAME = @tablename 
   AND COLUMN_NAME = 'width') = 0,
  'ALTER TABLE table_blocks ADD COLUMN width INT DEFAULT 100 AFTER y',
  'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add height column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname 
   AND TABLE_NAME = @tablename 
   AND COLUMN_NAME = 'height') = 0,
  'ALTER TABLE table_blocks ADD COLUMN height INT DEFAULT 100 AFTER width',
  'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add rotation column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname 
   AND TABLE_NAME = @tablename 
   AND COLUMN_NAME = 'rotation') = 0,
  'ALTER TABLE table_blocks ADD COLUMN rotation INT DEFAULT 0 AFTER height',
  'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add z_index column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname 
   AND TABLE_NAME = @tablename 
   AND COLUMN_NAME = 'z_index') = 0,
  'ALTER TABLE table_blocks ADD COLUMN z_index INT DEFAULT 1 AFTER rotation',
  'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add settings column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname 
   AND TABLE_NAME = @tablename 
   AND COLUMN_NAME = 'settings') = 0,
  'ALTER TABLE table_blocks ADD COLUMN settings JSON AFTER z_index',
  'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add foreign key constraint if it doesn't exist
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
   WHERE CONSTRAINT_SCHEMA = @dbname 
   AND TABLE_NAME = 'table_blocks' 
   AND CONSTRAINT_NAME = 'fk_table_blocks_layout') = 0,
  'ALTER TABLE table_blocks MODIFY COLUMN layout_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, ADD CONSTRAINT fk_table_blocks_layout FOREIGN KEY (layout_id) REFERENCES table_layouts(id) ON DELETE CASCADE',
  'SELECT 1'
));

PREPARE fkIfNotExists FROM @preparedStatement;
EXECUTE fkIfNotExists;
DEALLOCATE PREPARE fkIfNotExists;

-- Add layout_id to tables table if it doesn't exist
SET @tablename = 'tables';

-- Add layout_id column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname 
   AND TABLE_NAME = @tablename 
   AND COLUMN_NAME = 'layout_id') = 0,
  'ALTER TABLE tables ADD COLUMN layout_id VARCHAR(36) AFTER id',
  'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add foreign key constraint if it doesn't exist
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
   WHERE CONSTRAINT_SCHEMA = @dbname 
   AND TABLE_NAME = 'tables' 
   AND CONSTRAINT_NAME = 'fk_tables_layout') = 0,
  'ALTER TABLE tables ADD CONSTRAINT fk_tables_layout FOREIGN KEY (layout_id) REFERENCES table_layouts(id) ON DELETE SET NULL',
  'SELECT 1'
));

PREPARE fkIfNotExists FROM @preparedStatement;
EXECUTE fkIfNotExists;
DEALLOCATE PREPARE fkIfNotExists;

-- Insert a default layout if none exists
INSERT IGNORE INTO `table_layouts` (
  `id`, `name`, `description`, `is_active`, `created_by`
) VALUES (
  'default-layout', 
  'Default Layout', 
  'Default table layout created by system', 
  TRUE, 
  'admin'
);

-- Update existing tables to use the default layout
UPDATE `tables` SET `layout_id` = 'default-layout' WHERE `layout_id` IS NULL;

-- Add permissions for table layouts
INSERT IGNORE INTO `permissions` (`id`, `resource`, `action`, `description`) VALUES
  ('perm_table_layouts_view', 'table-layouts', 'read', 'View table layouts'),
  ('perm_table_layouts_manage', 'table-layouts', 'manage', 'Manage table layouts');

-- Grant permissions to admin role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'role_admin', 'perm_table_layouts_view' FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `role_permissions` 
  WHERE `role_id` = 'role_admin' AND `permission_id` = 'perm_table_layouts_view'
);

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'role_admin', 'perm_table_layouts_manage' FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `role_permissions` 
  WHERE `role_id` = 'role_admin' AND `permission_id` = 'perm_table_layouts_manage'
);

-- Record the migration if it doesn't exist
INSERT IGNORE INTO `migrations` (`name`) VALUES ('20250816_create_table_layouts.sql');
