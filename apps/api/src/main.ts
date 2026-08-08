import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { json, urlencoded, type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Required by @thallesp/nestjs-better-auth: Better Auth needs the raw request body for
    // its own routes; the library re-adds express.json()/urlencoded() for every other route.
    bodyParser: false,
  });

  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);
  const isProduction = config.get<string>("env") === "production";

  // Without this, every request behind a load balancer reports the balancer's address as req.ip,
  // so the global ThrottlerGuard buckets all traffic worldwide into a single rate-limit counter —
  // a self-inflicted outage. It also restores X-Forwarded-Proto, which secure-cookie handling and
  // absolute-URL generation both depend on. Hosting platforms terminate TLS one hop in front.
  if (isProduction) {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }

  // PrismaService.onModuleDestroy and the BullMQ workers only run on shutdown if Nest is listening
  // for the signal. Without this a redeploy SIGKILLs jobs mid-flight and leaks connections.
  app.enableShutdownHooks();

  // The app is created with `bodyParser: false` because Better Auth consumes the raw request
  // stream on its own routes. Every *other* route still needs JSON parsing, so add it explicitly
  // and skip the Better Auth mount path — without this, every non-auth POST/PATCH body arrives
  // as undefined and validation fails with a bare "(root): Required".
  const AUTH_PATH_PREFIX = "/api/auth";
  const jsonParser = json({ limit: "2mb" });
  const formParser = urlencoded({ extended: true, limit: "2mb" });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith(AUTH_PATH_PREFIX)) return next();
    return jsonParser(req, res, (err?: unknown) =>
      err ? next(err) : formParser(req, res, next),
    );
  });

  app.use(helmet());
  app.enableCors({
    // Validated, comma-split list so staging/preview origins can be added without a code change.
    origin: config.get<string[]>("corsOrigins") ?? ["http://localhost:3000"],
    credentials: true,
    maxAge: 86400,
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix("api", { exclude: ["health"] });

  // /api/docs publishes the entire API surface, so it is off in production unless deliberately
  // re-enabled with ENABLE_SWAGGER=true.
  if (!isProduction || config.get<boolean>("enableSwagger")) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Social Platform API")
      .setDescription("Unified social media management platform API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  // Bind all interfaces explicitly — a container's port mapping cannot reach a process listening
  // only on loopback.
  await app.listen(config.get<number>("port") ?? 4000, "0.0.0.0");
}

void bootstrap();
