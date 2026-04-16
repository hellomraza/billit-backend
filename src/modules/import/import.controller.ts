import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CsvTemplateDto,
  ImportProductDto,
  ImportReportDto,
} from './dto/import.dto';
import { ImportService } from './import.service';

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
  @ApiOperation({
    summary: 'Import products from CSV (contract: Section 12)',
    description:
      'Bulk import products from CSV with full validation. ' +
      'Max 5 MB file size, max 1000 rows. Invalid rows skipped with detailed error report. ' +
      'Creates product records and initializes stock for all tenant outlets.',
  })
  @ApiBody({
    type: ImportProductDto,
    description: 'CSV content with required columns: name, price, gst_rate',
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
      'Invalid CSV: missing required headers, file > 5 MB, or > 1000 rows',
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
    @Req() request: any,
    @Body() importDto: ImportProductDto,
  ) {
    const tenantId = request.user?.sub;
    return await this.importService.importProducts(tenantId, importDto.csv);
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
