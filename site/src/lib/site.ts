/** Facts about the project. Everything here must trace back to the repo. */
export const site = {
  name: "agentic-dev-stack",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://agentic-dev-stack-kappa.vercel.app",
  repo: "https://github.com/Gildaciolopes/agentic-dev-stack",
  npm: "https://www.npmjs.com/package/agentic-dev-stack",
  install: "npx agentic-dev-stack",
  license: "MIT",
  author: { name: "Gildacio Lopes", url: "https://github.com/Gildaciolopes" },
} as const;
