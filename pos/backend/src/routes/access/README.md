# Access Management API

This module provides a comprehensive Role-Based Access Control (RBAC) system for the Billiard POS application. It includes user authentication, role management, permission management, and audit logging.

## Authentication

### Login
- **POST** `/api/access/auth/login`
  - Request body: `{ email: string, password: string }`
  - Response: `{ user: object, token: string, expiresIn: string }`
  - Sets an HTTP-only cookie with the refresh token

### Refresh Token
- **POST** `/api/access/auth/refresh-token`
  - Uses the refresh token from cookies
  - Response: `{ token: string, expiresIn: string, user: object }`

### Logout
- **POST** `/api/access/auth/logout`
  - Revokes the current refresh token
  - Clears the refresh token cookie

### Get Current User
- **GET** `/api/access/auth/me`
  - Returns the current authenticated user's information
  - Response: `{ id: string, email: string, name: string, role: string, permissions: object }`

## Roles

### List Roles
- **GET** `/api/access/roles`
  - Query params: 
    - `page` (default: 1)
    - `limit` (default: 10, max: 50)
    - `search` (optional)
  - Response: `{ data: Role[], meta: { total, page, limit, totalPages } }`

### Get Role
- **GET** `/api/access/roles/:id`
  - Response: `Role`

### Create Role
- **POST** `/api/access/roles`
  - Requires permission: `roles:create`
  - Request body: `{ name: string, description?: string }`
  - Response: `Role`

### Update Role
- **PUT** `/api/access/roles/:id`
  - Requires permission: `roles:update`
  - Request body: `{ name?: string, description?: string }`
  - Response: Updated `Role`

### Delete Role
- **DELETE** `/api/access/roles/:id`
  - Requires permission: `roles:delete`
  - Cannot delete system roles
  - Response: `204 No Content`

## Permissions

### List Permissions
- **GET** `/api/access/permissions`
  - Query params:
    - `page` (default: 1)
    - `limit` (default: 50, max: 100)
    - `resource` (optional)
    - `action` (optional)
    - `search` (optional)
  - Response: `{ data: Permission[], meta: { total, page, limit, totalPages } }`

### Get Permission
- **GET** `/api/access/permissions/:id`
  - Response: `Permission`

### Create Permission
- **POST** `/api/access/permissions`
  - Requires permission: `permissions:create`
  - Request body: `{ resource: string, action: string, description?: string }`
  - Response: Created `Permission`

### Delete Permission
- **DELETE** `/api/access/permissions/:id`
  - Requires permission: `permissions:delete`
  - Cannot delete if assigned to roles
  - Response: `204 No Content`

### Get Unique Resources
- **GET** `/api/access/permissions/resources/list`
  - Response: `string[]` (list of unique resource names)

### Get Unique Actions
- **GET** `/api/access/permissions/actions/list`
  - Response: `string[]` (list of unique action names)

## Audit Logs

### List Audit Logs
- **GET** `/api/access/audit-logs`
  - Requires permission: `audit:read`
  - Query params:
    - `page` (default: 1)
    - `limit` (default: 50, max: 100)
    - `action` (optional)
    - `resourceType` (optional)
    - `resourceId` (optional)
    - `userId` (optional)
    - `startDate` (ISO date string, optional)
    - `endDate` (ISO date string, optional)
  - Response: `{ data: AuditLog[], meta: { total, page, limit, totalPages } }`

## Permission Metadata

### Get Permission Metadata
- **GET** `/api/access/permissions/meta`
  - Returns available resources and actions for frontend permission management
  - Response: `{ resources: string[], actions: string[], defaultPermissions: Array<{resource: string, action: string}> }`

## Models

### Role
```typescript
interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  permissions?: Permission[];
}
```

### Permission
```typescript
interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}
```

### AuditLog
```typescript
interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, any> | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string; // ISO date string
}
```

## Environment Variables

- `JWT_SECRET`: Secret key for signing JWT tokens
- `JWT_EXPIRES_IN`: Token expiration time (default: '8h')
- `REFRESH_TOKEN_EXPIRY`: Refresh token expiration in milliseconds (default: 7 days)
- `NODE_ENV`: Environment ('development' or 'production')
