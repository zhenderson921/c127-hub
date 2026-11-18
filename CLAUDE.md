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

## What the 2026-11-18 meeting changed

Betsey, Rechaud and Judy Victory met with Zane. The hub is now built in three
steps, from C127's own "Source of Truth" document:

- **1.0:** families and churches with staff follow-up, and Experience (VCE)
  follow-up. Care Communities need only status, launch date and close date.
- **2.0:** Aplos and all contacts (volunteers, donors), Experience booking in
  the hub in place of Eventbrite.
- **3.0:** the MyFam replacement: volunteers, care requests, church side.

Other decisions:

- Start from the family spreadsheet, not Promise Serves. Two earlier migrations
  went badly, so Promise Serves is a historical archive only.
- The team is mid-cleanup on the family spreadsheet. Build the structure now
  and load the clean data in a few weeks.
- HubSpot stays for email sends until about February 2027.
- Experience follow-up: church-related answers go to that church's coach; the
  rest go to one shared queue (the "Belong" inbox). Copy-and-paste drafts
  first, automation later.
- Leadership learns the tool before the team does. Staff have low tolerance
  for another rough launch. Target: family care logs December contacts here.
- Rechaud works with Zane on the Experience flow; Judy on churches and families.

## Two views

The app has two views, switched from the top of the sidebar:

- **Prototype** (`/`, `app/(hub)/*`): every screen from the first demo, on
  invented sample data from `lib/seed.ts`, kept in the browser. It never reads
  or writes the database, even for someone signed in. Leave it as it was sent
  to C127 unless Zane asks for a change.
- **Live tool** (`/live`, `app/live/*`): the screens being built piece by piece
  on C127's real records in Supabase. It needs a personal sign-in; the
  prototype password does not open it. Today it has Families and Churches.

New real-data work goes in the Live tool: add a screen under `app/live`, add it
to the nav in `components/LiveShell.tsx`, and keep its types and saves in
`lib/live/*`. Do not share types with the Prototype.

## Rules that matter

- **Never commit real C127 data.** No family, child, volunteer or donor records
  in this repo, in sample data, in tests or in screenshots. Real records enter
  through the Live tool and live only in Supabase. C127's source files are in
  `../C127 Historic Docs`, next to this repo and outside it. Read them for
  structure (columns, counts, category values), not for individual records.
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

- `app/login` – sign-in page (personal sign-in and prototype password)
- `app/(hub)/*` – the Prototype's screens: dashboard, my-work, families,
  churches, volunteers, map, experience, care, giving, reports, import, church,
  serve, request-help
- `app/live/*` – the Live tool's screens: families, churches, review (Data check)
- `components/ShellFrame.tsx` – the frame both views share, with the view
  switch; `Shell.tsx` is the Prototype's nav, `LiveShell.tsx` the Live tool's
- `components/live/ContactLog.tsx` – the contact log used on live screens
- `lib/live/types.ts`, `db.ts`, `store.tsx` – the Live tool's types, row
  mapping and actions. Each action saves first and changes the screen only
  when the save worked.
- `components/MatchMap.tsx` – Mapbox map with a drawn SVG fallback
- `lib/store.tsx` – the Prototype's state and actions. Its database-saving code
  is no longer reached and can be removed.
- `lib/db.ts` – the first schema's row mapping, plus `all()` and `loadProfile()`
  which the Live tool uses
- `lib/seed.ts` – invented sample data; `lib/match.ts` – closest-church logic;
  `lib/routing.ts` – who a guest's follow-up comes from and what it says;
  `lib/team.ts` – Care Community teams and background-check rules
- `scripts/preload.mjs` – the one-time load of C127's spreadsheets (see
  "Loading the spreadsheets")
- `middleware.ts` – lets a request through for a Supabase session, or the
  prototype cookie for anything outside `/live`
- `supabase/migrations/*` – schema and row level security, already applied

