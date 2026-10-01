import { mkdir, unlink, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID, createHash } from "crypto";
import { put, del } from "@vercel/blob";

// Same strategy as lib/storage.ts (Pedidos attachments): Vercel Blob in production, local disk
// fallback in dev. Kept as a separate module — and a separate path prefix below — so a Saúde
// Ocupacional document never ends up sharing a folder, or being discoverable by proximity, with
// a Pedido attachment.
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const STORAGE_ROOT = path.resolve(process.cwd(), /*turbopackIgnore: true*/ process.env.SAUDE_STORAGE_DIR ?? "./storage/saude");

function safeStoredName(originalName: string): string {
  const ext = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);
  return `${randomUUID()}${ext}`;
}

function isWithinStorageRoot(fullPath: string): boolean {
  return fullPath === STORAGE_ROOT || fullPath.startsWith(STORAGE_ROOT + path.sep);
}

export interface SaudeSavedFile {
  /** Opaque identifier — Blob URL in Blob mode, relative disk path in local mode. Callers must
   *  always go through readSaudeFile / deleteSaudeFile rather than interpreting this value. */
  storedPath: string;
  hash: string;
  size: number;
}

/**
 * Saves a Saúde Ocupacional document under its own prefix (e.g. "saude/pcmso/<versaoId>/...").
 * The raw Blob URL returned by `put` is never handed back to a caller outside this module —
 * every read goes through readSaudeFile, which streams the bytes through our own server, so the
 * permission check in the calling API route runs on every access regardless of whether the
 * underlying URL is easy or hard to guess (see AGENTS.md / seção 31: obscurity isn't protection).
 */
export async function saveSaudeFile(pathPrefix: string, originalName: string, bytes: Buffer): Promise<SaudeSavedFile> {
  const hash = createHash("sha256").update(bytes).digest("hex");

  if (USE_BLOB) {
    const blob = await put(`saude/${pathPrefix}/${safeStoredName(originalName)}`, bytes, {
      access: "public",
      addRandomSuffix: true,
    });
    return { storedPath: blob.url, hash, size: bytes.length };
  }

  const dir = path.join(/*turbopackIgnore: true*/ STORAGE_ROOT, pathPrefix);
  await mkdir(dir, { recursive: true });
  const storedName = safeStoredName(originalName);
  const fullPath = path.join(/*turbopackIgnore: true*/ dir, storedName);
  await writeFile(fullPath, bytes);
  return { storedPath: path.join(pathPrefix, storedName), hash, size: bytes.length };
}

export async function readSaudeFile(storedPath: string): Promise<Buffer> {
  if (storedPath.startsWith("http://") || storedPath.startsWith("https://")) {
    const res = await fetch(storedPath);
    if (!res.ok) throw new Error("Não foi possível ler o documento do armazenamento.");
    return Buffer.from(await res.arrayBuffer());
  }

  const fullPath = path.join(/*turbopackIgnore: true*/ STORAGE_ROOT, storedPath);
  if (!isWithinStorageRoot(fullPath)) {
    throw new Error("Caminho de documento inválido.");
  }
  return readFile(fullPath);
}

export async function deleteSaudeFile(storedPath: string): Promise<void> {
  if (storedPath.startsWith("http://") || storedPath.startsWith("https://")) {
    await del(storedPath).catch(() => undefined);
    return;
  }

  const fullPath = path.join(/*turbopackIgnore: true*/ STORAGE_ROOT, storedPath);
  if (!isWithinStorageRoot(fullPath)) return;
  await unlink(fullPath).catch(() => undefined);
}
