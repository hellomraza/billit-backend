import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DraftPaymentMethod } from './draft.schema';
import { DraftService } from './draft.service';

class InMemoryDraftModel {
  private readonly docs: Array<Record<string, any>> = [];

  async findOneAndUpdate(
    filter: Record<string, any>,
    update: any,
    options: any,
  ) {
    const tenantId = filter.tenantId?.toString();
    const clientDraftId = filter.clientDraftId;

    let doc = this.docs.find(
      (record) =>
        record.tenantId?.toString() === tenantId &&
        record.clientDraftId === clientDraftId,
    );

    if (!doc && options.upsert) {
      doc = {
        tenantId: filter.tenantId,
        clientDraftId,
      };
      this.docs.push(doc);
    }

    if (!doc) {
      return null;
    }

    if (update.$setOnInsert && doc.clientDraftId === clientDraftId) {
      Object.assign(doc, update.$setOnInsert);
    }

    if (update.$set) {
      Object.assign(doc, update.$set);
    }

    return doc;
  }

  getAllDocuments() {
    return this.docs;
  }
}

describe('DraftService', () => {
  it('updates an existing draft instead of creating a duplicate for the same clientDraftId', async () => {
    const draftModel = new InMemoryDraftModel();
    const outletService = {
      findById: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as any;

    const service = new DraftService(draftModel as any, outletService);

    const tenantId = new Types.ObjectId().toString();
    const outletId = new Types.ObjectId().toString();
    const clientDraftId = '550e8400-e29b-41d4-a716-446655440000';

    const firstResult = await service.syncDraft(tenantId, {
      clientDraftId,
      outletId,
      tabLabel: 'Bill 1',
      items: [],
      customerName: null,
      customerPhone: null,
      paymentMethod: DraftPaymentMethod.CASH,
    });

    const secondResult = await service.syncDraft(tenantId, {
      clientDraftId,
      outletId,
      tabLabel: 'Bill 2',
      items: [],
      customerName: null,
      customerPhone: null,
      paymentMethod: DraftPaymentMethod.CARD,
    });

    expect(firstResult).toBeDefined();
    expect(secondResult).toBeDefined();
    expect(draftModel.getAllDocuments()).toHaveLength(1);
    expect(draftModel.getAllDocuments()[0].tabLabel).toBe('Bill 2');
    expect(draftModel.getAllDocuments()[0].paymentMethod).toBe(
      DraftPaymentMethod.CARD,
    );
  });

  it('throws a bad request when the outlet does not belong to the tenant', async () => {
    const draftModel = new InMemoryDraftModel();
    const outletService = {
      findById: jest.fn().mockRejectedValue(new NotFoundException()),
    } as any;

    const service = new DraftService(draftModel as any, outletService);

    await expect(
      service.syncDraft(new Types.ObjectId().toString(), {
        clientDraftId: '550e8400-e29b-41d4-a716-446655440000',
        outletId: new Types.ObjectId().toString(),
        tabLabel: 'Bill 1',
        items: [],
        customerName: null,
        customerPhone: null,
        paymentMethod: DraftPaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
