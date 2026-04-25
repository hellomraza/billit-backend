import { NotFoundException } from '@nestjs/common';
import { CreateInvoiceDto } from './dto/invoice-create.dto';
import { InvoiceController } from './invoice.controller';

describe('InvoiceController', () => {
  const tenantId = '507f1f77bcf86cd799439011';
  const productId = '507f1f77bcf86cd799439012';
  const outletId = '507f1f77bcf86cd799439013';

  const createInvoiceDto: CreateInvoiceDto = {
    clientGeneratedId: '550e8400-e29b-41d4-a716-446655440000',
    clientDraftId: '550e8400-e29b-41d4-a716-446655440001',
    outletId: outletId as any,
    items: [
      {
        productId: productId as any,
        productName: 'Product A',
        quantity: 2,
        unitPrice: 100,
        gstRate: 18,
      },
    ],
    paymentMethod: 'CASH' as any,
  };

  const invoice = {
    _id: '507f1f77bcf86cd799439014',
    invoiceNumber: 'INV-001',
    createdAt: new Date('2026-04-25T10:00:00.000Z'),
    items: [
      {
        productId,
        productName: 'Product A',
        quantity: 2,
        unitPrice: 100,
        gstRate: 18,
        gstAmount: 36,
        lineTotal: 236,
      },
    ],
    gstEnabled: false,
    subtotal: 200,
    totalGstAmount: 36,
    grandTotal: 236,
    paymentMethod: 'CASH',
    customerName: null,
    customerPhone: null,
    tenantGstNumber: null,
    abbreviationsLocked: false,
  };

  it('soft deletes the associated draft after successful invoice creation', async () => {
    const invoiceService = {
      validateAndCheckStock: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue(invoice),
    } as any;
    const draftService = {
      softDelete: jest.fn().mockResolvedValue(undefined),
    } as any;

    const controller = new InvoiceController(invoiceService, draftService);

    const result = await controller.create(tenantId, createInvoiceDto);

    expect(invoiceService.create).toHaveBeenCalledWith(
      tenantId,
      createInvoiceDto,
    );
    expect(draftService.softDelete).toHaveBeenCalledWith(
      tenantId,
      createInvoiceDto.clientDraftId,
    );
    expect(result.statusCode).toBe(201);
  });

  it('soft deletes the associated draft for idempotent replay responses', async () => {
    const invoiceService = {
      validateAndCheckStock: jest
        .fn()
        .mockResolvedValue({ existingInvoice: invoice }),
      create: jest.fn(),
    } as any;
    const draftService = {
      softDelete: jest.fn().mockResolvedValue(undefined),
    } as any;

    const controller = new InvoiceController(invoiceService, draftService);

    const result = await controller.create(tenantId, createInvoiceDto);

    expect(invoiceService.create).not.toHaveBeenCalled();
    expect(draftService.softDelete).toHaveBeenCalledWith(
      tenantId,
      createInvoiceDto.clientDraftId,
    );
    expect(result.statusCode).toBe(200);
  });

  it('ignores missing draft errors when deleting post-invoice', async () => {
    const invoiceService = {
      validateAndCheckStock: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue(invoice),
    } as any;
    const draftService = {
      softDelete: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Draft not found')),
    } as any;

    const controller = new InvoiceController(invoiceService, draftService);

    await expect(
      controller.create(tenantId, createInvoiceDto),
    ).resolves.toBeDefined();
    expect(draftService.softDelete).toHaveBeenCalledWith(
      tenantId,
      createInvoiceDto.clientDraftId,
    );
  });
});
