import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantValidationGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Draft } from './draft.schema';
import { DraftService } from './draft.service';
import { SyncDraftDto } from './dto/sync-draft.dto';

@ApiTags('Drafts')
@Controller('tenants/:tenantId/drafts')
@UseGuards(JwtAuthGuard, TenantValidationGuard)
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
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  async syncDraft(
    @Param('tenantId') tenantId: string,
    @Body() syncDraftDto: SyncDraftDto,
  ) {
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
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  async findAll(@Param('tenantId') tenantId: string) {
    const drafts = await this.draftService.findAll(tenantId);

    return {
      drafts: drafts.map((draft) => this.draftToResponse(draft)),
    };
  }

  @Delete(':clientDraftId')
  @ApiOperation({
    summary: 'Soft delete a draft by clientDraftId',
  })
  @ApiResponse({
    status: 200,
    description: 'Draft soft deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Draft not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  async softDelete(
    @Param('tenantId') tenantId: string,
    @Param('clientDraftId') clientDraftId: string,
  ) {
    const draft = await this.draftService.softDelete(tenantId, clientDraftId);

    return this.draftToResponse(draft);
  }

  private draftToResponse(draft: Draft) {
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
