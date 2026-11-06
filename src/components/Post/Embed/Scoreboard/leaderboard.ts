import {
  type Entrant,
  type Leaderboard,
  type LeaderboardSnapshot,
  type LeaderboardView,
  type Progress,
  type Standings,
} from './types'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isEntrant(v: unknown): v is Entrant {
  return isObject(v) && typeof v.name === 'string'
}

export function isLeaderboard(v: unknown): v is Leaderboard {
  return (
    isObject(v) &&
    typeof v.status === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.standings) &&
    v.standings.every(isEntrant)
  )
}

/** Season standings record, drawn on the leaderboard card. */
export function isStandings(v: unknown): v is Standings {
  return (
    isObject(v) &&
    typeof v.name === 'string' &&
    Array.isArray(v.standings) &&
    v.standings.every(isEntrant)
  )
}

/** Standings shown as a leaderboard with a 'standings' status. */
export function standingsToLeaderboard(s: Standings): Leaderboard {
  return {
    sport: s.sport,
    league: s.league,
    name: s.season ? `${s.season} ${s.name}` : s.name,
    season: s.season,
    startsAt: s.updatedAt,
    status: 'standings',
    standings: s.standings,
    afterEvent: s.afterEvent,
    next: s.next,
    updatedAt: s.updatedAt,
  }
}

/** "Sao Paulo GP FP1, Fri, Nov 6, 10:30 AM" */
export function formatNext(next: {name: string; startsAt?: string}) {
  const d = next.startsAt ? new Date(next.startsAt) : undefined
  const when =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : undefined
  return [next.name, when].filter(Boolean).join(' \u00b7 ')
}

export function isLeaderboardSnapshot(v: unknown): v is LeaderboardSnapshot {
  return (
    isObject(v) &&
    typeof v.status === 'string' &&
    Array.isArray(v.standings) &&
    v.standings.every(isEntrant)
  )
}

export function isLeaderboardLive(status: string) {
  return status === 'live' || status === 'suspended'
}

/** Live events refresh every 30s; events about to start check every minute. */
export function getLeaderboardRefreshInterval(
  board: Leaderboard | undefined,
  now = Date.now(),
) {
  if (!board) return false
  if (isLeaderboardLive(board.status)) return 30_000
  if (board.status === 'scheduled') {
    const start = Date.parse(board.startsAt)
    if (!Number.isNaN(start) && start - now < 60 * 60_000) return 60_000
  }
  return false
}

export function applyLeaderboardSnapshot(
  board: Leaderboard,
  snapshot: LeaderboardSnapshot,
): LeaderboardView {
  return {
    ...board,
    status: snapshot.status,
    standings: snapshot.standings,
    progress: snapshot.progress ?? board.progress,
    isSnapshot: true,
  }
}

function sameEntrant(a?: Entrant, b?: Entrant) {
  return (
    a?.name === b?.name &&
    (a?.score ?? a?.toPar) === (b?.score ?? b?.toPar) &&
    (a?.thru ?? a?.laps) === (b?.thru ?? b?.laps)
  )
}

/** True when the top of the live board differs from the posted copy. */
export function hasLeaderboardChanged(
  board: Leaderboard,
  snapshot: LeaderboardSnapshot,
) {
  if (board.status !== snapshot.status) return true
  if (getProgressLabel(board.progress) !== getProgressLabel(snapshot.progress))
    return true
  for (let i = 0; i < 3; i++) {
    if (!sameEntrant(board.standings[i], snapshot.standings[i])) return true
  }
  return false
}

export function isHighlighted(entrant: Entrant, highlight: string[]) {
  const name = entrant.name.toLowerCase()
  return highlight.some(h => h.toLowerCase() === name)
}

export type Row = {
  entrant: Entrant
  /** Place as shown in the row. */
  position: string
  /** A driver listed under their constructor, drawn indented. */
  member: boolean
}

function toRow(standings: Entrant[], e: Entrant): Row {
  return {
    entrant: e,
    position: getPositionLabel(e, Math.max(standings.indexOf(e), 0)),
    member: false,
  }
}

/**
 * The three rows the card has room for: the top three, or the top two plus
 * the first highlighted entrant when they are further down. A highlighted
 * constructor with members fills the card with itself and two drivers.
 */
