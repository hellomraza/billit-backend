import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseService } from './database.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/billit',
        serverSelectionTimeoutMS: 5000,
      }),
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
