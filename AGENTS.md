<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- All data access goes through `src/lib/api.ts`; UI never imports `src/lib/mock/*` directly. Why: a real backend plugs in by changing only that file (`VITE_USE_MOCK=false`, `VITE_API_URL`).
- Mock data and the mock hybrid classifier live in `src/lib/mock/`; they are deterministic (seeded) so the UI and tests behave consistently.
- Shared domain types live in `src/types/index.ts`; TanStack Query hooks wrapping the API live in `src/hooks/use-smartlog.ts`. Why: one typed contract between UI and backend.
- Page bodies live in their route files under `src/routes/` (no `src/pages/`); reusable UI lives in `src/components/smartlog/` and `src/components/layout/`. Why: TanStack file routing is fixed for this stack.
- Data is fetched client-side with `useQuery` (no SSR loaders) because mock timestamps are relative to "now" and would mismatch between server and client renders.
- Severity/category colors come from the `--sev-*` / `--chart-*` tokens in `src/styles.css` via `src/lib/constants.ts`; never hardcode colors in components.
