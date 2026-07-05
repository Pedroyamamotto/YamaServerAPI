import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

export const getProximasVisitas = async (req, res) => {
    const { tecnicoId } = req.params;
    const { limit = 10 } = req.query;

    if (!ObjectId.isValid(tecnicoId)) {
        return res.status(400).json({ error: "ID de tecnico invalido" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const clientesCollection = db.collection("clientes");
        const pedidosCollection = db.collection("pedidos");

        const agora = new Date();

        // Buscar próximos serviços agendados
        const servicos = await servicosCollection.find({
            tecnico_id: tecnicoId,
            status: { $in: ["novo", "agendado", "em_andamento"] },
            data_agendada: { $gte: agora }
        })
        .sort({ data_agendada: 1, hora_agendada: 1 })
        .limit(parseInt(limit))
        .toArray();

        // Enriquecer com dados completos
        const proximasVisitas = await Promise.all(
            servicos.map(async (servico) => {
                const cliente = await clientesCollection.findOne({
                    _id: new ObjectId(servico.cliente_id)
                });

                const pedido = await pedidosCollection.findOne({
                    _id: new ObjectId(servico.pedido_id)
                });

                return {
                    _id: servico._id,
                    status: servico.status,
                    data_agendada: servico.data_agendada,
                    hora_agendada: servico.hora_agendada,
                    descricao_servico: servico.descricao_servico,
                    observacoes: servico.observacoes,
                    bling_pv_id: pedido?.bling_pv_id || null,
                    tipo_servico: pedido?.tipo_servico || null,
                    modelo_produto: pedido?.modelo_produto || null,
                    cliente: cliente ? {
                        nome: cliente.nome,
                        telefone: cliente.telefone,
                        endereco: `${cliente.numero ? cliente.numero + ', ' : ''}${cliente.bairro}, ${cliente.cidade} - ${cliente.estado}`,
                        endereco_completo: `${cliente.numero ? cliente.numero + ', ' : ''}${cliente.complemento ? cliente.complemento + ', ' : ''}${cliente.bairro}, ${cliente.cidade} - ${cliente.estado}, CEP: ${cliente.cep}`
                    } : null
                };
            })
        );

        console.log(chalk.blue(`Sistema: ${proximasVisitas.length} proxima(s) visita(s) carregada(s)`));

        return res.status(200).json({
            message: "Proximas visitas carregadas com sucesso!",
            total: proximasVisitas.length,
            visitas: proximasVisitas
        });
    } catch (error) {
        console.error("Erro ao carregar proximas visitas:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
