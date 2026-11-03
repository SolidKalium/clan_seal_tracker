import { createServer } from 'node:http';
import type { Server } from 'node:https';
import type { Socket } from 'node:net';
import type { Plugin } from 'vite';

// A TLS-only listener cannot answer plain HTTP. Inspect the first byte before
// handing each socket to Node's existing TLS listener or the redirect server.
// Vite retains its original HTTPS server, including HMR and normal shutdown.
export function httpsRedirect(origin: string): Plugin {
  const install = (secure: Server | null) => {
    if (!secure) return;
    const redirect = createServer((request, response) => {
      const destination = new URL(origin);
      let requested: URL;
      try {
        requested = new URL(request.url ?? '/', 'http://localhost');
      } catch {
        response.writeHead(400);
        response.end('Invalid request URL.');
        return;
      }
      destination.pathname = requested.pathname;
      destination.search = requested.search;
      response.writeHead(307, {
        Location: destination.href,
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end('Redirecting to HTTPS.');
    });
    const tlsListeners = secure.listeners('connection');
    secure.removeAllListeners('connection');
    secure.on('connection', (socket: Socket) => {
      socket.once('error', () => socket.destroy());
      socket.setTimeout(10_000, () => socket.destroy());
      socket.once('readable', () => {
        const first = socket.read() as Buffer | null;
        if (!first) {
          socket.destroy();
          return;
        }
        socket.setTimeout(0);
        socket.unshift(first);
        if (first[0] === 22) {
          socket.allowHalfOpen = false;
          for (const listener of tlsListeners) listener.call(secure, socket);
        } else redirect.emit('connection', socket);
      });
    });
    secure.once('close', () => redirect.closeAllConnections());
  };
  return {
    name: 'local-https-redirect',
    configureServer(server) {
      install(server.httpServer as Server | null);
    },
    configurePreviewServer(server) {
      install(server.httpServer as Server | null);
    },
  };
}
