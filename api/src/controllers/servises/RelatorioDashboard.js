import { getDb } from "../../db.js";

export const relatorioDashboard = async (req, res) => {
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const usuariosCollection = db.collection("usuários");

        // Contagens por status
        const [statusCounts, tecnicosAtivos] = await Promise.all([
            servicosCollection
                .aggregate([
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 },
                        },
                    },
                ])
                .toArray(),
            servicosCollection.distinct("tecnico_id", {
                status: { $in: ["aguardando", "atribuido", "iniciado", "pausado"] },
                tecnico_id: { $exists: true, $ne: null },
            }),
        ]);

        const countMap = {};
        for (const item of statusCounts) {
            if (item._id) countMap[item._id] = item.count;
        }

        // Padronização dos status
        const aguardando = countMap["aguardando"] || 0;
        const atribuidos = (countMap["atribuido"] || 0) + (countMap["agendado"] || 0) + (countMap["iniciado"] || 0) + (countMap["pausado"] || 0);
        const concluidos = countMap["concluido"] || 0;
        const naoRealizados = countMap["nao_realizado"] || 0;
        // Busca o total real de serviços no banco
        const total = await servicosCollection.countDocuments({});
        const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0;

        // Técnicos
        const tecnicos = await usuariosCollection.countDocuments({ typeUser: "tecnico" });
        // Serviços concluídos, ativos e total por técnico
        const servicosPorTecnicoRaw = await servicosCollection.aggregate([
            { $match: { tecnico_id: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: "$tecnico_id",
                    concluidos: {
                        $sum: { $cond: [{ $eq: ["$status", "concluido"] }, 1, 0] }
                    },
                    ativos: {
                        $sum: { $cond: [{ $in: ["$status", ["aguardando", "atribuido", "iniciado", "pausado"]] }, 1, 0] }
                    },
                    total_tecnico: { $sum: 1 },
                    tempo_total_ms: {
                        $sum: { $cond: [{ $eq: ["$status", "concluido"] }, { $ifNull: ["$tempo_trabalhado_ms", 0] }, 0] }
                    }
                }
            }
        ]).toArray();

        // Buscar dados dos técnicos na tabela usuários
        const usuarios = await usuariosCollection.find({ typeUser: { $in: ["tecnico", "gerente"] } }).toArray();
        const usuarioMap = new Map(usuarios.map(u => [String(u._id), u]));

        // Montar array final, incluindo técnicos sem cadastro
        const servicosPorTecnico = servicosPorTecnicoRaw
            .filter(item => String(item._id).trim() !== "")
            .map(item => {
                const user = usuarioMap.get(String(item._id));
                const tempo_medio_ms = item.concluidos > 0 ? Math.round(item.tempo_total_ms / item.concluidos) : 0;
                return {
                    _id: item._id,
                    nome: user ? user.nome : "Desconhecido",
                    concluidos: item.concluidos,
                    ativos: item.ativos,
                    total_tecnico: item.total_tecnico,
                    tempo_total_ms: item.tempo_total_ms || 0,
                    tempo_medio_ms: tempo_medio_ms,
                    motivo: user ? undefined : "Técnico não cadastrado na tabela usuários"
                };
            });

        // Adicionar técnicos sem serviços (apenas cadastrados)
        usuarios.forEach(user => {
            if (!servicosPorTecnico.find(t => String(t._id) === String(user._id))) {
                servicosPorTecnico.push({
                    _id: user._id,
                    nome: user.nome,
                    concluidos: 0,
                    ativos: 0,
                    total_tecnico: 0,
                    tempo_total_ms: 0,
                    tempo_medio_ms: 0,
                    motivo: "Técnico cadastrado, mas sem serviços registrados"
                });
            }
        });

        // Adicionar entrada para serviços sem técnico
        const semTecnicoCount = await servicosCollection.countDocuments({ $or: [ { tecnico_id: { $exists: false } }, { tecnico_id: null }, { tecnico_id: "" } ] });
        // Não adicionar nada para serviços sem técnico atribuído

        return res.status(200).json({
            aguardando,
            atribuidos,
            concluidos,
            total,
            taxaConclusao,
            tecnicosAtivos: tecnicosAtivos.length,
            naoRealizados,
            pedidosTotais: total,
            tecnicos,
            servicosConcluidosPorTecnico: servicosPorTecnico,
        });
    } catch {
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
