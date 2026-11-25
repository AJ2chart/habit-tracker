// Sert la version web exportée (dist/) pour le contrôle visuel, avec les en-têtes dont expo-sqlite a besoin
// (COOP/COEP) et un retour vers index.html pour les adresses des onglets (application d'une seule page).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = process.argv[2] ?? 'dist';
const PORT = Number(process.env.PORT ?? 8081);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(ROOT, url));
  if (!file.startsWith(normalize(ROOT)) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Version web servie sur http://localhost:${PORT}`));
