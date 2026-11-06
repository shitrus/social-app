import {AtUri} from '@atproto/syntax'

import {
  type Attachment,
  ATTACHMENT_FIELD,
  type Competitor,
  type Game,
  GAME_COLLECTION,
  type GameView,
  type Period,
  type Snapshot,
} from './types'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function isCompetitor(v: unknown): v is Competitor {
  return isObject(v) && typeof v.name === 'string' && isScore(v.score)
}

function isSnapshot(v: unknown): v is Snapshot {
  return (
    isObject(v) &&
    typeof v.status === 'string' &&
    isScore(v.homeScore) &&
    isScore(v.awayScore)
  )
}

/**
 * Reads the scoreboard attachment off a post record, if it has a usable one.
 * Posts carry it as an extra top-level field next to a normal link card.
 */
export function getScoreboardAttachment(
  record: unknown,
): Attachment | undefined {
  if (!isObject(record)) return
  const attachment = record[ATTACHMENT_FIELD]
  if (!isObject(attachment) || typeof attachment.game !== 'string') return
  if (!isSnapshot(attachment.snapshot)) return
  try {
    const uri = new AtUri(attachment.game)
    if (uri.collection !== GAME_COLLECTION || !uri.rkey) return
    if (!uri.host.startsWith('did:')) return
  } catch {
    return
  }
  return {
    game: attachment.game,
    snapshot: attachment.snapshot,
    alt: typeof attachment.alt === 'string' ? attachment.alt : undefined,
  }
}

export function isGame(v: unknown): v is Game {
  return (
    isObject(v) &&
    typeof v.status === 'string' &&
    isCompetitor(v.home) &&
    isCompetitor(v.away)
  )
}

export function isInProgress(status: string) {
  return status === 'live' || status === 'halftime'
}

/**
 * How often to poll the game record, or false to stop. Live games refresh
 * often; scheduled games check in now and then so the card flips to live
 * near kickoff; finished games stop.
 */
export function getRefreshInterval(game: Game | undefined, now = Date.now()) {
  if (!game) return false
  if (isInProgress(game.status)) return 15_000
  if (game.status === 'scheduled') {
    const start = Date.parse(game.startsAt)
    if (Number.isNaN(start)) return false
    const untilStart = start - now
    // Within an hour of start (or past it but not yet flipped to live)
    if (untilStart < 60 * 60_000) return 30_000
    return false
  }
  return false
}

/**
 * The game as it was when the post was made: teams and colors from the live
 * record, score and clock from the post's own snapshot.
 */
export function applySnapshot(game: Game, snapshot: Snapshot): GameView {
  return {
    ...game,
    status: snapshot.status,
    home: {...game.home, score: snapshot.homeScore},
    away: {...game.away, score: snapshot.awayScore},
    period: snapshot.period,
    clock: snapshot.clock,
    situation: snapshot.situation,
    isSnapshot: true,
  }
}

/**
 * True when the live game shows something the snapshot doesn't, so the
 * "show live score" control is worth offering.
 */
export function hasChangedSinceSnapshot(game: Game, snapshot: Snapshot) {
  return (
    game.status !== snapshot.status ||
    game.home.score !== snapshot.homeScore ||
    game.away.score !== snapshot.awayScore ||
    (game.period?.label ?? game.period?.number) !==
      (snapshot.period?.label ?? snapshot.period?.number) ||
    (game.clock ?? '') !== (snapshot.clock ?? '')
  )
}

export function teamName(team: Competitor) {
  return team.name || team.abbreviation || 'Team'
}

export function teamShortName(team: Competitor) {
  return team.abbreviation || team.name || 'Team'
}

/**
 * Only https images, so a record can't point the app at local or
 * insecure URLs. A logo blob is served from the record's own PDS.
 */
