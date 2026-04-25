# Royal Pet Clinic (Full Stack)

This workspace contains a complete **full-stack** Royal Pet Clinic application.

- **Client:** React + Vite app (`/client`) with the full UI and workflow.
- **Server:** Express API with a **real database** (SQLite by default, pluggable to Postgres via `DATABASE_URL`) (`/server`).
- **Storage:** Local uploads in development, with S3-compatible object storage support for production image/CDN delivery.

---

## ✅ Key Features

- **Real database** using SQLite (default), with schema and seeds generated via Knex.
- **Multi-user auth** via JWT tokens + role-based access control (admin/doctor/receptionist/owner).
- **Separate environments** via `.env` configuration and `NODE_ENV`.
- **API-backed session restore and bootstrap** so the client hydrates from the persistent database after login.
- **Background server sync** from the existing UI save flow for staff-side CRUD screens.
- **Owner self-service appointment requests** persisted through the API.
- **Pluggable image storage** with a cost-effective long-term production path using S3-compatible storage.

## 🚀 Production Deployment

### 1) Build the client

```bash
cd client
npm install
npm run build
```

### 2) Start the server in production

```bash
cd server
npm install
npm run migrate
npm run seed
NODE_ENV=production npm start
```

The server will serve the built client at **http://localhost:4000** and handle all API requests.

### Environment Variables

Create `server/.env`:
```
JWT_SECRET=your-super-secret-jwt-key-here
DATABASE_URL=sqlite://server/data/royalpet.db  # or postgres://... for production DB
ALLOW_BULK_SYNC=true

# Local uploads (default)
STORAGE_PROVIDER=local

# Recommended production image setup: Cloudflare R2 + CDN/custom domain
# STORAGE_PROVIDER=s3
# S3_BUCKET=royalpet-images
# S3_REGION=auto
# S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# S3_ACCESS_KEY_ID=...
# S3_SECRET_ACCESS_KEY=...
# S3_PUBLIC_BASE_URL=https://images.yourdomain.com
```

---

### Manage database

```bash
cd server
npm run migrate    # Apply schema
npm run seed       # Seed initial data
npm run reset-db   # Drop + rebuild + seed
```

---

## 🔐 Auth

Use the seeded users:

- `doctor@royalpet.in` / `doctor123` (Doctor)
- `reception@royalpet.in` / `recep123` (Receptionist)
- `admin@royalpet.in` / `admin123` (Admin)
- `owner@royalpet.in` / `owner123` (Pet Owner)

---

## 🚀 Deploying

1. Build client:
   ```bash
   cd client
   npm run build
   ```
2. Configure your environment variables (`PORT`, `JWT_SECRET`, `DATABASE_URL`).
3. Start server in production mode:
   ```bash
   cd server
   npm start
   ```

---

## Next Improvements (Optional)
- Add WebSocket or SSE updates for truly live multi-user refresh across tabs/devices.
- Break the large client page into feature modules and dedicated API hooks.
- Add image metadata tables if you want pet/profile/gallery uploads tracked in the DB.
- Move from SQLite to Postgres for multi-instance horizontal scale.
