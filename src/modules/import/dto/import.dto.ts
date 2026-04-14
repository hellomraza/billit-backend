import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ImportProductDto {
  @ApiProperty({
    description: 'CSV file (base64 encoded or raw CSV text)',
    example: 'name,sku,category,unit\nProduct1,SKU001,Category1,pieces\n',
  })
  @IsString()
  @IsNotEmpty()
  csv: string;
}

export class ImportReportDto {
  @ApiProperty({
    description: 'Total rows processed',
    example: 100,
  })
  totalRows: number;

  @ApiProperty({
    description: 'Successfully imported rows',
    example: 95,
  })
  successfulRows: number;

  @ApiProperty({
    description: 'Failed rows (skipped)',
    example: 5,
  })
  failedRows: number;

  @ApiProperty({
    description: 'List of failed rows with reasons',
    example: [
      { rowNumber: 2, reason: 'Missing required field: name' },
      { rowNumber: 5, reason: 'SKU already exists' },
    ],
  })
  errors: Array<{
    rowNumber: number;
    reason: string;
  }>;

  @ApiProperty({
    description: 'Timestamp of import',
    example: '2026-04-13T10:30:00.000Z',
  })
  importedAt: Date;
}

export class CsvTemplateDto {
  @ApiProperty({
    description: 'CSV template content',
    example:
      'name,sku,category,unit,price,quantity\nProduct Name,SKU123,Electronics,pieces,99.99,100\n',
  })
  template: string;

  @ApiProperty({
    description: 'Instructions for CSV format',
    example:
      'name: required (max 100), sku: required (unique), category: optional, unit: optional, price: required (number), quantity: optional',
  })
  instructions: string;
}
