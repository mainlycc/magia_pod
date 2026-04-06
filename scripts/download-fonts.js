const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'public', 'fonts');
// Stare URL-e `github.com/.../raw/...` często zwracają stronę HTML zamiast binariów TTF.
// Pełne pliki z repozytorium googlefonts/noto-fonts działają z jsPDF + Identity-H + jspdf-autotable.
const fonts = [
  {
    url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
    filename: 'NotoSans-Regular.ttf',
  },
  {
    url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
    filename: 'NotoSans-Bold.ttf',
  },
];

// Utwórz folder jeśli nie istnieje
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

function assertLooksLikeTtf(buf, filename) {
  if (buf.length < 4096) {
    throw new Error(`${filename}: plik zbyt mały (${buf.length} B) — prawdopodobnie błąd sieci lub HTML`);
  }
  const head = buf.subarray(0, Math.min(256, buf.length)).toString('utf8').trimStart();
  if (head.startsWith('<!') || head.startsWith('<html') || head.startsWith('<?xml')) {
    throw new Error(`${filename}: pobrano HTML zamiast TTF — sprawdź URL w skrypcie`);
  }
  const sig = buf.subarray(0, 4);
  const ascii = sig.toString('ascii');
  const isTtfScalar =
    sig[0] === 0 && sig[1] === 1 && sig[2] === 0 && sig[3] === 0;
  const ok = isTtfScalar || ascii === 'OTTO' || ascii === 'true' || ascii === 'ttcf';
  if (!ok) {
    throw new Error(`${filename}: brak nagłówka TTF/OTF`);
  }
}

function downloadFont(font) {
  const filePath = path.join(fontsDir, font.filename);
  return new Promise((resolve, reject) => {
    const tryOnce = (url) => {
      https
        .get(url, (response) => {
          const { statusCode } = response;
          if (statusCode >= 301 && statusCode <= 308 && response.headers.location) {
            response.resume();
            tryOnce(new URL(response.headers.location, url).href);
            return;
          }
          if (statusCode !== 200) {
            response.resume();
            reject(new Error(`${font.filename}: HTTP ${statusCode}`));
            return;
          }
          const chunks = [];
          response.on('data', (c) => chunks.push(c));
          response.on('end', () => {
            try {
              const buf = Buffer.concat(chunks);
              assertLooksLikeTtf(buf, font.filename);
              fs.writeFileSync(filePath, buf);
              console.log(`✓ Downloaded ${font.filename} (${buf.length} B)`);
              resolve();
            } catch (e) {
              try {
                fs.unlinkSync(filePath);
              } catch (_) {}
              reject(e);
            }
          });
        })
        .on('error', reject);
    };
    tryOnce(font.url);
  });
}

Promise.all(fonts.map((f) => downloadFont(f))).catch((err) => {
  console.error('✗', err.message);
  process.exitCode = 1;
});

console.log('Downloading fonts...');

