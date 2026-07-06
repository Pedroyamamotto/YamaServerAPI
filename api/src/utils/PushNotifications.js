import { getDb } from "../db.js";
import mongodb from "mongodb";
const { ObjectId } = mongodb;

export const sendPushNotification = async (tecnicoId, title, body) => {
    if (!tecnicoId) return;

    try {
        const db = await getDb();
        const usuariosCollection = db.collection("usuários");

        let query = { _id: tecnicoId };
        if (typeof tecnicoId === "string" && ObjectId.isValid(tecnicoId)) {
            query = { 
                $or: [
                    { _id: tecnicoId },
                    { _id: new ObjectId(tecnicoId) }
                ]
            };
        } else if (tecnicoId instanceof ObjectId) {
            query = { _id: tecnicoId };
        }

        const user = await usuariosCollection.findOne(query);

        if (!user || !user.pushToken) {
            console.log(`[PushNotification] Técnico ${tecnicoId} não possui pushToken registrado.`);
            return;
        }

        console.log(`[PushNotification] Enviando notificação para o técnico ${user.nome || user.name}...`);

        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                to: user.pushToken,
                sound: "default",
                title: title,
                body: body,
                data: { tecnicoId }
            })
        });

        const result = await response.json();
        console.log("[PushNotification] Resultado do envio:", JSON.stringify(result));
    } catch (error) {
        console.error("[PushNotification] Erro ao enviar notificação push:", error);
    }
};
