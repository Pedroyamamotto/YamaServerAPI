import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import chalk from "../../chalk-stub.js";

// Function to log user activity
export async function logUserActivity(req, res) {
    const { userId, action } = req.body;
    const db = await getDb();
    const userActivityCollection = db.collection("userActivities");

    try {
        const activity = {
            userId: new ObjectId(userId),
            action,
            timestamp: new Date(),
        };

        const result = await userActivityCollection.insertOne(activity);

        return res.status(201).json({ message: "Activity logged successfully", activityId: result.insertedId });
    } catch (error) {
        console.error("Error logging user activity:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// Function to retrieve user activities
export async function getUserActivities(req, res) {
    const { userId } = req.params;
    const db = await getDb();
    const userActivityCollection = db.collection("userActivities");

    try {
        const activities = await userActivityCollection.find({ userId: new ObjectId(userId) }).toArray();
        console.log(chalk.green(`System 💻 : Activities retrieved successfully for user: ${userId} ✔️`));

        return res.status(200).json(activities);
    } catch (error) {
        console.error("System 💻 : Error retrieving user activities:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}