import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Draft } from './draft.schema';
import { SyncDraftDto } from './dto/sync-draft.dto';

@Injectable()
export class DraftService {
  constructor(@InjectModel(Draft.name) private draftModel: Model<Draft>) {}

  async syncDraft(tenantId: string, payload: SyncDraftDto) {
    // ST-01.2.1: route + auth wiring only; upsert logic lands in ST-01.2.2.
    return {
      message: 'Draft sync endpoint is wired',
      tenantId,
      clientDraftId: payload.clientDraftId,
    };
  }
}
