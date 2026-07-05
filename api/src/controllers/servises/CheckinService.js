import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

export const checkinService = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID invalido" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        const servicoId = new ObjectId(id);

        const existingService = await servicosCollection.findOne({ _id: servicoId });
        if (!existingService) {
            return res.status(404).json({ error: "Servico nao encontrado" });
        }

        if (existingService.status === "concluido") {
            return res.status(400).json({ error: "Servico ja foi concluido" });
        }

        if (existingService.checkin_data) {
            return res.status(400).json({ 
                error: "Check-in ja realizado",
                checkin_data: existingService.checkin_data
            });
        }

        const updateData = {
            status: "em_andamento",
            checkin_data: new Date(),
            updated_at: new Date()
        };

        await servicosCollection.updateOne(
            { _id: servicoId },
            { $set: updateData }
        );

        console.log(chalk.green(`Sistema: Check-in realizado para servico ${id}`));

        return res.status(200).json({
            message: "Check-in realizado com sucesso!",
            serviceId: id,
            checkin_data: updateData.checkin_data,
            status: "em_andamento"
        });
    } catch (error) {
        console.error("Erro ao fazer check-in:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
