# Sports Calendar data strategy

This folder is for traceable JSON backups and emergency import sources only. Screenshot-derived JSON is no longer the primary data strategy. The frontend must query Supabase through `/api/sports/events`; do not import large JSON files directly into React components.

Primary storage model:

- `sports_events` stores the basic schedule: sport, league, title, home/away teams, start time, venue, status, and source metadata.
- `sports_event_details` stores sport-specific details in a flexible `details` jsonb object.
- Baseball details are the first priority: weather, probable pitchers, final score, box score URL, source URL, and last sync time.
- Other sports keep basic schedule data first and can add jsonb details later without adding many columns.

Current file layout:

```text
sports-data/parsed/baseball/cpbl/2026-06.json
sports-data/parsed/baseball/mlb/2026-06.json
sports-data/parsed/football/2026-06.json
sports-data/parsed/cycling/tour-de-france/2026-07.json
sports-data/parsed/racing/f1/2026-06.json
sports-data/parsed/racing/f1/2026-07.json
```

Guidelines:

- Keep JSON split by sport, league, and month.
- Do not create `all-events.json`.
- Raw official screenshots should stay outside Git, such as local storage or cloud drive.
- Parsed screenshot JSON is a fallback and audit trail, not the main data source.
- Each event should include `sport_type`, `league`, `title`, `start_time`, and source metadata when available.
- `racing` is the canonical sport type for F1 and future motorsport data. `motorsport` can remain as a legacy compatibility value, but new files should use `racing`.
- Basketball and tennis intentionally have no imported data in this round. Empty results for those filters are expected.

Import examples:

```powershell
npm run import:sports -- sports-data/parsed/cpbl/2026-06.json
npm run import:sports:folder -- sports-data/parsed
npm run import:sports:all
```

The import script upserts `sports_events` by `event_key`, so running the same file again updates existing rows instead of duplicating events. If an event has a `details` object, the script also upserts `sports_event_details` by `event_id`.

Supported JSON shapes:

```json
{
  "metadata": {
    "sport_type": "cycling",
    "league": "Tour de France",
    "source_name": "Tour de France 2026 route table",
    "source_url": "https://example.com/source",
    "limitations": "Start times are not included."
  },
  "events": [
    {
      "event_key": "tdf-2026-stage-01",
      "title": "Tour de France Stage 1: Barcelona",
      "sport_type": "cycling",
      "league": "Tour de France",
      "start_time": "2026-07-04",
      "venue": "Barcelona",
      "status": "scheduled",
      "details": {
        "sport_type": "cycling",
        "detail_status": "pre_game_synced",
        "sync_phase": "manual",
        "details": {
          "time_status": "tbd",
          "stage_number": 1,
          "stage_type": "team time trial"
        }
      }
    }
  ]
}
```

Source notes for current data:

- CPBL 2026-06: generated from the CPBL official schedule page endpoint (`/schedule/getgamedatas`) for first-team regular-season games. Weather is not included.
- MLB 2026-06: generated from the MLB Stats API schedule endpoint. Probable pitchers and weather are not populated by this import.
- Tour de France 2026-07: route/stage data is based on published 2026 Tour route tables and ASO route information as reflected in public route references. Stage start times are not included and are marked `time_status: "tbd"`.
- F1 2026-06 and 2026-07: race dates and circuits are based on the published 2026 Formula 1 calendar. Exact session times are not included and are marked `time_status: "tbd"`.
- Football 2026-06: present as an empty import structure only. No stable football source is selected in this round.

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
