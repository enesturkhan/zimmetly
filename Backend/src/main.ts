import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global validation pipe ekle
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO'da tanımlı olmayan property'leri otomatik siler
      forbidNonWhitelisted: true, // DTO'da olmayan property varsa hata verir
      transform: true, // Gelen veriyi DTO tipine otomatik dönüştürür
    }),
  );

  // FRONTEND_URL: prod/preview için https://proje.vercel.app (birden fazlaysa virgülle ayır)
  const corsOrigins: string[] = ['http://localhost:3000'];
  if (process.env.FRONTEND_URL?.trim()) {
    corsOrigins.push(
      ...process.env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean),
    );
  }

  app.enableCors({
    origin: [
      "http://localhost:3000",
      "https://zimmetly.vercel.app",
      "https://zimmetly-git-main-enestrkhan213-gmailcoms-projects.vercel.app",
    ],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();