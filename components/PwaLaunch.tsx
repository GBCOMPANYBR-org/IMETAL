"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function PwaLaunch() {
  const [visible, setVisible] = useState(false);
  const logoRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (!standalone || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (sessionStorage.getItem("imetal-launch-shown")) return;
    sessionStorage.setItem("imetal-launch-shown", "1");
    document.documentElement.classList.add("imetal-launch-active");
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const logo = logoRef.current;
    const background = backgroundRef.current;
    if (!logo || !background) return;
    let cancelled = false;
    let logoAnimation: Animation | undefined;
    let backgroundAnimation: Animation | undefined;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const target = document.querySelector("[data-imetal-login-logo] img");
      const end = target?.getBoundingClientRect();
      const start = logo.getBoundingClientRect();
      // A tela autenticada não possui logo de login: faz redução central.
      const finalWidth = end?.width ?? Math.min(200, start.width * .5);
      const finalX = end ? end.left + end.width / 2 : window.innerWidth / 2;
      const finalY = end ? end.top + end.height / 2 : window.innerHeight / 2;
      const startX = start.left + start.width / 2;
      const startY = start.top + start.height / 2;
      const scale = finalWidth / start.width;
      logoAnimation = logo.animate([
        { transform: "translate(0px, 0px) scale(1)", offset: 0 },
        { transform: "translate(0px, 0px) scale(1)", offset: .35 },
        { transform: `translate(${finalX - startX}px, ${finalY - startY}px) scale(${scale})`, offset: .90 },
        { transform: `translate(${finalX - startX}px, ${finalY - startY}px) scale(${scale})`, offset: 1 }
      ], { duration: 5000, easing: "ease-in-out", fill: "forwards" });
      backgroundAnimation = background.animate([
        { opacity: 1, offset: 0 }, { opacity: 1, offset: .90 }, { opacity: 0, offset: 1 }
      ], { duration: 5000, easing: "ease-in-out", fill: "forwards" });
      Promise.all([logoAnimation.finished, backgroundAnimation.finished]).then(() => { if (!cancelled) { document.documentElement.classList.remove("imetal-launch-active"); setVisible(false); } }).catch(() => {});
    }, 50);
    return () => { cancelled = true; window.clearTimeout(timer); logoAnimation?.cancel(); backgroundAnimation?.cancel(); document.documentElement.classList.remove("imetal-launch-active"); };
  }, [visible]);

  if (!visible) return null;
  return (
    <div aria-hidden="true" className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      <div ref={backgroundRef} className="absolute inset-0 bg-[#ffe637] bg-[url('/login-background.svg')] bg-cover bg-center" />
      <style>{`.imetal-launch-active [data-imetal-login-logo] { visibility: hidden !important; }`}</style>
      <div ref={logoRef} className="relative flex w-[95vw] max-w-[680px] items-center justify-center" style={{ transformOrigin: "center center" }}>
        <div className="absolute inset-0 bg-white" style={{ clipPath: "ellipse(47.1% 38% at 50% 50%)" }} />
        <Image src="/logo.png" alt="" width={680} height={235} priority className="relative h-auto w-full" />
      </div>
    </div>
  );
}
