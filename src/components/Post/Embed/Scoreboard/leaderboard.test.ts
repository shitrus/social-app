import {describe, expect, it} from '@jest/globals'

import {
  getLeaderboardAltText,
  getProgressLabel,
  hasLeaderboardChanged,
  pickRows,
  standingsToLeaderboard,
} from './leaderboard'
import {type Leaderboard} from './types'
import {getScoreboardAttachment} from './utils'

const URI =
  'at://did:plc:kh6nd4blegayjjicfmda2ra6/com.professorbutts.sports.leaderboard/pga-2026-wwt'

const board: Leaderboard = {
  sport: 'golf',
  league: 'PGA',
  name: 'World Wide Technology Championship',
  startsAt: '2026-11-05T12:00:00Z',
  updatedAt: '2026-11-06T20:00:00Z',
  status: 'live',
  progress: {
    $type: 'com.professorbutts.sports.defs#golfProgress',
    round: 2,
    cutLine: '-3',
  },
  standings: [
    {name: 'Player One', positionLabel: '1', toPar: -12, thru: '14'},
    {name: 'Player Two', positionLabel: 'T2', toPar: -10, thru: 'F'},
    {name: 'Player Three', positionLabel: 'T2', toPar: -10, thru: '12'},
    {name: 'Player Four', positionLabel: '4', toPar: -9, thru: '9'},
  ],
}

describe('leaderboard attachment', () => {
  it('reads a leaderboard post', () => {
    const a = getScoreboardAttachment({
      'com.professorbutts.sports.scoreboard': {
        game: URI,
        snapshot: {
          $type: 'com.professorbutts.sports.defs#leaderboardSnapshot',
          capturedAt: '2026-11-06T19:00:00Z',
          status: 'live',
          standings: board.standings,
        },
        highlight: ['Player Four'],
      },
    })
    expect(a?.kind).toBe('leaderboard')
    expect(a?.kind === 'leaderboard' && a.highlight).toEqual(['Player Four'])
  })
})

describe('pickRows', () => {
  it('shows the top three', () => {
    expect(pickRows(board.standings, []).map(r => r.entrant.name)).toEqual([
      'Player One',
      'Player Two',
      'Player Three',
    ])
  })
  it('pins a highlighted entrant below the top three', () => {
    expect(
      pickRows(board.standings, ['player four']).map(r => r.entrant.name),
    ).toEqual(['Player One', 'Player Two', 'Player Four'])
  })
})

describe('standings', () => {
  const constructors: Leaderboard = standingsToLeaderboard({
    sport: 'motorsport',
    league: 'F1',
    name: "Constructors' Championship",
    season: '2026',
    afterEvent: 'Mexico City GP',
    updatedAt: '2026-11-02T00:00:00Z',
    standings: [
      {name: 'Mercedes', position: 1, score: '600 pts'},
      {name: 'Ferrari', position: 2, score: '520 pts'},
      {name: 'Red Bull', position: 3, score: '480 pts'},
      {
        name: 'McLaren',
        position: 4,
        score: '450 pts',
        members: [
          {name: 'Lando Norris', position: 5, score: '240 pts'},
          {name: 'Oscar Piastri', position: 7, score: '210 pts'},
        ],
      },
    ],
  })
  it('shows a highlighted constructor with its drivers', () => {
    const rows = pickRows(constructors.standings, ['McLaren'])
    expect(rows.map(r => [r.entrant.name, r.position, r.member])).toEqual([
      ['McLaren', '4', false],
      ['Lando Norris', '5', true],
      ['Oscar Piastri', '7', true],
    ])
  })
  it('describes standings', () => {
    expect(
      getLeaderboardAltText({...constructors, isSnapshot: false}, ['McLaren']),
    ).toBe(
      "Leaderboard. F1, 2026, 2026 Constructors' Championship. Standings after Mexico City GP. 4: McLaren, 450 pts. Driver Lando Norris, P5, 240 pts. Driver Oscar Piastri, P7, 210 pts. Current standings.",
    )
  })
})

describe('progress and alt text', () => {
  it('labels golf and racing progress', () => {
    expect(getProgressLabel(board.progress)).toBe('Round 2 · Cut -3')
    expect(
      getProgressLabel({lap: 187, totalLaps: 267, stage: 3, flag: 'yellow'}),
    ).toBe('Stage 3 · Lap 187/267 · Yellow flag')
  })
  it('describes the card fully', () => {
    expect(getLeaderboardAltText({...board, isSnapshot: false})).toBe(
      'Leaderboard. PGA, World Wide Technology Championship. Live, Round 2 · Cut -3. 1: Player One, -12, Thru 14. T2: Player Two, -10, F. T2: Player Three, -10, Thru 12. Live standings.',
    )
  })
  it('notices a changed top of the board', () => {
    const snap = {
      capturedAt: '',
      status: 'live',
      standings: board.standings,
      progress: board.progress,
    }
    expect(hasLeaderboardChanged(board, snap)).toBe(false)
    expect(
      hasLeaderboardChanged(
        {...board, standings: [board.standings[1], board.standings[0]]},
        snap,
      ),
    ).toBe(true)
  })
})
