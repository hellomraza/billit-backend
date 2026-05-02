import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import serverless from 'serverless-http';
import { AppModule } from 'src/app.module';

let server;

async function bootstrap() {
  console.log('Bootstrapping NestJS application...');
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Cats example')
    .setDescription('The cats API description')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste JWT access token',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document);
  console.log('NestJS application initialized, starting serverless handler...');

  await app.init();
  console.log(
    'NestJS application fully initialized, creating serverless handler...',
  );

  const expressApp = app.getHttpAdapter().getInstance();
  console.log('Serverless handler created, ready to handle requests');
  return serverless(expressApp);
}

export default async function handler(req, res) {
  console.log('Received request:', req.method, req.path);
  if (!server) {
    console.log('No server instance found, bootstrapping application...');
    server = await bootstrap();
  }
  console.log('Handling request with serverless handler');
  return server(req, res);
}