Brand: teal `#00A499`, charcoal `#262626`, Bebas Neue for display and Figtree
for body (C127's site uses Proxima Nova, which is not free). The white logo is
`public/brand/c127-logo-white.png`.


## Database and roles

First schema (`20261113*`): `coaches`, `churches`, `profiles`, `families`,
`volunteers`, `needs`, `guests`, `tasks`, `gifts`, `activity_log`, and the view
`volunteer_hours`.

1.0 model (`20261118000000_model_1_0.sql`, applied 2026-11-18). It only adds to
the first schema:

- `people` – one row per adult, whatever they are to C127. `person_roles` are
  the tags (advocate, pastor, donor and so on), optionally tied to a church.
  `advocate_onboarding` holds the clinic and training dates.
- `families` gained home church and serving church as separate columns
  (`church_id` is the serving church), `family_status` and `care_status` as
  separate columns, `home_types` as a list, and a street address.
  `family_members` links adults to a family; `children` holds first name and
  year of birth, and the age band is worked out.
- `care_communities` – status, launch date and close date, kept as history.
- `interactions` – the one contact log, about a family, person or church.
  `reached` tells a real conversation from an attempt.
- `churches` gained the nine real statuses (`status`), campus, address, FAM
  activities, agreement date, next step and next contact. `church_aliases`
  holds other spellings of a church name.
- `visits`, `vce_responses`, `next_step_options` – the Center visitor log, the
  Next Steps form answers, and C127's follow-up flow chart as editable rows.
  `tasks` gained links and a shared `queue` so it can be the follow-up list.
  No screen uses these yet.
- `coaches` is really "C127 staff". It keeps its name for now.

The old columns the model replaces are listed at the bottom of the migration.
They are still there for now and nothing in the Live tool reads them.

`profiles.role` decides access, enforced by row level security:

- `staff` and `coach` see and change everything.
- `advocate` sees only their own church, its families, volunteers, needs and
  Care Communities. Nothing in `people`, `children` or `interactions`. The Live
  tool shows advocates an "almost there" message for now.
- Signed in with no profile row: sees nothing.
- Not signed in: nothing.

To give someone access: add them under Authentication in the Supabase
dashboard, then insert a `profiles` row with their role (and `church_id` for an
advocate). Zane has a `staff` account (2026-11-18).

The database holds **no records yet**: one user, the 12 seeded next-step
options, and nothing else.

## Loading the spreadsheets, and the Data check page

There is no import screen, by Zane's choice. The spreadsheets are loaded once
by a script, and once more when the cleaned family data arrives. Everything is
loaded straight away, including the uncertain parts, and C127 staff confirm
those afterwards on the Live tool's Data check page (`/live/review`).

```bash
node scripts/preload.mjs          # dry run: counts only, writes nothing to the hub
node scripts/preload.mjs --load   # asks for a C127 Hub sign-in, then loads
```

The script:

- Reads `../C127 Historic Docs`: the "Churches" and "Current Advocates" tabs
  of the Church Spreadsheet and "Main Information" of the Family Spreadsheet.
- Loads through `public.import_records()` in one transaction: if any row is
  refused, nothing is written. Only staff and coaches can call it.
- Matches a typed church name to the church list when it is exact, a saved
  alias, or differs only by "the", "of", "church" or place shorthand (Orl, WP,
  WG, LM). Any other name is **kept as typed**: `families.home_church_text`,
  `families.serving_church_text`, and `people.home_church_text` for an
  advocate, whose role and onboarding row then have no church yet.
- Skips churches, people and families already in the hub. It never updates or
  removes anything, so loading the cleaned spreadsheet later needs a decision
  first: wipe and reload, or teach the script to update.
- Brings children in as counts by type, with the spreadsheet's age band in
  their notes, since the spreadsheet has no names or birth years. The letter
  codes (`PA`, `EF`, `MHB` and so on) are read as band then type, with A =
  adopted, B = biological, F = foster, K = kinship, U = unknown. Confirm with
  C127.
- Does not load the monthly contact columns, event checkboxes, survey answers,
  or any other tab.
- Prints counts and category values only, never a person's details.

The Data check page works from what is in the database, so it stays right as
people fix things. Its tabs:

- **Church names** – each typed name, tagged "Likely the same", "Possibly the
  same" or "No close match" (`lib/live/match.ts`). "Same church" calls
  `match_church_name()`, which fixes every family and advocate using the name
  and saves it in `church_aliases`. "Add as new" adds the name as a Potential
  Prospect church first. "Leave as typed" stops asking.
- **Same person?** – people with the same first and last name. "Join them"
  calls `merge_people()`, which keeps everything from both records.
- **Same family?** and **Same church?** – shown side by side; they can only be
  marked as different. Joining two families or churches is not built.
- **Missing details** – families with no home type, adults, address, county or
  children, each linking to the family.

"Leave as typed" and "different" answers are rows in `review_dismissals`.

## What has been tested

- Prototype end to end in a browser, including phone width.
- The first schema's access rules: 24 checks on local Postgres, then confirmed
  on the real project.
- The 1.0 model: 45 checks (constraints and access rules) on an in-memory
  Postgres, then on the real project every read and write the Live tool makes
  was run as Zane's staff user inside a transaction and rolled back.
- Mapbox renders on the live site.

- The Live tool in a browser as Zane (2026-11-18), with invented rows that were
  removed afterwards: add a church with a new coach, edit it, add an advocate,
  log a contact; add a family with two adults, set home types, add a child,
  start a Care Community and make it active, log a contact.

- The preload script: a dry run on the real files, and a rehearsal of the full
  real load on an in-memory Postgres with every migration applied (247
  churches, 703 families, 1,413 people, 97 advocates, 2,113 children, 253 Care
  Communities, all accepted; 191 church names left as typed).
- The Data check page in a browser as Zane with invented rows, since removed:
  matching a name, adding a name as a new church, joining two people, and
  marking two families as different. `match_church_name` and `merge_people`
  also passed 22 checks on the in-memory Postgres. `import_records` was also run on the real project as Zane's
  staff user in a rolled-back transaction.

Not tested: the script's `--load` path against the real project (it needs a
password typed by a person), the Live tool at phone width or as a coach or advocate, removing a
child, a failed save, Google sign-in (not built), any real C127 file through an
importer.

