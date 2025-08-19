-- Insert default permissions
INSERT IGNORE INTO permissions (id, resource, action, description) VALUES
-- User management permissions
('perm_user_create', 'users', 'create', 'Create new users'),
('perm_user_read', 'users', 'read', 'View user information'),
('perm_user_update', 'users', 'update', 'Update user information'),
('perm_user_delete', 'users', 'delete', 'Delete users'),

-- Role management permissions
('perm_role_create', 'roles', 'create', 'Create new roles'),
('perm_role_read', 'roles', 'read', 'View roles'),
('perm_role_update', 'roles', 'update', 'Update roles'),
('perm_role_delete', 'roles', 'delete', 'Delete roles'),

-- Permission management permissions
('perm_permission_create', 'permissions', 'create', 'Create new permissions'),
('perm_permission_read', 'permissions', 'read', 'View permissions'),
('perm_permission_update', 'permissions', 'update', 'Update permissions'),
('perm_permission_delete', 'permissions', 'delete', 'Delete permissions'),

-- Audit log permissions
('perm_audit_read', 'audit', 'read', 'View audit logs'),

-- Order management permissions
('perm_order_create', 'orders', 'create', 'Create new orders'),
('perm_order_read', 'orders', 'read', 'View orders'),
('perm_order_update', 'orders', 'update', 'Update orders'),
('perm_order_delete', 'orders', 'delete', 'Delete orders'),

-- Inventory management permissions
('perm_inventory_create', 'inventory', 'create', 'Create inventory items'),
('perm_inventory_read', 'inventory', 'read', 'View inventory'),
('perm_inventory_update', 'inventory', 'update', 'Update inventory'),
('perm_inventory_delete', 'inventory', 'delete', 'Delete inventory items'),

-- Reporting permissions
('perm_report_read', 'reports', 'read', 'View reports'),

-- Settings permissions
('perm_settings_read', 'settings', 'read', 'View settings'),
('perm_settings_update', 'settings', 'update', 'Update settings');

-- Insert default roles
INSERT IGNORE INTO roles (id, name, description, is_system) VALUES
('role_admin', 'Administrator', 'Full system access', TRUE),
('role_manager', 'Manager', 'Manager with most permissions', FALSE),
('role_staff', 'Staff', 'Regular staff member', FALSE),
('role_cashier', 'Cashier', 'Cashier with limited access', FALSE);

-- Assign all permissions to admin role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_admin', id FROM permissions;

-- Assign basic permissions to manager role
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_manager', 'perm_user_read'),
('role_manager', 'perm_role_read'),
('role_manager', 'perm_permission_read'),
('role_manager', 'perm_audit_read'),
('role_manager', 'perm_order_create'),
('role_manager', 'perm_order_read'),
('role_manager', 'perm_order_update'),
('role_manager', 'perm_inventory_read'),
('role_manager', 'perm_inventory_update'),
('role_manager', 'perm_report_read'),
('role_manager', 'perm_settings_read');

-- Assign basic permissions to staff role
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_staff', 'perm_order_create'),
('role_staff', 'perm_order_read'),
('role_staff', 'perm_order_update'),
('role_staff', 'perm_inventory_read');

-- Assign basic permissions to cashier role
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_cashier', 'perm_order_create'),
('role_cashier', 'perm_order_read'),
('role_cashier', 'perm_order_update');

-- Create default admin user if not exists
-- Default password: Admin@123 (will be hashed)
SET @adminPassword = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; -- bcrypt hash of 'Admin@123'

INSERT INTO users (id, email, name, password, role_id, is_active)
SELECT 
    'admin',
    'admin@billiardpos.com',
    'Administrator',
    @adminPassword,
    'role_admin',
    TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@billiardpos.com');

-- Create refresh_tokens table if not exists
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token VARCHAR(255) NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_token (token)
);
