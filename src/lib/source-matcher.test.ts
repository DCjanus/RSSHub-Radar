import { describe, expect, it } from "vitest"

import { matchSource, mergeSourceParams } from "./source-matcher"

describe("matchSource", () => {
  it.each([
    ["keeps queryless rules compatible", "/lists/:id", "/lists/42", true],
    [
      "normalizes optional path segments before parsing query constraints",
      "/:lang?/lists/:id?type=season",
      "/en/lists/42?type=season",
      true,
    ],
    [
      "matches a literal query value",
      "/lists/:id?type=season",
      "/lists/42?type=season",
      true,
    ],
    [
      "rejects a different query value",
      "/lists/:id?type=season",
      "/lists/42?type=series",
      false,
    ],
    [
      "allows extra page query parameters",
      "/lists/:id?type=season",
      "/lists/42?from=space&type=season",
      true,
    ],
    [
      "ignores query parameter order",
      "/lists/:id?type=season&view=grid",
      "/lists/42?view=grid&type=season",
      true,
    ],
    [
      "requires every declared query parameter",
      "/lists/:id?type=season&view=grid",
      "/lists/42?type=season",
      false,
    ],
    ["rejects an empty placeholder", "/search?q=:keyword", "/search?q=", false],
    [
      "rejects ambiguous repeated page values",
      "/search?q=:keyword",
      "/search?q=first&q=second",
      false,
    ],
    [
      "rejects repeated keys in a source rule",
      "/search?tag=fixed&tag=:tag",
      "/search?tag=fixed&tag=dynamic",
      false,
    ],
    [
      "rejects query-aware source rules with fragments",
      "/foo?type=season#tab-a",
      "/foo?type=season#tab-a",
      false,
    ],
  ])("%s", (_, source, page, matches) => {
    expect(
      matchSource(source, new URL(page, "https://example.com")) !== null,
    ).toBe(matches)
  })

  it("extracts decoded query placeholders", () => {
    const match = matchSource(
      "/search?q=:keyword",
      new URL("https://example.com/search?q=hello%2F%E4%B8%96%E7%95%8C"),
    )

    expect(match?.queryCaptures).toEqual({ keyword: "hello/世界" })
  })

  it("accepts identical values captured by the same query placeholder", () => {
    const match = matchSource(
      "/foo?a=:id&b=:id",
      new URL("https://example.com/foo?a=1&b=1"),
    )

    expect(match?.queryCaptures).toEqual({ id: "1" })
  })

  it("rejects conflicting values captured by the same query placeholder", () => {
    expect(
      matchSource(
        "/foo?a=:id&b=:id",
        new URL("https://example.com/foo?a=1&b=2"),
      ),
    ).toBeNull()
  })

  it.each(["constructor", "toString", "__proto__"])(
    "captures the Object.prototype key %s",
    (paramName) => {
      const match = matchSource(
        `/foo?value=:${paramName}`,
        new URL("https://example.com/foo?value=1"),
      )

      expect(match).not.toBeNull()
      expect(match?.queryCaptures[paramName]).toBe("1")
      expect(mergeSourceParams({}, match!.queryCaptures)).toEqual({
        [paramName]: "1",
      })
    },
  )

  it("preserves trailing-path partial matching for query-aware rules", () => {
    const match = matchSource(
      "/lists/:id/:page?type=series",
      new URL("https://example.com/lists/42?type=series"),
    )

    expect(match?.paths).toEqual(["/lists/:id/:page", "/lists/:id", "/lists"])
  })

  it("normalizes optional path segments before parsing query constraints", () => {
    const match = matchSource(
      "/:lang?/lists/:id?type=season",
      new URL("https://example.com/en/lists/42?type=season"),
    )

    expect(match?.paths).toEqual(["/:lang/lists/:id", "/:lang/lists"])
  })

  it("supports a trailing optional segment before query constraints", () => {
    const match = matchSource(
      "/foo/:id??type=season",
      new URL("https://example.com/foo?type=season"),
    )

    expect(match?.paths).toEqual(["/foo/:id", "/foo"])
  })

  it("rejects malformed source URLs", () => {
    expect(
      matchSource("http://[", new URL("https://example.com/foo")),
    ).toBeNull()
  })
})

describe("mergeSourceParams", () => {
  it("accepts an identical pathname and query capture", () => {
    const sourceMatch = matchSource(
      "/user/:id?uid=:id",
      new URL("https://example.com/user/123?uid=123"),
    )

    expect(
      mergeSourceParams({ id: "123" }, sourceMatch!.queryCaptures),
    ).toEqual({ id: "123" })
  })

  it("rejects conflicting pathname and query captures", () => {
    const sourceMatch = matchSource(
      "/user/:id?uid=:id",
      new URL("https://example.com/user/123?uid=456"),
    )

    expect(
      mergeSourceParams({ id: "123" }, sourceMatch!.queryCaptures),
    ).toBeNull()
  })
})
