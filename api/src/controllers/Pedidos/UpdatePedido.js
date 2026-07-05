import * as yup from "yup";
import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";

/**
 * Atualiza qualquer campo do serviço via pedido_id
 */
export const updatePedido = async (req, res) => {
    const { id } = req.params;

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        console.log(chalk.blue("🔎 Buscando serviço:"), id);

        const existing = await servicosCollection.findOne({
            pedido_id: String(id),
        });

        if (!existing) {
            return res.status(404).json({
                error: "Pedido não encontrado",
            });
        }

        // 🔒 Campos que NÃO podem ser alterados
        const forbiddenFields = [
            "_id",
            "pedido_id",
            "created_at"
        ];

        // 🧠 Monta update dinâmico
        const updateData = {};

        for (const key in req.body) {
            if (!forbiddenFields.includes(key)) {
                updateData[key] = req.body[key];
            }
        }

        // 🔄 Conversões automáticas inteligentes

        if (updateData.data_agendada) {
            updateData.data_agendada = new Date(updateData.data_agendada);
        }

        if (updateData.concluido_em) {
            updateData.concluido_em = new Date(updateData.concluido_em);
        }

        if (updateData.checkin_data) {
            updateData.checkin_data = new Date(updateData.checkin_data);
        }

        if (updateData.tecnico_id) {
            updateData.tecnico_id = Number(updateData.tecnico_id);
        }

        // 🕒 Sempre atualizar timestamp
        updateData.updated_at = new Date();

        console.log("📦 Atualizando campos:", updateData);

        const result = await servicosCollection.updateOne(
            { pedido_id: String(id) },
            { $set: updateData }
        );

        console.log(
            chalk.green(`✅ Pedido atualizado com sucesso: ${id}`)
        );

        return res.status(200).json({
            message: "Atualizado com sucesso",
            modifiedCount: result.modifiedCount,
            updatedFields: Object.keys(updateData),
        });

    } catch (error) {
        console.error(chalk.red("❌ Erro:"), error);

        return res.status(500).json({
            error: "Erro interno no servidor",
        });
    }
};