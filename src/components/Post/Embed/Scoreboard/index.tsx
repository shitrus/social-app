import {useState} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Image} from 'expo-image'
import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Eye_Stroke2_Corner0_Rounded as EyeIcon} from '#/components/icons/Eye'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {type Attachment, type Competitor, type GameView} from './types'
import {useGameQuery} from './useGameQuery'
import {
  applySnapshot,
  formatGameDate,
  formatKickoff,
  getAltText,
  getLogoUri,
  getPeriodLabel,
  getPossessionEmoji,
  getRoundLabel,
  getSituationLabel,
  getTeamColor,
  hasChangedSinceSnapshot,
  isInProgress,
  teamName,
} from './utils'

export {getScoreboardAttachment} from './utils'

const FOOTER_HEIGHT = 44
/** Matches the drawn card (body plus footer) so loading doesn't shift the feed. */
const CARD_HEIGHT = 153 + FOOTER_HEIGHT

/**
 * Live scoreboard for posts that carry a com.professorbutts.sports.attachment.
 * Shows the score from when the post was made first, so readers see what the
 * poster was reacting to, and reveals the live score on tap. Renders
 * `fallback` (the normal link card) if the game record can't be loaded.
 */
export function ScoreboardEmbed({
  attachment,
  link,
  fallback,
  onOpen,
  style,
}: {
  attachment: Attachment
  link: app.bsky.embed.external.ViewExternal
  fallback: React.ReactNode
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const [showLive, setShowLive] = useState(false)
  const {data: game, isError, pds, did} = useGameQuery(attachment.game)

  if (isError && !game) return <>{fallback}</>
  if (!game || !did) {
    return (
      <View
        style={[
          a.w_full,
          a.rounded_lg,
          a.border,
          t.atoms.border_contrast_low,
          t.atoms.bg_contrast_25,
          {height: CARD_HEIGHT},
          style,
        ]}
        accessibilityLabel={attachment.alt}
        accessibilityHint={l`Loading the live scoreboard`}
      />
    )
  }

  const changed = hasChangedSinceSnapshot(game, attachment.snapshot)
  const view: GameView =
    showLive || !changed
      ? {...game, isSnapshot: false}
      : applySnapshot(game, attachment.snapshot)
  const alt = getAltText(view)
  const repo = {did, pds}

  return (
    <View
      style={[
        a.w_full,
        a.rounded_lg,
        a.border,
        t.atoms.border_contrast_low,
        style,
      ]}>
      <Link
        testID="scoreboardEmbed"
        to={link.uri}
        label={alt}
        onPress={() => {
          haptics.tap()
          onOpen?.()
        }}
        style={[a.w_full, a.rounded_lg]}>
        {({hovered, focused, pressed}) => (
          <View
            style={[
              a.w_full,
              a.p_md,
              a.gap_sm,
              a.rounded_lg,
              hovered || focused || pressed
                ? t.atoms.bg_contrast_25
                : t.atoms.bg,
            ]}>
            <Header game={view} />
            <TeamRow game={view} side="away" repo={repo} />
            <TeamRow game={view} side="home" repo={repo} />
            <StatusLine game={view} />
          </View>
        )}
      </Link>
      {/*
       * The footer is always drawn, with or without the toggle, so every card
       * is the same height whatever the sport or game state.
       */}
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.gap_sm,
          a.px_md,
          a.border_t,
          t.atoms.border_contrast_low,
          {height: FOOTER_HEIGHT},
        ]}>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {view.isSnapshot ? l`Score when posted` : l`Live score`}
        </Text>
        {changed && (
          <Button
            label={
              view.isSnapshot
                ? l`Show the live score`
                : l`Show the score when this was posted`
            }
            size="tiny"
            color="secondary"
            onPress={() => {
              haptics.tap()
              setShowLive(v => !v)
            }}>
            {view.isSnapshot && <ButtonIcon icon={EyeIcon} />}
            <ButtonText>
              {view.isSnapshot ? l`Show live` : l`Show when posted`}
            </ButtonText>
          </Button>
        )}
      </View>
    </View>
  )
}

