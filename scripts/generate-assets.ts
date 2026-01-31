// scripts/generate-assets.ts
import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';

interface IconSize {
  size: number;
  scale: number;
  idiom: string;
  filename: string;
}

const IOS_ICON_SIZES: IconSize[] = [
  { size: 20, scale: 2, idiom: 'iphone', filename: 'Icon-20@2x.png' },
  { size: 20, scale: 3, idiom: 'iphone', filename: 'Icon-20@3x.png' },
  { size: 29, scale: 2, idiom: 'iphone', filename: 'Icon-29@2x.png' },
  { size: 29, scale: 3, idiom: 'iphone', filename: 'Icon-29@3x.png' },
  { size: 40, scale: 2, idiom: 'iphone', filename: 'Icon-40@2x.png' },
  { size: 40, scale: 3, idiom: 'iphone', filename: 'Icon-40@3x.png' },
  { size: 60, scale: 2, idiom: 'iphone', filename: 'Icon-60@2x.png' },
  { size: 60, scale: 3, idiom: 'iphone', filename: 'Icon-60@3x.png' },
  { size: 20, scale: 1, idiom: 'ipad', filename: 'Icon-20.png' },
  { size: 20, scale: 2, idiom: 'ipad', filename: 'Icon-20@2x-ipad.png' },
  { size: 29, scale: 1, idiom: 'ipad', filename: 'Icon-29.png' },
  { size: 29, scale: 2, idiom: 'ipad', filename: 'Icon-29@2x-ipad.png' },
  { size: 40, scale: 1, idiom: 'ipad', filename: 'Icon-40.png' },
  { size: 40, scale: 2, idiom: 'ipad', filename: 'Icon-40@2x-ipad.png' },
  { size: 76, scale: 1, idiom: 'ipad', filename: 'Icon-76.png' },
  { size: 76, scale: 2, idiom: 'ipad', filename: 'Icon-76@2x.png' },
  { size: 83.5, scale: 2, idiom: 'ipad', filename: 'Icon-83.5@2x.png' },
  { size: 1024, scale: 1, idiom: 'ios-marketing', filename: 'Icon-1024.png' },
];

const ANDROID_ICON_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const ANDROID_ADAPTIVE_SIZES = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

async function generateAssetsForTenant(tenantId: string) {
  const tenantDir = path.join(__dirname, '..', 'tenants', tenantId);
  const assetsDir = path.join(tenantDir, 'assets');
  const generatedDir = path.join(assetsDir, 'generated');
  
  await fs.ensureDir(generatedDir);
  
  const config = require(path.join(tenantDir, 'config.json'));
  const sourceIcon = path.join(assetsDir, 'icon.png');
  const splashLogo = path.join(assetsDir, 'splash.png');
  
  console.log(`Generating assets for tenant: ${tenantId}`);
  
  // Generate iOS icons
  console.log('Generating iOS icons...');
  const iosIconsDir = path.join(generatedDir, 'ios');
  await fs.ensureDir(iosIconsDir);
  
  for (const iconSize of IOS_ICON_SIZES) {
    const pixelSize = Math.round(iconSize.size * iconSize.scale);
    await sharp(sourceIcon)
      .resize(pixelSize, pixelSize)
      .png()
      .toFile(path.join(iosIconsDir, iconSize.filename));
  }
  
  // Generate Contents.json for iOS
  const iosContents = {
    images: IOS_ICON_SIZES.map(icon => ({
      size: `${icon.size}x${icon.size}`,
      idiom: icon.idiom,
      filename: icon.filename,
      scale: `${icon.scale}x`,
    })),
    info: { version: 1, author: 'xcode' },
  };
  await fs.writeJson(path.join(iosIconsDir, 'Contents.json'), iosContents, { spaces: 2 });
  
  // Generate Android icons
  console.log('Generating Android icons...');
  const androidIconsDir = path.join(generatedDir, 'android');
  
  for (const [density, size] of Object.entries(ANDROID_ICON_SIZES)) {
    const densityDir = path.join(androidIconsDir, `mipmap-${density}`);
    await fs.ensureDir(densityDir);
    
    await sharp(sourceIcon)
      .resize(size, size)
      .png()
      .toFile(path.join(densityDir, 'ic_launcher.png'));
    
    // Round icon
    const roundIcon = await createRoundIcon(sourceIcon, size);
    await roundIcon.toFile(path.join(densityDir, 'ic_launcher_round.png'));
  }
  
  // Generate Android adaptive icons
  console.log('Generating Android adaptive icons...');
  const adaptiveIcon = path.join(assetsDir, 'adaptive-icon.png');
  
  for (const [density, size] of Object.entries(ANDROID_ADAPTIVE_SIZES)) {
    const densityDir = path.join(androidIconsDir, `mipmap-${density}`);
    await fs.ensureDir(densityDir);
    
    await sharp(adaptiveIcon)
      .resize(size, size)
      .png()
      .toFile(path.join(densityDir, 'ic_launcher_foreground.png'));
  }
  
  // Generate splash screens
  console.log('Generating splash screens...');
  await generateSplashScreens(splashLogo, config, generatedDir);
  
  // Generate notification icon (Android)
  console.log('Generating notification icons...');
  await generateNotificationIcons(sourceIcon, config, generatedDir);
  
  console.log(`Assets generated successfully for ${tenantId}`);
}

