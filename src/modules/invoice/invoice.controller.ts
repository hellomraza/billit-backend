import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateInvoiceDto, InvoiceResponseDto } from './dto/invoice.dto';
import { InvoiceService } from './invoice.service';

@ApiTags('Invoices')
@Controller('tenants/:tenantId/invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @ApiOperation({ summary: 'Create a new invoice (with transaction)' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 201,
    description:
      'Invoice created successfully. Auto-decrements stock, creates audit logs, and deficit records.',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or insufficient stock',
  })
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ) {
    const invoice = await this.invoiceService.create(
      tenantId,
      createInvoiceDto,
    );
    return this.invoiceToResponse(invoice);
  }

  @ApiOperation({ summary: 'Get all invoices for tenant (paginated)' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    default: 1,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    default: 10,
    description: 'Records per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of invoices',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/InvoiceResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  @Get()
  async findAll(
    @Param('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const { data, total } = await this.invoiceService.findAll(
      tenantId,
      parseInt(page),
      parseInt(limit),
    );
    return {
      data: data.map((i) => this.invoiceToResponse(i)),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    };
  }

  @ApiOperation({ summary: 'Get invoice by ID' })
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
    description: 'Invoice found',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invoice or tenant not found' })
  @Get(':invoiceId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    const invoice = await this.invoiceService.findById(tenantId, invoiceId);
    return this.invoiceToResponse(invoice);
  }

  @ApiOperation({ summary: 'Get invoice by invoice number' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'invoiceNumber',
    description: 'Auto-generated invoice number',
    example: 'INV-20260413-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice found',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invoice or tenant not found' })
  @Get('number/:invoiceNumber')
  async findByNumber(
    @Param('tenantId') tenantId: string,
    @Param('invoiceNumber') invoiceNumber: string,
  ) {
    const invoice = await this.invoiceService.findByNumber(
      tenantId,
      invoiceNumber,
    );
    return this.invoiceToResponse(invoice);
  }

  @ApiOperation({ summary: 'Get all invoices for an outlet' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'outletId',
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invoices for outlet',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/InvoiceResponseDto' },
        },
      },
    },
  })
  @Get('outlet/:outletId')
  async findByOutlet(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    const invoices = await this.invoiceService.findByOutlet(tenantId, outletId);
    return {
      data: invoices.map((i) => this.invoiceToResponse(i)),
    };
  }

  @ApiOperation({ summary: 'Get invoices by payment method' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'paymentMethod',
    description: 'Payment method (CASH, CARD, or UPI)',
    example: 'CASH',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invoices with specified payment method',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/InvoiceResponseDto' },
        },
      },
    },
  })
  @Get('payment-method/:paymentMethod')
  async findByPaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethod') paymentMethod: string,
  ) {
    const invoices = await this.invoiceService.findByPaymentMethod(
      tenantId,
      paymentMethod,
    );
    return {
      data: invoices.map((i) => this.invoiceToResponse(i)),
    };
  }

  @ApiOperation({ summary: 'Soft delete invoice (mark as deleted)' })
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
  @ApiResponse({ status: 404, description: 'Invoice or tenant not found' })
  @Delete(':invoiceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    await this.invoiceService.softDelete(tenantId, invoiceId);
  }

  private invoiceToResponse(invoice: any): InvoiceResponseDto {
    return {
      _id: invoice._id?.toString(),
      tenantId: invoice.tenantId?.toString(),
      outletId: invoice.outletId?.toString(),
      invoiceNumber: invoice.invoiceNumber,
      clientGeneratedId: invoice.clientGeneratedId,
      items: invoice.items.map((item) => ({
        productId: item.productId.toString(),
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0,
        gstRate: item.gstRate,
        gstAmount: item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0,
        lineTotal: item.lineTotal ? parseFloat(item.lineTotal.toString()) : 0,
      })),
      subtotal: invoice.subtotal ? parseFloat(invoice.subtotal.toString()) : 0,
      totalGstAmount: invoice.totalGstAmount
        ? parseFloat(invoice.totalGstAmount.toString())
        : 0,
      grandTotal: invoice.grandTotal
        ? parseFloat(invoice.grandTotal.toString())
        : 0,
      paymentMethod: invoice.paymentMethod,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      isGstInvoice: invoice.isGstInvoice,
      tenantGstNumber: invoice.tenantGstNumber,
      isDeleted: invoice.isDeleted,
      createdAt: invoice.createdAt,
    };
  }
}
