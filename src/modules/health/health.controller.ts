import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

/**
 * Health Check Controller
 * Provides endpoints for monitoring service health and readiness
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  /**
   * Liveness probe - Is the service running?
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Check if the service is running (for Kubernetes liveness probe)',
  })
  @ApiOkResponse({
    description: 'Service is alive',
    schema: {
      properties: {
        status: { type: 'string', example: 'alive' },
        timestamp: { type: 'string' },
      },
    },
  })
  live() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe - Is the service ready to accept requests?
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Check if the service is ready to accept requests (for Kubernetes readiness probe)',
  })
  @ApiOkResponse({
    description: 'Service is ready',
    schema: {
      properties: {
        status: { type: 'string', example: 'ready' },
        timestamp: { type: 'string' },
        uptime: { type: 'number' },
      },
    },
  })
  ready() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Detailed health check
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detailed health check',
    description: 'Get detailed health status including uptime and version',
  })
  @ApiOkResponse({
    description: 'Health check details',
    type: 'object',
  })
  check(): HealthCheckResponse {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.API_VERSION || '1.0.0',
    };
  }
}
