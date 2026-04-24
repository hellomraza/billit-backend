import { ApiProperty } from '@nestjs/swagger';

export class ImportProductDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'CSV file (.csv) with columns: name, price, gst_rate, opening_stock (optional), deficit_threshold (optional)',
  })
  file: any; // Express.Multer.File is handled by FileInterceptor
}

export class ImportErrorDto {
  @ApiProperty({
    description: 'Row number in CSV (1-indexed)',
    example: 5,
  })
  rowNumber: number;

  @ApiProperty({
    description: 'Reason for skipping the row',
    example: 'price must be positive (> 0)',
  })
  reason: string;

  @ApiProperty({
    description: 'The problematic row data',
    required: false,
    example: {
      name: 'Invalid Product',
      price: '-100',
      gst_rate: '18',
      opening_stock: '0',
      deficit_threshold: '',
    },
  })
  data?: Record<string, any>;
}

export class ImportReportDto {
  @ApiProperty({
    description: 'Number of products successfully imported',
    example: 95,
  })
  imported: number;

  @ApiProperty({
    description: 'Number of rows skipped due to validation errors',
    example: 5,
  })
  skipped: number;

  @ApiProperty({
    description: 'Total data rows processed (excluding header)',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Array of skipped rows with error details',
    type: [ImportErrorDto],
    example: [
      {
        rowNumber: 2,
        reason: 'price must be positive (> 0)',
        data: {
          name: 'Product A',
          price: '-100.00',
          gst_rate: '18',
          opening_stock: '50',
          deficit_threshold: '5',
        },
      },
      {
        rowNumber: 5,
        reason: 'gst_rate must be one of: 0, 5, 12, 18, 28',
        data: {
          name: 'Product B',
          price: '100.00',
          gst_rate: '10',
          opening_stock: '',
          deficit_threshold: '',
        },
      },
    ],
  })
  errors: ImportErrorDto[];

  @ApiProperty({
    description: 'Timestamp of when the import was processed',
    example: '2026-04-14T10:30:00.000Z',
  })
  importedAt: Date;
}

export class CsvTemplateDto {
  @ApiProperty({
    description: 'CSV template content showing column structure and examples',
    example:
      'name,price,gst_rate,opening_stock,deficit_threshold\n' +
      'Laptop Computer,99999.99,18,100,5\n' +
      'Office Chair,5999.99,18,50,3\n' +
      'USB Cable,299.99,18,200,10\n',
  })
  template: string;

  @ApiProperty({
    description: 'Detailed instructions for CSV format and constraints',
    example:
      'Required columns: name, price, gst_rate. Optional: opening_stock (default 0), deficit_threshold (default 10). ' +
      'Constraints: name max 200 chars, price positive with max 2 decimals, gst_rate one of [0,5,12,18,28], ' +
      'file size max 5 MB, max 1000 rows, opening_stock must be integer >= 0, deficit_threshold must be integer >= 1.',
  })
  instructions: string;
}
