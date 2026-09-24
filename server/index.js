import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import router from './routes/index.js';
import { setupSocketIO } from './socket/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

app.set('io', io);

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', router);

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'CODE PULSE API', timestamp: new Date() });
});

// Serve frontend static files if built
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

import { startResponderEscalationScheduler } from './services/responderEscalationService.js';

// Setup Socket.IO real-time engine
setupSocketIO(io);

// Start server-side 30-second responder escalation & reminder scheduler
startResponderEscalationScheduler();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
  =======================================================
  🚑 CODE PULSE BACKEND SERVER RUNNING
  =======================================================
  📡 API Server:      http://localhost:${PORT}/api
  🔌 Socket.IO:       http://localhost:${PORT}
  🏥 Tagline:         EVERY SECOND. EVERY SIGNAL. EVERY LIFE.
  =======================================================
  `);
});
