import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

let mem;
const APP_ROOT = path.resolve(process.cwd());
const DB_PATH = path.join(APP_ROOT, '.mongo-data');
const DB_NAME = process.env.MONGODB_NAME || 'water-bottle';
const MONGO_PORT = Number(process.env.MONGO_PORT || 27017);
const LOCAL_URI = `mongodb://127.0.0.1:${MONGO_PORT}/${DB_NAME}`;

function clearStaleMongoLock() {
  const lockPath = path.join(DB_PATH, 'mongod.lock');
  if (fs.existsSync(lockPath)) {
    try {
      fs.unlinkSync(lockPath);
      console.log('Removed stale Mongo memory lock file.');
    } catch (err) {
      console.warn(`Unable to remove stale Mongo memory lock file: ${err.message}`);
    }
  }
}

function getMemoryMongoConfig() {
  const port = Number(process.env.MONGO_PORT || 0);
  return {
    instance: { dbPath: DB_PATH, port: port || 0 }
  };
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();

  if (uri) {
    try {
      console.log(`Connecting to MongoDB at ${uri.replace(/:\/\/[^@]+@/, '://***@')}`);
      await mongoose.connect(uri);
      mongoose.set('strictQuery', false);
      console.log('MongoDB connected');
      return;
    } catch (err) {
      console.warn(`MONGODB_URI connection failed, falling back to local MongoDB. ${err.message}`);
    }
  }

  fs.mkdirSync(DB_PATH, { recursive: true });
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production (no in-memory fallback).');
  }

  try {
    await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 1500 });
    console.log(`Connected to persistent in-memory MongoDB at 127.0.0.1:${MONGO_PORT} (db: ${DB_NAME})`);
  } catch {
    fs.mkdirSync(DB_PATH, { recursive: true });
    clearStaleMongoLock();
    const mms = await import('mongodb-memory-server');
    const MongoMemoryServer = mms.MongoMemoryServer || mms.default?.MongoMemoryServer;
    mem = await MongoMemoryServer.create(getMemoryMongoConfig());
    const memUri = mem.getUri();
    console.log(`Started persistent in-memory MongoDB (${DB_PATH}) at ${memUri}`);
    await mongoose.connect(`${memUri}${DB_NAME}`);
  }

  mongoose.set('strictQuery', false);
  console.log('MongoDB connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (mem) await mem.stop();
}

export function keepMemoryDB() {
  return !!mem;
}