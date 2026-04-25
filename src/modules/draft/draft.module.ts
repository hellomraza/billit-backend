import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DraftController } from './draft.controller';
import { Draft, DraftSchema } from './draft.schema';
import { DraftService } from './draft.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Draft.name, schema: DraftSchema }]),
  ],
  controllers: [DraftController],
  providers: [DraftService],
  exports: [DraftService],
})
export class DraftModule {}
