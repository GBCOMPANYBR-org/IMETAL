// Copia os binários WASM do three-usdz-loader para public/usd-wasm, de onde o
// visualizador 3D carrega o runtime no navegador. Roda no postinstall (não são
// versionados no git — ficam sempre em sincronia com a versão instalada do pacote).
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "node_modules", "three-usdz-loader", "external");
const DEST = path.join(__dirname, "..", "public", "usd-wasm");

if (!fs.existsSync(SRC)) {
  console.warn("[copy-usd-wasm] three-usdz-loader não encontrado, pulando cópia dos assets 3D.");
  process.exit(0);
}

fs.mkdirSync(DEST, { recursive: true });

for (const file of fs.readdirSync(SRC)) {
  fs.copyFileSync(path.join(SRC, file), path.join(DEST, file));
}

console.log(`[copy-usd-wasm] Assets do visualizador 3D copiados para ${path.relative(process.cwd(), DEST)}`);
