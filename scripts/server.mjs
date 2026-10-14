import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root + sep) || pathname.split('/').some(p => p.startsWith('.')) || !['.html', '.css', '.js', '.svg'].includes(extname(filename))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!(await stat(filename)).isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': types[extname(filename)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(filename));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, host, () => console.log(`Bizzare Battle running on port ${port} (${host}).`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
