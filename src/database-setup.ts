import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT),
});

const createTable = `
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(255) NOT NULL,
  username VARCHAR(255),  -- Add this line for the username column
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

(async () => {
  try {
    await pool.query(createTable);
    console.log("Table created successfully.");
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    await pool.end();
  }
})();
