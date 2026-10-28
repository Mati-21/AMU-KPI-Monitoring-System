import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node scripts/seedAdmin.js',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
