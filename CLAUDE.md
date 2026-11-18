# C127 Hub: handoff notes

This file carries the context from the session that built this project. Read it
before changing anything. Last updated 2026-11-18.

## What this is

A hub for Commission 127 (C127), an Orlando-area nonprofit that helps churches
launch and lead Family Advocacy Ministries (FAMs) for foster, adoptive and
kinship families. Zane Henderson is building it with C127's leaders, Betsey and
Rechaud Bell, as "Option 2" of a two-option systems proposal.

The problem it answers, from the first meeting (2026-11-10):

- Five tools that don't talk: HubSpot (paid since March 2026, only used for
  newsletters), MyFam (Promise686's church/volunteer app), Aplos (gifts and
  accounting), team spreadsheets (the real source of truth), HubSpot forms.
- About 702 families, 70+ churches, coaches each assigned a set of churches.
- MyFam only holds families already connected to a church, so C127 lost its
  "closest church for an unconnected family" matching.
- About 300 people a month walk through the "Experience". The first follow-up
  email goes out and the rest do not. Follow-up should come from the coach of
  the guest's church, and differ by whether that church has a FAM.
- A state grant may require monthly reporting by county.

Option 2 as agreed: one hub that replaces both HubSpot and MyFam. Aplos stays
for accounting; the hub would read gifts from it.

## Rules that matter

- **Never commit real C127 data.** No family, child, volunteer or donor records
  in this repo, in sample data, in tests or in screenshots. Real records enter
  through the app's import screen and live only in Supabase. Keep C127's source
  files in a folder outside this repo.
- **All sample data is invented.** `lib/seed.ts` generates it from a fixed seed.
  Only the scale mirrors C127. Keep it that way.
- **Keep this repo private.** The demo password fallback is in `lib/auth.ts`.
- **Generous Giving (GG) is a separate organization** Zane also works with.
  Nothing here should touch GG's Supabase, HubSpot or reporting data.
- Build original screens. MyFam was studied only from its public pages for
  feature names; none of its code or design is copied.

## Where everything lives

| Thing | Where |
| --- | --- |
| Code | github.com/zhenderson921/c127-hub, branch `main` |
| Live site | https://c127-hub.vercel.app (Vercel redeploys on every push to `main`) |
| Database | Supabase organization "C127", project "C127-Hub", ref `wczlyobrtoywztqvqldd`, region us-east-1 |
| Two-option page | https://claude.ai/artifact/Tuu9gXQCx1iXUZTjn42Q52 |
| Slide deck (8 slides) | https://claude.ai/artifact/UktKHkrxRL4N8LRinvAtrw |

Vercel environment variables: `MAPBOX_TOKEN` (set), optional `SITE_PASSWORD`.
The Supabase URL and publishable key are public values with fallbacks in
`next.config.mjs`. The service role key and database password are not in the
repo and should never be.

## Stack and layout

Next.js 15 (App Router), React 19, TypeScript, Tailwind 3, Supabase
(`@supabase/supabase-js`, `@supabase/ssr`), Mapbox GL.

- `app/login` – sign-in page (personal sign-in and demo password)
- `app/(hub)/*` – the screens: dashboard, my-work, families, churches,
  volunteers, map, experience, care, giving, reports, import, church, serve,
  request-help
- `components/Shell.tsx` – navigation, mode banner, save-error banner
- `components/MatchMap.tsx` – Mapbox map with a drawn SVG fallback
- `lib/store.tsx` – all app state and every action; the only place that writes
- `lib/db.ts` – maps database rows to app types and back
- `lib/seed.ts` – invented sample data; `lib/match.ts` – closest-church logic;
  `lib/routing.ts` – who a guest's follow-up comes from and what it says;
  `lib/team.ts` – Care Community teams and background-check rules
- `middleware.ts` – lets a request through for a Supabase session or the demo cookie
- `supabase/migrations/*` – schema and row level security, already applied

