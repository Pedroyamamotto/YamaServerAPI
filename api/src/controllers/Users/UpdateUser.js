import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId } = mongodb;

export const updateUser = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do usuário inválido" });
    }

    try {
        const db = await getDb();
        const usuariosCollection = db.collection("usuários");

        const user = await usuariosCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const updateData = {};
        const allowedFields = ["nome", "name", "email", "telefone", "phone", "typeUser", "gerente_id", "gerenteId"];
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Se passar gerente_id ou gerenteId nulo, limpa
        if (req.body.gerente_id === null) {
            updateData.gerente_id = null;
            updateData.gerenteId = null;
        }

        updateData.updated_at = new Date();

        await usuariosCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        console.log(chalk.blue(`Sistema 💻 : Usuário ${id} atualizado com sucesso! 🔍`));

        return res.status(200).json({
            message: "Usuário atualizado com sucesso!",
        });
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
