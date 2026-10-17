const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '../public/ocr');
fs.mkdirSync(target, { recursive: true });
function copy(from, to) { fs.cpSync(from, path.join(target, to), { recursive: true }); }
copy(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), 'pdf.worker.min.mjs');
const pdfRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
for (const dir of ['cmaps', 'standard_fonts', 'wasm']) copy(path.join(pdfRoot, dir), dir);
copy(require.resolve('tesseract.js/dist/worker.min.js'), 'worker.min.js');
const core = path.dirname(require.resolve('tesseract.js-core/package.json'));
for (const file of fs.readdirSync(core)) {
  if (file.endsWith('.wasm.js')) copy(path.join(core, file), `core/${file}`);
}
const por = require('@tesseract.js-data/por');
copy(path.join(por.langPath, 'por.traineddata.gz'), 'lang/por.traineddata.gz');
console.log('[ocr] Assets locais preparados');
