import { describe, expect, it } from "vitest"

import { getPageRSSHub } from "./rsshub"

describe("getPageRSSHub", () => {
  it("deduplicates overlapping source candidates within a rule", () => {
    const rules = JSON.stringify({
      "query-test.dev": {
        _name: "Query Test",
        ".": [
          {
            title: "Foo",
            docs: "https://example.com/docs",
            source: ["/foo/:id", "/foo"],
            target: "/test/foo",
          },
        ],
      },
    })

    expect(
      getPageRSSHub({
        url: "https://query-test.dev/foo",
        html: "",
        rules,
      }).map((item) => item.path),
    ).toEqual(["/test/foo"])
  })

  it("deduplicates equivalent query constraints regardless of order", () => {
    const rules = JSON.stringify({
      "query-test.dev": {
        _name: "Query Test",
        ".": [
          {
            title: "Foo",
            docs: "https://example.com/docs",
            source: ["/foo?a=1&b=2", "/foo?b=2&a=1"],
            target: "/test/foo",
          },
        ],
      },
    })

    expect(
      getPageRSSHub({
        url: "https://query-test.dev/foo?a=1&b=2",
        html: "",
        rules,
      }).map((item) => item.path),
    ).toEqual(["/test/foo"])
  })

  it("preserves candidates with different query constraints", () => {
    const rules = {
      "query-test.dev": {
        _name: "Query Test",
        ".": [
          {
            title: "Foo",
            docs: "https://example.com/docs",
            source: ["/foo?a=:value", "/foo?b=:value"],
            target: (params) => `/test/${params.value}`,
          },
        ],
      },
    }

    expect(
      getPageRSSHub({
        url: "https://query-test.dev/foo?a=1&b=2",
        html: "",
        rules: rules as unknown as string,
      }).map((item) => item.path),
    ).toEqual(["/test/1", "/test/2"])
  })

  it("selects rules by literal query constraints", () => {
    const rules = JSON.stringify({
      "query-test.dev": {
        _name: "Query Test",
        ".": [
          {
            title: "Collection",
            docs: "https://example.com/docs",
            source: ["/lists/:id?type=season"],
            target: "/test/collection/:id",
          },
          {
            title: "Series",
            docs: "https://example.com/docs",
            source: ["/lists/:id?type=series"],
            target: "/test/series/:id",
          },
        ],
      },
    })

    expect(
      getPageRSSHub({
        url: "https://query-test.dev/lists/42?type=season",
        html: "",
        rules,
      }).map((item) => item.path),
    ).toEqual(["/test/collection/42"])
  })

  it("encodes query captures when substituting a string target path", () => {
    const rules = JSON.stringify({
      "query-test.dev": {
        _name: "Query Test",
        ".": [
          {
            title: "Search",
            docs: "https://example.com/docs",
            source: ["/search?q=:keyword"],
            target: "/test/search/:keyword",
          },
        ],
      },
    })

    expect(
      getPageRSSHub({
        url: "https://query-test.dev/search?q=hello%2Fworld%23%E4%B8%96%E7%95%8C",
        html: "",
        rules,
      }),
    ).toContainEqual(
      expect.objectContaining({
        path: "/test/search/hello%2Fworld%23%E4%B8%96%E7%95%8C",
      }),
    )
  })

  it("rejects repeated page values for literal query constraints", () => {
    const rules = JSON.stringify({
      "query-test.dev": {
        _name: "Query Test",
        ".": [
          {
            title: "Collection",
            docs: "https://example.com/docs",
            source: ["/lists/:id?type=season"],
            target: "/test/collection/:id",
          },
          {
            title: "Series",
            docs: "https://example.com/docs",
            source: ["/lists/:id?type=series"],
            target: "/test/series/:id",
          },
        ],
      },
    })

    expect(
      getPageRSSHub({
        url: "https://query-test.dev/lists/42?type=season&type=series",
        html: "",
        rules,
      }),
    ).toEqual([])
  })

  it("passes decoded query captures to function targets", () => {
    const rules = {
      "query-test.dev": {
        _name: "Query Test",
        ".": [
          {
            title: "Search",
            docs: "https://example.com/docs",
            source: ["/search?q=:keyword"],
            target: (params) => `/test/search/${params.keyword}`,
          },
        ],
      },
    }

    expect(
      getPageRSSHub({
        url: "https://query-test.dev/search?q=hello%2F%E4%B8%96%E7%95%8C",
        html: "",
        rules: rules as unknown as string,
      }),
    ).toContainEqual(
      expect.objectContaining({ path: "/test/search/hello/世界" }),
    )
  })
})
