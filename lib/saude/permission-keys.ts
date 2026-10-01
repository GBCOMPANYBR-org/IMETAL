// Pure constants — no server-only imports (prisma, next/server) — so client components can
// import this module directly without pulling server code into the browser bundle.

export type SauRole = "ADMINISTRADOR" | "SST" | "RH" | "GESTOR" | "VISUALIZACAO";

export const SAU_ROLES: { value: SauRole; label: string }[] = [
  { value: "ADMINISTRADOR", label: "Administrador" },
  { value: "SST", label: "SST" },
  { value: "RH", label: "RH" },
  { value: "GESTOR", label: "Gestor" },
  { value: "VISUALIZACAO", label: "Visualização" },
];

export const SAU_PERMISSION_KEYS = [
  "employee.view",
  "employee.edit",
  "pcmso.view",
  "pcmso.upload",
  "pcmso.review",
  "pcmso.approve",
  "aso.view",
  "aso.upload",
  "aso.review",
  "exam.view",
  "exam.edit",
  "release.view",
  "release.manage",
  "report.view",
  "audit.view",
] as const;

export type SauPermissionKey = (typeof SAU_PERMISSION_KEYS)[number];

export const SAU_PERMISSION_LABELS: Record<SauPermissionKey, string> = {
  "employee.view": "Ver funcionários",
  "employee.edit": "Editar funcionários",
  "pcmso.view": "Ver PCMSO",
  "pcmso.upload": "Enviar PCMSO",
  "pcmso.review": "Revisar leitura de IA do PCMSO",
  "pcmso.approve": "Aprovar e publicar PCMSO",
  "aso.view": "Ver ASO",
  "aso.upload": "Enviar ASO",
  "aso.review": "Revisar / confirmar ASO",
  "exam.view": "Ver exames",
  "exam.edit": "Editar exames",
  "release.view": "Ver liberação",
  "release.manage": "Gerenciar regras de liberação",
  "report.view": "Ver relatórios",
  "audit.view": "Ver auditoria",
};

/**
 * Preset applied to SauUserPermission when a role is granted or changed — a starting point,
 * editable per user afterwards. Authorization itself never consults `role` directly: it always
 * reads the effective SauUserPermission rows (see requireSaudeAccess in lib/saude/permissions.ts).
 */
export const SAU_ROLE_DEFAULTS: Record<SauRole, SauPermissionKey[]> = {
  ADMINISTRADOR: [...SAU_PERMISSION_KEYS],
  SST: [
    "employee.view",
    "employee.edit",
    "pcmso.view",
    "pcmso.upload",
    "pcmso.review",
    "pcmso.approve",
    "aso.view",
    "aso.upload",
    "aso.review",
    "exam.view",
    "exam.edit",
    "release.view",
    "report.view",
  ],
  RH: ["employee.view", "employee.edit", "aso.view", "aso.upload", "aso.review", "exam.view", "exam.edit", "release.view", "report.view"],
  GESTOR: ["employee.view", "release.view", "report.view"],
  VISUALIZACAO: ["employee.view", "release.view"],
};
