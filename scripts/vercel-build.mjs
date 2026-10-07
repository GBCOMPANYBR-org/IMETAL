import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const isVercelPreview = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview";

if (isVercelPreview) {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL_UNPOOLED) {
    console.error("Preview sem DATABASE_URL/DATABASE_URL_UNPOOLED. Migration cancelada.");
    process.exit(1);
  }
  console.log("Vercel Preview detectado: aplicando Prisma migrations no banco Preview...");
  run("npx", ["prisma", "migrate", "deploy"]);
  run("node", ["scripts/bootstrap-preview.mjs"]);
} else {
  console.log("Migration automática ignorada: este build não é Vercel Preview.");
}

run("npx", ["next", "build"]);
