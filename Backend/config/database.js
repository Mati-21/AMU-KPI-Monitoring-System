import { PrismaClient  } from '@prisma/client';
import { Pool  } from 'pg';
import { PrismaPg  } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();

const sqlLoggingEnabled = String(process.env.DB_LOG_SQL || 'false').toLowerCase() === 'true';

// Setup connection string from individual env vars since DATABASE_URL might not exist
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?schema=public`;

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: sqlLoggingEnabled ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('PostgreSQL database connected successfully (Prisma)');

    const shouldSync = String(process.env.DB_SYNC_ALTER || 'false').toLowerCase() === 'true';
    
    if (shouldSync && process.env.NODE_ENV === 'development') {
      console.log('Database sync skipped (Prisma requires you to run `npx prisma db push` or `npx prisma migrate dev` to sync schema)');
    } else if (process.env.NODE_ENV === 'development') {
      console.log('Database sync skipped (Prisma manages schema via migrations)');
    }
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    process.exit(1);
  }
};

export {  prisma, connectDB  };
