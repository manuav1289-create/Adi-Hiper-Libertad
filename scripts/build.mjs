import { build } from "vite";

try {
  await build();
  console.log("✔ Vite build OK");
} catch (err) {
  console.error("✖ Vite build FAILED");
  console.error(err);
  process.exit(1);
}