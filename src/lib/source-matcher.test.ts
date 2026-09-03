import { describe, expect, it, vi } from "vitest"

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
      "rejects repeated query placeholder names",
      "/foo?a=:id&b=:id",
      "/foo?a=1&b=1",
      false,
    ],
    [
      "rejects repeated pathname placeholder names",
      "/foo/:id/:id",
      "/foo/1/1",
      false,
    ],
    [
      "rejects placeholder names shared by pathname and query",
      "/user/:id?uid=:id",
      "/user/123?uid=123",
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

  it("warns once for a source with duplicate placeholder names", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const source = "/warning/:id?uid=:id"
    const page = new URL("https://example.com/warning/1?uid=1")

    matchSource(source, page)
    matchSource(source, page)

    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      `Invalid Radar source "${source}": duplicate placeholder "id"`,
    )
    warn.mockRestore()
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
  it("rejects overlapping pathname and query capture names", () => {
    expect(mergeSourceParams({ id: "123" }, { id: "123" })).toBeNull()
  })
})
