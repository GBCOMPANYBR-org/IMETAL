import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { hashPassword } from "../lib/auth";
import { PEDIDO_FIELD_KEYS } from "../lib/fields";

const prisma = new PrismaClient();

// Single canonical source of truth — update this filename whenever Felipe sends a new export
// (or point SEED_SOURCE_FILE at it for a one-off import without touching this file).
const SOURCE_FILES = ["Dados 26-08-26 Rev. 2.xlsx"];

const STATUS_CONFIG: Record<string, { color: string; editable: boolean }> = {
  Finalizado: { color: "#22c55e", editable: false },
  Cancelado: { color: "#ef4444", editable: false },
  "Em andamento": { color: "#3b82f6", editable: true },
  Instalação: { color: "#a855f7", editable: true },
  "Sem ação": { color: "#64748b", editable: true },
  Externo: { color: "#f59e0b", editable: true },
  Serviço: { color: "#ec4899", editable: true },
};
const DEFAULT_STATUS_COLOR = "#64748b";

// Values found in the real spreadsheet's TIPO column that are clearly data-entry mistakes
// (e.g. a city name typed into the wrong column), not a legitimate new Tipo. Rows hitting
// this fall back to "VENDA" and are reported at the end so they can be double-checked.
const INVALID_TIPO_VALUES = new Set(["CAJAMAR"]);

interface SheetRow {
  originalId: number;
  statusLabel: string;
  statusWasBlank: boolean;
  clienteName: string;
  pedidoCompra: string | null;
  data: Date | null;
  qtd: number;
  codigo: string | null;
  descricao: string | null;
  ncm: string | null;
  valorUnitario: number;
  pagamento: string | null;
  faturamentoLabel: string;
  tipoLabel: string;
  tipoWasInvalid: boolean;
  observacao: string | null;
  faturadoLabel: string;
  dataFaturamento: Date | null;
  nf: string | null;
  pdv: string | null;
}

function toText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/** Parses numbers defensively: handles plain numbers, Brazilian comma-decimals, and stray unit suffixes (e.g. "2,5 FT" -> 2.5). */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const match = String(value).trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  const n = Number(match[0].replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function excelSerialToDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value;
  const serial = Number(value);
  if (!Number.isFinite(serial)) return null;
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 86400000);
}

function resolveSourceFile(): string {
  if (process.env.SEED_SOURCE_FILE) {
    const override = path.resolve(process.cwd(), process.env.SEED_SOURCE_FILE);
    if (!fs.existsSync(override)) {
      throw new Error(`SEED_SOURCE_FILE aponta para um arquivo que não existe: ${override}`);
    }
    return override;
  }
  for (const name of SOURCE_FILES) {
    const filePath = path.resolve(process.cwd(), name);
    if (fs.existsSync(filePath)) return filePath;
  }
  throw new Error(`Nenhuma planilha encontrada (procurei: ${SOURCE_FILES.join(", ")}).`);
}

