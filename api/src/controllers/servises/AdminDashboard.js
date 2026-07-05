import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";

export const adminDashboard = async (req, res) => {
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const usuariosCollection = db.collection("usuários");

        // Contagens por status usando aggregation (uma única query)
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

            // Técnicos com serviços em aberto (aguardando | atribuido)
            servicosCollection
                .distinct("tecnico_id", {
                    status: { $in: ["aguardando", "atribuido", "iniciado", "pausado"] },
                    tecnico_id: { $exists: true, $ne: null },
                }),
        ]);

        // Mapeia contagens por status
        const countMap = {};
        for (const item of statusCounts) {
            if (item._id) countMap[item._id] = item.count;
        }

        const aguardando = countMap["aguardando"] || 0;
        const atribuidos = (countMap["atribuido"] || 0) + (countMap["agendado"] || 0) + (countMap["iniciado"] || 0) + (countMap["pausado"] || 0);
        const concluidos = countMap["concluido"] || 0;
        const naoRealizados = countMap["nao_realizado"] || 0;
        const total = Object.values(countMap).reduce((sum, v) => sum + v, 0);
        const taxaConclusao =
            total > 0 ? Math.round((concluidos / total) * 100) : 0;

        // Desempenho por técnico (serviços agrupados)
        const desempenhoPorTecnico = await servicosCollection
            .aggregate([
                {
                    $match: {
                        tecnico_id: { $exists: true, $ne: null },
                    },
                },
                {
                    $group: {
                        _id: "$tecnico_id",
                        concluidos: {
                            $sum: { $cond: [{ $eq: ["$status", "concluido"] }, 1, 0] },
                        },
                        nao_realizados: {
                            $sum: { $cond: [{ $eq: ["$status", "nao_realizado"] }, 1, 0] },
                        },
                        pendentes: {
                            $sum: {
                                $cond: [
                                    {
                                        $in: [
                                            "$status",
                                            ["aguardando", "atribuido", "agendado", "em_andamento", "pendente", "iniciado", "pausado"],
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        total: { $sum: 1 },
                    },
                },
                { $sort: { total: -1 } },
            ])
            .toArray();

        // Busca nomes dos técnicos em paralelo
        const tecnicoIds = desempenhoPorTecnico.map((t) => t._id?.toString()).filter(Boolean);
        const tecnicos = await usuariosCollection
            .find({ typeUser: "tecnico" }, { projection: { _id: 1, nome: 1, email: 1, telefone: 1 } })
            .toArray();

        const tecnicoMap = new Map(tecnicos.map((t) => [t._id.toString(), t]));

        const desempenho = desempenhoPorTecnico.map((item) => {
            const tecnico = tecnicoMap.get(item._id?.toString()) || {};
            return {
                tecnico_id: item._id,
                nome: tecnico.nome || "Desconhecido",
                email: tecnico.email || null,
                telefone: tecnico.telefone || null,
                concluidos: item.concluidos,
                nao_realizados: item.nao_realizados,
                pendentes: item.pendentes,
                total: item.total,
                taxa_conclusao:
                    item.total > 0
                        ? Math.round((item.concluidos / item.total) * 100)
                        : 0,
            };
        });

        console.log(chalk.blue(`Sistema 💻 : Dashboard admin carregado 📊`));

        return res.status(200).json({
            message: "Dashboard carregado com sucesso!",
            resumo: {
                aguardando,
                atribuidos,
                concluidos,
                nao_realizados: naoRealizados,
                total,
                taxa_conclusao: taxaConclusao,
                tecnicos_ativos: tecnicosAtivos.length,
            },
            desempenho_tecnicos: desempenho,
        });
    } catch (error) {
        console.error("Erro ao carregar dashboard admin:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