function Header({game}: {game: GameView}) {
  const t = useTheme()
  const round = getRoundLabel(game)
  return (
    <View
      style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text
        numberOfLines={1}
        style={[
          a.flex_1,
          a.text_xs,
          a.font_semi_bold,
          t.atoms.text_contrast_medium,
        ]}>
        {[game.league, round].filter(Boolean).join(' · ')}
      </Text>
      <StatusPill game={game} />
    </View>
  )
}

function StatusPill({game}: {game: GameView}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const live = isInProgress(game.status)
  let label: string
  switch (game.status) {
    case 'live':
      label = l`LIVE`
      break
    case 'halftime':
      label = l`HALFTIME`
      break
    case 'final':
      label = /OT/i.test(game.period?.label || '') ? l`FINAL/OT` : l`FINAL`
      break
    case 'postponed':
      label = l`POSTPONED`
      break
    case 'canceled':
      label = l`CANCELED`
      break
    default:
      label = formatKickoff(game.startsAt) ?? l`SCHEDULED`
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
        live && !game.isSnapshot
          ? {backgroundColor: t.palette.negative_500}
          : t.atoms.bg_contrast_50,
      ]}>
      {live && !game.isSnapshot && (
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
          live && !game.isSnapshot ? {color: '#ffffff'} : t.atoms.text,
        ]}>
        {label}
      </Text>
    </View>
  )
}

function TeamRow({
  game,
  side,
  repo,
}: {
  game: GameView
  side: 'home' | 'away'
  repo: {did: string; pds?: string}
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const team: Competitor = game[side]
  const other: Competitor = game[side === 'home' ? 'away' : 'home']
  const logo = getLogoUri(team, repo)
  const color = getTeamColor(team) ?? t.palette.contrast_300
  const ball = getPossessionEmoji(game.sport)
  const hasBall =
    isInProgress(game.status) && game.situation?.possession === side
  const lost = game.status === 'final' && team.score < other.score
  const showScore = game.status !== 'scheduled'

  return (
    <View
      style={[a.flex_row, a.align_center, a.gap_sm, {height: 36}]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View
        style={[a.rounded_full, {width: 4, height: 32, backgroundColor: color}]}
      />
      {logo ? (
        <Image
          source={{uri: logo}}
          style={{width: 32, height: 32}}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          alt={l`${teamName(team)} logo`}
        />
      ) : (
        <View style={{width: 32, height: 32}} />
      )}
      <View style={[a.flex_1, a.flex_row, a.align_baseline, a.gap_xs]}>
        {team.rank ? (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {team.rank}
          </Text>
        ) : null}
        <Text
          emoji
          numberOfLines={1}
          style={[
            a.flex_shrink,
            a.text_md,
            a.font_semi_bold,
            lost && t.atoms.text_contrast_medium,
          ]}>
          {teamName(team)}
        </Text>
        {team.record ? (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {team.record}
          </Text>
        ) : null}
        {hasBall && ball && <Text style={[a.text_xs]}>{ball}</Text>}
      </View>
      {showScore && (
        <Text
          style={[
            a.text_2xl,
            a.font_bold,
            {fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right'},
            lost && t.atoms.text_contrast_medium,
          ]}>
          {team.score}
        </Text>
      )}
    </View>
  )
}

function StatusLine({game}: {game: GameView}) {
  const t = useTheme()
  const {t: l} = useLingui()
  let parts: (string | undefined)[]
  if (game.status === 'live') {
    parts = [getPeriodLabel(game.period), game.clock, getSituationLabel(game)]
  } else if (game.status === 'halftime') {
    parts = [l`Halftime`]
  } else if (game.status === 'final') {
    parts = [formatGameDate(game.startsAt), game.venue]
  } else {
    parts = [game.venue]
  }
  /*
   * Always drawn, with a blank line when there's nothing to say, so the card
   * keeps one fixed height.
   */
  const text = parts.filter(Boolean).join(' \u00b7 ') || '\u00a0'
  return (
    <Text
      numberOfLines={1}
      style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {text}
    </Text>
  )
}
