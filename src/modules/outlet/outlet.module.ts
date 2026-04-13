import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutletController } from './outlet.controller';
import { Outlet, OutletSchema } from './outlet.schema';
import { OutletService } from './outlet.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Outlet.name, schema: OutletSchema }]),
  ],
  providers: [OutletService],
  controllers: [OutletController],
  exports: [OutletService],
})
export class OutletModule {}
