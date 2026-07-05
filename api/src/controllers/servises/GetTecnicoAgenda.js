import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

const getUtcDayFromDate = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.getUTCDate();
};

export const getTecnicoAgenda = async (req, res) => {
    const { tecnicoId } = req.params;
    const { mes, ano } = req.query;

    if (!ObjectId.isValid(tecnicoId)) {
        return res.status(400).json({ error: "ID de tecnico invalido" });
    }

    if (!mes || !ano) {
        return res.status(400).json({ error: "Parametros mes e ano sao obrigatorios" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const clientesCollection = db.collection("clientes");

        // Criar range de datas para o mês
        const mesInt = parseInt(mes);
        const anoInt = parseInt(ano);
        const primeiroDia = new Date(anoInt, mesInt - 1, 1);
        const ultimoDia = new Date(anoInt, mesInt, 0, 23, 59, 59, 999);

        // Buscar serviços do técnico no mês
        const servicos = await servicosCollection.find({
            tecnico_id: tecnicoId,
            data_agendada: {
                $gte: primeiroDia,
                $lte: ultimoDia
            }
        }).sort({ data_agendada: 1, hora_agendada: 1 }).toArray();

        // Enriquecer com dados do cliente
        const servicosEnriquecidos = await Promise.all(
            servicos.map(async (servico) => {
                const cliente = await clientesCollection.findOne({
                    _id: new ObjectId(servico.cliente_id)
                });

                return {
                    ...servico,
                    cliente: cliente ? {
                        nome: cliente.nome,
                        telefone: cliente.telefone,
                        endereco: `${cliente.bairro}, ${cliente.cidade} - ${cliente.estado}`
                    } : null
                };
            })
        );

        // Agrupar por dia
        const agendaPorDia = {};
        servicosEnriquecidos.forEach(servico => {
            const dia = getUtcDayFromDate(servico.data_agendada);

            if (!dia) {
                return;
            }

            if (!agendaPorDia[dia]) {
                agendaPorDia[dia] = [];
            }
            agendaPorDia[dia].push(servico);
        });

        console.log(chalk.blue(`Sistema: Agenda carregada para tecnico ${tecnicoId} - ${mes}/${ano}`));

        return res.status(200).json({
            message: "Agenda carregada com sucesso!",
            mes: mesInt,
            ano: anoInt,
            total_servicos: servicos.length,
            agenda: agendaPorDia,
            servicos: servicosEnriquecidos
        });
    } catch (error) {
        console.error("Erro ao carregar agenda do tecnico:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
