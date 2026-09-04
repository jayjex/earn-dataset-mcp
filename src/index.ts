#!/usr/bin/env node
/**
 * earn-dataset-mcp — MCP server over a static snapshot of Superteam Earn listings.
 *
 * Pure local data: 28 open listings with full description text, harvested from
 * superteam.fun on 2026-09-04. No network calls at runtime, so the tools never
 * fail on upstream outages and respond instantly.
 *
 * Tools:
 *  - list_listings()            — every listing: title, reward, token, deadline
 *  - get_listing(id_or_title)   — one listing, full description text
 *  - search_listings(query)     — keyword search over title + description
 *  - stats()                    — totals, reward range, token mix, soonest deadlines
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LISTINGS, HARVESTED_AT, RawListing } from "./data.js";

interface Listing {
  slug: string;
  title: string;
  reward: number | null;
  token: string;
  deadline: string;
  desc: string;
}

const LISTINGS_BY_KEY = new Map<string, Listing>();
for (const raw of LISTINGS as RawListing[]) {
  const l: Listing = { ...raw };
  LISTINGS_BY_KEY.set(l.slug.toLowerCase(), l);
  LISTINGS_BY_KEY.set(l.title.toLowerCase(), l);
}

function findListing(idOrTitle: string): Listing | undefined {
  const key = idOrTitle.trim().toLowerCase();
  const direct = LISTINGS_BY_KEY.get(key);
  if (direct) return direct;
  // exact-title match, then unique substring match on slug or title
  for (const l of LISTINGS as RawListing[]) if (l.title.toLowerCase() === key) return l as Listing;
  const partial = [...LISTINGS_BY_KEY.entries()].filter(([k]) => k.includes(key));
  if (partial.length === 1) return partial[0][1];
  return undefined;
}

function summarize(l: Listing) {
  return {
    slug: l.slug,
    title: l.title,
    reward: l.reward,
    token: l.token,
    deadline: l.deadline,
    url: `https://superteam.fun/earn/listing/${l.slug}`,
    listingId: l.slug, // accepted by get_listing
  };
}

function search(query: string): Listing[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored: Array<{ l: Listing; s: number }> = [];
  for (const raw of LISTINGS as RawListing[]) {
    const l = raw as Listing;
    const hay = (l.title + "\n" + l.desc).toLowerCase();
    let s = 0;
    for (const t of terms) {
      const inTitle = l.title.toLowerCase().includes(t);
      const count = hay.split(t).length - 1;
      if (!inTitle && count === 0) { s = -1; break; }
      if (inTitle) s += 3;
      s += Math.min(count, 10);
    }
    if (s > 0) scored.push({ l, s });
  }
  return scored.sort((a, b) => b.s - a.s).map((x) => x.l);
}

const server = new McpServer(
  { name: "earn-dataset-mcp", version: "1.0.0" },
  { instructions:
      "Search and inspect a static snapshot of Superteam Earn (superteam.fun) bounty listings — 28 open listings with full description text, harvested 2026-09-04. " +
      "All data is local; calls are instant and never fail on upstream outages. Use search_listings for keyword queries, get_listing for one listing's full text, " +
      "list_listings for the index, stats for dataset shape." }
);

server.tool(
  "list_listings",
  "List all 28 Superteam Earn listings in the dataset (snapshot 2026-09-04): title, reward, token, deadline, URL.",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify({
        dataset: "superteam-earn-listings",
        harvestedAt: HARVESTED_AT,
        count: (LISTINGS as RawListing[]).length,
        listings: (LISTINGS as RawListing[]).map(summarize),
      }, null, 2),
    }],
  })
);

server.tool(
  "get_listing",
  "Get one listing by slug, exact title, or unique title fragment — returns the FULL description text (sponsor brief, submission requirements, judging criteria).",
  { idOrTitle: z.string().describe("Listing slug, exact title, or unique title fragment, e.g. 'breakpoint-2026' or 'Create Content for Breakpoint 2026'") },
  async ({ idOrTitle }) => {
    const l = findListing(idOrTitle);
    if (!l) {
      const matches = (LISTINGS as RawListing[]).filter((x) => x.title.toLowerCase().includes(idOrTitle.trim().toLowerCase())).map((x) => x.title);
      return { content: [{ type: "text", text: JSON.stringify({
        error: `No listing matches '${idOrTitle}'.`,
        hint: "Use list_listings() for the index, or try a slug fragment.",
        similarTitles: matches.slice(0, 5),
      }, null, 2) }] };
    }
    return { content: [{ type: "text", text: JSON.stringify({ ...summarize(l), description: l.desc }, null, 2) }] };
  }
);

server.tool(
  "search_listings",
  "Keyword search across all listing titles and full description texts. All terms must match; results ranked by term frequency (title hits weigh more).",
  { query: z.string().describe("Keywords, e.g. 'content Solana' or 'QA tester'") },
  async ({ query }) => {
    const results = search(query);
    return { content: [{ type: "text", text: JSON.stringify({
      query,
      matches: results.length,
      listings: results.map((l) => ({ ...summarize(l), snippet: l.desc.slice(0, 300) })),
    }, null, 2) }] };
  }
);

server.tool(
  "stats",
  "Dataset shape: listing count, harvest date, total reward pool, reward range, token mix, soonest deadlines.",
  {},
  async () => {
    const ls = LISTINGS as RawListing[];
    const rewards = ls.map((l) => l.reward).filter((r): r is number => typeof r === "number" && r > 0);
    const tokens: Record<string, number> = {};
    for (const l of ls) tokens[l.token] = (tokens[l.token] || 0) + 1;
    const soonest = [...ls].sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 5);
    return { content: [{ type: "text", text: JSON.stringify({
      dataset: "superteam-earn-listings",
      harvestedAt: HARVESTED_AT,
      listings: ls.length,
      withStatedReward: rewards.length,
      totalRewardPoolUsd: rewards.reduce((a, b) => a + b, 0),
      minReward: rewards.length ? Math.min(...rewards) : null,
      maxReward: rewards.length ? Math.max(...rewards) : null,
      tokenMix: tokens,
      soonestDeadlines: soonest.map((l) => ({ title: l.title, deadline: l.deadline, reward: l.reward, token: l.token })),
      note: "Rewards are denominated in the listed token; USD face value at harvest time. 2 listings have no stated reward (project-dependent pay).",
    }, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
