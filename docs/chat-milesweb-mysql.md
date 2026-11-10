# Chat record — Postgres to MilesWeb MySQL

Date: 23 Oct 2026

This file is a record of the chat. Passwords, API keys, and tokens are not included.

## What you asked for

1. Move the app off PostgreSQL / MySQL onto MySQL through Prisma.
2. Load the local MySQL data onto MilesWeb (cPanel MariaDB), structure first, then data, including the four large photo tables.
3. Point the running app at the MilesWeb database.
4. Save new image uploads in the cPanel folder `wellnessvalley/uploads`, in the folders that are already there: `avatars`, `captures`, `education`, `food`, `good-habits`, `transformation`, `weight`. Existing photos must keep working.
5. Explain the old `DB_*` lines in `backend/.env`, then add the MilesWeb values, then remove the PostgreSQL connection.
6. Fix the transformation-card crash: `.filter is not a function`.
7. Write this markdown file of the chat.

## Before and after — database

```
Before
Phone → API → MySQL / PostgreSQL

After
Phone → API → MYSQL_DATABASE_URL → MilesWeb MariaDB
         (Prisma, same table query style the code already used)
```

If `MYSQL_DATABASE_URL` is not set, the old MySQL table client is still used. With it set, table reads and writes go to MySQL. That is how already-working screens stay on one path.

MilesWeb connection that is live in `backend/.env`:

| Item | Value |
|---|---|
| Host | `spectrum.herosite.pro` |
| Port | `3306` |
| Database | `yvyunomg_wellness_valley` |
| User | `yvyunomg_wellnessvalley` |

phpMyAdmin inside the server showed port `3316`. Remote access that worked is port `3306`. The public IP that was allowed for remote MySQL was `106.222.221.48`.

Local source database was `wellness_schema_check` on `localhost:3306`.

## What was loaded onto MilesWeb

Structure first (46 tables), then the smaller tables, then the four photo tables.

| Table | About |
|---|---|
| `food_nutrition_data_table` | largest, meal photos |
| `captures_table` | capture photos |
| `weight_records_table` | weight photos |
| `education_logs_table` | education photos |

Checks after the load matched the local counts used in the chat: team `2389`, food `17793`, weight `4256`, captures `19393`, education `2388`.

MariaDB changes that were required in the structure file:

- `utf8mb4_0900_bin` → `utf8mb4_bin`
- `utf8mb4_0900_ai_ci` → `utf8mb4_unicode_ci`
- MySQL 8 `CHECK` lines removed
- `DEFAULT (cast(... as json))` replaced with a plain JSON string default
- `DEFINER=root@localhost` removed from triggers so the import did not need SUPER

Dump files were written under `C:\dumps\`. They were not committed.

## Before and after — images

```
Before
Phone → API → Cloudflare R2 file
             MySQL / MySQL stores the key (avatars/…, food/…, …)
Phone loads the file from R2

After (when FTP is turned on)
Phone → API → wellnessvalley/uploads/<same folder>/<same key>
             MySQL stores that path
Phone loads the file from the API (/api/media/...)
```

Folder names in code already match the cPanel folders. Old photos are not moved and are not deleted. A key that is not on the MilesWeb disk still uses the previous R2 or base64 path.

The API runs on this PC, not on the MilesWeb machine, so files cannot be written with a local `save`. They need FTP.

The database username and password were tried as the FTP login. The file server answered `530 Login authentication failed`. Because of that, the FTP lines in `backend/.env` stay commented. New uploads keep the current behaviour until a real cPanel **FTP Accounts** username and password are set:

```
MILESWEB_FTP_HOST=spectrum.herosite.pro
MILESWEB_FTP_PORT=21
MILESWEB_FTP_USER=
MILESWEB_FTP_PASSWORD=
MILESWEB_FTP_UPLOAD_ROOT=wellnessvalley/uploads
MILESWEB_FTP_SECURE=true
```

Restart the backend after those values are filled in. The next upload should then show up in File Manager.

## Why the old DB_* lines were commented

`backend/.env` had two different database doors.

| Door | Variables | Who reads them | Status |
|---|---|---|---|
| MilesWeb | `MYSQL_DATABASE_URL` | Prisma / table APIs | On. This is the live database. |
| Old Postgres | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DATABASE_URL` | `backend/utils/dbPool.js` (Postgres driver `pg`) | Removed |

Those `DB_*` names are not the MilesWeb connection. Filling them with the MilesWeb host would have made the dashboard speak Postgres to MariaDB, which fails. The MilesWeb values were written there only as comments so they could be seen next to the old names. You then asked for the PostgreSQL connection itself to be removed.

## PostgreSQL connection removed

- Commented `DB_*`, `DATABASE_URL`, and MySQL URL lines were deleted from `backend/.env`.
- `backend/utils/dbPool.js` was deleted. It was the only Postgres pool. The dashboard was the only caller.
- The `pg` package was uninstalled.
- `backend/services/dashboardService.js` now runs its query through Prisma on `MYSQL_DATABASE_URL`.
- `backend/backend.md` database section now describes the MilesWeb Prisma path.

Login, food, weight, and profile were already on MilesWeb and were not switched again.

Restart the backend after `.env` changes.

## Transformation card crash

Error:

```
TypeError: (intermediate value).filter is not a function
    at TransformationCardContent
```

`recoveredHealthIssues` is stored in a JSON column. MilesWeb was returning that JSON as text. The card called `.filter` on the text. Only a list has `.filter`.

Fixes:

- `backend/shared/lib/mysql/rowCodec.js` parses JSON columns back into arrays and objects.
- The transformation card treats a non-list as an empty list, so the screen does not crash.
- The coach testimonial page does the same when it walks health-issue labels.

Refresh the page. Restart the backend so the labels load as a list again.

## Code added for MySQL

- `backend/prisma/schema.prisma` — MySQL schema, 46 models, URL from `MYSQL_DATABASE_URL`
- `backend/shared/lib/prisma.js` — Prisma client
- `backend/shared/lib/mysql/` — query layer that accepts the same `.from().select().eq().insert()` calls the repositories already use
- `backend/utils/mysqlClient.js` — when `MYSQL_DATABASE_URL` is set, `getMysqlClient()` returns that MySQL layer

Unknown extra write columns are dropped (for example job fields that are not in the MySQL table) so those writes do not throw.

## Still open

1. cPanel FTP username and password, so new images land in `wellnessvalley/uploads`.
2. Restart the backend after the latest `.env` and code changes if it is still the old process.
3. Testimonial video files and the race-leaderboard live channel still expect MySQL when those features are used. Table data does not.
