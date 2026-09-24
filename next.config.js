/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // O runtime WASM do visualizador 3D USDZ (three-usdz-loader) precisa de um
        // contexto cross-origin isolado (SharedArrayBuffer). Isso só existe se o
        // documento de nível superior já foi CARREGADO com esses headers — não basta
        // a rota "/" tê-los, porque o login redireciona por navegação client-side
        // (sem reload), então o isolamento fica travado no que "/login" trouxe.
        // Por isso aplicamos em toda página autenticável (qualquer uma pode ser a
        // primeira a carregar na aba). Ficam de fora as rotas de API e a página
        // pública de anexos por QR Code (não precisam de isolamento e são acessadas
        // por gente sem login, sem motivo pra restringir o que elas podem carregar).
        source:
          "/((?!api|public/anexos|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo.png|robots.txt).*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
