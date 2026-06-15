# Sports Calendar parsed data

This folder is for traceable JSON backups and import sources only. The frontend must query Supabase through `/api/sports/events`; do not import large JSON files directly into React components.

Recommended file layout:

```text
sports-data/parsed/cpbl/2026-06.json
sports-data/parsed/nba/2026-06.json
sports-data/parsed/fifa/2026-06.json
```

Guidelines:

- Keep JSON split by sport, league, and month.
- Do not create `all-events.json`.
- Raw official screenshots should stay outside Git, such as local storage or cloud drive.
- Parsed JSON can be committed as an auditable backup and imported into Supabase.
- Each event should include `sport_type`, `league`, `title`, `start_time`, and source metadata when available.

Import example:

```powershell
npm run import:sports -- sports-data/parsed/cpbl/2026-06.json
```

The import script upserts by `event_key`, so running the same file again updates existing rows instead of duplicating events.
