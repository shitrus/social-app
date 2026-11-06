import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {
  getEntrantDetail,
  getEntrantScore,
  getPositionLabel,
  getProgressLabel,
  isHighlighted,
  isLeaderboardLive,
  pickRows,
} from './leaderboard'
import {type Entrant, type LeaderboardView} from './types'
import {formatGameDate, formatKickoff} from './utils'

/*
 * Three 24px rows with 4px gaps fill the same 80px that two 36px team rows
 * and their gap take on a game card, so both card types are one height.
 */
const ROW_HEIGHT = 24
const ROW_GAP = 4

/** Leaderboard card contents: header, top three rows, status line. */
export function LeaderboardBody({
  board,
  highlight,
}: {
  board: LeaderboardView
  highlight: string[]
}) {
  const t = useTheme()
  const rows = pickRows(board.standings, highlight)
  const status = getStatusLine(board)
  return (
    <>
      <View
        style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Text
          emoji
          numberOfLines={1}
          style={[
            a.flex_1,
            a.text_xs,
            a.font_semi_bold,
            t.atoms.text_contrast_medium,
          ]}>
          {[board.league, board.name].filter(Boolean).join(' · ')}
        </Text>
        <LeaderboardPill board={board} />
      </View>
      <View
        style={[{gap: ROW_GAP, height: ROW_HEIGHT * 3 + ROW_GAP * 2}]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {rows.map((e, i) => (
          <EntrantRow
            key={`${e.name}-${i}`}
            entrant={e}
            position={getPositionLabel(
              e,
              Math.max(board.standings.indexOf(e), i),
            )}
            highlighted={isHighlighted(e, highlight)}
          />
        ))}
      </View>
      <Text
        numberOfLines={1}
        style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {status || ' '}
      </Text>
    </>
  )
}

function getStatusLine(board: LeaderboardView) {
  const progress = getProgressLabel(board.progress)
  if (board.status === 'final') {
    return [formatGameDate(board.endsAt ?? board.startsAt), board.venue]
      .filter(Boolean)
      .join(' · ')
  }
  return progress ?? board.venue
}

function LeaderboardPill({board}: {board: LeaderboardView}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const live = board.status === 'live' && !board.isSnapshot
  let label: string
  switch (board.status) {
    case 'live':
      label = l`LIVE`
      break
    case 'suspended':
      label = l`SUSPENDED`
      break
    case 'final':
      label = l`FINAL`
      break
    case 'postponed':
      label = l`POSTPONED`
      break
    case 'canceled':
      label = l`CANCELED`
      break
    default:
      label = formatKickoff(board.startsAt) ?? l`SCHEDULED`
  }
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_xs,
        a.rounded_full,
        a.px_sm,
        {paddingVertical: 2},
        live
          ? {backgroundColor: t.palette.negative_500}
          : t.atoms.bg_contrast_50,
      ]}>
      {live && (
        <View
          style={[
            a.rounded_full,
            {width: 6, height: 6, backgroundColor: '#ffffff'},
          ]}
        />
      )}
      <Text
        style={[
          a.text_2xs,
          a.font_bold,
          live ? {color: '#ffffff'} : t.atoms.text,
          isLeaderboardLive(board.status) &&
            board.isSnapshot &&
            t.atoms.text_contrast_medium,
        ]}>
        {label}
      </Text>
    </View>
  )
}

function EntrantRow({
  entrant,
  position,
  highlighted,
}: {
  entrant: Entrant
  position: string
  highlighted: boolean
}) {
  const t = useTheme()
  const color =
    entrant.color && /^#[0-9a-fA-F]{6}$/.test(entrant.color)
      ? entrant.color
      : undefined
  const score = getEntrantScore(entrant)
  const detail = getEntrantDetail(entrant)
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.rounded_sm,
        {height: ROW_HEIGHT, marginHorizontal: -4, paddingHorizontal: 4},
        highlighted && {backgroundColor: t.palette.primary_50},
      ]}>
      <Text
        style={[
          a.text_sm,
          a.font_bold,
          {width: 32, fontVariant: ['tabular-nums']},
        ]}>
        {position}
      </Text>
      <View
        style={[
          a.rounded_full,
          {
            width: 3,
            height: 16,
            backgroundColor: color ?? t.palette.contrast_200,
          },
        ]}
      />
      <View style={[a.flex_1, a.flex_row, a.align_baseline, a.gap_xs]}>
        {entrant.number ? (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {`#${entrant.number}`}
          </Text>
        ) : null}
        <Text
          emoji
          numberOfLines={1}
          style={[a.flex_shrink, a.text_sm, a.font_semi_bold]}>
          {entrant.name}
        </Text>
        {entrant.team ? (
          <Text
            numberOfLines={1}
            style={[a.flex_shrink, a.text_xs, t.atoms.text_contrast_medium]}>
            {entrant.team}
          </Text>
        ) : null}
      </View>
      {detail ? (
        <Text
          numberOfLines={1}
          style={[a.text_xs, t.atoms.text_contrast_medium, {minWidth: 48}]}>
          {detail}
        </Text>
      ) : null}
      <Text
        style={[
          a.text_md,
          a.font_bold,
          {minWidth: 48, textAlign: 'right', fontVariant: ['tabular-nums']},
        ]}>
        {score ?? ''}
      </Text>
    </View>
  )
}
