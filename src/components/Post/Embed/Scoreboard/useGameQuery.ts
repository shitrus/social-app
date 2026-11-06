import {type DidDocument, getPdsEndpoint} from '@atproto/common-web'
import {AtUri} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {type Game} from './types'
import {getRefreshInterval, isGame} from './utils'

const useRepoPdsQueryKeyRoot = 'scoreboard-repo-pds'
const useGameQueryKeyRoot = 'scoreboard-game'

async function resolvePds(did: string, signal?: AbortSignal) {
  let url: string
  if (did.startsWith('did:plc:')) {
    url = `https://plc.directory/${did}`
  } else if (did.startsWith('did:web:')) {
    const domain = did.slice('did:web:'.length)
    if (domain.includes(':')) throw new Error('Unsupported did:web')
    url = `https://${decodeURIComponent(domain)}/.well-known/did.json`
  } else {
    throw new Error('Unsupported DID method')
  }
  const res = await fetch(url, {signal})
  if (!res.ok) throw new Error(`DID lookup failed: ${res.status}`)
  const pds = getPdsEndpoint((await res.json()) as DidDocument)
  if (!pds) throw new Error('No PDS in DID document')
  return pds
}

/**
 * The PDS that hosts a repo. Game records are read straight from the
 * poster's PDS, since the appview does not index unknown collections.
 */
function useRepoPdsQuery(did: string | undefined) {
  return useQuery({
    queryKey: createQueryKey(useRepoPdsQueryKeyRoot, {did}),
    queryFn: ({signal}) => resolvePds(did!, signal),
    enabled: !!did,
    staleTime: STALE.HOURS.ONE,
    retry: 1,
  })
}

/**
 * Latest state of a com.professorbutts.sports.game record, polled while the
 * game is live or about to start.
 */
export function useGameQuery(gameUri: string | undefined) {
  const uri = gameUri ? new AtUri(gameUri) : undefined
  const did = uri?.host
  const {data: pds, error: pdsError} = useRepoPdsQuery(did)

  const query = useQuery({
    queryKey: createQueryKey(useGameQueryKeyRoot, {uri: gameUri}),
    queryFn: async ({signal}): Promise<Game> => {
      const params = new URLSearchParams({
        repo: uri!.host,
        collection: uri!.collection,
        rkey: uri!.rkey,
      })
      const res = await fetch(
        `${pds!.replace(/\/$/, '')}/xrpc/com.atproto.repo.getRecord?${params}`,
        {signal, cache: 'no-store'},
      )
      if (!res.ok) throw new Error(`getRecord failed: ${res.status}`)
      const body = (await res.json()) as {value?: unknown}
      if (!isGame(body.value)) throw new Error('Not a game record')
      return body.value
    },
    enabled: !!uri && !!pds,
    staleTime: STALE.SECONDS.FIFTEEN,
    refetchInterval: q => getRefreshInterval(q.state.data),
    retry: 1,
  })

  return {
    ...query,
    pds,
    did,
    isError: query.isError || !!pdsError,
  }
}
