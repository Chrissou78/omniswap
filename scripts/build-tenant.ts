// scripts/build-tenant.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

interface BuildOptions {
  tenantId: string;
  platform: 'ios' | 'android' | 'all';
  profile: 'development' | 'preview' | 'production';
  autoSubmit: boolean;
}

async function buildTenant(options: BuildOptions) {
  const { tenantId, platform, profile, autoSubmit } = options;
  
  console.log(`\n🏗️  Building ${tenantId} for ${platform} (${profile})\n`);
  
  // Validate tenant exists
  const tenantDir = path.join(__dirname, '..', 'tenants', tenantId);
  if (!await fs.pathExists(tenantDir)) {
    throw new Error(`Tenant ${tenantId} not found`);
  }
  
  // Load and validate config
  const config = require(path.join(tenantDir, 'config.json'));
  validateTenantConfig(config);
  
  // Generate assets if needed
  console.log('📦 Generating assets...');
  await execAsync(`npx ts-node scripts/generate-assets.ts ${tenantId}`);
  
  // Set environment variables
  const env = {
    ...process.env,
    TENANT_ID: tenantId,
    API_URL: config.apiUrl || `https://api.${config.deepLinking.universalLinks.ios.applinks[0]}`,
    APP_VERSION: config.app.version || '1.0.0',
  };
  
  // Build commands
  const platforms = platform === 'all' ? ['ios', 'android'] : [platform];
  
  for (const p of platforms) {
    console.log(`\n📱 Building ${p}...`);
    
    const buildProfile = `tenant-${tenantId}-${profile}`;
    let command = `eas build --platform ${p} --profile ${buildProfile} --non-interactive`;
    
    if (autoSubmit && profile === 'production') {
      command += ' --auto-submit';
    }
    
    try {
      const { stdout, stderr } = await execAsync(command, { env });
      console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (error: any) {
      console.error(`Build failed for ${p}:`, error.message);
      throw error;
    }
  }
  
  console.log(`\n✅ Build complete for ${tenantId}!\n`);
}

function validateTenantConfig(config: TenantMobileConfig) {
  const required = [
    'app.name',
    'identifiers.ios.bundleId',
    'identifiers.android.packageName',
    'theme.colors.primary',
    'deepLinking.scheme',
  ];
  
  for (const field of required) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], config as any);
    if (!value) {
      throw new Error(`Missing required config field: ${field}`);
    }
  }
  
  // Validate bundle ID format
  const bundleIdRegex = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i;
  if (!bundleIdRegex.test(config.identifiers.ios.bundleId)) {
    throw new Error('Invalid iOS bundle identifier format');
  }
  if (!bundleIdRegex.test(config.identifiers.android.packageName)) {
    throw new Error('Invalid Android package name format');
  }
}

// CLI
const args = process.argv.slice(2);
const tenantId = args[0];
const platform = (args[1] as 'ios' | 'android' | 'all') || 'all';
const profile = (args[2] as 'development' | 'preview' | 'production') || 'production';
const autoSubmit = args.includes('--submit');

if (!tenantId) {
  console.error('Usage: npx ts-node scripts/build-tenant.ts <tenant-id> [ios|android|all] [development|preview|production] [--submit]');
  process.exit(1);
}

buildTenant({ tenantId, platform, profile, autoSubmit })
  .catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
