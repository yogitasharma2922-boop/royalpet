# Royal Pet Clinic

Full-stack clinic management app. React + Vite client, Express API, Knex migrations, SQLite for local work and PostgreSQL in production.

## Roles and access

Access is enforced on the server (`server/src/config/rolePolicy.js`), not only in the interface. A role cannot open another role's pages and cannot read or change its data through the API either.

| Data | Admin | Doctor | Receptionist | Owner |
|---|---|---|---|---|
| Owners, pets | read, write, delete | read, write | read, write | own records only |
| Appointments | full | full | full | own, request only |
| Visits (queue, vitals) | full | full | queue fields and vitals only | own, walk-in request only |
| Diagnosis, notes, prescriptions | full | full | none | own records only |
| Vaccinations | full | full | none | own records only |
| Invoices, inventory, supplier payments | full | full | none | own invoices only |
| Users, activity log, backups, clinic settings | full | none | none | none |

Doctors and receptionists see other users only by name. Deactivating a user blocks them on their next request.

## Local development

```bash
cd server && npm install && npm run migrate && npm run seed && npm run dev   # API on :4000
cd client && npm install && npm run dev                                       # UI on :5173 (proxies /api)
```

Demo accounts (created by the seed when `SEED_DEMO_USERS=true`, the default outside production):

- `doctor@royalpet.in` / `doctor123`
- `reception@royalpet.in` / `recep123`
- `admin@royalpet.in` / `admin123`
- `owner@royalpet.in` / `owner123`

## Tests

```bash
cd server && npm test                                   # in-memory SQLite
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/royalpet_test npm test   # real Postgres
cd client && npm test
```

## Deploying on Render

1. Push the repository and create a Blueprint from `render.yaml`. It creates the web service and a Postgres database and wires `DATABASE_URL` and `JWT_SECRET`.
2. The service builds the client, then at start runs `npm run migrate` and `npm run seed`. The seed only fills an empty database, so redeploys never touch live data.
3. Set `DOCTOR_REG_CODE` and `RECEPTION_REG_CODE` if staff may sign themselves up. Leave them empty to disable that and create staff from the admin screen.
4. Before real clinic use, set `SEED_DEMO_USERS=false` together with `ADMIN_EMAIL` and `ADMIN_PASSWORD` on a fresh database, so no public demo passwords exist.

Environment variables are listed in `server/.env.example`.

## How data is saved

The UI keeps a working copy in the browser and sends only the rows that changed to `PUT /api/sync` after each save. The server applies them in one transaction in dependency order, ignores references to rows that do not exist, and never deletes a row unless that row's id is in the request. Saves are queued, retried when the network drops, and flushed before sign-out. An idle tab refreshes from the server every 45 seconds when it has nothing unsaved.

## Known limitations

- Image uploads on Render's disk are deleted at each deploy. Set `STORAGE_PROVIDER=s3` (Cloudflare R2 or S3) to keep them.
- Two users who create a record of the same kind within the same few seconds can pick the same id, and the later save overwrites the earlier one. Moving id generation fully to the server would remove this.
- The sign-in token is stored in `localStorage`.
