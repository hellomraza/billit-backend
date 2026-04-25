import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
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
    summary: 'Sync draft (authenticated route wiring)',
  })
  @ApiResponse({
    status: 200,
    description: 'Draft sync route reached',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async syncDraft(@Req() request: any, @Body() syncDraftDto: SyncDraftDto) {
    const tenantId = request.user?.sub;
    return this.draftService.syncDraft(tenantId, syncDraftDto);
  }
}
