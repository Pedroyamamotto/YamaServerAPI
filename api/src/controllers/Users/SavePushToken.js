import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId } = mongodb;

export const savePushToken = async (req, res) => {
    const { id } = req.params;
    const { pushToken } = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do usuário inválido" });
    }

    if (!pushToken) {
        return res.status(400).json({ message: "pushToken é obrigatório" });
    }

    try {
        const db = await getDb();
        const usuariosCollection = db.collection("usuários");

        const result = await usuariosCollection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    pushToken: pushToken,
                    updated_at: new Date() 
                } 
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        console.log(chalk.blue(`Sistema 💻 : Push Token salvo para o usuário ${id}!`));

        return res.status(200).json({
            message: "Push token salvo com sucesso!",
        });
    } catch (error) {
        console.error("Erro ao salvar push token:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
