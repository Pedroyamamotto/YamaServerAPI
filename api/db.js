import mongodb from "mongodb";
const { MongoClient  } = mongodb;

let client;

export async function getdb() {
    if (!client || client.topology.isDestroyed()) {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        console.log("Conectado ao MongoDB");
    }
    return client.db(process.env.MONGODB_DB);
}