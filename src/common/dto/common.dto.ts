import { ApiProperty } from '@nestjs/swagger';

/**
 * Shared DTOs used across multiple modules
 */

export class SuccessMessageDto {
  @ApiProperty({
    type: String,
    description: 'Success message',
    example: 'Operation completed successfully',
  })
  message: string;
}
