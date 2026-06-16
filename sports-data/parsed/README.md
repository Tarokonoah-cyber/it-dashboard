# Sports Calendar data strategy

This folder is for traceable JSON backups and emergency import sources only. Screenshot-derived JSON is no longer the primary data strategy. The frontend must query Supabase through `/api/sports/events`; do not import large JSON files directly into React components.

Primary storage model:

- `sports_events` stores the basic schedule: sport, league, title, home/away teams, start time, venue, status, and source metadata.
- `sports_event_details` stores sport-specific details in a flexible `details` jsonb object.
- Baseball details are the first priority: weather, probable pitchers, final score, box score URL, source URL, and last sync time.
- Other sports keep basic schedule data first and can add jsonb details later without adding many columns.

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
- Parsed screenshot JSON is a fallback and audit trail, not the main data source.
- Each event should include `sport_type`, `league`, `title`, `start_time`, and source metadata when available.

Import example:

```powershell
npm run import:sports -- sports-data/parsed/cpbl/2026-06.json
```

The import script upserts by `event_key`, so running the same file again updates existing rows instead of duplicating events.

Details sync skeleton:

```powershell
npm run sync:sports-details -- --payload sports-data/parsed/example-details.json --phase pre_game_3h --dry-run
npm run sync:sports-details -- --payload sports-data/parsed/example-details.json --phase pre_game_3h
```

Example detail payload shape:

```json
[
  {
    "event_id": "00000000-0000-0000-0000-000000000000",
    "sport_type": "baseball",
    "detail_status": "pre_game_synced",
    "sync_phase": "pre_game_3h",
    "details": {
      "probable_pitchers": {
        "away": { "name": "Away starter", "throws": "R" },
        "home": { "name": "Home starter", "throws": "L" },
        "status": "announced"
      },
      "weather": {
        "summary": "Partly cloudy",
        "temperature": 29,
        "rain_probability": "20%"
      },
      "final_score": null,
      "box_url": null,
      "source_url": "https://example.com/game"
    },
    "source_url": "https://example.com/game",
    "source_name": "External baseball schedule provider"
  }
]
```

Planned baseball sync phases:

- Morning: sync today's games and the next 7-14 days of basic schedule.
- 3 hours before game time: fill probable pitchers and weather.
- 1 hour before game time: refresh probable pitchers again because MLB starters can be announced late.
- Post-game or next morning: fill final score and box score link.
- If data has not been synced, show `尚未同步`.
- If a source has not announced a field yet, show `尚未公布`.
- If the game is waiting for a final score, show `賽後更新`.
