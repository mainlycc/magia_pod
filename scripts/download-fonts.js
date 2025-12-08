const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'public', 'fonts');
const fonts = [
  {
    url: 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Regular.ttf',
    filename: 'NotoSans-Regular.ttf'
  },
  {
    url: 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Bold.ttf',
    filename: 'NotoSans-Bold.ttf'
  }
];

// Utwórz folder jeśli nie istnieje
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

fonts.forEach(font => {
  const filePath = path.join(fontsDir, font.filename);
  const file = fs.createWriteStream(filePath);
  
  https.get(font.url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`✓ Downloaded ${font.filename}`);
    });
  }).on('error', (err) => {
    fs.unlink(filePath, () => {});
    console.error(`✗ Error downloading ${font.filename}:`, err.message);
  });
});

console.log('Downloading fonts...');

