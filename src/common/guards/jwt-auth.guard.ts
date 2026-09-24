import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { isObservable, firstValueFrom } from "rxjs";
import { RedisService } from "../../infra/redis/redis.service";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") implements CanActivate {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = super.canActivate(context);
    const authenticated = isObservable(result)
      ? await firstValueFrom(result)
      : await result;

    if (!authenticated) return false;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { jti?: string };

    if (!user?.jti) return false;

    if (await this.redis.isAccessTokenBlacklisted(user.jti)) {
      return false;
    }

    return true;
  }
}
