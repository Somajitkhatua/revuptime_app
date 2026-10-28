const fs = require("node:fs/promises");
const path = require("node:path");
const {
  generateImageAsync,
  generateImageBackgroundAsync,
  compositeImagesAsync,
  getPngInfo,
} = require("@expo/image-utils");

const projectRoot = path.resolve(__dirname, "..");
const directory = path.join(projectRoot, "assets", "branding");
const src = path.join(directory, "launcher-mark.png");

async function makeIcon(name, symbolSize, backgroundColor) {
  const foreground = await generateImageAsync(
    { projectRoot },
    { src, width: symbolSize, height: symbolSize, resizeMode: "contain" },
  );
  const background = await generateImageBackgroundAsync({
    width: 1024,
    height: 1024,
    resizeMode: "contain",
    backgroundColor,
  });
  const offset = (1024 - symbolSize) / 2;
  const result = await compositeImagesAsync({
    foreground: foreground.source,
    background,
    x: offset,
    y: offset,
  });
  await fs.writeFile(path.join(directory, name), result);
}

async function main() {
  // Native launchers apply their own circle/squircle mask. Keep the symbol
  // inside Android's central safe area; never bake wallpaper or text into it.
  await makeIcon("app-icon.png", 840, "#FFFFFF");
  // Store the legacy/iOS icon as fully opaque RGB, including antialiased edges.
  const opaqueIcon = await generateImageAsync(
    { projectRoot },
    {
      src: path.join(directory, "app-icon.png"),
      width: 1024,
      height: 1024,
      resizeMode: "contain",
      backgroundColor: "#FFFFFF",
      removeTransparency: true,
    },
  );
  await fs.writeFile(path.join(directory, "app-icon.png"), opaqueIcon.source);
  await makeIcon("adaptive-icon.png", 640, "transparent");
  const favicon = await generateImageAsync(
    { projectRoot },
    {
      src: path.join(directory, "app-icon.png"),
      width: 48,
      height: 48,
      resizeMode: "contain",
    },
  );
  await fs.writeFile(path.join(directory, "favicon.png"), favicon.source);
  for (const name of ["app-icon.png", "adaptive-icon.png", "favicon.png"]) {
    const { width, height } = await getPngInfo(path.join(directory, name));
    console.log(`${name}: ${width}x${height}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
