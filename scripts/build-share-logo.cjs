const sharp = require('../backend/node_modules/sharp');
const fs = require('fs');

async function buildCrispLogo() {
  const emblemResized = await sharp('frontend/public/logo.png')
    .resize(440, 440, { fit: 'contain', background: '#ffffff' })
    .toBuffer();

  const svgStr = '<svg width="800" height="200" xmlns="http://www.w3.org/2000/svg">' +
    '<text x="400" y="125" font-family="Arial, Helvetica, sans-serif" font-size="70" font-weight="bold" fill="#014a38" text-anchor="middle">Wellness Valley</text>' +
    '</svg>';

  const textSvg = Buffer.from(svgStr);

  const finalImage = await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite([
    { input: emblemResized, top: 100, left: 180 },
    { input: textSvg, top: 540, left: 0 }
  ])
  .png()
  .toBuffer();

  fs.writeFileSync('frontend/public/wellness-valley-share.png', finalImage);
  console.log('Saved frontend/public/wellness-valley-share.png, size:', finalImage.length);
}
buildCrispLogo();
