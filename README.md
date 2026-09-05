# earn-dataset-mcp

MCP server over a static snapshot of Superteam Earn (superteam.fun) bounty listings: 28 open listings with their **full description text** — sponsor briefs, submission requirements, judging criteria — harvested 2026-09-04.

The data ships inside the package. No network calls at runtime, so the tools respond instantly and never fail on an upstream outage.

## Tools

| Tool | What it does |
|---|---|
| `list_listings()` | Index of all 28 listings: title, reward, token, deadline, URL |
| `get_listing(id_or_title)` | One listing's complete description text. Accepts slug, exact title, or a unique title fragment |
| `search_listings(query)` | Keyword search over titles + full descriptions, ranked by term frequency |
| `stats()` | Dataset shape: count, harvest date, total reward pool ($56,705 face value), token mix, soonest deadlines |

Dataset fields per listing: `slug`, `title`, `reward`, `token`, `deadline`, `desc`. Rewards are in the listed token (15 USDG, 13 USDC); 2 listings have no stated reward.

If you want live data instead of a snapshot, see our other server, [earn-bounty-scanner](https://github.com/jayjex/earn-bounty-scanner), which fetches from superteam.fun directly.

## Hosted version

Running on [FiatDock](https://fiatdock.com) at $0.01/call: https://fiatdock.com/s/svc_7db4548f-dbf5-4f27-8e3c-31566b78ee01 (Streamable HTTP, pay-per-call via x402).

## Local setup

```bash
git clone https://github.com/jayjex/earn-dataset-mcp
cd earn-dataset-mcp
npm install
npm run build
```

## MCP client config

stdio:

```json
{
  "mcpServers": {
    "earn-dataset-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/earn-dataset-mcp/dist/index.js"]
    }
  }
}
```

Once the npm package is published, `npx -y earn-dataset-mcp` works too.

## Where the data came from

Snapshot pulled from live superteam.fun JSON endpoints on 2026-09-04, including the undocumented `/api/search/{title}` trick that returns full description text (the public cards API only exposes truncated fields). `earn-api-endpoints.txt` in the source repo maps 186+ reverse-engineered superteam.fun API routes if you want to harvest your own.

## License

MIT
