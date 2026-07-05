// filepath: d:\Projeto de Aulas\api Mongo\api\models\sessionModel.js
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import mongoose from "mongoose";

// Define the session schema
const sessionSchema = new mongoose.Schema({
    userId: {
        type: ObjectId,
        required: true,
        ref: "professores", // Assuming the user collection is named "professores"
    },
    loginTime: {
        type: Date,
        default: Date.now,
    },
    logoutTime: {
        type: Date,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
});

// Create a model for the session
const Session = mongoose.model("Session", sessionSchema);

// Export the model
export default Session;