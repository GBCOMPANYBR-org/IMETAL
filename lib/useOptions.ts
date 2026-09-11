"use client";

import { useEffect, useState } from "react";

export interface LabelOption {
  id: number;
  label: string;
}
export interface NameOption {
  id: number;
  name: string;
}
export interface StatusOption {
  id: number;
  label: string;
  color: string;
  editable: boolean;
}

export interface PedidoOptions {
  status: StatusOption[];
  clientes: NameOption[];
  faturamento: LabelOption[];
  tipo: LabelOption[];
  faturado: LabelOption[];
  pagamento: LabelOption[];
}

const EMPTY: PedidoOptions = { status: [], clientes: [], faturamento: [], tipo: [], faturado: [], pagamento: [] };

/** Loads the dropdown option lists used across filters and the pedido form. Fetched once per mount. */
export function usePedidoOptions(): { options: PedidoOptions; loading: boolean; reload: () => void } {
  const [options, setOptions] = useState<PedidoOptions>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/options/status").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/options/clientes").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/options/faturamento").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/options/tipo").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/options/faturado").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/options/pagamento").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([status, clientes, faturamento, tipo, faturado, pagamento]) => {
        if (cancelled) return;
        setOptions({ status, clientes, faturamento, tipo, faturado, pagamento });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { options, loading, reload: () => setVersion((v) => v + 1) };
}
