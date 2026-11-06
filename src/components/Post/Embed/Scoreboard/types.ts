/*
 * Hand-written types for the com.professorbutts.sports.* records. These
 * lexicons are not part of `#/lexicons`, so records arrive as unknown JSON and
 * are checked by the guards in `./utils`.
 *
 * Lexicons: com.professorbutts.sports.game, com.professorbutts.sports.defs,
 * com.professorbutts.sports.scoreboard (formerly .attachment)
 */

export const GAME_COLLECTION = 'com.professorbutts.sports.game'
export const LEADERBOARD_COLLECTION = 'com.professorbutts.sports.leaderboard'
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

export type SoccerSituation = {
  /** Announced added time, e.g. '3'. */
  stoppageTime?: string
  homeRedCards?: number
  awayRedCards?: number
}

/**
 * A union member of com.professorbutts.sports.defs#situation. Older records
 * have no `$type` and mix football and baseball fields, so every field is
 * optional and readers look at the fields themselves.
 */
export type Situation = {$type?: string} & FootballSituation &
  BaseballSituation &
  Omit<BasketballSituation, 'possession'> &
  HockeySituation &
  SoccerSituation

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

/** Post field pointing at a two-sided game. */
export type GameAttachment = {
  kind: 'game'
  /** at:// URI of the game record. Always resolves to the latest state. */
  game: string
  snapshot: Snapshot
  /** Full description of the scoreboard at the snapshot moment. */
  alt?: string
}

/** Post field pointing at a leaderboard event (golf, motorsport). */
export type LeaderboardAttachment = {
  kind: 'leaderboard'
  /** at:// URI of the leaderboard record. */
  game: string
  snapshot: LeaderboardSnapshot
  /** Entrant names the post is about. */
  highlight: string[]
  alt?: string
}

export type Attachment = GameAttachment | LeaderboardAttachment

export type Entrant = {
  name: string
  position?: number
  positionLabel?: string
  shortName?: string
  team?: string
  number?: string
  country?: string
  color?: string
  score?: string
  toPar?: number
  today?: string
  thru?: string
  laps?: number
  lapsLed?: number
  detail?: string
  rounds?: number[]
  state?: string
  profile?: string
  photoUrl?: string
}

/** A union member of com.professorbutts.sports.defs#progress. */
export type Progress = {
  $type?: string
  /** Golf */
  round?: number
  totalRounds?: number
  cutLine?: string
  playoff?: boolean
  /** Motorsport */
  lap?: number
  totalLaps?: number
  stage?: number
  session?: string
  flag?: string
}

export type Leaderboard = {
  sport: string
  league: string
  name: string
  season?: string
  venue?: string
  startsAt: string
  endsAt?: string
  status: GameStatus | 'suspended'
  progress?: Progress
  standings: Entrant[]
  updatedAt: string
}

export type LeaderboardSnapshot = {
  capturedAt: string
  status: string
  standings: Entrant[]
  progress?: Progress
}

export type LeaderboardView = Leaderboard & {
  isSnapshot: boolean
}

/**
 * The state that the card draws: the live record, or the live record with the
 * post's snapshot laid over it.
 */
export type GameView = Game & {
  /** True when this is the score at posting time rather than right now. */
  isSnapshot: boolean
}
