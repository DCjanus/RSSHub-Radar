export type SourceMatch = {
  paths: string[]
  queryKey: string
  queryCaptures: Record<string, string>
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
      if (
        Object.hasOwn(queryCaptures, paramName) &&
        queryCaptures[paramName] !== value
      ) {
        return null
      }
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
  for (const [name, value] of Object.entries(queryCaptures)) {
    if (Object.hasOwn(pathParams, name) && pathParams[name] !== value) {
      return null
    }
  }

  return { ...pathParams, ...queryCaptures }
}
