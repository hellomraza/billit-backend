import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Draft } from './draft.schema';
import { SyncDraftDto } from './dto/sync-draft.dto';

@Injectable()
export class DraftService {
  constructor(@InjectModel(Draft.name) private draftModel: Model<Draft>) {}

  async syncDraft(tenantId: string, payload: SyncDraftDto) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const syncedAt = new Date();

    const filter = {
      tenantId: tenantObjectId,
      clientDraftId: payload.clientDraftId,
    };

    const update = {
      $set: {
        outletId: new Types.ObjectId(payload.outletId),
        tabLabel: payload.tabLabel ?? null,
        items: payload.items,
        customerName: payload.customerName ?? null,
        customerPhone: payload.customerPhone ?? null,
        paymentMethod: payload.paymentMethod ?? null,
        isDeleted: false,
        syncedAt,
      },
      $setOnInsert: {
        tenantId: tenantObjectId,
        clientDraftId: payload.clientDraftId,
      },
    };

    return this.draftModel.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
      runValidators: true,
    });
  }
}
