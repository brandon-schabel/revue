const { watch } = require("fs");
const { spawn } = require("child_process");

console.log("Watching for file changes...");

watch("./src", { recursive: true }, (eventType, filename) => {
  console.log(`File ${filename} changed. Rebuilding...`);
  const build = spawn("bun", ["run", "build"], { stdio: "inherit" });
  
  build.on("close", (code) => {
    if (code === 0) {
      console.log("Build completed successfully.");
    } else {
      console.error(`Build failed with code ${code}`);
    }
  });
});