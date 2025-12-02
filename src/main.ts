import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global validation pipe ekle
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO'da tanımlı olmayan property'leri otomatik siler
      forbidNonWhitelisted: true, // DTO'da olmayan property varsa hata verir
      transform: true, // Gelen veriyi DTO tipine otomatik dönüştürür
    }),
  );
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
