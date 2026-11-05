# GoalSeer — Vercel deployment

## What is ready
- Next.js 16 App Router project restored from the uploaded pages, routes, components and CSS.
- Missing shared modules reconstructed: dates, prediction engine, ESPN feed, queries, board loader, UI primitives, header, optional DB layer.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- No required environment variables. `DATABASE_URL` is optional.

## Deploy from Vercel Dashboard
1. Push this folder to a GitHub/GitLab/Bitbucket repository, or use Vercel CLI below.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework preset should be **Next.js**.
4. Build command: `npm run build`
5. Install command: `npm install`
6. Output directory: leave default / empty for Next.js.
7. Environment variables: none required. Optionally add `DATABASE_URL`.
8. Deploy.

## Deploy with Vercel CLI
```bash
npm i -g vercel
vercel login
vercel deploy --prod --yes
```

If you want a custom project name:
```bash
vercel deploy --prod --yes --name goalseer
```
Note: newer Vercel CLI versions may require linking/creating the project first:
```bash
vercel link
vercel deploy --prod
```

## After deployment
Check:
- `/`
- `/api/health`
- `/api/predictions`
- `/leagues`
- `/accuracy`

The app uses public ESPN endpoints at runtime. If ESPN is unreachable, it falls back to deterministic simulated fixtures.
