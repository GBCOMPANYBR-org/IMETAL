import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Rota de manutenção desativada." },
    { status: 410 }
  );
}
