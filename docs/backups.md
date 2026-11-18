# Backups of the C127 Hub

The hub's records live in Supabase. Supabase keeps its own daily copies on the
paid plan, but those sit in the same account as the database. This is a second
copy, kept somewhere else, that C127 owns.

**What it does.** Every night GitHub runs `.github/workflows/backup.yml`. It
takes a full copy of the hub's data and sign-ins, encrypts it with a
passphrase, and puts it in C127's storage. It keeps 30 daily copies and 12
monthly ones. If a run fails, GitHub emails the owner of the repository.

**Status: written, not yet run.** It has never been run against the real
database. Until the three secrets below are set, each night's run does nothing
and says so. The first real run and the first restore test are the proof that
it works; do both before relying on it.

## What a backup holds

Every family, child, person, church and contact note in the hub, and who can
sign in. Treat a copy with the same care as the database itself:

- It is stored encrypted. Without the passphrase it cannot be read.
- It goes only to storage C127 owns. Never a laptop, never this repository,
  never a personal account.
- The passphrase is kept somewhere separate from the copies, by two people at
  C127 (for example in the organization's password manager). If it is lost,
  the copies cannot be opened by anyone.

## Setting it up, once

Three things are needed. None of them goes in the repository.

1. **Somewhere to keep the copies.** A private storage bucket or a shared
   drive that C127 owns. `rclone` is the tool that uploads, and it works with
   Google Drive, Backblaze B2, Amazon S3 and many others. On a computer, run
   `rclone config`, create one remote, and name it exactly `c127backup`. The
   contents of the file it writes (`rclone config file` shows where) are the
   `RCLONE_CONFIG` secret.
2. **The database connection string.** In the Supabase dashboard, open the
   project, click Connect, and copy the **Session pooler** connection string
   with the database password filled in. This is the `SUPABASE_DB_URL` secret.
   Use the session pooler, not the direct connection: GitHub's machines cannot
   reach the direct one.
3. **A passphrase.** Long and random. This is the `BACKUP_PASSPHRASE` secret.

Add the three in GitHub under the repository's Settings → Secrets and
variables → Actions → New repository secret. Then open the Actions tab, choose
"Nightly backup", and click "Run workflow" to try it straight away.

## Restoring

To test a restore, or to recover:

1. Download the copy you want from C127's storage.
2. Decrypt it: `gpg --decrypt --output hub.dump c127-hub-YYYY-MM-DD.dump.gpg`
   and type the passphrase.
3. Restore it into an **empty** database, never over the live one. For a test,
   create a new Supabase project (or a local Postgres 17) and run:
   `pg_restore --no-owner --no-privileges --dbname "<connection string>" hub.dump`
   A new Supabase project already has an `auth` schema, so expect messages
   about objects that already exist there; the `public` schema is the part
   that matters for a test.
4. Compare the row counts with the `counts.txt` saved beside the copy.
5. Delete the test database and the decrypted `hub.dump` afterwards.

Do a restore test when this is first set up, and again every few months. A
backup that has never been restored is only a hope.

## Putting one mistake back

For a single mistake (a family removed, two people joined who should not have
been, a church name matched to the wrong church) use the **History** page in
the hub. It can put one change back without touching anything else. Backups
are for when the database itself is lost or badly damaged.

## Also worth doing

- A second owner of the Supabase organization at C127, so access does not
  depend on one person.
- The same for the GitHub repository and the Vercel project.
