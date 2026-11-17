import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';

const PAIRING_DB = '/tmp/opencode/memo-pairing.json';
const SYNC_DB = '/tmp/opencode/memo-sync.json';
const PRESENCE_DB = '/tmp/opencode/memo-presence.json';

interface RegistryState {
  codes: Record<string, {
    code: string;
    role: 'boy' | 'girl';
    deviceId: string;
    name: string;
    expiresAt: string;
    used: boolean;
    usedAt: string | null;
    usedByDeviceId: string | null;
  }>;
  couplePairs: Array<{
    id: string;
    boyDeviceId: string;
    girlDeviceId: string;
    anniversaryDate: string;
    createdAt: string;
  }>;
}

const emptyRegistry = (): RegistryState => ({ codes: {}, couplePairs: [] });

const readRegistry = (): RegistryState => {
  try {
    const raw = fs.existsSync(PAIRING_DB) ? fs.readFileSync(PAIRING_DB, 'utf8') : '';
    if (!raw.trim()) return emptyRegistry();
    const parsed = JSON.parse(raw);
    return { codes: parsed.codes ?? {}, couplePairs: parsed.couplePairs ?? [] };
  } catch {
    return emptyRegistry();
  }
};

const writeRegistry = (state: RegistryState): void => {
  fs.mkdirSync(path.dirname(PAIRING_DB), { recursive: true });
  fs.writeFileSync(PAIRING_DB, JSON.stringify(state, null, 2));
};

const sendJson = (res: import('node:http').ServerResponse, status: number, payload: unknown): void => {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(body);
};

// ---- Couple data sync -----------------------------------------------------------
// Shared store for the two devices of a couple pair: rows for milestones,
// anniversaries and period entries plus delete tombstones. Last-write-wins on
// the row's updatedAt timestamp; physical deletes propagate via tombstones.
const SYNC_TABLES = ['milestones', 'anniversaries', 'period_entries', 'notices'] as const;
type SyncTable = (typeof SYNC_TABLES)[number];

interface SyncCoupleState {
  tables: Record<SyncTable, Record<string, Record<string, unknown>>>;
  tombstones: Record<SyncTable, Record<string, string>>;
}

interface SyncState {
  couples: Record<string, SyncCoupleState>;
}

const emptyTables = (): SyncCoupleState['tables'] => ({
  milestones: {},
  anniversaries: {},
  period_entries: {},
  notices: {},
});

const emptyTombs = (): SyncCoupleState['tombstones'] => ({
  milestones: {},
  anniversaries: {},
  period_entries: {},
  notices: {},
});

const emptySyncState = (): SyncState => ({ couples: {} });

const readSyncState = (): SyncState => {
  try {
    const raw = fs.existsSync(SYNC_DB) ? fs.readFileSync(SYNC_DB, 'utf8') : '';
    if (!raw.trim()) return emptySyncState();
    const parsed = JSON.parse(raw);
    return { couples: parsed.couples ?? {} };
  } catch {
    return emptySyncState();
  }
};

const writeSyncState = (state: SyncState): void => {
  try {
    fs.mkdirSync(path.dirname(SYNC_DB), { recursive: true });
    fs.writeFileSync(SYNC_DB, JSON.stringify(state, null, 2));
  } catch {
    // best-effort
  }
};

interface PresenceData {
  seen: Record<string, number>;
  names: Record<string, string>;
}

const readPresence = (): PresenceData => {
  try {
    const raw = fs.existsSync(PRESENCE_DB) ? fs.readFileSync(PRESENCE_DB, 'utf8') : '';
    if (!raw.trim()) return { seen: {}, names: {} };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // New format { seen, names }; the old flat { deviceId: ms } still reads
    if (parsed && typeof parsed === 'object' && (parsed.seen || parsed.names)) {
      return {
        seen: (parsed.seen as Record<string, number>) ?? {},
        names: (parsed.names as Record<string, string>) ?? {},
      };
    }
    return { seen: parsed as Record<string, number>, names: {} };
  } catch {
    return { seen: {}, names: {} };
  }
};

