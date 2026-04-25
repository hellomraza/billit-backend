import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutletModule } from '../outlet/outlet.module';
import { DraftController } from './draft.controller';
import { Draft, DraftSchema } from './draft.schema';
import { DraftService } from './draft.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Draft.name, schema: DraftSchema }]),
    OutletModule,
  ],
  controllers: [DraftController],
  providers: [DraftService],
  exports: [DraftService],
})
export class DraftModule {}
