import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ZodError } from 'zod';
import { createWorkspace, actors, CRMError } from './workspace.mjs';
import { handleMcp } from './mcp.mjs';
import { runHandoff } from './client.mjs';

const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
export async function startDemo(port = 4318) {
  const workspace = await createWorkspace();
  let baseUrl;
  const server = createServer(async (request, response) => {
    const send = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(value));
    };
    try {
      const actualPort = server.address().port;
      const validHosts = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`];
      if (!validHosts.includes(request.headers.host)) throw new CRMError(403, 'Invalid local host.');
      if (request.headers.origin && !validHosts.map(host => `http://${host}`).includes(request.headers.origin)) throw new CRMError(403, 'Cross-origin requests are disabled.');
      const path = new URL(request.url, baseUrl).pathname;
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      if (request.method === 'GET' && assets[path]) {
        const [name, type] = assets[path];
        response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
        response.end(await readFile(new URL(`./public/${name}`, import.meta.url)));
        return;
      }
      if (request.method === 'GET' && path === '/api/state') { send(200, await workspace.state()); return; }
      if (request.method !== 'POST' || !['/api/operate', '/api/handoff', '/mcp'].includes(path)) { send(404, { error: 'Not found.' }); return; }
      if (!request.headers['content-type']?.startsWith('application/json')) throw new CRMError(415, 'Use application/json.');
      const chunks = []; let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 65536) throw new CRMError(413, 'Request too large.');
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new CRMError(400, 'Invalid JSON.'); }
      if (path === '/mcp') { await handleMcp(workspace, request, response, body); return; }
      if (path === '/api/handoff') { send(200, await runHandoff(baseUrl)); return; }
      const { operation, input, requestId } = body ?? {};
      send(200, await workspace.perform(actors.web, operation, input, requestId));
    } catch (error) {
      if (response.headersSent) { response.end(); return; }
      const status = error instanceof ZodError ? 400 : error.status ?? 500;
      send(status, { error: error instanceof ZodError ? 'Check the fields and try again.' : status < 500 ? error.message : 'The demo could not complete this operation.' });
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    baseUrl, workspace,
    close: async () => { await new Promise(resolve => server.close(resolve)); workspace.close(); },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const demo = await startDemo(Number(process.env.PORT ?? 4318));
  console.log(`Ricardo CRM demo: ${demo.baseUrl}\nMCP endpoint: ${demo.baseUrl}/mcp\nFictional data in memory; restarting restores the fixtures.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await demo.close(); process.exit(0); });
}
