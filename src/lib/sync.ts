/**
 * Cross-device couple sync.
 *
 * The dev-server registry (`/api/sync/*`) acts as the couple's shared store so
 * two devices can exchange milestones, anniversaries and period entries with
 * last-write-wins merging on each row's `updatedAt`. Deletes propagate via
 * tombstones recorded in localStorage (see tauri.ts). On native builds the
 * endpoints don't exist; every call degrades gracefully and the app keeps
 * working fully offline on one device.
 */

import { couplePair, db, getTombstones, userProfile } from '@/lib/tauri';
import type { Anniversary, Milestone, Notice, PeriodEntry } from '@/types';

export const SYNC_TABLES = ['milestones', 'anniversaries', 'period_entries', 'notices'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

type AnyRow = Record<string, unknown>;

const tsOf = (row: AnyRow | null | undefined): string =>
  String(row?.updatedAt ?? row?.createdAt ?? '');

const apiPost = async <T = unknown>(path: string, body?: unknown): Promise<T | null> => {
  try {
    const res = await fetch(`/api/sync${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // no sync backend (native build / static preview / server down)
  }
};

const apiGet = async <T = unknown>(path: string): Promise<T | null> => {
  try {
    const res = await fetch(`/api/sync${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

export interface SyncContext {
  coupleId: string;
  deviceId: string;
  partnerDeviceId: string;
  name: string;
}

/** Who the local device is, and which device is the partner. */
export async function getSyncContext(): Promise<SyncContext | null> {
  const [pair, profile] = await Promise.all([couplePair.get(), userProfile.get()]);
  if (!pair || !profile) return null;
  const deviceId = profile.deviceId;
  const partnerDeviceId = pair.boyDeviceId === deviceId ? pair.girlDeviceId : pair.boyDeviceId;
  return { coupleId: pair.id, deviceId, partnerDeviceId, name: profile.name ?? '' };
}

export function partnerDeviceIdOf(pair: { boyDeviceId: string; girlDeviceId: string }, deviceId: string): string {
  return pair.boyDeviceId === deviceId ? pair.girlDeviceId : pair.boyDeviceId;
}

export async function sendHeartbeat(deviceId: string, name?: string): Promise<boolean> {
  const res = await apiPost<{ success: boolean }>('/heartbeat', { deviceId, name });
  return res?.success === true;
}

export interface PartnerStatus {
  online: boolean | null;
  name: string | null;
}

/** Partner's online flag as the dev server sees it; null when unknown (no backend / offline). */
export async function getPartnerStatus(partnerDeviceId: string): Promise<PartnerStatus> {
  const res = await apiGet<{ success: boolean; online: boolean; name?: string | null }>(`/status?deviceId=${encodeURIComponent(partnerDeviceId)}`);
  if (!res || res.success !== true) return { online: null, name: null };
  return { online: res.online, name: res.name ?? null };
}

interface PushResponse {
  success: boolean;
  rows?: { milestones?: AnyRow[]; anniversaries?: AnyRow[]; period_entries?: AnyRow[]; notices?: AnyRow[] };
  tombstones?: Record<SyncTable, Record<string, string>>;
}

const toBoolInt = (v: unknown): number => (v === true || v === 1 || v === '1' ? 1 : 0);
const nowIso = () => new Date().toISOString();

interface InsertSpec { sql: string; params: unknown[] }

const buildInsert = (table: SyncTable, row: AnyRow): InsertSpec => {
  if (table === 'milestones') {
    const createdAt = String(row.createdAt ?? nowIso());
    return {
      sql: `INSERT INTO milestones (id, title, date, emoji, note, created_by, synced, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      params: [
        String(row.id), String(row.title ?? ''), String(row.date ?? ''), String(row.emoji ?? '📌'),
        row.note ?? null, String(row.createdBy ?? 'girl'), createdAt,
        String(row.updatedAt ?? createdAt),
      ],
    };
  }
  if (table === 'anniversaries') {
    const createdAt = String(row.createdAt ?? nowIso());
    return {
      sql: `INSERT INTO anniversaries (id, date, label, is_primary, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        String(row.id), String(row.date ?? ''), String(row.label ?? 'Anniversary'),
        toBoolInt(row.isPrimary), createdAt, String(row.updatedAt ?? createdAt),
      ],
    };
  }
  if (table === 'notices') {
    const createdAt = String(row.createdAt ?? nowIso());
    return {
      sql: `INSERT INTO notices (id, message, remind_at, repeat_minutes, active, created_by, synced, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      params: [
        String(row.id), String(row.message ?? ''), String(row.remindAt ?? row.remind_at ?? nowIso()),
        Number(row.repeatMinutes ?? row.repeat_minutes ?? 0),
        toBoolInt(row.active ?? 1),
        String(row.createdBy ?? row.created_by ?? 'girl'), createdAt,
        String(row.updatedAt ?? createdAt),
      ],
    };
  }
  const createdAt = String(row.createdAt ?? nowIso());
  const symptoms = Array.isArray(row.symptoms) ? JSON.stringify(row.symptoms) : (typeof row.symptoms === 'string' ? row.symptoms : '[]');
  return {
    sql: `INSERT INTO period_entries (id, date, is_period_day, flow, symptoms, notes, created_by, synced, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    params: [
      String(row.id), String(row.date ?? ''), toBoolInt(row.isPeriodDay ?? true),
      row.flow ?? null, symptoms, row.notes ?? null,
      String(row.createdBy ?? 'girl'), createdAt, String(row.updatedAt ?? createdAt),
    ],
  };
};

/** Write the server's canonical state back into the local DB (delete-then-insert per row).
 *  Returns what it merged in so callers can reload stores and keep deleted cards visible for an exit animation. */
const applyCanonical = async (resp: PushResponse): Promise<{ changed: boolean; removedMilestones: Milestone[]; removedAnniversaries: Anniversary[] }> => {
  const rows = resp.rows ?? {};
  const tombstones = resp.tombstones ?? { milestones: {}, anniversaries: {}, period_entries: {}, notices: {} };
  let changed = false;
  const removedMilestones: Milestone[] = [];
  const removedAnniversaries: Anniversary[] = [];

  for (const table of SYNC_TABLES) {
    const canonical = (rows[table] ?? []) as AnyRow[];
    const byId = new Map(canonical.map(r => [String(r.id), r]));

    // Local rows whose id lost the merge or was tombstoned get removed.
    const local = (await db.query(`SELECT * FROM ${table}`)) as AnyRow[];
    const localById = new Map(local.map(r => [String(r.id), r]));

    const tombs = tombstones[table] ?? {};
    for (const [id, deletedAt] of Object.entries(tombs)) {
      const l = localById.get(id);
      if (l && tsOf(l) <= deletedAt) {
        if (table === 'milestones') removedMilestones.push(l as unknown as Milestone);
        if (table === 'anniversaries') removedAnniversaries.push(l as unknown as Anniversary);
        await db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
        localById.delete(id);
        changed = true;
      }
    }

    // Upsert rows that are missing locally or older than the canonical row.
    for (const row of canonical) {
      const id = String(row.id ?? '');
      if (!id) continue;
      const localRow = localById.get(id);
      if (localRow && tsOf(localRow) >= tsOf(row)) continue; // local is not older

      await db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
      if (table === 'period_entries') {
        // The unique (date, created_by) constraint can point at a different id
        await db.query('DELETE FROM period_entries WHERE date = ? AND created_by = ?', [String(row.date ?? ''), String(row.createdBy ?? '')]);
      }
      const spec = buildInsert(table, row);
      await db.query(spec.sql, spec.params);
      changed = true;
    }
  }
  return { changed, removedMilestones, removedAnniversaries };
};

export type SyncStatus = 'ok' | 'offline' | 'no-couple' | 'error';

export interface SyncOutcome {
  status: SyncStatus;
  /** True when the merge brought in remote rows or deletes */
  changed: boolean;
  /** Rows this device just removed because the partner deleted them (play the exit animation) */
  removed: { milestones: Milestone[]; anniversaries: Anniversary[] };
}

/**
 * Push local state to the couple's shared store, then apply whatever the
 * server returns as canonical. Safe to call repeatedly; convergence is
 * guaranteed by last-write-wins on `updatedAt`.
 */
export async function syncCoupleData(): Promise<SyncOutcome> {
  const ctx = await getSyncContext();
  const empty = { milestones: [] as Milestone[], anniversaries: [] as Anniversary[] };
  if (!ctx) return { status: 'no-couple', changed: false, removed: empty };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'offline', changed: false, removed: empty };
  }

  const [milestoneRows, anniversaryRows, periodRows, noticeRows] = await Promise.all([
    db.query('SELECT * FROM milestones') as Promise<Milestone[]>,
    db.query('SELECT * FROM anniversaries') as Promise<Anniversary[]>,
    db.query('SELECT * FROM period_entries') as Promise<PeriodEntry[]>,
    db.query('SELECT * FROM notices') as Promise<Notice[]>,
  ]);

  const pushed = await apiPost<PushResponse>('/push', {
    coupleId: ctx.coupleId,
    deviceId: ctx.deviceId,
    name: ctx.name,
    rows: {
      milestones: milestoneRows,
      anniversaries: anniversaryRows,
      period_entries: periodRows,
      notices: noticeRows,
    },
    tombstones: getTombstones(),
  });

  if (!pushed?.success) {
    return {
      status: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error',
      changed: false,
      removed: { milestones: [], anniversaries: [] },
    };
  }

  const { changed, removedMilestones, removedAnniversaries } = await applyCanonical(pushed);
  return { status: 'ok', changed, removed: { milestones: removedMilestones, anniversaries: removedAnniversaries } };
}
