#!/bin/bash
# docker/scripts/init-db.sh
# Location: omniswap/docker/scripts/init-db.sh

set -e

echo "🗄️  Initializing OmniSwap database..."

# Create additional databases if needed
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    
    -- Create default tenant
    INSERT INTO "Tenant" (id, name, slug, status, plan, domains, "createdAt", "updatedAt")
    VALUES (
        'default',
        'OmniSwap',
        'default',
        'active',
        'enterprise',
        ARRAY['localhost'],
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create default tenant config
    INSERT INTO "TenantConfig" ("tenantId", branding, theme, features, fees, tokens, "updatedAt")
    VALUES (
        'default',
        '{"name": "OmniSwap", "tagline": "Swap Anything, Anywhere"}',
        '{}',
        '{}',
        '{}',
        '{}',
        NOW()
    ) ON CONFLICT ("tenantId") DO NOTHING;
EOSQL

echo "✅ Database initialized successfully!"
