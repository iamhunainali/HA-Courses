import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

const UP = process.env.UPLOAD_DIR || '/data/uploads';

async function bootstrap() {
  mkdirSync(join(UP, 'public'), { recursive: true });
  mkdirSync(join(UP, 'private'), { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  // Sirf thumbnails aur slideshow images public hain. Videos/files private + enrollment-protected.
  app.useStaticAssets(join(UP, 'public'), { prefix: '/api/media/' });
  const server = await app.listen(3000);
  server.setTimeout(0);
}
bootstrap();
