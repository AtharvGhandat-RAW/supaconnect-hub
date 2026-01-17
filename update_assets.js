
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function convert() {
  try {
    const logoPath = 'src/assets/logo.png'; // Updated to PNG
    console.log(`Generating icons from ${logoPath}...`);
    
    if (!fs.existsSync(logoPath)) {
        console.error('Logo file not found at ' + logoPath);
        process.exit(1);
    }

    // Ensure resources dir exists for Capacitor
    if (!fs.existsSync('resources')) {
        fs.mkdirSync('resources');
    }

    // --- Capacitor Assets ---
    // Generate Icon (Square)
    await sharp(logoPath)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent!
      })
      .toFile('resources/icon.png');
    
    // Generate Splash
    await sharp(logoPath)
      .resize(2732, 2732, { 
        fit: 'contain', 
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White bg for splash
      })
      .toFile('resources/splash.png');
      
    // --- Web Assets (Favicon) ---
    // Overwrite favicon.png and .ico with new logo
    await sharp(logoPath)
      .resize(64, 64, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile('public/favicon.png');

    await sharp(logoPath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile('public/favicon.ico');

    console.log('Icons prepared in resources/ and public/favicon.*');
    
  } catch (error) {
    console.error('Error processing images:', error);
    process.exit(1);
  }
}

convert();
