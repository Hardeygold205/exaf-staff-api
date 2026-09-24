import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  roles?: string[];
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthenticatedUser;
  };
}

@WebSocketGateway({
  namespace: "/workplace",
  cors: {
    origin: ["http://localhost:4200"],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token;

      if (!token) {
        this.logger.warn(`Disconnecting unauthenticated socket: ${client.id}`);
        client.disconnect();
        return;
      }

      // Verify token using JWT service
      const user = await this.verifySocketToken(token);

      if (!user) {
        client.disconnect();
        return;
      }

      client.data.user = user;

      await client.join(`user:${user.id}`);

      // this.logger.log(`User ${user.id} connected with socket ${client.id}`);
    } catch (error) {
      this.logger.warn(`Socket authentication failed: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.user?.id;
    // this.logger.log(`User ${userId ?? "unknown"} disconnected: ${client.id}`);
  }

  notifyPermissionUpdate(
    userId: string,
    payload?: {
      permissionGrants: string[];
      permissionRevokes: string[];
    },
  ): void {
    this.server.to(`user:${userId}`).emit("permissions_updated", {
      userId,
      ...payload,
    });
  }

  notifyUsersPermissionUpdate(userIds: string[]): void {
    for (const userId of userIds) {
      this.notifyPermissionUpdate(userId);
    }
  }

  notifyForceLogout(
    userId: string,
    reason: "ACCOUNT_DEACTIVATED" | "PASSWORD_RESET",
  ): void {
    const roomName = `user:${userId}`;

    this.server.to(roomName).emit("force_logout", {
      userId,
      reason,
      message:
        reason === "ACCOUNT_DEACTIVATED"
          ? "Your account has been deactivated. Please contact support."
          : "Your password was reset. Please log in again with your new credentials.",
    });

    this.server.in(roomName).disconnectSockets(true);
  }

  private async verifySocketToken(
    token: string,
  ): Promise<AuthenticatedUser | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      return {
        id: payload.sub ?? payload.id,
        email: payload.email,
        roles: payload.roles,
      };
    } catch {
      return null;
    }
  }
}
