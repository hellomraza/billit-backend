import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseService } from './database.service';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/billit',
        tls: /^mongodb\+srv:\/\//.test(process.env.MONGODB_URI || ''),
        retryWrites: /^mongodb\+srv:\/\//.test(process.env.MONGODB_URI || ''),
        serverSelectionTimeoutMS: 5000,
      }),
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
