/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Página de Pedidos (onde o modal de Anexos/Fotos e o visualizador 3D USDZ
        // são renderizados). O runtime WASM do visualizador (three-usdz-loader)
        // precisa de um contexto cross-origin isolado (SharedArrayBuffer), daí o
        // COOP/COEP abaixo. Escopado só a esta rota para não afetar login, a
        // página pública de anexos por QR Code nem o restante do sistema.
        source: "/",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