export function pickRows(standings: Entrant[], highlight: string[]): Row[] {
  const pinned = highlight.length
    ? standings.find(e => isHighlighted(e, highlight))
    : undefined
  if (pinned?.members?.length) {
    return [
      toRow(standings, pinned),
      ...pinned.members.slice(0, 2).map(m => ({
        entrant: m,
        position: m.positionLabel ?? (m.position ? String(m.position) : ''),
        member: true,
      })),
    ]
  }
  const top = standings.slice(0, 3)
  if (pinned && !top.includes(pinned)) {
    return [...standings.slice(0, 2), pinned].map(e => toRow(standings, e))
  }
  return top.map(e => toRow(standings, e))
}

export function formatToPar(n: number) {
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

/** Main figure for a row: golf to-par, a race gap, or points. */
export function getEntrantScore(e: Entrant) {
  return e.score ?? (e.toPar != null ? formatToPar(e.toPar) : undefined)
}

/** Secondary figure for a row, e.g. "Thru 14" or "72 laps". */
export function getEntrantDetail(e: Entrant) {
  if (e.detail) return e.detail
  if (e.thru) return e.thru === 'F' ? 'F' : `Thru ${e.thru}`
  if (e.laps != null) return `${e.laps} laps`
}

export function getPositionLabel(e: Entrant, index: number) {
  return e.positionLabel ?? String(e.position ?? index + 1)
}

const FLAGS: Record<string, string> = {
  yellow: 'Yellow flag',
  red: 'Red flag',
  checkered: 'Checkered flag',
  white: 'White flag',
  safetyCar: 'Safety car',
  virtualSafetyCar: 'Virtual safety car',
}

const SESSIONS: Record<string, string> = {
  practice: 'Practice',
  qualifying: 'Qualifying',
  sprint: 'Sprint',
}

export function getProgressLabel(p?: Progress) {
  if (!p) return undefined
  const parts: (string | undefined)[] = []
  if (p.round != null) {
    parts.push(p.playoff ? 'Playoff' : `Round ${p.round}`)
    if (p.cutLine) parts.push(`Cut ${p.cutLine}`)
  }
  if (p.session && SESSIONS[p.session]) parts.push(SESSIONS[p.session])
  if (p.stage != null) parts.push(`Stage ${p.stage}`)
  if (p.lap != null) {
    parts.push(p.totalLaps ? `Lap ${p.lap}/${p.totalLaps}` : `Lap ${p.lap}`)
  }
  if (p.flag && FLAGS[p.flag]) parts.push(FLAGS[p.flag])
  return parts.filter(Boolean).join(' · ') || undefined
}

/** Complete text description of a leaderboard card, for screen readers. */
export function getLeaderboardAltText(
  board: LeaderboardView,
  highlight: string[] = [],
) {
  const out = ['Leaderboard.']
  out.push(
    `${[board.league, board.season, board.name].filter(Boolean).join(', ')}.`,
  )
  const status =
    board.status === 'standings'
      ? board.afterEvent
        ? `Standings after ${board.afterEvent}`
        : 'Season standings'
      : board.status === 'final'
        ? 'Final'
        : board.status === 'scheduled'
          ? 'Not started'
          : board.status === 'suspended'
            ? 'Suspended'
            : board.status === 'postponed'
              ? 'Postponed'
              : board.status === 'canceled'
                ? 'Canceled'
                : 'Live'
  const progress = getProgressLabel(board.progress)
  out.push(`${[status, progress].filter(Boolean).join(', ')}.`)
  const rows = pickRows(board.standings, highlight)
  rows.forEach(({entrant: e, position, member}) => {
    const bits = [
      member
        ? `Driver ${e.name}${position ? `, P${position}` : ''}`
        : `${position}: ${e.name}`,
      e.team,
      getEntrantScore(e),
      getEntrantDetail(e),
    ].filter(Boolean)
    out.push(`${bits.join(', ')}.`)
  })
  if (board.venue) out.push(`${board.venue}.`)
  out.push(
    board.isSnapshot
      ? 'Standings when posted.'
      : board.status === 'standings'
        ? 'Current standings.'
        : 'Live standings.',
  )
  if (board.next) {
    out.push(`Next update: ${formatNext(board.next)}.`)
  }
  return out.join(' ')
}
