import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;

export const iniciarService = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID inválido" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        const existingService = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!existingService) {
            return res.status(404).json({ message: "Serviço não encontrado" });
        }

        if (existingService.status === "concluido" || existingService.status === "nao_realizado") {
            return res.status(400).json({ message: "Não é possível iniciar um serviço finalizado" });
        }

        const updateData = {
            status: "iniciado",
            iniciado_em: new Date(),
            updated_at: new Date()
        };

        await servicosCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        return res.status(200).json({ message: "Serviço iniciado com sucesso" });
    } catch (error) {
        console.error("Erro ao iniciar serviço:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
