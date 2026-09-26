import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";
import helmet from "helmet";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Needed the moment this sits behind nginx/a load balancer/a Docker network gateway —
  // without it, req.ip reports the proxy's address, not the real client's.
  // 1 = trust the first hop (typical single reverse-proxy setup); adjust if you add more hops.
  app.set("trust proxy", 1);

  app.use(helmet());

  app.setGlobalPrefix("api/v1", { exclude: ["/", "health"] });

  const uploadDir = process.env.UPLOAD_DIR ?? "uploads";
  app.useStaticAssets(join(process.cwd(), uploadDir), {
    prefix: `/${uploadDir}/`,
  });

  app.enableCors({
    origin: ["http://localhost:4200"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("EXAF Staff Workplace API")
    .setDescription(
      "Backend API for auth, RBAC, attendance, projects, staff requests, and screentime/app monitoring.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(process.env.PORT ?? 5002, "0.0.0.0");
}
bootstrap();
