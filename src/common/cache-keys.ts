export const CacheKeys = {
  rolePermissions: (roleName: string) => `rbac:role:${roleName}:permissions`,
  usersDirectory: "users:directory",
  projectsList: "projects:list",
  blacklistedAccessToken: (jti: string) => `auth:blacklist:access:${jti}`,
} as const;
