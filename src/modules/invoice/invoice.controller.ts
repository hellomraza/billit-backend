import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantValidationGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateInvoiceDto,
  CreateInvoiceResponseDto,
  InvoiceDetailResponseDto,
  InvoiceListResponseDto,
  OverrideBlockedResponseDto,
  StockInsufficientResponseDto,
} from './dto/invoice-create.dto';
import { InvoiceService } from './invoice.service';

@UseGuards(JwtAuthGuard, TenantValidationGuard)
@ApiBearerAuth('access-token')
@ApiTags('Invoices')
@Controller('tenants/:tenantId/invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Create invoice with two-phase validation:
   * Phase 1: Check stock availability
   * Phase 2: Create invoice with atomic transaction
   */
  @ApiOperation({
    summary: 'Create invoice (with two-phase validation)',
    description: `
     Two-phase creation process:
      1. Validates clientGeneratedId for idempotency (returns 200 if exists)
      2. Checks stock for all items (returns 409 if insufficient and no override)
      3. Validates override flags against deficit threshold (returns 403 if blocked)
      4. Locks abbreviations on first invoice (auto)
      5. Creates invoice atomically with stock deduction, audit logs, and deficits
     
      Retry with override=true in individual items to retry after 409 response.
    `,
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description:
      'Invoice already exists (idempotent replay). Returns existing invoice.',
    type: CreateInvoiceResponseDto,
  })
  @ApiResponse({
    status: 201,
    description:
      'Invoice created successfully. Stock decremented, audit logged, abbreviations locked if first invoice.',
    type: CreateInvoiceResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Stock insufficient for some items. Review insufficientItems and retry with override=true flags.',
    type: StockInsufficientResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'Override blocked because deficit threshold exceeded for those items.',
    type: OverrideBlockedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (missing items, duplicate product IDs, etc.)',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ) {
    // Validation: At least 1 item required
    if (!createInvoiceDto.items || createInvoiceDto.items.length === 0) {
      throw new ConflictException('Invoice must have at least 1 item');
    }

    // Validation: No duplicate product IDs
    const productIds = createInvoiceDto.items.map((i) =>
      i.productId.toString(),
    );
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      throw new ConflictException(
        'Duplicate product IDs in invoice items not allowed',
      );
    }

    // Phase 1: Check stock and idempotency
    const validationResult = await this.invoiceService.validateAndCheckStock(
      tenantId,
      createInvoiceDto,
    );

    // If invoice already exists (idempotent replay), return 200 with existing invoice
    if (validationResult.existingInvoice) {
      return {
        statusCode: 200,
        message: 'Invoice already exists (idempotent replay)',
        data: this.invoiceToCreateResponse(validationResult.existingInvoice),
      };
    }

    // If insufficient stock and no override flags set, return 409
    if (
      validationResult.insufficiencies &&
      validationResult.insufficiencies.length > 0
    ) {
      // Check if user provided override flags
      const hasOverrideFlags = createInvoiceDto.items.some(
        (item) => item.override,
      );

      if (!hasOverrideFlags) {
        // Return 409 with insufficient items details
        throw new ConflictException({
          error: 'STOCK_INSUFFICIENT',
          insufficientItems: validationResult.insufficiencies,
          message:
            'Stock insufficient for some items. Review and retry with override flag if allowed.',
        });
      }

      // Phase 2: Check if overrides are allowed for each insufficient item
      const blockedItems = validationResult.insufficiencies.filter(
        (item) => !item.canOverride,
      );

      if (blockedItems.length > 0) {
        // Return 403 if override is blocked
        throw new ForbiddenException({
          error: 'OVERRIDE_BLOCKED',
          blockedItems: blockedItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            deficitThreshold: item.deficitThreshold,
            currentDeficit: item.currentDeficit,
          })),
          message:
            'Override blocked because deficit threshold exceeded for these items.',
        });
      }
    }

    // Phase 3: Create invoice atomically
    const invoice = await this.invoiceService.create(
      tenantId,
      createInvoiceDto,
    );

    return {
      statusCode: 201,
      message: 'Invoice created successfully',
      data: this.invoiceToCreateResponse(invoice),
    };
  }

  /**
   * Get invoices with filters and pagination
   * Default: 20 items per page, sorted by creation date (newest first)
   */
  @ApiOperation({
    summary: 'Get invoices with filters and pagination',
    description:
      'Retrieve invoices with optional filters (date range, payment method, GST status, outlet, product search). Default pagination: 20 per page.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Records per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: 'string',
    format: 'date-time',
    description: 'Filter invoices from this date (ISO 8601)',
    example: '2026-04-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: 'string',
    format: 'date-time',
    description: 'Filter invoices until this date (ISO 8601)',
    example: '2026-04-30T23:59:59Z',
  })
  @ApiQuery({
    name: 'invoiceNumber',
    required: false,
    type: 'string',
    description: 'Filter by invoice number (partial match)',
    example: 'ABC-OUT',
  })
  @ApiQuery({
    name: 'paymentMethod',
    required: false,
    type: 'string',
    description:
      'Filter by payment method (CASH, CARD, UPI, CHEQUE, BANK_TRANSFER)',
    example: 'CASH',
  })
  @ApiQuery({
    name: 'gstEnabled',
    required: false,
    type: 'boolean',
    description: 'Filter by GST enabled status',
    example: true,
  })
  @ApiQuery({
    name: 'outletId',
    required: false,
    type: 'string',
    description: 'Filter by outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    type: 'string',
    description: 'Filter by product ID in invoice items',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of invoices matching filters',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/InvoiceListResponseDto' },
        },
        total: { type: 'number', example: 150 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
      },
    },
  })
  @Get()
  async findAll(
    @Param('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('invoiceNumber') invoiceNumber?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('gstEnabled') gstEnabled?: string,
    @Query('outletId') outletId?: string,
    @Query('productId') productId?: string,
  ) {
    // Cap limit to 100
    let parsedLimit = Math.min(parseInt(limit) || 20, 100);
    let parsedPage = Math.max(parseInt(page) || 1, 1);

    const { data, total } = await this.invoiceService.findWithFilters(
      tenantId,
      {
        page: parsedPage,
        limit: parsedLimit,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        invoiceNumber,
        paymentMethod,
        gstEnabled:
          gstEnabled === 'true'
            ? true
            : gstEnabled === 'false'
              ? false
              : undefined,
        outletId,
        productId,
      },
    );

    return {
      data: data.map((invoice) => this.invoiceToListResponse(invoice)),
      total,
      page: parsedPage,
      limit: parsedLimit,
    };
  }

  /**
   * Get invoice detail by ID
   */
  @ApiOperation({ summary: 'Get invoice detail by ID' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'invoiceId',
    description: 'Invoice ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice details with all snapshots and deficit status',
    type: InvoiceDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @Get(':invoiceId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    const invoice = await this.invoiceService.findById(tenantId, invoiceId);
    return this.invoiceToDetailResponse(invoice);
  }

  /**
   * Soft delete invoice
   */
  @ApiOperation({
    summary: 'Delete invoice (soft delete)',
    description: 'Marks invoice as deleted without removing from database',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'invoiceId',
    description: 'Invoice ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ status: 204, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @Delete(':invoiceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    await this.invoiceService.softDelete(tenantId, invoiceId);
  }

  private invoiceToCreateResponse(invoice: any): CreateInvoiceResponseDto {
    return {
      invoiceId: invoice._id?.toString(),
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt?.toISOString(),
      items: invoice.items.map((item: any) => ({
        productId: item.productId.toString?.() || item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: this.parseDecimal(item.unitPrice),
        gstRate: item.gstRate,
        gstAmount: this.parseDecimal(item.gstAmount),
        lineTotal: this.parseDecimal(item.lineTotal),
      })),
      subtotal: this.parseDecimal(invoice.subtotal),
      gstTotal: this.parseDecimal(invoice.totalGstAmount),
      grandTotal: this.parseDecimal(invoice.grandTotal),
      paymentMethod: invoice.paymentMethod,
      customerDetails: invoice.customerName
        ? {
            name: invoice.customerName,
            phone: invoice.customerPhone,
          }
        : undefined,
      gstDetails: {
        tenantGSTNumber: invoice.tenantGstNumber,
        gstEnabled: invoice.gstEnabled,
      },
      abbreviationsLocked: invoice.abbreviationsLocked,
    };
  }

  private invoiceToListResponse(invoice: any): InvoiceListResponseDto {
    const deficitItems = invoice.items.filter(
      (item: any) => item.overridden,
    ).length;

    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceId: invoice._id?.toString(),
      createdAt: invoice.createdAt?.toISOString(),
      businessName: invoice.businessName,
      itemCount: invoice.items.length,
      subtotal: this.parseDecimal(invoice.subtotal),
      gstTotal: this.parseDecimal(invoice.totalGstAmount),
      grandTotal: this.parseDecimal(invoice.grandTotal),
      paymentMethod: invoice.paymentMethod,
      customerName: invoice.customerName,
      deficitCount: deficitItems,
    };
  }

  private invoiceToDetailResponse(invoice: any): InvoiceDetailResponseDto {
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceId: invoice._id?.toString(),
      createdAt: invoice.createdAt?.toISOString(),
      businessName: invoice.businessName,
      businessAbbr: invoice.businessAbbr,
      outletName: invoice.outletName,
      outletAbbr: invoice.outletAbbr,
      gstEnabled: invoice.gstEnabled,
      tenantGSTNumber: invoice.tenantGstNumber,
      customerDetails: invoice.customerName
        ? {
            name: invoice.customerName,
            phone: invoice.customerPhone,
          }
        : undefined,
      paymentMethod: invoice.paymentMethod,
      items: invoice.items.map((item: any) => ({
        productId: item.productId.toString?.() || item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: this.parseDecimal(item.unitPrice),
        gstRate: item.gstRate,
        gstAmount: this.parseDecimal(item.gstAmount),
        lineTotal: this.parseDecimal(item.lineTotal),
      })),
      subtotal: this.parseDecimal(invoice.subtotal),
      gstTotal: this.parseDecimal(invoice.totalGstAmount),
      grandTotal: this.parseDecimal(invoice.grandTotal),
      deficitItems: invoice.items
        .filter((item: any) => item.overridden)
        .map((item: any) => ({
          productId: item.productId.toString?.() || item.productId,
          productName: item.productName,
          quantity: item.quantity,
          currentResolutionStatus: 'PENDING', // TODO: Fetch actual status from deficit records
        })),
    };
  }

  private parseDecimal(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    // Handle Decimal128 objects
    return parseFloat(value.toString?.() || '0');
  }
}
