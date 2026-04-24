import { ApiProperty } from '@nestjs/swagger';

/**
 * Shared DTOs used across multiple modules
 */

export class SuccessMessageDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Operation completed successfully',
  })
  message: string;
}
