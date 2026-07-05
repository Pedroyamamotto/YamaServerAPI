import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;

export const deletePedido = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID inválido" });
    }

    try {
        const db = await getDb();
        const pedidosCollection = db.collection("pedidos");

        const existingPedido = await pedidosCollection.findOne({ _id: new ObjectId(id) });
        
        if (!existingPedido) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }

        const result = await pedidosCollection.deleteOne({ _id: new ObjectId(id) });

        console.log(chalk.red(`Sistema 💻 : Pedido Deletado com Sucesso: ${id} 🗑️`));

        return res.status(200).json({
            message: "Pedido deletado com sucesso!",
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error("Erro ao deletar pedido:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
