import type { Extraction } from "./types";
import { readPcmsoPage, addClinicalRule, type SuggestedRole, type SuggestedExam } from "./pcmso";

/** Executado somente no navegador. Nenhum documento é enviado a provedores de OCR/IA. */
export async function extractDocument(documentId: number, onProgress: (text: string) => void, signal: AbortSignal, forceOcr = false): Promise<Extraction> {
  const response = await fetch(`/api/saude/documentos/${documentId}`, { signal });
  if (!response.ok) throw new Error("Não foi possível abrir o documento. Verifique seu acesso.");
  const blob = await response.blob();
  if (!blob.size || blob.size > 20 * 1024 * 1024) throw new Error("Use um arquivo não vazio de até 20 MB.");
  const type = blob.type.split(";")[0];
  let worker: import("tesseract.js").Worker | undefined;
  const check = () => { if (signal.aborted) throw new DOMException("Leitura cancelada", "AbortError"); };
  const cancel = () => { void worker?.terminate(); };
  signal.addEventListener("abort", cancel);
  let currentPage = 1;
  async function recognize(image: Blob | HTMLCanvasElement) {
    check();
    if (!worker) {
      onProgress("Carregando OCR em português (a primeira leitura pode demorar)...");
      const tesseract = await import("tesseract.js");
      const createWorker = tesseract.createWorker ?? tesseract.default.createWorker;
      worker = await createWorker("por", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: new URL("/ocr/core", location.origin).href,
        langPath: new URL("/ocr/lang", location.origin).href,
        logger: m => { if (m.status === "recognizing text") onProgress(`OCR da página ${currentPage}: ${Math.round(m.progress * 100)}%`); },
      });
      check();
    }
    let abortRecognition: () => void = () => {};
    try {
      const aborted = new Promise<never>((_, reject) => {
        abortRecognition = () => reject(new DOMException("Leitura cancelada", "AbortError"));
        signal.addEventListener("abort", abortRecognition, { once: true });
      });
      const result = await Promise.race([worker.recognize(image), aborted]);
      check();
      return result.data.text.trim();
    } finally { signal.removeEventListener("abort", abortRecognition); }
  }
  const pages: Extraction["pages"] = [];
  const roles: SuggestedRole[] = [];
  let clinical: SuggestedExam | undefined;
  try {
    if (type === "application/pdf") {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), cMapUrl: "/ocr/cmaps/", cMapPacked: true, standardFontDataUrl: "/ocr/standard_fonts/", wasmUrl: "/ocr/wasm/" });
      const abortPdf = () => { void task.destroy(); };
      signal.addEventListener("abort", abortPdf);
      try {
        const pdf = await task.promise;
        if (pdf.numPages > 100) throw new Error("Este arquivo tem mais de 100 páginas. Divida-o em partes para leitura.");
        for (currentPage = 1; currentPage <= pdf.numPages; currentPage++) {
          check();
          onProgress(`Lendo página ${currentPage} de ${pdf.numPages}...`);
          const page = await pdf.getPage(currentPage);
          const content = await page.getTextContent();
          let text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
          let method: "text" | "ocr" = "text";
          if (forceOcr || text.replace(/\s/g, "").length < 40) {
            const base = page.getViewport({ scale: 1 });
            const scale = Math.min(2, 3000 / Math.max(base.width, base.height));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
            try {
              await page.render({ canvas, viewport }).promise;
              const recognized = await recognize(canvas);
              // Mantém texto digital curto se OCR não conseguir ler a página.
              if (recognized) { text = recognized; method = "ocr"; }
            } finally { canvas.width = 0; canvas.height = 0; }
          }
          if (method === "text") {
            const parsed = readPcmsoPage(content.items.filter(item => "str" in item), currentPage);
            if (parsed.role) roles.push(parsed.role);
            if (parsed.clinical) clinical = parsed.clinical;
          }
          pages.push({ page: currentPage, method, text });
          page.cleanup();
        }
      } finally { signal.removeEventListener("abort", abortPdf); await task.destroy(); }
    } else if (["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"].includes(type)) {
      pages.push({ page: 1, method: "ocr", text: await recognize(blob) });
    } else throw new Error("Formato não suportado. Use PDF, JPEG, PNG, WebP ou GIF.");
    check();
    if (!pages.some(p => p.text.trim())) throw new Error("Nenhum texto legível identificado. Tente uma imagem mais nítida ou confira o original manualmente.");
    const text = pages.map(p => `--- Página ${p.page} (${p.method === "ocr" ? "OCR" : "texto"}) ---\n${p.text || "[Sem texto identificado]"}`).join("\n\n");
    if (text.length > 500000 || pages.some(p => p.text.length > 100000)) throw new Error("Texto acima do limite. Divida o documento em partes.");
    return { documentId, pages, text, edited: false, pcmsoSuggestions: addClinicalRule(roles, clinical) };
  } finally { signal.removeEventListener("abort", cancel); await worker?.terminate(); }
}
