// filepath: d:\Projeto de Aulas\api Mongo\api\controllers\users\Delete.js
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js"; 
import chalk from "../../chalk-stub.js";

export async function deleteUser(req, res) {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID inválido" });
    }

    const db = await getDb();
    const usuariosCollection = db.collection("usuários");
    
    try {
        const result = await usuariosCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        return res.status(200).json({ message: "Usuário deletado com sucesso" });
    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
}