function readSheetRows(): { rows: SheetRow[]; sourceFile: string } {
  const filePath = resolveSourceFile();
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });

  const headerIndex = rows.findIndex((r) => r[0] === "ID" && r[1] === "STATUS" && r[2] === "CLIENTE");
  if (headerIndex === -1) {
    throw new Error("Não foi possível localizar a linha de cabeçalho (ID/STATUS/CLIENTE) na planilha.");
  }

  const dataRows: SheetRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const idCell = row[0];
    if (idCell === null || idCell === undefined || Number.isNaN(Number(idCell))) break;

    const rawTipo = toText(row[13]);
    const tipoWasInvalid = rawTipo !== null && INVALID_TIPO_VALUES.has(rawTipo);

    dataRows.push({
      originalId: Number(idCell),
      statusLabel: toText(row[1]) ?? "Sem ação",
      statusWasBlank: toText(row[1]) === null,
      clienteName: toText(row[2]) ?? "NÃO INFORMADO",
      pedidoCompra: toText(row[3]),
      data: excelSerialToDate(row[4]),
      qtd: toNumber(row[5]),
      codigo: toText(row[6]),
      descricao: toText(row[7]),
      ncm: toText(row[8]),
      valorUnitario: toNumber(row[9]),
      pagamento: toText(row[11]),
      faturamentoLabel: toText(row[12]) ?? "IMETAL",
      tipoLabel: !rawTipo || tipoWasInvalid ? "VENDA" : rawTipo,
      tipoWasInvalid,
      observacao: toText(row[14]),
      faturadoLabel: toText(row[15]) ?? "NÃO",
      dataFaturamento: excelSerialToDate(row[16]),
      nf: toText(row[17]),
      pdv: toText(row[18]),
    });
  }
  return { rows: dataRows, sourceFile: filePath };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const { rows, sourceFile } = readSheetRows();
  console.log(`Planilha lida (${path.basename(sourceFile)}): ${rows.length} pedidos encontrados.`);

  const distinctStatus = Array.from(new Set(rows.map((r) => r.statusLabel)));
  const distinctClientes = Array.from(new Set(rows.map((r) => r.clienteName))).sort();
  const distinctFaturamento = Array.from(new Set(["IMETAL", "J.A. ADELSON", ...rows.map((r) => r.faturamentoLabel)]));
  const distinctTipo = Array.from(new Set(["VENDA", "SERVIÇO", ...rows.map((r) => r.tipoLabel)]));
  const distinctFaturado = Array.from(new Set(["SIM", "NÃO", ...rows.map((r) => r.faturadoLabel)]));
  const distinctPagamento = Array.from(new Set(rows.map((r) => r.pagamento).filter((v): v is string => v !== null)));

  const statusByLabel = new Map<string, { id: number }>();
  for (const [order, label] of distinctStatus.entries()) {
    const config = STATUS_CONFIG[label] ?? { color: DEFAULT_STATUS_COLOR, editable: true };
    const created = await prisma.status.upsert({
      where: { label },
      update: {},
      create: { label, color: config.color, editable: config.editable, order },
    });
    statusByLabel.set(label, created);
  }

  const clienteByName = new Map<string, { id: number }>();
  for (const name of distinctClientes) {
    const created = await prisma.cliente.upsert({ where: { name }, update: {}, create: { name } });
    clienteByName.set(name, created);
  }

  const faturamentoByLabel = new Map<string, { id: number }>();
  for (const label of distinctFaturamento) {
    const created = await prisma.faturamento.upsert({ where: { label }, update: {}, create: { label } });
    faturamentoByLabel.set(label, created);
  }

  const tipoByLabel = new Map<string, { id: number }>();
  for (const label of distinctTipo) {
    const created = await prisma.tipo.upsert({ where: { label }, update: {}, create: { label } });
    tipoByLabel.set(label, created);
  }

  const faturadoByLabel = new Map<string, { id: number }>();
  for (const label of distinctFaturado) {
    const created = await prisma.faturado.upsert({ where: { label }, update: {}, create: { label } });
    faturadoByLabel.set(label, created);
  }

  const pagamentoByLabel = new Map<string, { id: number }>();
  for (const label of distinctPagamento) {
    const created = await prisma.pagamento.upsert({ where: { label }, update: {}, create: { label } });
    pagamentoByLabel.set(label, created);
  }

  const adminUsername = process.env.ADMIN_DEFAULT_USERNAME ?? "admin";
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD ?? "imetal123";
  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      name: "Administrador",
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      canEdit: true,
      active: true,
      permissions: { create: PEDIDO_FIELD_KEYS.map((fieldKey) => ({ fieldKey, canView: true })) },
    },
  });
  console.log(`Usuário ADMIN pronto: ${admin.username} / senha padrão "${adminPassword}" (troque após o primeiro acesso).`);

  const existingPedidos = await prisma.pedido.count();
  if (existingPedidos > 0) {
    console.log(`Já existem ${existingPedidos} pedidos no banco — pulando importação de linhas para evitar duplicidade.`);
  } else {
    const pedidosData = rows.map((row) => {
      const status = statusByLabel.get(row.statusLabel)!;
      const cliente = clienteByName.get(row.clienteName)!;
      const faturamento = faturamentoByLabel.get(row.faturamentoLabel)!;
      const tipo = tipoByLabel.get(row.tipoLabel)!;
      const faturado = faturadoByLabel.get(row.faturadoLabel)!;
      const pagamento = row.pagamento ? pagamentoByLabel.get(row.pagamento) : undefined;

      return {
        id: row.originalId,
        statusId: status.id,
        clienteId: cliente.id,
        faturamentoId: faturamento.id,
        tipoId: tipo.id,
        faturadoId: faturado.id,
        pedidoCompra: row.pedidoCompra,
        data: row.data,
        qtd: row.qtd,
        codigo: row.codigo,
        descricao: row.descricao,
        ncm: row.ncm,
        valorUnitario: row.valorUnitario,
        valorTotal: row.qtd * row.valorUnitario,
        pagamentoId: pagamento?.id,
        observacao: row.observacao,
        dataFaturamento: row.dataFaturamento,
        nf: row.nf,
        pdv: row.pdv,
        createdById: admin.id,
        updatedById: admin.id,
      };
    });

    for (const batch of chunk(pedidosData, 200)) {
      await prisma.pedido.createMany({ data: batch });
    }
    console.log(`${rows.length} pedidos importados de ${path.basename(sourceFile)}, preservando o ID da planilha.`);

    // Ids were inserted explicitly (matching the spreadsheet), so the underlying Postgres
    // sequence never advanced — without this, the next pedido created through the app would
    // collide with an imported id. Resync it to continue right after the highest imported id.
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Pedido"', 'id'), (SELECT MAX(id) FROM "Pedido"))`
    );
    const nextId = await prisma.pedido.aggregate({ _max: { id: true } });
    console.log(`Sequência de ID ajustada — próximo pedido criado pelo sistema começará em ${(nextId._max.id ?? 0) + 1}.`);

    const blankStatusIds = rows.filter((r) => r.statusWasBlank).map((r) => r.originalId);
    if (blankStatusIds.length > 0) {
      console.log(
        `Aviso: ${blankStatusIds.length} pedido(s) sem Status na planilha original entraram como "Sem ação" (IDs originais: ${blankStatusIds.join(", ")}).`
      );
    }
    const invalidTipoIds = rows.filter((r) => r.tipoWasInvalid).map((r) => r.originalId);
    if (invalidTipoIds.length > 0) {
      console.log(
        `Aviso: ${invalidTipoIds.length} pedido(s) com valor de Tipo inválido na planilha original entraram como "VENDA" (IDs originais: ${invalidTipoIds.join(", ")}) — vale conferir manualmente.`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
