import { Client  } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const createDatabase = async () => {
  // Connect to default 'postgres' database
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres'  // Connect to default database
  });

  try {
    console.log('🔄 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Check if database exists
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME]
    );
    
    if (res.rowCount === 0) {
      // Create database
      await client.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
      console.log(`✅ Database "${process.env.DB_NAME}" created successfully`);
    } else {
      console.log(`✅ Database "${process.env.DB_NAME}" already exists`);
    }
    
    await client.end();
    console.log('✅ Database setup complete!');
    
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    process.exit(1);
  }
};

createDatabase();