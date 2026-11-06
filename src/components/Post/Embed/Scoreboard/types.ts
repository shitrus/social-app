/*
 * Hand-written types for the com.professorbutts.sports.* records. These
 * lexicons are not part of `#/lexicons`, so records arrive as unknown JSON and
 * are checked by the guards in `./utils`.
 *
 * Lexicons: com.professorbutts.sports.game, com.professorbutts.sports.defs,
 * com.professorbutts.sports.scoreboard (formerly .attachment)
 */

export const GAME_COLLECTION = 'com.professorbutts.sports.game'
/** Post field that carries the scoreboard. */
export const SCOREBOARD_FIELD = 'com.professorbutts.sports.scoreboard'
/** Older name for the same field, still on posts made before the rename. */
export const LEGACY_ATTACHMENT_FIELD = 'com.professorbutts.sports.attachment'

export type GameStatus =
  | 'scheduled'
  | 'live'
  | 'halftime'
  | 'final'
  | 'postponed'
  | 'canceled'
  | (string & {})

export type Period = {
  number: number
  /** Display label, e.g. 'Q3', '2nd Half', 'OT'. */
  label?: string
}

export type FootballSituation = {
  possession?: 'home' | 'away' | (string & {})
  down?: number
  distance?: number
  yardLine?: string
}

export type BaseballSituation = {
  balls?: number
  strikes?: number
  outs?: number
  onFirst?: boolean
  onSecond?: boolean
  onThird?: boolean
}

export type BasketballSituation = {
  possession?: 'home' | 'away' | (string & {})
  homeTimeouts?: number
  awayTimeouts?: number
  homeFouls?: number
  awayFouls?: number
  bonus?: 'home' | 'away' | 'both' | (string & {})
}

export type HockeySituation = {
  powerPlay?: 'home' | 'away' | (string & {})
  homeSkaters?: number
  awaySkaters?: number
  emptyNet?: 'home' | 'away' | 'both' | (string & {})
}

/**
 * A union member of com.professorbutts.sports.defs#situation. Older records
 * have no `$type` and mix football and baseball fields, so every field is
 * optional and readers look at the fields themselves.
 */
export type Situation = {$type?: string} & FootballSituation &
  BaseballSituation &
  Omit<BasketballSituation, 'possession'> &
  HockeySituation

export type BlobRef = {
  ref?: {$link?: string}
  mimeType?: string
}

export type Competitor = {
  name: string
  abbreviation?: string
  score: number
  record?: string
  color?: string
  secondaryColor?: string
  rank?: number
  logo?: BlobRef
  logoUrl?: string
  profile?: string
}

export type Game = {
  sport: string
  league: string
  season?: string
  venue?: string
  startsAt: string
  status: GameStatus
  home: Competitor
  away: Competitor
  period?: Period
  clock?: string
  situation?: Situation
  updatedAt: string
  round?: string
  conference?: string
}

export type Snapshot = {
  capturedAt: string
  status: GameStatus
  homeScore: number
  awayScore: number
  period?: Period
  clock?: string
  situation?: Situation
}

export type Attachment = {
  /** at:// URI of the game record. Always resolves to the latest state. */
  game: string
  snapshot: Snapshot
  /** Full description of the scoreboard at the snapshot moment. */
  alt?: string
}

/**
 * The state that the card draws: the live record, or the live record with the
 * post's snapshot laid over it.
 */
export type GameView = Game & {
  /** True when this is the score at posting time rather than right now. */
  isSnapshot: boolean
}
