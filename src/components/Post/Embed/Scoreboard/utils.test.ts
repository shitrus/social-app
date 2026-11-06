import {describe, expect, it} from '@jest/globals'

import {type Game} from './types'
import {
  applySnapshot,
  getAltText,
  getLogoUri,
  getRefreshInterval,
  getScoreboardAttachment,
  getSituationLabel,
  hasChangedSinceSnapshot,
} from './utils'

const GAME_URI =
  'at://did:plc:kh6nd4blegayjjicfmda2ra6/com.professorbutts.sports.game/nfl-2026-11-09-cin-pit'

const game: Game = {
  sport: 'football',
  league: 'NFL',
  startsAt: '2026-11-09T18:00:00Z',
  updatedAt: '2026-11-09T19:30:00Z',
  status: 'live',
  away: {name: 'Bengals', abbreviation: 'CIN', score: 17, record: '6-3'},
  home: {name: 'Steelers', abbreviation: 'PIT', score: 14, record: '5-4'},
  period: {number: 3, label: 'Q3'},
  clock: '4:32',
  situation: {possession: 'away', down: 3, distance: 7, yardLine: 'PIT 42'},
}

const snapshot = {
  capturedAt: '2026-11-09T19:00:00Z',
  status: 'live',
  homeScore: 7,
  awayScore: 10,
  period: {number: 2, label: 'Q2'},
  clock: '1:10',
}

describe('getScoreboardAttachment', () => {
  it('reads a valid attachment', () => {
    const a = getScoreboardAttachment({
      text: '',
      'com.professorbutts.sports.attachment': {game: GAME_URI, snapshot},
    })
    expect(a?.game).toBe(GAME_URI)
  })

  it('reads the new field name, preferring it over the old one', () => {
    const a = getScoreboardAttachment({
      'com.professorbutts.sports.scoreboard': {
        game: GAME_URI,
        snapshot: {...snapshot, homeScore: 1},
      },
      'com.professorbutts.sports.attachment': {game: GAME_URI, snapshot},
    })
    expect(a?.kind === 'game' && a.snapshot.homeScore).toBe(1)
  })

  it('ignores posts without one', () => {
    expect(getScoreboardAttachment({text: 'hi'})).toBeUndefined()
  })

  it('rejects other collections and bad snapshots', () => {
    expect(
      getScoreboardAttachment({
        'com.professorbutts.sports.attachment': {
          game: 'at://did:plc:abc/app.bsky.feed.post/123',
          snapshot,
        },
      }),
    ).toBeUndefined()
    expect(
      getScoreboardAttachment({
        'com.professorbutts.sports.attachment': {
          game: GAME_URI,
          snapshot: {status: 'live'},
        },
      }),
    ).toBeUndefined()
  })
})

describe('snapshot', () => {
  it('lays the posted score over the live game', () => {
    const v = applySnapshot(game, snapshot)
    expect(v.home.score).toBe(7)
    expect(v.away.score).toBe(10)
    expect(v.home.name).toBe('Steelers')
    expect(v.isSnapshot).toBe(true)
    expect(hasChangedSinceSnapshot(game, snapshot)).toBe(true)
  })

  it('reports no change when the game matches', () => {
    expect(
      hasChangedSinceSnapshot(game, {
        ...snapshot,
        homeScore: 14,
        awayScore: 17,
        period: game.period,
        clock: game.clock,
      }),
    ).toBe(false)
  })
})

describe('getAltText', () => {
  it('describes the whole live card', () => {
    expect(getAltText({...game, isSnapshot: false})).toBe(
      'Scoreboard. NFL. Bengals (6-3) at Steelers (5-4). Live. Bengals 17, Steelers 14. 3rd quarter, 4:32 left. Bengals ball, 3rd and 7 at the PIT 42. Live score.',
    )
  })

  it('describes a final', () => {
    expect(getAltText({...game, status: 'final', isSnapshot: true})).toContain(
      'Final. Bengals 17, Steelers 14. Score when posted.',
    )
  })
})

describe('baseball and hockey situations', () => {
  it('labels the count, outs and runners', () => {
    expect(
      getSituationLabel({
        ...game,
        sport: 'baseball',
        situation: {
          balls: 2,
          strikes: 1,
          outs: 1,
          onFirst: true,
          onThird: true,
        },
      }),
    ).toBe('2-1, 1 out, on 1st & 3rd')
  })
  it('labels a power play and empty net', () => {
    expect(
      getSituationLabel({
        ...game,
        sport: 'hockey',
        situation: {powerPlay: 'home', emptyNet: 'away'},
      }),
    ).toBe('Power play PIT, CIN empty net')
  })
})

describe('getRefreshInterval', () => {
  const now = Date.parse('2026-11-09T17:30:00Z')
  it('polls live games and games about to start', () => {
    expect(getRefreshInterval(game, now)).toBe(15_000)
    expect(getRefreshInterval({...game, status: 'scheduled'}, now)).toBe(30_000)
  })
  it('stops for finals and far-off games', () => {
    expect(getRefreshInterval({...game, status: 'final'}, now)).toBe(false)
    expect(
      getRefreshInterval(
        {...game, status: 'scheduled'},
        now - 24 * 60 * 60_000,
      ),
    ).toBe(false)
  })
})

describe('getLogoUri', () => {
  it('only allows https logo URLs', () => {
    const repo = {did: 'did:plc:x'}
    expect(
      getLogoUri({...game.home, logoUrl: 'http://evil.test/a.png'}, repo),
    ).toBeUndefined()
    expect(
      getLogoUri({...game.home, logoUrl: 'https://a.espncdn.com/x.png'}, repo),
    ).toBe('https://a.espncdn.com/x.png')
  })
})
