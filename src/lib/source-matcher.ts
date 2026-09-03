export type SourceMatch = {
  paths: string[]
  queryKey: string
  queryCaptures: Record<string, string>
}

const warnedInvalidSources = new Set<string>()

function warnDuplicatePlaceholder(source: string, paramName: string) {
  if (warnedInvalidSources.has(source)) {
    return
  }
  warnedInvalidSources.add(source)
  console.warn(
    `Invalid Radar source "${source}": duplicate placeholder "${paramName}"`,
  )
}

export function matchSource(source: string, url: URL): SourceMatch | null {
  // route-recognizer does not support optional segments, so normalize the
  // source syntax before handing it to the URL parser.
  // For example, "/foo/:id??type=season" becomes "/foo/:id?type=season".
  const normalizedSource = source.replace(/(\/:\w+)\?(?=\/|\?|$)/g, "$1")
  let sourceUrl
  try {
    sourceUrl = new URL(normalizedSource, url.origin)
  } catch {
    return null
  }
  if (sourceUrl.search && sourceUrl.hash) {
    return null
  }
  const placeholderNames = new Set<string>()
  for (const match of sourceUrl.pathname.matchAll(/\/:(\w+)/g)) {
    const paramName = match[1]
    if (placeholderNames.has(paramName)) {
      warnDuplicatePlaceholder(source, paramName)
      return null
    }
    placeholderNames.add(paramName)
  }

  const queryCaptures: Record<string, string> = Object.create(null)
  const queryKeys = new Set<string>()

  for (const [key, expectedValue] of sourceUrl.searchParams) {
    if (queryKeys.has(key)) {
      return null
    }
    queryKeys.add(key)

    const actualValues = url.searchParams.getAll(key)
    if (actualValues.length !== 1) {
      return null
    }

    const paramName = expectedValue.match(/^:(\w+)$/)?.[1]

    if (paramName) {
      const value = actualValues[0]
      if (!value) {
        return null
      }
      if (placeholderNames.has(paramName)) {
        warnDuplicatePlaceholder(source, paramName)
        return null
      }
      placeholderNames.add(paramName)
      queryCaptures[paramName] = value
    } else if (actualValues[0] !== expectedValue) {
      return null
    }
  }

  // Preserve queryless sources so URL parsing does not discard legacy hash routes.
  let path = sourceUrl.search ? sourceUrl.pathname : normalizedSource

  const paths = [path]
  let tailMatch
  do {
    tailMatch = path.match(/\/:\w+$/)
    if (tailMatch) {
      path = path.slice(0, path.length - tailMatch[0].length)
      paths.push(path)
    }
  } while (tailMatch)

  const queryKey = new URLSearchParams(sourceUrl.searchParams)
  queryKey.sort()

  return {
    paths,
    queryKey: queryKey.toString(),
    queryCaptures,
  }
}

export function mergeSourceParams(
  pathParams: Record<string, unknown>,
  queryCaptures: Record<string, string>,
): Record<string, unknown> | null {
  for (const name of Object.keys(queryCaptures)) {
    if (Object.hasOwn(pathParams, name)) {
      return null
    }
  }

  return { ...pathParams, ...queryCaptures }
}
