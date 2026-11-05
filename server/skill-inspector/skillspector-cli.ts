import path from "path";
import fs from "fs";

// Pinned in Task 1, Step 2. Use the exact commit SHA or tag confirmed to install.
export const SKILLSPECTOR_GIT_REF = "26d1a9aecd27c8646298f9b2c0b85b0e5736b62b";

// The venv is provisioned at build time (script/build.ts) into <repo>/.venv and
// shipped inside the deployment image. Reference the binary by absolute path —
// never rely on PATH, because the autoscale runtime PATH may not include it.
export const SKILLSPECTOR_BIN = path.join(process.cwd(), ".venv", "bin", "skillspector");

// The venv's Python interpreter and our streaming wrapper (referenced from the repo at runtime).
export const SKILLSPECTOR_PYTHON = path.join(process.cwd(), ".venv", "bin", "python");
export const SKILLSPECTOR_STREAM_SCRIPT = path.join(
  process.cwd(),
  "server",
  "skill-inspector",
  "skillspector_stream.py",
);

export function skillSpectorAvailable(): boolean {
  return (
    fs.existsSync(SKILLSPECTOR_BIN) &&
    fs.existsSync(SKILLSPECTOR_PYTHON) &&
    fs.existsSync(SKILLSPECTOR_STREAM_SCRIPT)
  );
}