async function createRoundIcon(sourcePath: string, size: number): Promise<sharp.Sharp> {
  const roundedCorners = Buffer.from(
    `<svg><circle cx="${size/2}" cy="${size/2}" r="${size/2}"/></svg>`
  );
  
  return sharp(sourcePath)
    .resize(size, size)
    .composite([{
      input: roundedCorners,
      blend: 'dest-in',
    }]);
}

async function generateSplashScreens(
  logoPath: string,
  config: TenantMobileConfig,
  outputDir: string
) {
  const splashDir = path.join(outputDir, 'splash');
  await fs.ensureDir(splashDir);
  
  const splashSizes = [
    { width: 1284, height: 2778, name: 'splash-iphone-portrait.png' },
    { width: 2778, height: 1284, name: 'splash-iphone-landscape.png' },
    { width: 2048, height: 2732, name: 'splash-ipad-portrait.png' },
    { width: 2732, height: 2048, name: 'splash-ipad-landscape.png' },
    { width: 1080, height: 1920, name: 'splash-android-portrait.png' },
    { width: 1920, height: 1080, name: 'splash-android-landscape.png' },
  ];
  
  for (const size of splashSizes) {
    // Create background
    const background = sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background: config.splash.backgroundColor,
      },
    });
    
    // Resize logo
    const logoWidth = config.splash.logoWidth || Math.min(size.width * 0.4, 400);
    const logo = await sharp(logoPath)
      .resize(logoWidth)
      .toBuffer();
    
    // Composite logo on background
    await background
      .composite([{
        input: logo,
        gravity: 'center',
      }])
      .png()
      .toFile(path.join(splashDir, size.name));
  }
}

async function generateNotificationIcons(
  sourcePath: string,
  config: TenantMobileConfig,
  outputDir: string
) {
  const notifDir = path.join(outputDir, 'notification');
  await fs.ensureDir(notifDir);
  
  // Android notification icons should be white silhouette
  const sizes = {
    mdpi: 24,
    hdpi: 36,
    xhdpi: 48,
    xxhdpi: 72,
    xxxhdpi: 96,
  };
  
  for (const [density, size] of Object.entries(sizes)) {
    const densityDir = path.join(notifDir, `drawable-${density}`);
    await fs.ensureDir(densityDir);
    
    // Convert to white silhouette
    await sharp(sourcePath)
      .resize(size, size)
      .greyscale()
      .threshold(128)
      .negate()
      .png()
      .toFile(path.join(densityDir, 'notification_icon.png'));
  }
}

// Run for specific tenant or all tenants
const targetTenant = process.argv[2];

if (targetTenant) {
  generateAssetsForTenant(targetTenant);
} else {
  // Generate for all tenants
  const tenantsDir = path.join(__dirname, '..', 'tenants');
  const tenants = fs.readdirSync(tenantsDir).filter(f => 
    fs.statSync(path.join(tenantsDir, f)).isDirectory()
  );
  
  Promise.all(tenants.map(generateAssetsForTenant))
    .then(() => console.log('All tenant assets generated'))
    .catch(console.error);
}
