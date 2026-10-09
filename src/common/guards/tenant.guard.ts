import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AuthUser } from "../decorators/current-user.decorator";

/** Rejects platform-only tokens on tenant routes that require an organization. */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) return false;
    if (user.isPlatformAdmin) return true;
    if (!user.orgId) {
      throw new ForbiddenException("Organization context is required");
    }
    return true;
  }
}
