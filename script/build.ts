import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import { execSync } from "child_process";
import { SKILLSPECTOR_GIT_REF } from "../server/skill-inspector/skillspector-cli";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("provisioning skillspector venv...");
  execSync("python3.12 -m venv .venv", { stdio: "inherit" });
  // If Task 1/Step 2 found that git+pip works:
  execSync(
    `.venv/bin/pip install --no-cache-dir "git+https://github.com/NVIDIA/SkillSpector.git@${SKILLSPECTOR_GIT_REF}"`,
    { stdio: "inherit" },
  );
  // If only `make install` worked, replace the line above with a clone-to-.venv flow per Step 2 Option B.
  console.log("skillspector venv ready at .venv/bin/skillspector");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
