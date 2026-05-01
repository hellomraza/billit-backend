import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CsvFileUpload } from '../../decorator/file-upload.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CsvTemplateDto, ImportReportDto } from './dto/import.dto';
import { ImportService } from './import.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 1000; // Max 1000 rows excluding header
@ApiTags('Import')
@Controller('products/import')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ImportController {
  constructor(private importService: ImportService) {}

  /**
   * Import products from CSV
   *
   * CONTRACT COMPLIANCE (Section 12: CSV Import Rules)
   *
   * Constraints enforced:
   * - CSV only (text content)
   * - Max 5 MB file size (returns 400 if exceeded)
   * - Max 1000 rows excluding header (returns 400 if exceeded)
   * - Skip invalid rows (not entire import)
   * - Import valid rows (batch insert)
   * - Return structured import report
   *
   * Processing:
   * 1. Validates tenant exists
   * 2. Checks file size (5 MB limit)
   * 3. Validates row count (1000 max)
   * 4. Parses CSV and validates each row
   * 5. Creates product records with basePrice (Decimal128), gstRate, deficitThreshold
   * 6. Creates stock records for ALL outlets with opening_stock quantity
   * 7. Returns report with import count, skip count, and detailed error list
   *
   * Columns (CSV header):
   * - name (required, max 200 chars)
   * - price (required, positive, max 2 decimals)
   * - gst_rate (required, one of: 0, 5, 12, 18, 28)
   * - opening_stock (optional, defaults 0, integer >= 0)
   * - deficit_threshold (optional, defaults 10, integer >= 1)
   *
   * Row errors are returned in detailed error array with:
   * - rowNumber: 1-indexed row number
   * - reason: detailed validation error message
   * - data: the problematic row data for debugging
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @CsvFileUpload('file', {
    maxSize: MAX_FILE_SIZE,
    maxRows: MAX_ROWS,
  })
  @ApiOperation({
    summary: 'Import products from CSV (contract: Section 12)',
    description:
      'Bulk import products from CSV file with full validation. ' +
      'Max 5 MB file size, max 1000 rows. Invalid rows skipped with detailed error report. ' +
      'Creates product records and initializes stock for all tenant outlets.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Import completed with report (imported count, skipped count, error details)',
    type: ImportReportDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid CSV: missing required headers, file > 5 MB, > 1000 rows, or invalid file type',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found or no active outlets',
  })
  async importProducts(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_FILE_SIZE })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
    @Req() request: any,
  ) {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    // Validate file extension
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('File must be a CSV file (extension .csv)');
    }

    // Validate MIME type (accept common CSV MIME types)
    const validMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/csv',
      'text/plain', // Some systems send CSV as plain text
      'application/octet-stream', // Fallback for some browsers
    ];

    if (!validMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Expected CSV, got ${file.mimetype}. Please upload a valid CSV file.`,
      );
    }

    // Extract CSV content from file buffer
    const csvContent = file.buffer.toString('utf8');

    const tenantId = request.user?.sub;
    return await this.importService.importProducts(tenantId, csvContent);
  }

  /**
   * Get CSV template
   */
  @Get('template')
  @ApiOperation({
    summary: 'Get CSV import template',
    description: 'Download or view the CSV template for product import',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV template with instructions',
    type: CsvTemplateDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getTemplate() {
    return this.importService.getTemplate();
  }
}
