import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('Billit Backend API')
    .setDescription('Multi-tenant POS & Inventory Management System API Documentation')
    .setVersion('1.0.0')
    .addTag('Tenants', 'Tenant account management')
    .addTag('Outlets', 'Store outlet management')
    .addTag('Products', 'Product catalog management')
    .addTag('Stock', 'Inventory management')
    .addTag('Invoices', 'Sales invoice management')
    .addTag('Deficits', 'Stock shortage tracking')
    .addTag('Stock Audit', 'Stock change history')
    .addTag('Password Reset', 'Password reset functionality')
    .setContact('Support', 'https://billit.example.com', 'support@billit.example.com')
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
  console.log(`🚀 Server running on http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📚 Swagger docs available at http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