export function getLogoUri(
  team: Competitor,
  repo: {did: string; pds?: string},
): string | undefined {
  const cid = team.logo?.ref?.$link
  if (cid && repo.pds) {
    return `${repo.pds.replace(/\/$/, '')}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(repo.did)}&cid=${encodeURIComponent(cid)}`
  }
  if (team.logoUrl && /^https:\/\//.test(team.logoUrl)) return team.logoUrl
}

/** Accepts only plain `#rrggbb` colors from the record. */
export function getTeamColor(team: Competitor): string | undefined {
  if (team.color && /^#[0-9a-fA-F]{6}$/.test(team.color)) return team.color
}

const ROUNDS: Record<string, string> = {
  wildcard: 'Wild Card',
  divisional: 'Divisional',
  conference: 'Conference Championship',
  superbowl: 'Super Bowl',
}

export function getRoundLabel(game: Game) {
  const round = game.round && ROUNDS[game.round]
  if (!round) return
  return game.round === 'conference' && game.conference
    ? `${game.conference} Championship`
    : round
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** Short down-and-distance or count line, e.g. "3rd & 7 at PIT 42". */
export function getSituationLabel(game: Game) {
  const s = game.situation
  if (!s || !isInProgress(game.status)) return
  if (s.down != null) {
    const dist = s.distance === 0 ? 'Goal' : (s.distance ?? '')
    return [`${ordinal(s.down)} & ${dist}`, s.yardLine && `at ${s.yardLine}`]
      .filter(Boolean)
      .join(' ')
  }
  if (s.outs != null || s.balls != null) {
    return [
      s.balls != null && `${s.balls}-${s.strikes ?? 0}`,
      s.outs != null && `${s.outs} out${s.outs === 1 ? '' : 's'}`,
    ]
      .filter(Boolean)
      .join(', ')
  }
}

function periodName(p?: {label?: string; number?: number}): string {
  if (!p) return ''
  const label = p.label || ''
  const end = /^End (.+)$/.exec(label)
  if (end) return `end of the ${periodName({label: end[1]})}`
  const qh = /^([QH])(\d)$/.exec(label)
  if (qh) return `${ordinal(+qh[2])} ${qh[1] === 'Q' ? 'quarter' : 'half'}`
  const ot = /^(\d*)OT$/.exec(label)
  if (ot) return ot[1] ? `${ordinal(+ot[1])} overtime` : 'overtime'
  return label || (p.number ? `period ${p.number}` : '')
}

export function formatGameDate(startsAt: string) {
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatKickoff(startsAt: string) {
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Complete text description of the card, for screen readers. Mirrors the alt
 * text the card service writes for its images.
 */
export function getAltText(game: GameView) {
  const {away: a, home: h} = game
  const team = (t: Competitor) =>
    `${t.rank ? `#${t.rank} ` : ''}${teamName(t)}${t.record ? ` (${t.record})` : ''}`
  const score = () => {
    if (a.score === h.score) return `Tied ${a.score} to ${h.score}`
    const [lead, trail] = h.score > a.score ? [h, a] : [a, h]
    return `${teamName(lead)} ${lead.score}, ${teamName(trail)} ${trail.score}`
  }
  const out = ['Scoreboard.']
  const round = getRoundLabel(game)
  const head = [game.league, game.season, round].filter(Boolean).join(', ')
  if (head) out.push(`${head}.`)
  out.push(`${team(a)} at ${team(h)}.`)
  switch (game.status) {
    case 'scheduled': {
      const d = new Date(game.startsAt)
      out.push(
        Number.isNaN(d.getTime())
          ? 'Scheduled.'
          : `Starts ${d.toLocaleString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
            })}.`,
      )
      break
    }
    case 'postponed':
      out.push('Postponed.')
      break
    case 'canceled':
      out.push('Canceled.')
      break
    case 'halftime':
      out.push(`Halftime. ${score()}.`)
      break
    case 'final':
      out.push(
        `Final${/OT/i.test(game.period?.label || '') ? ' in overtime' : ''}. ${score()}.`,
      )
      break
    default: {
      out.push(`Live. ${score()}.`)
      const pn = periodName(game.period)
      const when = [
        pn && pn[0].toUpperCase() + pn.slice(1),
        game.clock && `${game.clock} left`,
      ]
        .filter(Boolean)
        .join(', ')
      if (when) out.push(`${when}.`)
      const s = game.situation || {}
      if (s.down != null) {
        const side =
          s.possession === 'home'
            ? game.home
            : s.possession === 'away'
              ? game.away
              : undefined
        const pos = side ? `${teamName(side)} ball, ` : ''
        out.push(
          `${pos}${ordinal(s.down)} and ${s.distance === 0 ? 'goal' : (s.distance ?? '')}${s.yardLine ? ` at the ${s.yardLine}` : ''}.`,
        )
      } else if (s.outs != null || s.balls != null) {
        const bases = [
          s.onFirst && 'first',
          s.onSecond && 'second',
          s.onThird && 'third',
        ].filter(Boolean)
        out.push(
          [
            s.outs != null && `${s.outs} out${s.outs === 1 ? '' : 's'}`,
            bases.length
              ? `runner${bases.length > 1 ? 's' : ''} on ${bases.join(' and ')}`
              : 'bases empty',
            s.balls != null && `count ${s.balls}-${s.strikes ?? 0}`,
          ]
            .filter(Boolean)
            .join(', ') + '.',
        )
      }
    }
  }
  if (game.venue) out.push(`${game.venue}.`)
  out.push(game.isSnapshot ? 'Score when posted.' : 'Live score.')
  return out.join(' ')
}

export function getPeriodLabel(period?: Period) {
  return period?.label || (period?.number ? `P${period.number}` : undefined)
}
