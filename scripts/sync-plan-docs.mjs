import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'plan-docs');
const outputDir = path.join(root, 'public', 'plan-docs');

const docs = [
  {
    id: 'platform',
    title: 'Platform Plan',
    file: 'MUSICXR_PLATFORM_PLAN.md',
    summary:
      'Product vision, user groups, asset and token model, royalty operations, compliance concerns, MVP scope, risks, and launch readiness.',
    accent: 'blue'
  },
  {
    id: 'technology',
    title: 'Technology Plan',
    file: 'MUSICXR_TECHNOLOGY_PLAN.md',
    summary:
      'Flutter, Firebase, Firestore, Cloud Functions, security model, vendor stack, design system, CI/CD, testing, and app-store readiness.',
    accent: 'green'
  },
  {
    id: 'implementation-gtm',
    title: 'Implementation And GTM Plan',
    file: 'MUSICXR_IMPLEMENTATION_GTM_PLAN.md',
    summary:
      'Execution phases, team model, operating cadence, MVP backlog, pilot strategy, launch audiences, channels, metrics, risks, and next actions.',
    accent: 'coral'
  }
];

const image = {
  title: 'Source Business Diagram',
  file: 'business-doc.png',
  summary: 'Original MusicXR ecosystem visual used to derive the planning documents.'
};

await mkdir(outputDir, { recursive: true });

const manifestDocs = [];

for (const doc of docs) {
  const sourcePath = path.join(sourceDir, doc.file);
  const outputPath = path.join(outputDir, doc.file);
  const text = await readFile(sourcePath, 'utf8');
  const sourceStats = await stat(sourcePath);

  await copyFile(sourcePath, outputPath);

  manifestDocs.push({
    ...doc,
    href: `plan-docs/${doc.file}`,
    lineCount: text.split(/\r?\n/).length,
    byteSize: sourceStats.size
  });
}

const imageSourcePath = path.join(sourceDir, image.file);
const imageOutputPath = path.join(outputDir, image.file);
const imageStats = await stat(imageSourcePath);

await copyFile(imageSourcePath, imageOutputPath);

const manifest = {
  product: 'MusicXR',
  prepared: '2026-06-21',
  docs: manifestDocs,
  image: {
    ...image,
    href: `plan-docs/${image.file}`,
    byteSize: imageStats.size
  }
};

await writeFile(
  path.join(root, 'public', 'docs-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);

console.log(`Synced ${manifestDocs.length} planning docs and 1 source image to public/plan-docs.`);
