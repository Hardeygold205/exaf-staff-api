import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { AuthUser } from "../common/decorators/current-user.decorator";

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  jti: string;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secretOrKey = config.get<string>("JWT_ACCESS_SECRET");
    if (!secretOrKey) {
      throw new Error(
        "JWT_ACCESS_SECRET is not set — refusing to start with an insecure default",
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.jti || !payload.exp) {
      throw new UnauthorizedException("Token must be reissued");
    }

    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
