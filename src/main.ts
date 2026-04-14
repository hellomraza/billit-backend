import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HttpErrorFilter } from './common/filters/http-error.filter';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { GlobalValidationPipe } from './common/pipes/global-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend communication
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Parse cookies from requests
  app.use(cookieParser());

  // Rate limiting middleware (skip for health checks)
  app.use(RateLimitMiddleware);

  // Global validation pipe with custom error formatting
  app.useGlobalPipes(new GlobalValidationPipe());

  // Global exception filters for consistent error responses (order matters: HTTP first, then general)
  app.useGlobalFilters(new HttpErrorFilter(), new GlobalExceptionFilter());

  // Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('Billit Backend API')
    .setDescription(
      'Multi-tenant POS & Inventory Management System API Documentation',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'access-token',
        description: 'Enter your JWT access token',
      },
      'access-token',
    )
    .addTag('Health', 'Service health and readiness checks')
    .addTag('Auth', 'Authentication and session management')
    .addTag('Onboarding', 'Tenant onboarding flow')
    .addTag('Settings', 'Tenant settings and profile')
    .addTag('Tenants', 'Tenant account management')
    .addTag('Outlets', 'Store outlet management')
    .addTag('Products', 'Product catalog management')
    .addTag('Stock', 'Inventory management')
    .addTag('Invoices', 'Sales invoice management')
    .addTag('Deficits', 'Stock shortage tracking')
    .addTag('Stock Audit', 'Stock change history')
    .addTag('Password Reset', 'Password reset functionality')
    .addTag('Import', 'CSV import functionality')
    .setContact(
      'Support',
      'https://billit.example.com',
      'support@billit.example.com',
    )
    .setLicense('Proprietary', 'All rights reserved')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: true,
      displayRequestDuration: true,
    },
    customCss: '.swagger-ui { font-family: sans-serif; }',
    customJs: [],
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `🚀 Server running on http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `📚 Swagger docs available at http://localhost:${process.env.PORT ?? 3000}/api`,
  );
}
bootstrap();
