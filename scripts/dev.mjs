// `npm run dev`: start the Vite dev server, then launch Electron pointed at it (edits hot-reload)
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';

const server = await createServer({ configFile: 'vite.config.mjs' });
await server.listen();
const url = server.resolvedUrls.local[0];

const env = { ...process.env, VITE_DEV_SERVER_URL: url };
delete env.ELECTRON_RUN_AS_NODE;   // set by some editors' terminals; it stops Electron opening a window
const app = spawn(electron, ['.'], { stdio: 'inherit', env });
app.on('close', code => {
  server.close();
  process.exit(code ?? 0);
});
