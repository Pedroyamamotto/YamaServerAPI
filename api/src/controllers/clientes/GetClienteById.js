import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

export const getClienteById = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID invalido" });
    }

    try {
        const db = await getDb();
        const clientesCollection = db.collection("clientes");

        const cliente = await clientesCollection.findOne({ _id: new ObjectId(id) });

        if (!cliente) {
            return res.status(404).json({ error: "Cliente nao encontrado" });
        }

        console.log(chalk.blue(`Sistema: Cliente encontrado: ${id}`));

        return res.status(200).json({
            message: "Cliente encontrado com sucesso!",
            cliente,
        });
    } catch (error) {
        console.error("Erro ao buscar cliente:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
