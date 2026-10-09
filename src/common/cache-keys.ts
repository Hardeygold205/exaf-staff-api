export const CacheKeys = {
  rolePermissions: (roleId: string) => `rbac:role:${roleId}:permissions`,
  usersDirectory: (orgId: string) => `users:directory:${orgId}`,
  projectsList: (orgId: string) => `projects:list:${orgId}`,
  blacklistedAccessToken: (jti: string) => `auth:blacklist:access:${jti}`,
} as const;
