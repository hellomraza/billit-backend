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

    const payload = update.$set ?? update;
    Object.assign(doc, payload);

    return doc;
  }

  find(filter: Record<string, any>) {
    const result = this.docs.filter((record) => {
      const tenantMatches =
        record.tenantId?.toString() === filter.tenantId?.toString();
      const outletMatches =
        record.outletId?.toString() === filter.outletId?.toString();
      const deletedMatches = record.isDeleted === filter.isDeleted;

      return tenantMatches && outletMatches && deletedMatches;
    });

    return {
      sort: (sortSpec: Record<string, 1 | -1>) => ({
        exec: async () =>
          [...result].sort((left, right) => {
            const sortKey = Object.keys(sortSpec)[0];
            const direction = sortSpec[sortKey];
            const leftValue = new Date(left[sortKey]).getTime();
            const rightValue = new Date(right[sortKey]).getTime();

            return direction === 1
              ? leftValue - rightValue
              : rightValue - leftValue;
          }),
      }),
    };
  }

  seed(document: Record<string, any>) {
    this.docs.push(document);
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

  it('returns active drafts for the default outlet ordered by updatedAt ascending', async () => {
    const draftModel = new InMemoryDraftModel();
    const tenantId = new Types.ObjectId().toString();
    const defaultOutletId = new Types.ObjectId();
    const outletService = {
      getDefault: jest.fn().mockResolvedValue({ _id: defaultOutletId }),
    } as any;

    draftModel.seed({
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(tenantId),
      outletId: defaultOutletId,
      clientDraftId: 'draft-2',
      tabLabel: 'Second',
      items: [],
      customerName: null,
      customerPhone: null,
      paymentMethod: DraftPaymentMethod.CASH,
      isDeleted: false,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T12:00:00.000Z'),
      syncedAt: new Date('2026-01-01T11:00:00.000Z'),
    });

    draftModel.seed({
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(tenantId),
      outletId: defaultOutletId,
      clientDraftId: 'draft-1',
      tabLabel: 'First',
      items: [],
      customerName: null,
      customerPhone: null,
      paymentMethod: DraftPaymentMethod.CARD,
      isDeleted: false,
      createdAt: new Date('2026-01-01T09:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      syncedAt: new Date('2026-01-01T09:30:00.000Z'),
    });

    draftModel.seed({
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(tenantId),
      outletId: defaultOutletId,
      clientDraftId: 'deleted-draft',
      tabLabel: 'Deleted',
      items: [],
      customerName: null,
      customerPhone: null,
      paymentMethod: DraftPaymentMethod.UPI,
      isDeleted: true,
      createdAt: new Date('2026-01-01T08:00:00.000Z'),
      updatedAt: new Date('2026-01-01T08:30:00.000Z'),
      syncedAt: new Date('2026-01-01T08:15:00.000Z'),
    });

    draftModel.seed({
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(tenantId),
      outletId: new Types.ObjectId(),
      clientDraftId: 'other-outlet',
      tabLabel: 'Other outlet',
      items: [],
      customerName: null,
      customerPhone: null,
      paymentMethod: DraftPaymentMethod.CASH,
      isDeleted: false,
      createdAt: new Date('2026-01-01T07:00:00.000Z'),
      updatedAt: new Date('2026-01-01T07:30:00.000Z'),
      syncedAt: new Date('2026-01-01T07:15:00.000Z'),
    });

    const service = new DraftService(draftModel as any, outletService);

    const drafts = await service.findAll(tenantId);

    expect(outletService.getDefault).toHaveBeenCalledWith(tenantId);
    expect(drafts).toHaveLength(2);
    expect(drafts.map((draft) => draft.clientDraftId)).toEqual([
      'draft-1',
      'draft-2',
    ]);
  });

  it('returns an empty array when there are no active drafts', async () => {
    const draftModel = new InMemoryDraftModel();
    const outletService = {
      getDefault: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as any;

    const service = new DraftService(draftModel as any, outletService);

    await expect(
      service.findAll(new Types.ObjectId().toString()),
    ).resolves.toEqual([]);
  });

  it('soft deletes a draft by tenantId and clientDraftId', async () => {
    const draftModel = new InMemoryDraftModel();
    const outletService = {} as any;
    const tenantId = new Types.ObjectId().toString();
    const outletId = new Types.ObjectId();
    const clientDraftId = 'draft-to-delete';

    draftModel.seed({
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(tenantId),
      outletId,
      clientDraftId,
      tabLabel: 'Bill 1',
      items: [],
      customerName: null,
      customerPhone: null,
      paymentMethod: DraftPaymentMethod.CASH,
      isDeleted: false,
      createdAt: new Date('2026-01-01T08:00:00.000Z'),
      updatedAt: new Date('2026-01-01T08:00:00.000Z'),
      syncedAt: new Date('2026-01-01T08:00:00.000Z'),
    });

    const service = new DraftService(draftModel as any, outletService);

    const result = await service.softDelete(tenantId, clientDraftId);

    expect(result).toBeDefined();
    expect(result.isDeleted).toBe(true);
    expect(draftModel.getAllDocuments()).toHaveLength(1);
    expect(draftModel.getAllDocuments()[0].isDeleted).toBe(true);
  });

  it('throws not found when soft deleting a missing draft', async () => {
    const draftModel = new InMemoryDraftModel();
    const outletService = {} as any;
    const service = new DraftService(draftModel as any, outletService);

    await expect(
      service.softDelete(
        new Types.ObjectId().toString(),
        'missing-client-draft-id',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never performs a hard delete when soft deleting a draft', async () => {
    const tenantId = new Types.ObjectId().toString();
    const draftModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        tenantId: new Types.ObjectId(tenantId),
        clientDraftId: 'draft-no-hard-delete',
        isDeleted: true,
      }),
      findOneAndDelete: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      findByIdAndDelete: jest.fn(),
      remove: jest.fn(),
    } as any;
    const outletService = {} as any;
    const service = new DraftService(draftModel, outletService);

    await service.softDelete(tenantId, 'draft-no-hard-delete');

    expect(draftModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(draftModel.findOneAndDelete).not.toHaveBeenCalled();
    expect(draftModel.deleteOne).not.toHaveBeenCalled();
    expect(draftModel.deleteMany).not.toHaveBeenCalled();
    expect(draftModel.findByIdAndDelete).not.toHaveBeenCalled();
    expect(draftModel.remove).not.toHaveBeenCalled();
  });
});
