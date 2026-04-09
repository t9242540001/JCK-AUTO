/**
 * @file test-noscut-image-variants.ts
 * @description Test image generation: 4 visual concepts × 2 models = 8 images
 * @run npx tsx -r dotenv/config scripts/test-noscut-image-variants.ts dotenv_config_path=.env.local
 */

import fs from "fs";
import path from "path";
import { generateImage } from "../src/lib/dashscope";

const OUTPUT_DIR = "/var/www/jckauto/storage/noscut/test";

const MODELS = [
  { make: "Toyota", model: "Land Cruiser Prado", generation: "J150" },
  { make: "Lexus", model: "RX", generation: "AL20" },
];

// 4 visual concept variants
const VARIANTS: Record<string, (make: string, model: string, gen: string) => string> = {

  // Variant A: whole car studio render — clean, professional, model recognizable
  "A-studio": (make, model, gen) =>
    `Professional automotive studio photograph of ${make} ${model} ${gen}, silver metallic color, clean 3/4 front angle view, neutral light gray seamless background, soft studio lighting, sharp focus on front end, premium catalog style. No text, no people, no other objects.`,

  // Variant B: flat lay product shot — 6 parts arranged on neutral background, no car
  "B-flatlay": (make, model, gen) =>
    `Product flat lay photograph on neutral light gray background. Six automotive parts neatly arranged in a clean grid layout: front bumper assembly, headlights pair left and right, cooling radiator, front panel frame, parking sensors set, front camera. Parts are for ${make} ${model} ${gen}. Professional product photography style, soft even lighting, top-down view, no shadows, no text, no labels.`,

  // Variant C: before/after split — damaged front left, restored front right
  "C-beforeafter": (make, model, gen) =>
    `Split image of ${make} ${model} ${gen}. Left half: car with damaged front end, dented bumper, broken headlight, cracked front panel, realistic accident damage. Right half: same car fully restored with perfect front end, new bumper, intact headlights, clean panel. Both halves same lighting, same angle, gray background. Sharp dividing line in center. No text, no labels.`,

  // Variant D: whole car with glowing front zone overlay
  "D-highlight": (make, model, gen) =>
    `Technical illustration of ${make} ${model} ${gen} in 3/4 front angle on light gray background. The front end area — bumper, headlights, radiator grille, front panel — is highlighted with a subtle blue-white glow and slightly separated from the body, indicating the replaceable zone. The rest of the car body is slightly faded/desaturated. Clean modern technical style. No text, no numbers, no callouts, no labels.`,
};

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main(): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const m of MODELS) {
    for (const [variantKey, buildPrompt] of Object.entries(VARIANTS)) {
      const filename = `${m.make.toLowerCase()}-${m.generation.toLowerCase()}-${variantKey}.jpg`;
      const outputPath = path.join(OUTPUT_DIR, filename);
      const prompt = buildPrompt(m.make, m.model, m.generation);

      console.log(`\n[${variantKey}] ${m.make} ${m.model} ${m.generation}`);
      console.log(`Prompt: ${prompt.slice(0, 80)}...`);

      try {
        const { imageUrl } = await generateImage(prompt, {
          size: "1024*1024",
          promptExtend: false,
          watermark: false,
        });
        await downloadImage(imageUrl, outputPath);
        console.log(`✓ Saved: ${filename}`);
      } catch (err) {
        console.error(`✗ Failed: ${(err as Error).message}`);
      }

      // Pause between calls to avoid rate limiting
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\nDone. Check results in ${OUTPUT_DIR}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
