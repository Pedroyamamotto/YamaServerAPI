import "dotenv/config";
import mongodb from "mongodb";
const { MongoClient  } = mongodb;

let cachedClient = null;
let cachedDb = null;
let testDbOverride = null;

function resolveDbNameFromUri(uri) {
    try {
        const parsed = new URL(uri);
        const path = parsed.pathname?.replace(/^\//, "").trim();
        return path || "apibling";
    } catch {
        return "apibling";
    }
}

export async function getDb() {
    if (testDbOverride) {
        return testDbOverride;
    }

    if (cachedDb) {
        return cachedDb;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI não está definido no ambiente");
    }

    const dbName = process.env.MONGODB_DB || resolveDbNameFromUri(uri);

    if (!cachedClient) {
        cachedClient = new MongoClient(uri);
        await cachedClient.connect();
    }

    cachedDb = cachedClient.db(dbName);
    return cachedDb;
}

export async function closeDbConnection() {
    if (cachedClient) {
        await cachedClient.close();
        cachedClient = null;
        cachedDb = null;
    }
}

export function setDbForTests(db) {
    testDbOverride = db;
}

export function resetDbForTests() {
    testDbOverride = null;
}
