import { Module } from '@nestjs/common';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { GlobalValidationPipe } from './pipes/global-validation.pipe';

@Module({
  providers: [GlobalValidationPipe, GlobalExceptionFilter],
  exports: [GlobalValidationPipe, GlobalExceptionFilter],
})
export class CommonModule {}
