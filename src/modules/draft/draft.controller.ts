import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DraftService } from './draft.service';
import { SyncDraftDto } from './dto/sync-draft.dto';

@ApiTags('Drafts')
@Controller('drafts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class DraftController {
  constructor(private readonly draftService: DraftService) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Sync draft (upsert by tenant + clientDraftId)',
  })
  @ApiResponse({
    status: 200,
    description: 'Draft synced successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async syncDraft(@Req() request: any, @Body() syncDraftDto: SyncDraftDto) {
    const tenantId = request.user?.sub;
    return this.draftService.syncDraft(tenantId, syncDraftDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Get all active drafts for the authenticated tenant default outlet',
  })
  @ApiResponse({
    status: 200,
    description: 'Drafts retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async findAll(@Req() request: any) {
    const tenantId = request.user?.sub;
    const drafts = await this.draftService.findAll(tenantId);

    return {
      drafts: drafts.map((draft) => this.draftToResponse(draft)),
    };
  }

  private draftToResponse(draft: any) {
    return {
      id: draft._id?.toString(),
      clientDraftId: draft.clientDraftId,
      tabLabel: draft.tabLabel ?? null,
      items: draft.items,
      customerName: draft.customerName ?? null,
      customerPhone: draft.customerPhone ?? null,
      paymentMethod: draft.paymentMethod ?? null,
      isDeleted: draft.isDeleted,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      syncedAt: draft.syncedAt ?? null,
    };
  }
}
