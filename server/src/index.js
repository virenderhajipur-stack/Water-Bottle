import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import './models/index.js';
import { connectDB, disconnectDB } from './config/db.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { ensureInventory } from './services/inventoryService.js';
import { ensureDefaults } from './services/bootstrapService.js';

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok' }));
app.use('/api', routes);

// In production, serve the built client (single service: static + API)
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  console.log(`Serving client build from ${clientDist}`);
}

app.use(notFound);
app.use(errorHandler);

async function bootstrap() {
  await connectDB();
  await ensureDefaults();
  await ensureInventory();
}

await bootstrap();

// Only start a traditional listening server outside Vercel's serverless environment
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5100;
  app.listen(PORT, () => {
    console.log(`Water Bottle Management API running on http://localhost:${PORT}`);
  });

  async function shutdown() {
    try {
      await disconnectDB();
    } finally {
      process.exit(0);
    }
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;