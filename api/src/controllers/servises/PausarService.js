import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;

export const pausarService = async (req, res) => {
    const { id } = req.params;
    const { motivo, data_agendada, turno_agendado } = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID inválido" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        const existingService = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!existingService) {
            return res.status(404).json({ message: "Serviço não encontrado" });
        }

        if (existingService.status === "concluido" || existingService.status === "nao_realizado") {
            return res.status(400).json({ message: "Não é possível pausar um serviço finalizado" });
        }

        let updateData = {};
        if (motivo === "Remarcar o atendimento") {
            updateData = {
                status: "aguardando",
                iniciado_em: null,
                tempo_trabalhado_ms: 0,
                quantidade_pausas: 0,
                pausa_motivo: motivo,
                pausado_em: null,
                data_agendada: data_agendada ? new Date(data_agendada) : null,
                turno_agendado: turno_agendado || null,
                updated_at: new Date()
            };
        } else {
            // Calcula o tempo trabalhado na sessão atual e adiciona ao tempo total
            let tempo_trabalhado_ms = existingService.tempo_trabalhado_ms || 0;
            if (existingService.iniciado_em) {
                const iniciado = new Date(existingService.iniciado_em);
                const agora = new Date();
                tempo_trabalhado_ms += (agora.getTime() - iniciado.getTime());
            }

            updateData = {
                status: "pausado",
                iniciado_em: null, // zera a data de início da sessão atual
                tempo_trabalhado_ms,
                pausa_motivo: motivo,
                pausado_em: new Date(),
                quantidade_pausas: (existingService.quantidade_pausas || 0) + 1,
                updated_at: new Date()
            };

            if (data_agendada) {
                updateData.data_agendada = new Date(data_agendada);
                if (turno_agendado) {
                    updateData.turno_agendado = turno_agendado;
                }
            }
        }

        await servicosCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        return res.status(200).json({ message: "Serviço pausado com sucesso" });
    } catch (error) {
        console.error("Erro ao pausar serviço:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
