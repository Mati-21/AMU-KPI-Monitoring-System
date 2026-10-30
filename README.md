# AMU-KPI-Monitoring-System
## Project Links

🔗 Original Project:  
https://github.com/Mati-21/AMU-KPI-Monitoring-System

🔗 My Fork (my contributions):  
https://github.com/MentosMkt/AMU-KPI-Monitoring-System

## Documentation

- [MODULES_SPECIFICATION.html](MODULES_SPECIFICATION.html) — the 10 modules, 25 Prisma models and every `/api/v1` route (source of truth)
- [TASK_DIVISION.html](TASK_DIVISION.html) — module ownership for Developer A / Developer B and the roadmap
- [Docs/CLASS_DIAGRAM.md](Docs/CLASS_DIAGRAM.md) — class diagram of `Backend/prisma/schema.prisma`
- Swagger UI at `http://localhost:8058/api-docs` while the backend runs

## Backend setup

```bash
cd Backend
cp .env.example .env          # then set DATABASE_URL and JWT_SECRET
npm install
npm run db:deploy             # apply migrations (npm run db:migrate when changing schema.prisma)
npm run seed:admin            # root office, permission catalog, settings, Super Admin (prints the temporary password)
npm run dev                   # http://localhost:8058, API under /api/v1
```

- First login with the Super Admin forces a password change and TOTP MFA setup.
- `npm run seed:admin` is safe to re-run; it only resets the admin credentials with `npm run seed:admin:reset`.
- Every server start syncs the permission catalog (`config/permissions.json`) and system settings (`config/settings.json`) into the database: missing entries are created, settings already saved keep their values. `npm run seed:permissions` / `npm run seed:settings` do the same on demand.
- `npm run test:auth` runs the full cookie/MFA flow against a running server — it **resets the Super Admin's password and MFA**, so use it only on a development database.
