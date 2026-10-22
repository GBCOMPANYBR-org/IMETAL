"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "imetal_hide_valores";

interface ValuesVisibilityContextValue {
  /** true = valores monetários devem aparecer mascarados na tela (preferência pessoal, tipo app de banco). */
  hidden: boolean;
  toggle: () => void;
}

const ValuesVisibilityContext = createContext<ValuesVisibilityContextValue>({
  hidden: true,
  toggle: () => {},
});

/**
 * Preferência pessoal e só de exibição — não é uma permissão (isso continua controlado por
 * visibleFields no backend). É guardada no localStorage do navegador, então cada login decide
 * por si, e o valor real nunca deixa de vir do servidor: só a renderização troca por "R$ ••••••".
 * Começa sempre visível (false) no primeiro render, mesmo se o usuário já tinha ocultado antes,
 * para evitar mismatch de hidratação entre servidor e cliente — o localStorage é lido logo após
 * montar, então a troca (se houver) acontece em um piscar de olhos.
 */
export function ValuesVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") setHidden(true);
  }, []);

  function toggle() {
    setHidden((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return <ValuesVisibilityContext.Provider value={{ hidden, toggle }}>{children}</ValuesVisibilityContext.Provider>;
}

export function useValuesVisibility() {
  return useContext(ValuesVisibilityContext);
}
