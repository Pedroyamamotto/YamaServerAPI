import mongodb from "mongodb";
const { ObjectId  } = mongodb;

export const USER_ACTIVITY_COLLECTION = "userActivities";

export function validateUserActivityInput(payload = {}) {
    const errors = [];

    if (!payload.userId) {
        errors.push("userId e obrigatorio");
    } else if (!ObjectId.isValid(payload.userId)) {
        errors.push("userId invalido");
    }

    if (!payload.action || typeof payload.action !== "string" || !payload.action.trim()) {
        errors.push("action e obrigatorio");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

export function buildUserActivityDoc(payload = {}) {
    return {
        userId: new ObjectId(payload.userId),
        action: String(payload.action).trim(),
        typeUser: payload.typeUser || "tecnico",
        metadata: payload.metadata || {},
        timestamp: new Date(),
    };
}