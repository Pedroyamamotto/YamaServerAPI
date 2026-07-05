import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

export const deleteCliente = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID invalido" });
    }

    try {
        const db = await getDb();
        const clientesCollection = db.collection("clientes");

        const existingCliente = await clientesCollection.findOne({ _id: new ObjectId(id) });
        if (!existingCliente) {
            return res.status(404).json({ error: "Cliente nao encontrado" });
        }

        const result = await clientesCollection.deleteOne({ _id: new ObjectId(id) });

        console.log(chalk.red(`Sistema: Cliente deletado com sucesso: ${id}`));

        return res.status(200).json({
            message: "Cliente deletado com sucesso!",
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error("Erro ao deletar cliente:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