const writePresence = (presence: PresenceData): void => {
  // Prune seen entries older than a day so the file stays tiny
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const seen = Object.fromEntries(Object.entries(presence.seen).filter(([, t]) => (t as number) > cutoff));
  try {
    fs.writeFileSync(PRESENCE_DB, JSON.stringify({ seen, names: presence.names }));
  } catch {
    // best-effort
  }
};

const rowTs = (row?: Record<string, unknown> | null): string =>
  String(row?.updatedAt ?? row?.createdAt ?? '');

const canonicalRows = (couple: SyncCoupleState) => ({
  milestones: Object.values(couple.tables.milestones ?? {}),
  anniversaries: Object.values(couple.tables.anniversaries ?? {}),
  period_entries: Object.values(couple.tables.period_entries ?? {}),
  notices: Object.values(couple.tables.notices ?? {}),
});

const mergePush = (
  couple: SyncCoupleState,
  rows: Record<string, unknown>,
  tombstones: Array<{ table?: string; id?: string; deletedAt?: string }>
): SyncCoupleState => {
  // Couples saved before the notices table existed lack its keys — backfill
  for (const table of SYNC_TABLES) {
    couple.tables[table] = couple.tables[table] ?? {};
    couple.tombstones[table] = couple.tombstones[table] ?? {};
  }
  for (const table of SYNC_TABLES) {
    const incoming = Array.isArray(rows[table])
      ? (rows[table] as Array<Record<string, unknown>>)
      : [];
    for (const row of incoming) {
      const id = String(row?.id ?? '');
      if (!id) continue;
      // A row older than its own delete tombstone stays deleted
      if (couple.tombstones[table][id] && rowTs(row) <= couple.tombstones[table][id]) continue;
      const cur = couple.tables[table][id];
      if (!cur || rowTs(row) >= rowTs(cur)) {
        couple.tables[table][id] = row;
      }
    }
    for (const t of tombstones) {
      if (t?.table !== table) continue;
      const id = String(t?.id ?? '');
      const deletedAt = String(t?.deletedAt ?? '');
      if (!id || !deletedAt) continue;
      if ((couple.tombstones[table][id] ?? '') < deletedAt) {
        couple.tombstones[table][id] = deletedAt;
      }
      const row = couple.tables[table][id];
      if (row && rowTs(row) <= deletedAt) {
        delete couple.tables[table][id];
      }
    }
  }
  return couple;
};

const readBody = (req: import('node:http').IncomingMessage): Promise<unknown> =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw.trim() ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });

