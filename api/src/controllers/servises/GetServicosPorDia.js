import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

export const getServicosPorDia = async (req, res) => {
    const { tecnicoId, data } = req.params;

    if (!ObjectId.isValid(tecnicoId)) {
        return res.status(400).json({ error: "ID de tecnico invalido" });
    }

    if (!data) {
        return res.status(400).json({ error: "Data e obrigatoria" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const clientesCollection = db.collection("clientes");
        const pedidosCollection = db.collection("pedidos");

        // Parsear data (formato: YYYY-MM-DD) em horário local para evitar deslocamento de timezone
        const [ano, mes, dia] = data.split("-").map(Number);
        if (!ano || !mes || !dia) {
            return res.status(400).json({ error: "Data invalida. Use o formato YYYY-MM-DD" });
        }
        const inicioDia = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
        const fimDia = new Date(ano, mes - 1, dia, 23, 59, 59, 999);

        // Buscar serviços do técnico na data
        const servicos = await servicosCollection.find({
            tecnico_id: tecnicoId,
            data_agendada: {
                $gte: inicioDia,
                $lte: fimDia
            }
        }).sort({ hora_agendada: 1 }).toArray();

        // Enriquecer com dados do cliente e pedido
        const servicosDetalhados = await Promise.all(
            servicos.map(async (servico) => {
                const cliente = await clientesCollection.findOne({
                    _id: new ObjectId(servico.cliente_id)
                });

                const pedido = await pedidosCollection.findOne({
                    _id: new ObjectId(servico.pedido_id)
                });

                return {
                    ...servico,
                    cliente: cliente ? {
                        nome: cliente.nome,
                        telefone: cliente.telefone,
                        cpf: cliente.cpf,
                        endereco_completo: `${cliente.numero ? cliente.numero + ', ' : ''}${cliente.bairro}, ${cliente.cidade} - ${cliente.estado}`,
                        cep: cliente.cep
                    } : null,
                    pedido: pedido ? {
                        bling_pv_id: pedido.bling_pv_id,
                        modelo_produto: pedido.modelo_produto,
                        tipo_servico: pedido.tipo_servico
                    } : null
                };
            })
        );

        console.log(chalk.blue(`Sistema: ${servicos.length} servico(s) encontrado(s) para ${data}`));

        return res.status(200).json({
            message: "Servicos do dia carregados com sucesso!",
            data,
            total: servicos.length,
            servicos: servicosDetalhados
        });
    } catch (error) {
        console.error("Erro ao carregar servicos do dia:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
