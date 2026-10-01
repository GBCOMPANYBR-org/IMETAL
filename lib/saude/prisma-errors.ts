import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

/** Turns a unique-constraint violation (P2002 — matrícula/CPF/nome já cadastrado) into a clean
 *  400 instead of letting it bubble up as an unhandled 500. Mirrors runWithFkErrorHandling in
 *  lib/prisma-errors.ts, kept separate so this module has no dependency on Pedidos' error copy. */
export async function runWithUniqueErrorHandling<T>(fn: () => Promise<T>, message: string): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw err;
  }
}
