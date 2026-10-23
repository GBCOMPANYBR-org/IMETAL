"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function PwaLaunch() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (!standalone || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // A cada nova abertura do app (não a cada troca de página).
    if (sessionStorage.getItem("imetal-launch-shown")) return;
    sessionStorage.setItem("imetal-launch-shown", "1");
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 2050);
    return () => window.clearTimeout(timeout);
  }, []);
  if (!visible) return null;
  return (
    <div aria-hidden="true" className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#ffe637] bg-[url('/login-background.svg')] bg-cover bg-center pointer-events-none" style={{ animation: "imetal-launch-fade 2.05s ease-in-out both" }}>
      <style>{`@keyframes imetal-launch-fade { 0%, 45% { opacity: 1; } 100% { opacity: 0; } } @keyframes imetal-launch-zoom { 0%,35% { transform:scale(1.65); filter:blur(0); } 100% { transform:scale(.55); filter:blur(6px); } }`}</style>
      <Image src="/logo.png" alt="" width={420} height={150} priority className="h-auto w-[75vw] max-w-[420px]" style={{ animation: "imetal-launch-zoom 2.05s ease-in-out both" }} />
    </div>
  );
}
