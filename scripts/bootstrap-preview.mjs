import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.PREVIEW_ADMIN_USERNAME;
  const password = process.env.PREVIEW_ADMIN_PASSWORD;
  if (!username || !password) throw new Error("PREVIEW_ADMIN_USERNAME/PREVIEW_ADMIN_PASSWORD ausentes no Preview.");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { username },
    update: { active: true, role: "ADMIN", canEdit: true, mustChangePassword: false },
    create: {
      username,
      name: "Administrador Preview",
      passwordHash,
      role: "ADMIN",
      canEdit: true,
      active: true,
      allClientes: true,
      canViewGraficos: true,
      mustChangePassword: false,
    },
  });

  const statuses = [
    ["Finalizado", "#22c55e", false, 0],
    ["Cancelado", "#ef4444", false, 1],
    ["Em andamento", "#3b82f6", true, 2],
    ["Instalação", "#a855f7", true, 3],
    ["Sem ação", "#64748b", true, 4],
    ["Externo", "#f59e0b", true, 5],
    ["Serviço", "#ec4899", true, 6],
  ];
  for (const [label, color, editable, order] of statuses) {
    await prisma.status.upsert({ where: { label }, update: {}, create: { label, color, editable, order } });
  }
  for (const label of ["IMETAL", "J.A. ADELSON"]) {
    await prisma.faturamento.upsert({ where: { label }, update: {}, create: { label } });
  }
  for (const label of ["VENDA", "SERVIÇO"]) {
    await prisma.tipo.upsert({ where: { label }, update: {}, create: { label } });
  }
  for (const label of ["SIM", "NÃO"]) {
    await prisma.faturado.upsert({ where: { label }, update: {}, create: { label } });
  }
  await prisma.cliente.upsert({ where: { name: "CLIENTE TESTE" }, update: {}, create: { name: "CLIENTE TESTE" } });
  console.log("Bootstrap Preview concluído: admin e cadastros mínimos prontos.");
}

main().finally(() => prisma.$disconnect());
