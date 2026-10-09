import { ForbiddenException } from "@nestjs/common";
import { AuthUser } from "./decorators/current-user.decorator";

/** Staff actions always run inside one organization. Platform admins use org-admin routes. */
export function requireOrgId(actor: AuthUser): string {
  if (!actor.orgId) {
    throw new ForbiddenException(
      "This action requires an organization account",
    );
  }
  return actor.orgId;
}

export function assertSameOrg(
  actor: AuthUser,
  organizationId: string | null | undefined,
) {
  if (actor.isPlatformAdmin) return;
  if (!organizationId || organizationId !== actor.orgId) {
    throw new ForbiddenException("You cannot access another organization");
  }
}
