import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;

export const deleteService = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID inválido" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        const existingService = await servicosCollection.findOne({ _id: new ObjectId(id) });
        
        if (!existingService) {
            return res.status(404).json({ error: "Serviço não encontrado" });
        }

        const result = await servicosCollection.deleteOne({ _id: new ObjectId(id) });

        console.log(chalk.red(`Sistema 💻 : Serviço Deletado com Sucesso: ${id} 🗑️`));

        return res.status(200).json({
            message: "Serviço deletado com sucesso!",
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error("Erro ao deletar serviço:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
