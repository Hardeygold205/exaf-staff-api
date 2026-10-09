import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ResponseMessage } from "./common/decorators/response-message.decorator";

@Controller()
export class AppController {
  constructor(private config: ConfigService) {}

  @Get()
  @ResponseMessage("Staff Workplace Platform API is running")
  getRoot() {
    const port = this.config.get<number>("PORT", 5002);
    return {
      port: Number(port),
      swaggerDocs: "/api/docs",
      health: "/health",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("health")
  @ResponseMessage("Service is healthy")
  health() {
    return { timestamp: new Date().toISOString() };
  }
}
