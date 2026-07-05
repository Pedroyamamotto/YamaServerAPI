import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;

export const getPedidoById = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID inválido" });
    }

    try {
        const db = await getDb();
        const pedidosCollection = db.collection("pedidos");

        const pedido = await pedidosCollection.findOne({ _id: new ObjectId(id) });

        if (!pedido) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }

        console.log(chalk.blue(`Sistema 💻 : Pedido encontrado: ${id} 🔍`));

        return res.status(200).json({
            message: "Pedido encontrado com sucesso!",
            pedido,
        });
    } catch (error) {
        console.error("Erro ao buscar pedido:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