const pairingRegistry = (): Plugin => {
  const sseClients = new Set<import('node:http').ServerResponse>();

  const broadcast = (event: string): void => {
    for (const client of [...sseClients]) {
      try {
        client.write(`event: ${event}\ndata: {}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  const broadcastPairUpdate = (): void => broadcast('pair-update');
  const broadcastSyncUpdate = (): void => broadcast('sync-update');

  return {
  name: 'memo-pairing-registry',
  configureServer(server) {
    // Watch the shared registry/sync files so dev servers on other ports also
    // push pair updates to their connected tabs.
    try {
      fs.watchFile(PAIRING_DB, { interval: 250 }, () => broadcastPairUpdate());
    } catch {
      // Best-effort; polling is the fallback
    }
    try {
      fs.watchFile(SYNC_DB, { interval: 250 }, () => broadcastSyncUpdate());
    } catch {
      // Best-effort; polling is the fallback
    }

    server.middlewares.use('/api/pairing', async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const pathname = url.pathname.replace(/^\/api\/pairing/, '') || '/';
      const state = readRegistry();

      const badRequest = (reason: string) => sendJson(res, 400, { success: false, reason });

      if (req.method === 'GET' && pathname === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.write(': connected\n\n');
        sseClients.add(res);
        const heartbeat = setInterval(() => {
          try {
            res.write(': ping\n\n');
          } catch {
            clearInterval(heartbeat);
            sseClients.delete(res);
          }
        }, 25000);
        req.on('close', () => {
          clearInterval(heartbeat);
          sseClients.delete(res);
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/create') {
        const body = (await readBody(req)) as Record<string, unknown>;
        const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        const role = body.role === 'boy' ? 'boy' : 'girl';
        const deviceId = String(body.deviceId || '');
        const name = String(body.name || '').slice(0, 80);
        const expiresAt = String(body.expiresAt || '');
        if (code.length !== 6 || !deviceId || !expiresAt) return badRequest('invalid_create');

        state.codes[code] = {
          code,
          role,
          deviceId,
          name,
          expiresAt,
          used: false,
          usedAt: null,
          usedByDeviceId: null,
        };
        writeRegistry(state);
        return sendJson(res, 200, { success: true });
      }

      if (req.method === 'POST' && pathname === '/verify') {
        const body = (await readBody(req)) as Record<string, unknown>;
        const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        const role = body.role === 'boy' ? 'boy' : 'girl';
        const entry = state.codes[code];
        if (!entry) return sendJson(res, 200, { success: false, reason: 'not_found' });
        if (entry.used) return sendJson(res, 200, { success: false, reason: 'used' });
        if (Date.parse(entry.expiresAt) <= Date.now()) return sendJson(res, 200, { success: false, reason: 'expired' });
        if (entry.role === role) return sendJson(res, 200, { success: false, reason: 'same_role' });
        return sendJson(res, 200, { success: true, role: entry.role, deviceId: entry.deviceId, name: entry.name });
      }

      if (req.method === 'POST' && pathname === '/use') {
        const body = (await readBody(req)) as Record<string, unknown>;
        const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        const role = body.role === 'boy' ? 'boy' : 'girl';
        const deviceId = String(body.deviceId || '');
        if (!deviceId) return badRequest('invalid_use');

        const entry = state.codes[code];
        if (!entry) return sendJson(res, 200, { success: false, reason: 'not_found' });
        if (entry.used) return sendJson(res, 200, { success: false, reason: 'used' });
        if (Date.parse(entry.expiresAt) <= Date.now()) return sendJson(res, 200, { success: false, reason: 'expired' });
        if (entry.role === role) return sendJson(res, 200, { success: false, reason: 'same_role' });

        entry.used = true;
        entry.usedAt = new Date().toISOString();
        entry.usedByDeviceId = deviceId;

        const joinerName = typeof body.name === 'string' ? body.name.slice(0, 80) : '';
        const boyDeviceId = role === 'boy' ? deviceId : entry.deviceId;
        const girlDeviceId = role === 'girl' ? deviceId : entry.deviceId;
        const anniversaryDate = new Date().toISOString().split('T')[0];
        const couplePair = {
          id: crypto.randomUUID(),
          boyDeviceId,
          girlDeviceId,
          anniversaryDate,
          createdAt: new Date().toISOString(),
          // Both names are learned at pair time so either side can label rows offline
          names: {
            [boyDeviceId]: (role === 'boy' ? joinerName : entry.name) || null,
            [girlDeviceId]: (role === 'girl' ? joinerName : entry.name) || null,
          },
        };
        state.couplePairs.push(couplePair);
        writeRegistry(state);
        broadcastPairUpdate();
        return sendJson(res, 200, {
          success: true,
          anniversaryDate,
          pairedRole: entry.role,
          pairedDeviceId: entry.deviceId,
          couplePair,
        });
      }

      if (req.method === 'GET' && pathname === '/pair' && url.searchParams.get('deviceId')) {
        const deviceId = url.searchParams.get('deviceId')!;
        const pair = state.couplePairs.find(p => p.boyDeviceId === deviceId || p.girlDeviceId === deviceId);
        return sendJson(res, 200, pair ? { success: true, pair } : { success: false });
      }

      if (req.method === 'POST' && pathname === '/unpair') {
        const body = (await readBody(req)) as Record<string, unknown>;
        const deviceId = String(body.deviceId || '');
        if (!deviceId) return badRequest('invalid_device_id');
        const before = state.couplePairs.length;
        state.couplePairs = state.couplePairs.filter(p => !(p.boyDeviceId === deviceId || p.girlDeviceId === deviceId));
        state.codes = Object.fromEntries(
          Object.entries(state.codes).filter(([, c]) => !(c.deviceId === deviceId || c.usedByDeviceId === deviceId))
        );
        writeRegistry(state);
        broadcastPairUpdate();
        return sendJson(res, 200, { success: true, removed: before - state.couplePairs.length });
      }

      return sendJson(res, 404, { success: false, reason: 'not_found' });
    });

    // Couple data sync: push/pull shared rows, heartbeat + presence, so both
    // paired devices see the same milestones, anniversaries and period entries.
    server.middlewares.use('/api/sync', async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const pathname = url.pathname.replace(/^\/api\/sync/, '') || '/';

      if (req.method === 'POST' && pathname === '/push') {
        const body = (await readBody(req)) as Record<string, unknown>;
        const coupleId = String(body.coupleId || '');
        const deviceId = String(body.deviceId || '');
        const name = typeof body.name === 'string' ? body.name.slice(0, 80) : '';
        if (coupleId.length < 8 || coupleId.length > 64 || !deviceId) {
          return sendJson(res, 400, { success: false, reason: 'invalid_sync' });
        }
        const rows = (body.rows && typeof body.rows === 'object' ? body.rows : {}) as Record<string, unknown>;
        const tombstones = Array.isArray(body.tombstones)
          ? (body.tombstones as Array<{ table?: string; id?: string; deletedAt?: string }>)
          : [];

        const state = readSyncState();
        const couple = state.couples[coupleId] ?? {
          tables: emptyTables(),
          tombstones: emptyTombs(),
        };
        mergePush(couple, rows, tombstones);
        state.couples[coupleId] = couple;
        writeSyncState(state);

        const presence = readPresence();
        presence.seen[deviceId] = Date.now();
        if (name) presence.names[deviceId] = name;
        writePresence(presence);

        broadcastSyncUpdate();
        return sendJson(res, 200, { success: true, rows: canonicalRows(couple), tombstones: couple.tombstones });
      }

      if (req.method === 'GET' && pathname === '/pull' && url.searchParams.get('coupleId')) {
        const coupleId = url.searchParams.get('coupleId')!;
        const state = readSyncState();
        const couple = state.couples[coupleId];
        return sendJson(res, 200, {
          success: true,
          rows: couple ? canonicalRows(couple) : emptyTables(),
          tombstones: couple ? couple.tombstones : emptyTombs(),
        });
      }

      if (req.method === 'POST' && pathname === '/heartbeat') {
        const body = (await readBody(req)) as Record<string, unknown>;
        const deviceId = String(body.deviceId || '');
        const name = typeof body.name === 'string' ? body.name.slice(0, 80) : '';
        if (!deviceId) return sendJson(res, 400, { success: false, reason: 'invalid_device_id' });
        const presence = readPresence();
        presence.seen[deviceId] = Date.now();
        if (name) presence.names[deviceId] = name;
        writePresence(presence);
        return sendJson(res, 200, { success: true });
      }

      if (req.method === 'GET' && pathname === '/status' && url.searchParams.get('deviceId')) {
        const deviceId = url.searchParams.get('deviceId')!;
        const presence = readPresence();
        const lastSeen = presence.seen[deviceId] ?? null;
        const online = lastSeen !== null && Date.now() - lastSeen < 30000;
        return sendJson(res, 200, { success: true, online, lastSeen, name: presence.names[deviceId] ?? null });
      }

      return sendJson(res, 404, { success: false, reason: 'not_found' });
    });
  },
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), pairingRegistry()],
  root: './src',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
});