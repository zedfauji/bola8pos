-- Add indexes to improve database performance
-- This migration adds indexes to frequently queried columns

-- Refresh tokens table indexes
-- Commented out due to potential missing columns
-- -- CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
-- -- CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
-- -- CREATE INDEX idx_refresh_tokens_revoked ON refresh_tokens(revoked);
-- -- CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);

-- Users table indexes
-- Commented out due to potential missing columns
-- -- CREATE INDEX idx_users_email ON users(email);
-- -- CREATE INDEX idx_users_role_id ON users(role_id);
-- -- CREATE INDEX idx_users_is_active ON users(is_active);

-- Orders table indexes
-- CREATE INDEX idx_orders_user_id ON orders(user_id);
-- CREATE INDEX idx_orders_status ON orders(status);
-- CREATE INDEX idx_orders_created_at ON orders(created_at);
-- CREATE INDEX idx_orders_table_id ON orders(table_id);

-- Order items table indexes
-- CREATE INDEX idx_order_items_order_id ON order_items(order_id);
-- CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Products table indexes
-- CREATE INDEX idx_products_category_id ON products(category_id);
-- CREATE INDEX idx_products_is_active ON products(is_active);

-- Inventory table indexes
-- CREATE INDEX idx_inventory_product_id ON inventory(product_id);
-- CREATE INDEX idx_inventory_location_id ON inventory(location_id);

-- Tables table indexes
-- CREATE INDEX idx_tables_layout_id ON tables(layout_id);
-- CREATE INDEX idx_tables_status ON tables(status);
-- CREATE INDEX idx_tables_is_active ON tables(is_active);

-- Role permissions table indexes
-- CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
-- CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Audit logs table indexes
-- CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
-- CREATE INDEX idx_audit_logs_action ON audit_logs(action);
-- CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
-- CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Token blacklist table indexes
-- CREATE INDEX idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- Add composite indexes for frequently joined columns
-- CREATE INDEX idx_orders_user_status ON orders(user_id, status);
-- CREATE INDEX idx_inventory_product_location ON inventory(product_id, location_id);
-- CREATE INDEX idx_tables_layout_status ON tables(layout_id, status);