Brand: teal `#00A499`, charcoal `#262626`, Bebas Neue for display and Figtree
for body (C127's site uses Proxima Nova, which is not free). The white logo is
`public/brand/c127-logo-white.png`.

## Two modes

- **Demo:** the shared password sets a cookie. Data is `buildSeed()` kept in the
  browser's localStorage. Nothing reads or writes the database.
- **Live:** a Supabase sign-in. `StoreProvider` loads every table the person may
  see, and each action updates the screen first, then saves. A failed save shows
  a banner and reloads the true state. A personal sign-in wins over a demo cookie.

## Database and roles

Tables: `coaches`, `churches`, `profiles`, `families`, `volunteers`, `needs`,
`guests`, `tasks`, `gifts`, `activity_log`, and the view `volunteer_hours`
(hours are counted from completed needs, never typed in).

`profiles.role` decides access, enforced by row level security:

- `staff` and `coach` see and change everything.
- `advocate` sees only their own church, its families, volunteers and needs.
  No guests, gifts, coaches or to-dos. The app also limits them to the Church view.
- Signed in with no profile row: sees nothing ("Almost there" screen).
- Not signed in: nothing.

To give someone access: add them under Authentication in the Supabase
dashboard, then insert a `profiles` row with their role (and `church_id` for an
advocate).

The database is currently **empty**: no users, no records. Test data from the
build session was removed on 2026-11-18.

## What has been tested

- Demo mode end to end in a browser, including phone width.
- Live mode against the real project with temporary staff and advocate accounts
  (since deleted): sign-in, importing churches and families, matching a family,
  adding a to-do and a guest, and reading it all back after reload.
- Access rules: 24 checks on local Postgres, then confirmed on the real project
  by querying the API directly as an advocate.
- Mapbox renders on the live site.

Not tested: Google sign-in (not built), any real C127 file through the importer.

## Known limits

- No screen to add or edit a single church, coach or volunteer by hand. They
  arrive by import. Volunteers have no import yet.
- Import takes one CSV at a time, for families or for churches and coaches.
  Records are placed on the map by town, not street address (`TOWNS` in
  `lib/seed.ts`).
- Saves run in the background, so a hard page reload within a second of a click
  can lose that change.
- Reminders (no contact in 4 weeks, call a guest) are computed in the browser,
  not stored. Nothing sends email or texts yet. "Send this follow-up" only
  records the touch.
- The Volunteer view and Family request screens are previews for staff. There
  are no volunteer or family sign-ins.
- The map legend shows churches as squares; Mapbox draws them as circles.
- Gifts are a table only. There is no Aplos connection.

## Next steps, in rough order

1. **Zane's own account.** Create it in Supabase, then add a `staff` profile.
2. **Google sign-in.** C127 uses Google Workspace. Zane creates an OAuth client
   in Google Cloud and enables the Google provider in Supabase; then add a
   "Continue with Google" button and the callback route. Emailed sign-in links
   are the planned fallback for volunteers and advocates.
3. **Turn off open sign-ups** in Supabase Authentication settings.
4. **Fit the importer to C127's real files.** C127 has given Zane data files to
   use as a guide to the architecture. Read them for structure, adjust the
   schema and import column hints, and add import types as needed (volunteers,
   Experience guests, gifts, Promise Serves exports).
5. **Meeting notes.** Zane has notes from follow-up meetings with C127 to bring
   in next. They may change the priorities above.
6. Later: file storage for documents, email and text sending, an Aplos read,
   add/edit screens.

Promise Serves, MyFam's predecessor, is retired on 2026-11-20 according to
promise686.org/myfam. C127's exports need to be out before then.

## The working session with C127

Planned as 2 to 3 hours. The agreed framing: leave with one real piece working
on their real data, plus an agreed map of everything else. Outline: pick the
one piece (the family spreadsheet is the recommendation), map their data model
on a whiteboard, import churches then families live, let a coach drive while
changes are made on the spot, then decide roles, a C127 backup person and the
next piece.

## How Zane likes the proposal worded

These came from his edits to the two-option page and deck. Follow them in
anything written for C127:

- Plain and warm. No statistics callouts, no "estimates" disclaimers, no
  "prepared by" footers.
- Option 1's weakness is that HubSpot is not built for churches: C127-specific
  things must be added, and irrelevant HubSpot features create noise. Its risk
  is the effort of building each workflow by hand.
- Option 2 leads with being fully customizable to anything C127 needs now or
  later. C127 becomes responsible for the system. Zane gets them up and running
  and coaches whoever C127 picks as its own backup.
- Churches and volunteers use the tool "wherever they want, whether their
  phones or their computers."
- Say that the data and structure already set up in HubSpot and MyFam carry
  over. Do not say the setup is lost.
- Do not compare the options on "if the key person leaves" or "cost of
  changing your mind."

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without a `.env.local`, the app still points at the
C127 Supabase project through the fallbacks in `next.config.mjs`, and the map
uses the drawn fallback unless `NEXT_PUBLIC_MAPBOX_TOKEN` is set.

After a schema change, add a new file under `supabase/migrations` and apply it
to the project, so the repo and the database stay in step.
