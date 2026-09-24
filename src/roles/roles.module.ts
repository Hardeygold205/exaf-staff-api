import { Module } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { RolesController } from "./roles.controller";
import { WebsocketModule } from "../infra/socket/events.module";

@Module({
  imports: [WebsocketModule],
  providers: [RolesService],
  controllers: [RolesController],
})
export class RolesModule {}
