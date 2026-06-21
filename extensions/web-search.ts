/**
 * Web search for the Codex recipe.
 *
 * gpt-5.5 supports a hosted `web_search` tool in the Codex CLI. That tool is
 * served by OpenAI's Responses API and is not available through the Pi
 * runtime, and Pi ships no native web search — so this extension provides a
 * `web_search` tool with the same name and a `query` parameter, backed by the
 * Parallel AI Search API (https://docs.parallel.ai). Requires PARALLEL_API_KEY.
 *
 * Configuration (env):
 *   PARALLEL_API_KEY            required to enable web_search
 *   PARALLEL_SEARCH_PROCESSOR   processor tier: "base" (default) or "pro"
 *   PARALLEL_SEARCH_MAX_RESULTS max results per search (default 5)
 *
 * To swap in a different backend, change the `execute` body — the tool name
 * and `query` parameter stay the same.
 */

import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const WebSearchParams = Type.Object({
  query: Type.String({ description: "The search query.", minLength: 2 }),
  allowed_domains: Type.Optional(
    Type.Array(Type.String(), {
      description: "Only include results from these domains.",
    })
  ),
  blocked_domains: Type.Optional(
    Type.Array(Type.String(), {
      description: "Never include results from these domains.",
    })
  ),
});

const PARALLEL_SEARCH_URL = "https://api.parallel.ai/v1/search";

interface ParallelSearchResult {
  url: string;
  title?: string;
  excerpts?: string[];
  publish_date?: string | null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchesDomain(host: string, domains: string[]): boolean {
  return domains.some((d) => {
    const needle = d.replace(/^www\./, "").toLowerCase();
    return host === needle || host.endsWith(`.${needle}`);
  });
}

const extension: ExtensionFactory = (pi: ExtensionAPI) => {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web for current information beyond the model's knowledge cutoff. " +
      "Returns ranked results with titles, URLs, and excerpts. Cite the URLs you rely on.",
    promptSnippet: "Search the web for up-to-date information.",
    parameters: WebSearchParams,
    async execute(_toolCallId, params, signal) {
      const apiKey = process.env.PARALLEL_API_KEY;
      if (!apiKey) {
        throw new Error(
          "web_search is unavailable: PARALLEL_API_KEY is not set. Add it to the recipe environment to enable web search via the Parallel AI Search API (https://docs.parallel.ai)."
        );
      }

      const processor = process.env.PARALLEL_SEARCH_PROCESSOR || "base";
      const maxResults = Number(process.env.PARALLEL_SEARCH_MAX_RESULTS) || 5;

      const res = await fetch(PARALLEL_SEARCH_URL, {
        method: "POST",
        signal,
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: params.query,
          search_queries: [params.query],
          processor,
          max_results: maxResults,
          max_chars_per_result: 1500,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `web_search failed: ${res.status} ${res.statusText}${
            detail ? `\n${detail.slice(0, 500)}` : ""
          }`
        );
      }
      const body = (await res.json()) as {
        search_id?: string;
        results?: ParallelSearchResult[];
      };

      let results = body.results ?? [];
      if (params.allowed_domains?.length) {
        results = results.filter((r) =>
          matchesDomain(hostOf(r.url), params.allowed_domains!)
        );
      }
      if (params.blocked_domains?.length) {
        results = results.filter(
          (r) => !matchesDomain(hostOf(r.url), params.blocked_domains!)
        );
      }

      if (results.length === 0) {
        return {
          content: [
            { type: "text", text: `No web results for: "${params.query}".` },
          ],
          details: { query: params.query, count: 0 },
        };
      }

      const blocks = results.map((r, i) => {
        const title = r.title?.trim() || r.url;
        const date = r.publish_date ? ` (published ${r.publish_date})` : "";
        const excerpt = (r.excerpts ?? []).join("\n").trim();
        return `[${i + 1}] ${title}\n${r.url}${date}\n${excerpt}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Search results for "${params.query}":\n\n${blocks.join("\n\n")}`,
          },
        ],
        details: { query: params.query, count: results.length },
      };
    },
  });
};

export default extension;
