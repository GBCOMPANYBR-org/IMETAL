const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  // This bootstrap must never touch Production, even if preview credentials are accidentally
  // configured there. Vercel sets VERCEL_ENV to "preview" only for Preview deployments.
  if (process.env.VERCEL_ENV !== "preview") {
    console.log("[preview-admin] skipped: not a Vercel Preview deployment");
    return;
  }

  const username = process.env.PREVIEW_ADMIN_USERNAME?.trim();
  const password = process.env.PREVIEW_ADMIN_PASSWORD;
  if (!username || !password) {
    console.log("[preview-admin] skipped: Preview admin credentials are not configured");
    return;
  }
  if (password.length < 8) {
    throw new Error("[preview-admin] PREVIEW_ADMIN_PASSWORD must have at least 8 characters");
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: {
        passwordHash,
        name: "Administrador Preview",
        role: "ADMIN",
        canEdit: true,
        active: true,
        allClientes: true,
        canViewGraficos: true,
        mustChangePassword: false,
      },
      create: {
        username,
        passwordHash,
        name: "Administrador Preview",
        role: "ADMIN",
        canEdit: true,
        active: true,
        allClientes: true,
        canViewGraficos: true,
        mustChangePassword: false,
      },
    });
    console.log("[preview-admin] Preview administrator is ready");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[preview-admin] failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
