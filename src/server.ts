import express, { Request, Response } from "express";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import * as db from "./database";
import path from "path";

dotenv.config();

const app = express();

app.use(express.static(path.join(__dirname, "..", "public")));

const server = createServer(app);

const io: SocketIOServer = new SocketIOServer(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://play.framed.gg",
      "https://framed-crate.vercel.app",
      "https://framed-delta.vercel.app",
      "https://framed-git-dev-crate.vercel.app/"
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Message = {
  player_id?: string; // Client must emit. Will be undefined for system and assistant messages
  role: "system" | "user" | "assistant";
  content: string;
};

const PLAYER_NAMES = ["Soup Enjoyer", "Pineapple Guy", "Zippy", "Dizzy Dan"];

let roomMessages: { [roomId: string]: Message[] } = {};
let roomsWithInitialMessage: Set<string> = new Set();

// For variable AI responses
let roomMessageCount: { [roomId: string]: number } = {};
let roomRandomInterval: { [roomId: string]: number } = {};
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, World!");
});

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  socket.on("joinRoom", ({ roomId, player_id }) => {
    socket.join(roomId);
    if (!roomMessages[roomId]) {
      roomMessages[roomId] = [];
    }
  });

  // socket.on("requestInitialMessage", async ({ roomId, player_id }, ack) => {
  //   if (!roomId) {
  //     console.error("roomId is undefined");
  //     ack && ack(false);
  //     return;
  //   }
  //   console.log(`Initial message request received for room: ${roomId}`);

  //   // Message stating user joined
  //   const userJoinedMessage: Message = {
  //     player_id,
  //     role: "system",
  //     content: `${player_id} joined`,
  //   };
  //   io.to(roomId).emit("newMessage", userJoinedMessage);
  //   await db.storeMessage(roomId, {
  //     player_id: userJoinedMessage.player_id,
  //     role: userJoinedMessage.role as "system" | "user" | "assistant",
  //     content: userJoinedMessage.content,
  //   });

  //   // Check if initial message has already been sent for this room
  //   if (!roomsWithInitialMessage.has(roomId)) {
  //     roomsWithInitialMessage.add(roomId);
  //     console.log(`Sending initial message for room: ${roomId}`);

  //     const initialMessageContext: Message = {
  //       role: "user",
  //       content:
  //         "A precious artwork has been stolen and there is a single perpetrator among us. Players must decide who did it in the game FRAMED. You're an engaged non-player with a twist. Roles: detective, doctor, citizen, or thief. Players are unaware of each other's roles. Set the context wittily in 20 words or less",
  //     };

  //     const chatCompletion = await openai.chat.completions.create({
  //       messages: [initialMessageContext],
  //       model: "gpt-3.5-turbo",
  //     });

  //     const assistantOpeningRemark = chatCompletion.choices[0]?.message.content.trim();
  //     console.log(" Assistant OpeningRemark:", assistantOpeningRemark);

  //     io.to(roomId).emit("newMessage", { sender: "assistant", content: assistantOpeningRemark });
  //     await db.storeMessage(roomId, { player_id: null, role: "assistant", content: assistantOpeningRemark });

  //     roomsWithInitialMessage.add(roomId);
  //   } else {
  //     console.log(`Initial message already sent for room: ${roomId}`);
  //   }

  //   ack && ack(true);
  // });

  socket.on("sendMessage", async (roomId, message: { sender: string; content: string; player_id: string }) => {
    console.log("Received roomId:", roomId);
    console.log("Received message object:", message);

    if (!roomId || !message) {
      console.error("Missing required parameters. Room ID:", roomId, "Message:", message);
      return;
    }

    if (!roomMessages[roomId]) {
      roomMessages[roomId] = [];
    }

    // Store user's message in memory and database
    if (["system", "user", "assistant"].includes(message.sender)) {
      roomMessages[roomId].push({
        player_id: message.player_id,
        role: message.sender as "system" | "user" | "assistant",
        content: message.content,
      });
      await db.storeMessage(roomId, {
        player_id: message.player_id,
        role: message.sender as "system" | "user" | "assistant",
        content: message.content,
      });
    } else {
      console.error("Invalid sender role:", message.sender);
      return; // Exit if the sender role is invalid
    }

    socket.broadcast
      .to(roomId)
      .emit("newMessage", { sender: "user", content: message.content, player_id: message.player_id });

    // If the sender is a user, manage the AI's random response intervals
    // if (message.sender === "user") {
    //   // Initialize roomMessageCount and roomRandomInterval if they don't exist for the room
    //   if (!roomMessageCount[roomId]) {
    //     roomMessageCount[roomId] = 0;
    //   }
    //   if (!roomRandomInterval[roomId]) {
    //     roomRandomInterval[roomId] = getRandomInt(3, 7);
    //   }

    //   // Increment the message count
    //   roomMessageCount[roomId]++;

    //   // Check if it's time for the AI to respond
    //   if (roomMessageCount[roomId] === roomRandomInterval[roomId]) {
    //     // Fetch the last n messages (n being the random interval)
    //     const lastMessages = await db.fetchLastNMessages(roomId, roomRandomInterval[roomId]);

    //     const framedGameContext: Message = {
    //       role: "system",
    //       content:
    //         "In the game FRAMED, an art piece has gone missing, and there's a single perpetrator among the players. Players take on roles like detective, doctor, citizen, or thief. You're a non-player observer here to drop occasionally bold zingers based on the ongoing chat. Be bold, be witty, and keep it under 20 words. -",
    //     };

    //     const messagesWithContext = [framedGameContext, ...lastMessages];

    //     const formattedMessages = messagesWithContext.map((msg) => ({
    //       role: msg.role,
    //       content: msg.content,
    //     }));

    //     const chatCompletion = await openai.chat.completions.create({
    //       messages: formattedMessages,
    //       model: "gpt-3.5-turbo",
    //     });

    //     const assistantMessage = chatCompletion.choices[0]?.message.content.trim();
    //     roomMessages[roomId].push({ role: "assistant", content: assistantMessage });

    //     io.to(roomId).emit("newMessage", { sender: "assistant", content: assistantMessage });
    //     console.log(" Assistant VariableRemark:", assistantMessage);
    //     await db.storeMessage(roomId, { player_id: null, role: "assistant", content: assistantMessage });

    //     // Reset the message count and generate a new random interval for the next AI response
    //     roomMessageCount[roomId] = 0;
    //     roomRandomInterval[roomId] = getRandomInt(3, 7);
    //   }
    // }
  });

  socket.on("requestChatHistory", async (roomId, ack) => {
    const chatHistory = await db.fetchChatHistory(roomId);
    ack && ack(chatHistory);
  });

  socket.on("playerDeath", async (roomId, player_id) => {
    if (!roomId || player_id === undefined) {
      console.error("Missing required parameters. Room ID:", roomId, "Player ID:", player_id);
      return;
    }
  
    const playerName = PLAYER_NAMES[player_id];
  
    const deathContext: Message = {
      role: "system",
      content: `Tell a story about how ${playerName} was killed during the night in an art gallery by an art thief in 20 words or less.`,
    };
  
    try {
      const chatCompletion = await openai.chat.completions.create({
        messages: [deathContext],
        model: "gpt-3.5-turbo",
      });
  
      const deathNarrative = chatCompletion.choices[0]?.message.content.trim();
      io.to(roomId).emit("playerDeathNarrative", { player_id, deathNarrative });
  
      await db.storeMessage(roomId, { player_id: null, role: "assistant", content: deathNarrative });
      console.log("Death Narrative for player:", playerName, deathNarrative);
    } catch (error) {
      console.error("Error handling player death:", error);
    }
  });
  
  
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
  });
});

const PORT: number = Number(process.env.PORT) || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
  // Schedule DB cleanup function
  setInterval(async () => {
    console.log("Running scheduled cleanup...");
    await db.chatHistoryCleanup();
  }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
});
