// apps/api/src/middleware/tenant.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { TenantConfig } from '@omniswap/types';
import { TenantService } from '../services/tenant.service';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    tenant: TenantConfig;
  }
}

const tenantService = new TenantService();

export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Skip for health checks
  if (request.url.startsWith('/health')) {
    return;
  }

  // Extract tenant ID from various sources
  let tenantId: string | undefined;

  // 1. From header
  tenantId = request.headers['x-tenant-id'] as string;

  // 2. From subdomain (tenant.api.omniswap.io)
  if (!tenantId) {
    const host = request.headers.host || '';
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'api' && subdomain !== 'www') {
      tenantId = subdomain;
    }
  }

  // 3. From query param (for testing)
  if (!tenantId && request.query) {
    tenantId = (request.query as any).tenantId;
  }

  // Default tenant for development
  if (!tenantId) {
    tenantId = 'default';
  }

  try {
    const tenant = await tenantService.getTenantConfig(tenantId);
    
    if (!tenant) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found',
        },
      });
    }

    if (tenant.tenant.status !== 'active') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'TENANT_INACTIVE',
          message: 'Tenant is not active',
        },
      });
    }

    request.tenantId = tenantId;
    request.tenant = tenant;
  } catch (error) {
    request.log.error(error, 'Failed to load tenant');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'TENANT_LOAD_ERROR',
        message: 'Failed to load tenant configuration',
      },
    });
  }
}
