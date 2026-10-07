import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

const CONFIRMATION = "APLICAR MIGRACAO FINALIZADOS";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as { confirmation?: string } | null;
  if (body?.confirmation !== CONFIRMATION) {
    return NextResponse.json(
      { error: "Confirmação inválida. Nenhuma alteração foi executada." },
      { status: 400 }
    );
  }

  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastFinalizadosViewedAt" TIMESTAMP(3)'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "finalizadoAt" TIMESTAMP(3)'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Pedido_finalizadoAt_idx" ON "Pedido"("finalizadoAt")'
    );

    const rows = await prisma.$queryRawUnsafe<Array<{ user_column: boolean; pedido_column: boolean; pedido_index: boolean }>>(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'User'
            AND column_name = 'lastFinalizadosViewedAt'
        ) AS user_column,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'Pedido'
            AND column_name = 'finalizadoAt'
        ) AS pedido_column,
        EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'Pedido'
            AND indexname = 'Pedido_finalizadoAt_idx'
        ) AS pedido_index
    `);

    const verification = rows[0] ?? {
      user_column: false,
      pedido_column: false,
      pedido_index: false,
    };

    const ok = verification.user_column && verification.pedido_column && verification.pedido_index;
    return NextResponse.json({ ok, verification }, { status: ok ? 200 : 500 });
  } catch (error) {
    console.error("Falha na migration temporária de finalizados:", error);
    return NextResponse.json(
      { error: "Falha ao aplicar a migration. Consulte os logs do servidor." },
      { status: 500 }
    );
  }
}
