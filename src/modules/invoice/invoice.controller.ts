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
import { CreateInvoiceDto, InvoiceResponseDto } from './dto/invoice.dto';
import { InvoiceService } from './invoice.service';

@Controller('tenants/:tenantId/invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

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

  @Get(':invoiceId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    const invoice = await this.invoiceService.findById(tenantId, invoiceId);
    return this.invoiceToResponse(invoice);
  }

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