## Known limits

Live tool:

- No import screen. Records come from the preload script or are added by hand.
- An adult's name, phone and email cannot be edited after the family is added,
  and an adult cannot be added to an existing family. Same for people at a
  church. Advocate onboarding dates have a table but no screen.
- No map or closest-church matching: nothing sets latitude and longitude yet.
- Every table is loaded into the browser at once. Fine for C127's size; the
  contact log is the first thing to page if Promise Serves history is loaded.
- Nothing sends email or texts.

Prototype (unchanged from the first demo): reminders are computed in the
browser, "Send this follow-up" only records the touch, the Volunteer view and
Family request screens are previews, gifts are a table only, and the map
legend shows churches as squares where Mapbox draws circles.

## Next steps, in rough order

1. **Zane runs the preload** (`node scripts/preload.mjs --load`). Then C127
   staff need the Live tool deployed and their own `staff` accounts before
   they can work through the Data check page. When the cleaned family
   spreadsheet arrives, decide how the second load treats what is already
   there.
2. **Experience follow-up in the Live tool** on `visits`, `vce_responses`,
   `next_step_options` and `tasks`. Sources: `CCC_Visitors2026.xlsx` and "My
   Next Steps VCE (Responses).xlsx" (both were in Zane's Downloads; move them
   into `../C127 Historic Docs`). Responses after 2026-10-14 are in HubSpot.
   Routing owners in `next_step_options` are blank on purpose and get set in
   the database, so no staff names live in the repo.
3. **Edit screens** for adults and church people; advocate onboarding.
4. **Turn off open sign-ups** in Supabase Authentication settings. Google
   sign-in is deferred: email and password for now.
5. Later: geocoding and the match map on real addresses, events with
   attendance, linking gifts to people, email and text sending.

Open questions for C127: the age band cut-offs (Preschool 0–4, Elementary
5–10, Middle 11–13, Teen 14–17 are a guess, and the spreadsheet's `MH` columns
are unexplained); whether advocates should see children's names and the
contact log; whether Jeremy's HubSpot automation pauses (Rechaud to decide).

Promise Serves was due to retire on 2026-11-20. The 2026-11-16 export is in
`../C127 Historic Docs/PS Dump 11_16_26`. Its `people.csv` has no phone numbers
and addresses for about a third of people.

Supabase's advisor flags `public.rls_auto_enable()`, a function that is not in
this repo's migrations and that anyone can call. Its origin is unknown.

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
C127 Supabase project through the fallbacks in `next.config.mjs`, so the Live
tool on a laptop works on the real records. The map uses the drawn fallback
unless `NEXT_PUBLIC_MAPBOX_TOKEN` is set.

After a schema change, add a new file under `supabase/migrations` and apply it
to the project, so the repo and the database stay in step.
