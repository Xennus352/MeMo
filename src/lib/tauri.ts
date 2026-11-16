import { isTauri } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { 
  UserProfile, 
  CycleSettings, 
  PeriodEntry, 
  Milestone, 
  Anniversary, 
  NotificationSettings, 
  AppSettings,
  SyncQueueItem,
  PairingCode,
  CouplePair,
  PredictionResult,
  UserRole,
  DateKey 
} from '@/types';

// The database file the native plugin opens on startup (see the `plugins.sql.preload`
// section in src-tauri/tauri.conf.json and the migration registration in lib.rs).
const TAURI_DB = 'sqlite:hourglass.db';

// Check if running in Tauri environment
const isTauriEnv = async () => {
  try {
    return await isTauri();
  } catch {
    return false;
  }
};

// Web storage fallback
const STORAGE_KEY = 'hourglass_web_db';

interface WebDB {
  user_profile: UserProfile[];
  cycle_settings: CycleSettings[];
  period_entries: PeriodEntry[];
  milestones: Milestone[];
  anniversaries: Anniversary[];
  notification_settings: NotificationSettings[];
  app_settings: AppSettings[];
  sync_queue: SyncQueueItem[];
  pairing_codes: PairingCode[];
  couple_pair: CouplePair[];
}

type TableName = keyof WebDB;

const getWebDB = (): WebDB => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  return {
    user_profile: [],
    cycle_settings: [{ id: 'default', cycleLength: 28, periodLength: 5, updatedAt: new Date().toISOString() }],
    period_entries: [],
    milestones: [],
    anniversaries: [],
    notification_settings: [{
      id: 'default',
      periodReminder: true,
      periodReminderDays: 1,
      ovulationReminder: true,
      milestoneReminder: true,
      milestoneReminderDays: 3,
      anniversaryReminder: true,
      updatedAt: new Date().toISOString(),
    }],
    app_settings: [{ id: 'default', theme: 'light', language: 'en', widgetEnabled: true, updatedAt: new Date().toISOString() }],
    sync_queue: [],
    pairing_codes: [],
    couple_pair: [],
  };
};

const saveWebDB = (db: WebDB) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

// SQLite hands back snake_case columns and 0/1 booleans, while every model in
// src/types is camelCase with real booleans. Normalize rows at the boundary so
// the Tauri backend and the localStorage fallback return the same shape.
const BOOLEAN_COLUMNS = new Set([
  'isPeriodDay',
  'isPrimary',
  'used',
  'synced',
  'periodReminder',
  'ovulationReminder',
  'milestoneReminder',
  'anniversaryReminder',
  'widgetEnabled',
]);

const JSON_COLUMNS = new Set(['symptoms', 'payload']);

const camelCaseKey = (key: string) =>
  key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());

const normalizeRow = (row: unknown): unknown => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    const name = camelCaseKey(key);

    if (BOOLEAN_COLUMNS.has(name) && (value === 0 || value === 1 || value === '0' || value === '1')) {
      normalized[name] = value === 1 || value === '1';
    } else if (JSON_COLUMNS.has(name) && typeof value === 'string') {
      try {
        normalized[name] = JSON.parse(value);
      } catch {
        normalized[name] = value;
      }
    } else {
      normalized[name] = value;
    }
  }
  return normalized;
};

