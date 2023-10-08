import { Pool } from 'pg';

// PostgreSQL pool connection
const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT),
});

type Message = {
    username?: string; // Will be undefined for system and assistant messages
    role: 'system' | 'user' | 'assistant';
    content: string;
};

// Function to store a new chat message
export const storeMessage = async (roomId: string, message: Message) => {
  const query = 'INSERT INTO chat_messages(room_id, username, role, content) VALUES($1, $2, $3, $4)';
  const values = [roomId, message.username, message.role, message.content];
  
  try {
    await pool.query(query, values);
  } catch (err) {
    console.error('Error storing message:', err);
  }
};

// Function to fetch chat history for a room
export const fetchChatHistory = async (roomId: string): Promise<Message[]> => {
  const query = 'SELECT username, role, content FROM chat_messages WHERE room_id = $1 ORDER BY timestamp ASC';
  
  try {
    const res = await pool.query(query, [roomId]);
    return res.rows;
  } catch (err) {
    console.error('Error fetching chat history:', err);
    return [];
  }
};

// Function to fetch the last n messages for a room for AI context
export async function fetchLastNMessages(roomId: string, n: number): Promise<Message[]> {
  const query = `
      SELECT username, role, content FROM chat_messages
      WHERE room_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
  `;

  try {
    const res = await pool.query(query, [roomId, n]);
    return res.rows;
  } catch (err) {
    console.error('Error fetching last N messages:', err);
    return [];
  }
}
