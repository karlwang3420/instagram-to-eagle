const http = require('node:http');

const EAGLE_ORIGIN = 'http://127.0.0.1:41595';

function startEagleProxy() {
  const requests = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      let target;
      try {
        target = new URL(request.url, EAGLE_ORIGIN);
      } catch {
        response.writeHead(400).end();
        return;
      }
      if (target.origin !== EAGLE_ORIGIN || request.headers.host !== '127.0.0.1:41595') {
        response.writeHead(502).end();
        return;
      }

      const body = Buffer.concat(chunks).toString('utf8');
      requests.push({ method: request.method, url: target.href, path: target.pathname, body });
      const data = target.pathname === '/api/folder/list'
        ? []
        : target.pathname === '/api/application/info'
          ? { version: '4.0.0' }
          : {};
      const payload = JSON.stringify({ status: 'success', data });
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Access-Control-Allow-Origin': '*'
      });
      response.end(payload);
    });
  });
  server.on('connect', (_request, socket) => socket.destroy());

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      resolve({
        port: address.port,
        requests,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close(error => error ? closeReject(error) : closeResolve());
          server.closeAllConnections?.();
        })
      });
    });
  });
}

module.exports = { startEagleProxy };
