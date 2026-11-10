# C127 Hub

A working demo of one place for Commission 127's families, churches, coaches,
volunteers, Experience follow-up, care requests, giving and grant reporting.

**All data in the demo is invented.** It is generated from a fixed seed in
`lib/seed.ts`. No real family, church, volunteer or donor appears in it. Only
the scale (702 families, 74 churches, about 300 Experience guests in 45 days)
mirrors the real organization.

## What it shows

| Screen | What it answers |
| --- | --- |
| Dashboard | Where things stand today and what needs attention |
| My work | Each coach's churches, to-dos and automatic "no contact in 4 weeks" reminders |
| Families | All 702 families, connected to a church or not |
| Churches | Every church from first conversation to active FAM |
| Volunteers | Clearance, training and hours across every roster |
| Church match map | The closest serving church with room for each unconnected family |
| Church view | What a FAM advocate sees: their families, Care Communities, requests and roster |
| Volunteer view | What a volunteer sees on a phone: sign-ups, open requests, orientation |
| Family request | How a family asks for help, with or without a church |
| Experience follow-up | Who each guest's follow-up comes from, what it says, and the sequence until they take a step |
| Care requests | Meals, rides and childcare across all churches |
| Giving | Gifts as read from Aplos, with donor, volunteer and guest shown as one person |
| Grant report | Monthly numbers by county, exported as CSV |
| Import a spreadsheet | Reads a CSV's headings, tidies values, flags duplicates |

Changes you make (connecting a family, sending a follow-up, importing rows) are
saved in your own browser only. "Reset sample data" in the sidebar restores the
starting state.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and enter the password.

## Password

The whole site sits behind one password, checked in `middleware.ts`. Set the
`SITE_PASSWORD` environment variable on the host to choose it. If it is unset,
the app uses the demo password in `lib/auth.ts`. The browser cookie stores a
hash, not the password.

## Map

The church match map uses Mapbox when `NEXT_PUBLIC_MAPBOX_TOKEN` is set to a
public token (it starts with `pk.`); `MAPBOX_TOKEN` is accepted as well. Set it in the host's environment
variables, or in `.env.local` for local work. Without it, or if Mapbox cannot
load, the page shows a drawn map with the same dots and matching. Restrict the
token to your site's URL in the Mapbox account.

## Deploy to Vercel

1. Go to vercel.com/new and import this repository.
2. Leave every build setting at its default (Vercel detects Next.js).
3. Under Environment Variables, add `NEXT_PUBLIC_MAPBOX_TOKEN`, and optionally `SITE_PASSWORD`.
4. Deploy. Every later push to `main` redeploys.

## What a production version needs

This demo has no database: it keeps state in the browser so it can be shown
without touching real records. A real version would add a hosted database
(for example Postgres), individual staff logins with roles, an audit trail,
a nightly read from Aplos, an email and text sender for follow-up and
volunteer reminders, and separate sign-ins for advocates, volunteers and
families that limit each to their own church's records.
