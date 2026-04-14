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
   */
  @Post()
  @ApiOperation({
    summary: 'Import products from CSV',
    description:
      'Bulk import products via CSV. Maximum 1000 rows. Invalid rows are skipped and returned in report.',
  })
  @ApiBody({ type: ImportProductDto })
  @ApiResponse({
    status: 201,
    description: 'Import report with results',
    type: ImportReportDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid CSV format or size limit exceeded',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
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