// Generic query function that works in both Tauri and web
const executeQuery = async (sql: string, params?: unknown[]): Promise<unknown[]> => {
  const tauriAvailable = await isTauriEnv();
  
  if (tauriAvailable) {
    // Proxy the sql plugin's own commands. The plugin connects the preload
    // database at startup and runs the registered migrations; it also handles
    // row serialization, so we only normalize the keys afterwards.
    const isSelect = /^\s*select/i.test(sql);
    if (isSelect) {
      const rows = (await invoke<Array<Record<string, unknown>>>('plugin:sql|select', {
        db: TAURI_DB,
        query: sql,
        values: params ?? [],
      })) ?? [];
      return rows.map(normalizeRow);
    }
    const result = await invoke<[number, unknown]>('plugin:sql|execute', {
      db: TAURI_DB,
      query: sql,
      values: params ?? [],
    });
    const lastInsertId = result?.[1];
    return [{
      rowsAffected: result?.[0] ?? 0,
      lastInsertRowid:
        typeof lastInsertId === 'number'
          ? lastInsertId
          : (lastInsertId as { Sqlite?: number } | null)?.Sqlite,
    }];
  }

  // Web fallback - parse simple SQL and execute against localStorage
  const db = getWebDB();
  const lowerSql = sql.toLowerCase().trim();
  
  // SELECT queries
  if (lowerSql.startsWith('select')) {
    const tableMatch = lowerSql.match(/from\s+(\w+)/);
    const whereMatch = lowerSql.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i);
    const limitMatch = lowerSql.match(/limit\s+(\d+)/i);
    const orderMatch = lowerSql.match(/order\s+by\s+(\w+)\s+(asc|desc)/i);
    
    if (!tableMatch) return [];
    const table = tableMatch[1] as TableName;
    let results = [...((db[table] as unknown[]) || [])] as Record<string, unknown>[];
    
    // Simple WHERE parsing (handles =, >, <, >=, <=, LIKE and AND)
    if (whereMatch) {
      const remaining = [...(params || [])];
      const conditions = whereMatch[1].split(/\s+and\s+/i).map(c => {
        const m = c.match(/^\s*(\w+)\s*(>=|<=|=|>|<|like)\s*(.+)\s*$/i);
        if (!m) return null;
        let val = m[3].trim().replace(/^['"]|['"]$/g, '');
        if (val === '?') val = String(remaining.shift() ?? '');
        return { col: m[1], op: m[2].toLowerCase(), val };
      }).filter(Boolean) as Array<{ col: string; op: string; val: string }>;

      results = results.filter((row: Record<string, unknown>) =>
        conditions.every(({ col, op, val }) => {
          const rowVal = row[col];
          if (op === '=') return String(rowVal) === val;
          if (op === '>') return Number(rowVal) > Number(val);
          if (op === '<') return Number(rowVal) < Number(val);
          if (op === '>=') return Number(rowVal) >= Number(val);
          if (op === '<=') return Number(rowVal) <= Number(val);
          if (op === 'like') return String(rowVal).includes(val.replace(/%/g, ''));
          return true;
        })
      );
    }
    
    if (orderMatch) {
      const [col, dir] = [orderMatch[1], orderMatch[2]];
      results.sort((a: Record<string, unknown>, b: Record<string, unknown>) => dir === 'desc' 
        ? String(b[col]).localeCompare(String(a[col]))
        : String(a[col]).localeCompare(String(b[col]))
      );
    }
    
    if (limitMatch) {
      results = results.slice(0, parseInt(limitMatch[1]));
    }
    
    return results.map(normalizeRow);
  }
  
  // INSERT queries
  if (lowerSql.startsWith('insert')) {
    const tableMatch = lowerSql.match(/into\s+(\w+)/);
    const columnsMatch = sql.match(/\(([^()]+)\)\s*values/i);
    const valuesMatch = sql.match(/values\s*\(([^()]+)\)/i);
    if (!tableMatch || !columnsMatch || !valuesMatch) return [];
    
    const table = tableMatch[1] as TableName;
    const columns = columnsMatch[1].split(',').map(c => c.trim());
    const remaining = [...(params || [])];

    // Read the VALUES list positionally instead of assuming one parameter per
    // column: the schema inserts literals such as `synced = 0` and `NULL`.
    const values = valuesMatch[1].split(',').map(token => {
      const raw = token.trim();
      if (raw === '?') return remaining.shift();
      if (/^null$/i.test(raw)) return null;
      if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
      if (/^'.*'$/.test(raw)) return raw.slice(1, -1).replace(/''/g, "'");
      return raw;
    });
    
    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      row[col] = values[i] ?? null;
    });
    
    (db[table] as unknown[]).push(row as any);
    saveWebDB(db);
    return [{ lastInsertRowid: row.id }];
  }
  
  // UPDATE queries
  if (lowerSql.startsWith('update')) {
    const tableMatch = lowerSql.match(/update\s+(\w+)/);
    const setMatch = lowerSql.match(/set\s+(.+?)(?:\s+where|$)/i);
    const whereMatch = lowerSql.match(/where\s+(.+)/i);
    if (!tableMatch || !setMatch) return [];

    const table = tableMatch[1] as TableName;

    // Consume values in the order they appear in the SQL: SET first, WHERE after.
    const remaining = [...(params || [])];
    const takeValue = (raw: string): unknown => {
      if (raw === '?') return remaining.shift();
      const cleaned = raw.replace(/^['"]|['"]$/g, '');
      if (cleaned === 'NULL' || cleaned === 'null') return null;
      if (cleaned !== '' && !isNaN(Number(cleaned))) return Number(cleaned);
      return cleaned;
    };

    const updates = setMatch[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(assignment => {
        const eq = assignment.indexOf('=');
        const col = assignment.slice(0, eq).trim();
        const raw = assignment.slice(eq + 1).trim();
        return [col, takeValue(raw)] as const;
      });

    const conditions: Array<{ col: string; val: unknown }> = [];
    if (whereMatch) {
      for (const condition of whereMatch[1].split(/\s+and\s+/i)) {
        const m = condition.match(/^\s*(\w+)\s*=\s*(.+)\s*$/i);
        if (m) conditions.push({ col: m[1], val: takeValue(m[2].trim()) });
      }
    }

    let count = 0;
    const rows = (db[table] as unknown[]) as Record<string, unknown>[];
    for (const row of rows) {
      const match = conditions.every(c => String(row[c.col]) === String(c.val));
      if (!match) continue;
      count++;
      for (const [col, value] of updates) row[col] = value;
    }
    saveWebDB(db);
    return [{ changes: count }];
  }
  
  // DELETE queries
  if (lowerSql.startsWith('delete')) {
    const tableMatch = lowerSql.match(/from\s+(\w+)/);
    const whereMatch = lowerSql.match(/where\s+(.+)/i);
    if (!tableMatch) return [];
    
    const table = tableMatch[1] as TableName;
    let count = 0;
    if (whereMatch) {
      const whereValues = params || [];
      let whereValueIndex = 0;
      const [col, op, val] = whereMatch[1].split(/\s*=\s*/).map(s => s.trim().replace(/['"]/g, ''));
      const whereVal = whereValues[whereValueIndex] ?? val;
      const rows = (db[table] as unknown[]) as Record<string, unknown>[];
      const initialLength = rows.length;
      (db[table] as unknown[]) = rows.filter((row: Record<string, unknown>) => String(row[col]) !== String(whereVal));
      count = initialLength - rows.length;
    } else {
      count = (db[table] as unknown[]).length;
      (db[table] as unknown[]) = [];
    }
    saveWebDB(db);
    return [{ changes: count }];
  }
  
  return [];
};

const executeTransaction = async (queries: string[]): Promise<void> => {
  // Kept for backwards compatibility; the app now uses db.transaction().
  for (const sql of queries) {
    await executeQuery(sql);
  }
};

interface TransactionQuery {
  sql: string;
  params?: unknown[];
}

// The sql plugin has no transaction command, so native code goes through our own
// `execute_transaction` command which runs the batch inside a real SQLite
// transaction. The web fallback just runs the statements in order.
const runTransaction = async (queries: TransactionQuery[]): Promise<void> => {
  const tauriAvailable = await isTauriEnv();
  if (tauriAvailable) {
    await invoke('execute_transaction', {
      queries: queries.map(q => [q.sql, q.params ?? []]),
    });
    return;
  }
  for (const q of queries) {
    await executeQuery(q.sql, q.params);
  }
};

// Database operations
export const db = {
  async init(): Promise<void> {
    // On native, the sql plugin connects the preload database at startup and
    // runs the registered migrations - nothing to invoke here. On web, seed
    // sensible defaults into the local storage fallback.
    const webDB = getWebDB();
    if (!webDB.app_settings.length) {
      webDB.app_settings = [{ id: 'default', theme: 'light', language: 'en', widgetEnabled: true, updatedAt: new Date().toISOString() }];
    }
    if (!webDB.notification_settings.length) {
      webDB.notification_settings = [{
        id: 'default',
        periodReminder: true,
        periodReminderDays: 1,
        ovulationReminder: true,
        milestoneReminder: true,
        milestoneReminderDays: 3,
        anniversaryReminder: true,
        updatedAt: new Date().toISOString(),
      }];
    }
    if (!webDB.cycle_settings.length) {
      webDB.cycle_settings = [{ id: 'default', cycleLength: 28, periodLength: 5, updatedAt: new Date().toISOString() }];
    }
    saveWebDB(webDB);
  },

  async query(sql: string, params?: unknown[]): Promise<unknown[]> {
    return executeQuery(sql, params);
  },

  /** Run a batch of statements in one transaction (all-or-nothing). */
  async transaction(queries: TransactionQuery[]): Promise<void> {
    return runTransaction(queries);
  },
};

// User Profile
export const userProfile = {
  async get(): Promise<UserProfile | null> {
    const result = await db.query('SELECT * FROM user_profile LIMIT 1');
    return result[0] as UserProfile | null;
  },

  async create(profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString();
    await db.query(
      `INSERT INTO user_profile (id, role, name, device_id, pairing_code, paired_device_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [profile.id, profile.role, profile.name, profile.deviceId, profile.pairingCode ?? null, profile.pairedDeviceId ?? null, now, now]
    );
  },

  async update(updates: Partial<Omit<UserProfile, 'id' | 'createdAt'>>): Promise<void> {
    const profile = await this.get();
    if (!profile) return;

    const fields = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([k]) => `${k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())} = ?`)
      .join(', ');

    if (!fields) return;

    const values = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([_, v]) => v);

    await db.query(
      `UPDATE user_profile SET ${fields}, updated_at = ? WHERE id = ?`,
      [...values, new Date().toISOString(), profile.id]
    );
  },
};

// Cycle Settings
export const cycleSettings = {
  async get(): Promise<CycleSettings> {
    const result = await db.query('SELECT * FROM cycle_settings LIMIT 1');
    return result[0] as CycleSettings || { id: 'default', cycleLength: 28, periodLength: 5, updatedAt: new Date().toISOString() };
  },

  async update(settings: Partial<Omit<CycleSettings, 'id' | 'updatedAt'>>): Promise<void> {
    const current = await this.get();
    const fields = Object.entries(settings)
      .filter(([_, v]) => v !== undefined)
      .map(([k]) => `${k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())} = ?`)
      .join(', ');

    if (!fields) return;

    const values = Object.entries(settings)
      .filter(([_, v]) => v !== undefined)
      .map(([_, v]) => v);

    await db.query(
      `UPDATE cycle_settings SET ${fields}, updated_at = ? WHERE id = ?`,
      [...values, new Date().toISOString(), current.id]
    );
  },
};

// Period Entries
export const periodEntries = {
  async getAll(startDate?: DateKey, endDate?: DateKey): Promise<PeriodEntry[]> {
    let query = 'SELECT * FROM period_entries';
    const params: (string | number)[] = [];

    if (startDate || endDate) {
      query += ' WHERE';
      if (startDate) {
        query += ' date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += startDate ? ' AND' : '';
        query += ' date <= ?';
        params.push(endDate);
      }
    }
    query += ' ORDER BY date DESC';

    return db.query(query, params) as Promise<PeriodEntry[]>;
  },

  async get(date: DateKey): Promise<PeriodEntry | null> {
    const result = await db.query('SELECT * FROM period_entries WHERE date = ?', [date]);
    return result[0] as PeriodEntry | null;
  },

  async upsert(entry: Omit<PeriodEntry, 'id' | 'synced' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
    const id = entry.id || crypto.randomUUID();
    const existing = await this.get(entry.date);

    if (existing) {
      await db.query(
        `UPDATE period_entries SET is_period_day = ?, flow = ?, symptoms = ?, notes = ?, created_by = ?, updated_at = ?
         WHERE id = ?`,
        [entry.isPeriodDay ? 1 : 0, entry.flow ?? null, JSON.stringify(entry.symptoms ?? []), entry.notes ?? null, entry.createdBy, new Date().toISOString(), existing.id]
      );
      return existing.id;
    } else {
      await db.query(
        `INSERT INTO period_entries (id, date, is_period_day, flow, symptoms, notes, created_by, synced, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [id, entry.date, entry.isPeriodDay ? 1 : 0, entry.flow ?? null, JSON.stringify(entry.symptoms ?? []), entry.notes ?? null, entry.createdBy, new Date().toISOString(), new Date().toISOString()]
      );
      return id;
    }
  },

  async delete(date: DateKey): Promise<void> {
    const entry = await this.get(date);
    if (entry) {
      await db.query('DELETE FROM period_entries WHERE id = ?', [entry.id]);
    }
  },
};

export interface MilestoneQuery {
  offset?: number;
  limit?: number;
  search?: string;
  /** Which date column the from/to range applies to */
  dateType?: 'milestone' | 'created';
  from?: string;
  to?: string;
  /** milestone date in the future / past relative to today */
  timing?: 'all' | 'upcoming' | 'past';
}

import { dateKey } from '@/utils/helpers';

const filterMilestonesWeb = (rows: unknown[], q: MilestoneQuery): Milestone[] => {
  const normalized = rows.map(normalizeRow) as Milestone[];
  const needle = q.search?.trim().toLowerCase();
  const today = dateKey();

  return normalized.filter(m => {
    if (needle && !(`${m.title} ${m.note ?? ''}`.toLowerCase().includes(needle))) return false;
    const day = q.dateType === 'created' ? (m.createdAt ?? '').slice(0, 10) : m.date;
    if (q.from && day < q.from) return false;
    if (q.to && day > q.to) return false;
    if (q.timing === 'upcoming' && m.date < today) return false;
    if (q.timing === 'past' && m.date >= today) return false;
    return true;
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

const buildMilestoneSql = (q: MilestoneQuery): { where: string; params: unknown[] } => {
  const clauses: string[] = [];
  const params: unknown[] = [];

  const needle = q.search?.trim();
  if (needle) {
    clauses.push('(title LIKE ? OR note LIKE ?)');
    params.push(`%${needle}%`, `%${needle}%`);
  }

  const dayExpr = q.dateType === 'created' ? 'substr(created_at, 1, 10)' : 'date';
  if (q.from) {
    clauses.push(`${dayExpr} >= ?`);
    params.push(q.from);
  }
  if (q.to) {
    clauses.push(`${dayExpr} <= ?`);
    params.push(q.to);
  }

  const today = dateKey();
  if (q.timing === 'upcoming') {
    clauses.push('date >= ?');
    params.push(today);
  } else if (q.timing === 'past') {
    clauses.push('date < ?');
    params.push(today);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
};

// Milestones
export const milestones = {
  async getAll(): Promise<Milestone[]> {
    return db.query('SELECT * FROM milestones ORDER BY created_at DESC') as Promise<Milestone[]>;
  },

  async getUpcoming(limit = 5): Promise<Milestone[]> {
    const today = new Date().toISOString().split('T')[0];
    return db.query('SELECT * FROM milestones WHERE date >= ? ORDER BY date ASC LIMIT ?', [today, limit]) as Promise<Milestone[]>;
  },

  async getPage(q: MilestoneQuery = {}): Promise<Milestone[]> {
    const offset = q.offset ?? 0;
    const limit = q.limit ?? 20;

    const tauriAvailable = await isTauriEnv();
    if (!tauriAvailable) {
      return filterMilestonesWeb(getWebDB().milestones as unknown[], q).slice(offset, offset + limit);
    }

    const { where, params } = buildMilestoneSql(q);
    return db.query(
      `SELECT * FROM milestones ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as Promise<Milestone[]>;
  },

  async count(q: MilestoneQuery = {}): Promise<number> {
    const tauriAvailable = await isTauriEnv();
    if (!tauriAvailable) {
      return filterMilestonesWeb(getWebDB().milestones as unknown[], q).length;
    }

    const { where, params } = buildMilestoneSql(q);
    const rows = (await db.query(`SELECT COUNT(*) AS n FROM milestones ${where}`, params)) as Array<{ n: number }>;
    return Number(rows[0]?.n ?? 0);
  },

  async create(milestone: Omit<Milestone, 'id' | 'synced' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.query(
      `INSERT INTO milestones (id, title, date, emoji, note, created_by, synced, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, milestone.title, milestone.date, milestone.emoji, milestone.note ?? null, milestone.createdBy, now, now]
    );
    return id;
  },

  async update(id: string, updates: Partial<Omit<Milestone, 'id' | 'createdAt'>>): Promise<void> {
    const fields = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([k]) => `${k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())} = ?`)
      .join(', ');

    if (!fields) return;

    const values = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([_, v]) => v);

    await db.query(
      `UPDATE milestones SET ${fields}, updated_at = ? WHERE id = ?`,
      [...values, new Date().toISOString(), id]
    );
  },

  async delete(id: string): Promise<void> {
    await db.query('DELETE FROM milestones WHERE id = ?', [id]);
  },
};

// Anniversaries
export const anniversaries = {
  async getAll(): Promise<Anniversary[]> {
    return db.query('SELECT * FROM anniversaries ORDER BY date ASC') as Promise<Anniversary[]>;
  },

  async getPrimary(): Promise<Anniversary | null> {
    const result = await db.query('SELECT * FROM anniversaries WHERE is_primary = 1 LIMIT 1');
    return result[0] as Anniversary | null;
  },

  async create(anniversary: Omit<Anniversary, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    if (anniversary.isPrimary) {
      queries.push({ sql: 'UPDATE anniversaries SET is_primary = 0' });
    }
    queries.push({
      sql: `INSERT INTO anniversaries (id, date, label, is_primary, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      params: [id, anniversary.date, anniversary.label, anniversary.isPrimary ? 1 : 0, new Date().toISOString()],
    });
    // Multi-write: the "one primary" invariant and the insert must apply together.
    await db.transaction(queries);
    return id;
  },

  async update(id: string, updates: Partial<Omit<Anniversary, 'id' | 'createdAt'>>): Promise<void> {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    if (updates.isPrimary) {
      queries.push({ sql: 'UPDATE anniversaries SET is_primary = 0' });
    }
    const fields = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([k]) => `${k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())} = ?`)
      .join(', ');

    if (fields) {
      const values = Object.entries(updates)
        .filter(([_, v]) => v !== undefined)
        .map(([_, v]) => v);
      queries.push({ sql: `UPDATE anniversaries SET ${fields} WHERE id = ?`, params: [...values, id] });
    }

    if (queries.length) {
      await db.transaction(queries);
    }
  },

  async delete(id: string): Promise<void> {
    await db.query('DELETE FROM anniversaries WHERE id = ?', [id]);
  },
};

// Couple Pair
export const couplePair = {
  async get(): Promise<CouplePair | null> {
    const profile = await userProfile.get();
    if (!profile?.pairedDeviceId) return null;

    const result = await db.query(
      'SELECT * FROM couple_pair WHERE boy_device_id = ? OR girl_device_id = ?',
      [profile.deviceId, profile.deviceId]
    );
    return result[0] as CouplePair | null;
  },

  async create(boyDeviceId: string, girlDeviceId: string, anniversaryDate: string): Promise<string> {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO couple_pair (id, boy_device_id, girl_device_id, anniversary_date, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, boyDeviceId, girlDeviceId, anniversaryDate, new Date().toISOString()]
    );
    return id;
  },
};

// Pairing Codes
export const pairingCodes = {
  async create(code: Omit<PairingCode, 'id' | 'used' | 'usedAt' | 'usedByDeviceId'>): Promise<string> {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO pairing_codes (id, code, role, device_id, name, expires_at, used, used_at, used_by_device_id)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL)`,
      [id, code.code, code.role, code.deviceId, code.name, code.expiresAt]
    );
    return id;
  },

  async get(code: string): Promise<PairingCode | null> {
    const now = new Date().toISOString();
    const result = await db.query('SELECT * FROM pairing_codes WHERE code = ? AND used = 0 AND expires_at > ?', [code, now]);
    return result[0] as PairingCode | null;
  },

  async use(code: string, usedByDeviceId: string): Promise<void> {
    await db.query(
      `UPDATE pairing_codes SET used = 1, used_at = ?, used_by_device_id = ? WHERE code = ?`,
      [new Date().toISOString(), usedByDeviceId, code]
    );
  },
};

// Notification Settings
export const notificationSettings = {
  async get(): Promise<NotificationSettings> {
    const result = await db.query('SELECT * FROM notification_settings LIMIT 1');
    return result[0] as NotificationSettings || {
      id: 'default',
      periodReminder: true,
      periodReminderDays: 1,
      ovulationReminder: true,
      milestoneReminder: true,
      milestoneReminderDays: 3,
      anniversaryReminder: true,
      updatedAt: new Date().toISOString(),
    };
  },

  async update(settings: Partial<Omit<NotificationSettings, 'id' | 'updatedAt'>>): Promise<void> {
    const current = await this.get();
    const fields = Object.entries(settings)
      .filter(([_, v]) => v !== undefined)
      .map(([k]) => `${k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())} = ?`)
      .join(', ');

    if (!fields) return;

    const values = Object.entries(settings)
      .filter(([_, v]) => v !== undefined)
      .map(([_, v]) => v);

    await db.query(
      `UPDATE notification_settings SET ${fields}, updated_at = ? WHERE id = ?`,
      [...values, new Date().toISOString(), current.id]
    );
  },
};

// App Settings
export const appSettings = {
  async get(): Promise<AppSettings> {
    const result = await db.query('SELECT * FROM app_settings LIMIT 1');
    return result[0] as AppSettings || { id: 'default', theme: 'light', language: 'en', widgetEnabled: true, updatedAt: new Date().toISOString() };
  },

  async update(settings: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>): Promise<void> {
    const current = await this.get();
    const fields = Object.entries(settings)
      .filter(([_, v]) => v !== undefined)
      .map(([k]) => `${k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())} = ?`)
      .join(', ');

    if (!fields) return;

    const values = Object.entries(settings)
      .filter(([_, v]) => v !== undefined)
      .map(([_, v]) => v);

    await db.query(
      `UPDATE app_settings SET ${fields}, updated_at = ? WHERE id = ?`,
      [...values, new Date().toISOString(), current.id]
    );
  },
};

// Sync Queue
export const syncQueue = {
  async getAll(limit = 50): Promise<SyncQueueItem[]> {
    return db.query('SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT ?', [limit]) as Promise<SyncQueueItem[]>;
  },

  async enqueue(type: SyncQueueItem['type'], action: SyncQueueItem['action'], payload: Record<string, unknown>): Promise<void> {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO sync_queue (id, type, action, payload, retries, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [id, type, action, JSON.stringify(payload), new Date().toISOString()]
    );
  },

  async markAttempt(id: string): Promise<void> {
    await db.query('UPDATE sync_queue SET retries = retries + 1, last_attempt_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  },

  async remove(id: string): Promise<void> {
    await db.query('DELETE FROM sync_queue WHERE id = ?', [id]);
  },

  async clear(): Promise<void> {
    await db.query('DELETE FROM sync_queue WHERE retries >= 5');
  },
};

// Device ID
export async function getOrCreateDeviceId(): Promise<string> {
  const tauriAvailable = await isTauriEnv();
  if (tauriAvailable) {
    return invoke('get_or_create_device_id');
  }
  
  // Web: use localStorage
  let deviceId = localStorage.getItem('hourglass_device_id');
  if (!deviceId) {
    deviceId = `device_${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem('hourglass_device_id', deviceId);
  }
  return deviceId;
}

// Pairing
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

const generateCode = (): string => {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
};

export async function generatePairingCode(role: UserRole, name: string, deviceId: string): Promise<string> {
  // Always create and store the code here: it works on web and native alike,
  // and the entering device must be able to look the code up afterwards.
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await pairingCodes.create({ code, role, deviceId, name, expiresAt });
  return code;
}

export async function enterPairingCode(code: string, currentDeviceId: string, currentRole: UserRole): Promise<{ success: boolean; anniversaryDate?: string; pairedRole?: UserRole }> {
  const pairingCode = await pairingCodes.get(code);
  if (!pairingCode) {
    return { success: false };
  }

  if (pairingCode.role === currentRole) {
    return { success: false };
  }

  const anniversaryDate = new Date().toISOString().split('T')[0];
  const boyDeviceId = currentRole === 'boy' ? currentDeviceId : pairingCode.deviceId;
  const girlDeviceId = currentRole === 'girl' ? currentDeviceId : pairingCode.deviceId;
  const profile = await userProfile.get();
  const now = new Date().toISOString();

  // Pairing touches three tables; it must succeed or fail as one unit.
  await db.transaction([
    {
      sql: `INSERT INTO couple_pair (id, boy_device_id, girl_device_id, anniversary_date, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      params: [crypto.randomUUID(), boyDeviceId, girlDeviceId, anniversaryDate, now],
    },
    {
      sql: 'UPDATE pairing_codes SET used = 1, used_at = ?, used_by_device_id = ? WHERE code = ?',
      params: [now, currentDeviceId, code],
    },
    ...(profile
      ? [{ sql: 'UPDATE user_profile SET paired_device_id = ?, updated_at = ? WHERE id = ?', params: [pairingCode.deviceId, now, profile.id] as unknown[] }]
      : []),
  ]);

  return { success: true, anniversaryDate, pairedRole: pairingCode.role };
}

// Notifications (no-op in web)
export async function schedulePeriodReminder(daysBefore: number, periodStart: string): Promise<void> {
  const tauriAvailable = await isTauriEnv();
  if (tauriAvailable) {
    return invoke('schedule_period_reminder', { days_before: daysBefore, period_start: periodStart });
  }
}

export async function scheduleMilestoneReminder(daysBefore: number, milestoneDate: string, title: string): Promise<void> {
  const tauriAvailable = await isTauriEnv();
  if (tauriAvailable) {
    return invoke('schedule_milestone_reminder', { days_before: daysBefore, milestone_date: milestoneDate, title });
  }
}

export async function cancelAllNotifications(): Promise<void> {
  const tauriAvailable = await isTauriEnv();
  if (tauriAvailable) {
    return invoke('cancel_notifications');
  }
}

// Share (system share sheet when available, clipboard otherwise).
// Always shares the clean 6-character code, never a prefixed sentence.
export async function sharePairingCode(code: string): Promise<void> {
  const clean = code.replace(/\s/g, '');
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'MeMo 💕 Pairing Code', text: clean });
      return;
    } catch (error) {
      // User dismissed the share sheet or the share failed; fall back to clipboard.
      if ((error as Error | undefined)?.name === 'AbortError') return;
    }
  }
  await copyToClipboard(clean);
}

export async function copyToClipboard(text: string): Promise<void> {
  const clean = text.replace(/\s/g, '');
  const tauriAvailable = await isTauriEnv();
  if (tauriAvailable) {
    await invoke('plugin:clipboard-manager|write_text', { text: clean });
    return;
  }
  await navigator.clipboard.writeText(clean);
}

// Export/Import
// The backup format is one JSON object mapping each table name to its rows, exactly
// as stored. Columns are filtered against the known schema so a backup taken on
// one platform can be restored on another even if stored values mix camelCase
// (legacy web seeds) and snake_case (schema-managed) keys.
const TABLE_COLUMNS: Record<string, string[]> = {
  user_profile: ['id', 'role', 'name', 'device_id', 'pairing_code', 'paired_device_id', 'created_at', 'updated_at'],
  couple_pair: ['id', 'boy_device_id', 'girl_device_id', 'anniversary_date', 'created_at'],
  period_entries: ['id', 'date', 'is_period_day', 'flow', 'symptoms', 'notes', 'created_by', 'synced', 'created_at', 'updated_at'],
  cycle_settings: ['id', 'cycle_length', 'period_length', 'last_period_start', 'updated_at'],
  milestones: ['id', 'title', 'date', 'emoji', 'note', 'created_by', 'synced', 'created_at', 'updated_at'],
  anniversaries: ['id', 'date', 'label', 'is_primary', 'created_at'],
  notification_settings: ['id', 'period_reminder', 'period_reminder_days', 'ovulation_reminder', 'milestone_reminder', 'milestone_reminder_days', 'anniversary_reminder', 'updated_at'],
  app_settings: ['id', 'theme', 'language', 'widget_enabled', 'updated_at'],
  sync_queue: ['id', 'type', 'action', 'payload', 'retries', 'created_at', 'last_attempt_at'],
  pairing_codes: ['id', 'code', 'role', 'device_id', 'name', 'expires_at', 'used', 'used_at', 'used_by_device_id'],
};

const camelFor = (snake: string) =>
  snake.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());

// Raw rows, straight from the database, so export/import is a faithful copy.
const rawRowsForBackup = async (table: string): Promise<Array<Record<string, unknown>>> => {
  const tauriAvailable = await isTauriEnv();
  if (tauriAvailable) {
    return (
      (await invoke<Array<Record<string, unknown>>>('plugin:sql|select', {
        db: TAURI_DB,
        query: `SELECT * FROM ${table}`,
        values: [],
      })) ?? []
    );
  }
  const webDB = getWebDB() as unknown as Record<string, Array<Record<string, unknown>>>;
  return webDB[table] ?? [];
};

export async function exportData(): Promise<string> {
  const dump: Record<string, Array<Record<string, unknown>>> = {};
  for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
    const rows = await rawRowsForBackup(table);
    dump[table] = rows.map(row => {
      const out: Record<string, unknown> = {};
      for (const col of columns) {
        if (col in row) {
          out[col] = row[col];
        } else {
          const camel = camelFor(col);
          if (camel in row) out[col] = row[camel];
        }
      }
      return out;
    });
  }
  return JSON.stringify(dump, null, 2);
}

export async function importData(jsonData: string): Promise<void> {
  const parsed = JSON.parse(jsonData) as Record<string, unknown>;
  const queries: TransactionQuery[] = [];

  for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
    if (!Array.isArray(parsed[table])) continue; // leave tables absent from the backup untouched
    const rows = parsed[table] as Array<Record<string, unknown>>;

    queries.push({ sql: `DELETE FROM ${table}` });

    for (const row of rows) {
      const cols = columns.filter(col => col in row);
      if (cols.length === 0) continue;
      const placeholders = cols.map(() => '?').join(', ');
      queries.push({
        sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
        params: cols.map(col => row[col] ?? null),
      });
    }
  }

  // All-or-nothing restore: a failed row must not leave the database half-wiped.
  await db.transaction(queries);
  window.location.reload();
}