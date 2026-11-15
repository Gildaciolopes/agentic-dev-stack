import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    // R3F frame loops mutate three.js objects and spring state imperatively by design.
    files: ["src/components/three/**"],
    rules: { "react-hooks/immutability": "off", "react-hooks/refs": "off" },
  },
  { ignores: [".next/**", "node_modules/**", "references/**", "next-env.d.ts", "src/components/fluid/**"] },
];

export default config;
