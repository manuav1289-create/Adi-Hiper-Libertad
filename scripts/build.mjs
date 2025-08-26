import { build } from "vite";

try {
  await build(); // usa tu vite.config.* automáticamente
  console.log("✔ Vite build OK");
} catch (err) {
  console.error("❌ Vite build FAILED");
  console.error(err);
  process.exit(1);
}
