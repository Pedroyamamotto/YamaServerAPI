import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId } = mongodb;
import { updateCliente as updateClienteController } from "../clientes/UpdateCliente.js";

/**
 * Atualiza dados do serviço e do cliente em uma única rota
 * Suporta busca por _id (ObjectId) ou pedido_id (string)
 */
export const updateServicoCompleto = async (req, res) => {
    const { id } = req.params;
    let {
        descricao_servico,
        status,
        data_agendada,
        hora_agendada,
        observacoes,
        cliente_id,
        nome_cliente,
        telefone_cliente,
        endereco_completo,
        nomeAntigo,
        nomeNovo,
        tecnico_id,
        tecnico,
        ...rest
    } = req.body;

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        // Determina query: busca por _id (ObjectId) primeiro, depois por pedido_id (string)
        let servicoQuery = { pedido_id: String(id) };
        if (ObjectId.isValid(id) && String(id).length === 24) {
            const byObjectId = await servicosCollection.findOne({ _id: new ObjectId(id) });
            if (byObjectId) {
                servicoQuery = { _id: new ObjectId(id) };
            }
        }

        // Se cliente_id não veio, buscar pelo nomeAntigo ou pelo próprio serviço
        if (!cliente_id || typeof cliente_id !== 'string' || !ObjectId.isValid(cliente_id)) {
            const clientesCollection = db.collection("clientes");
            let clienteDoc = null;
            if (nomeAntigo && typeof nomeAntigo === 'string' && nomeAntigo.trim() !== '') {
                const nomeAntigoRegex = new RegExp(`^${nomeAntigo.trim().replace(/\s+/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                clienteDoc = await clientesCollection.findOne({ nome: nomeAntigoRegex });
            } else {
                const servicoDoc = await servicosCollection.findOne(servicoQuery);
                if (servicoDoc && (servicoDoc.cliente_id || (servicoDoc.cliente && (servicoDoc.cliente._id || servicoDoc.cliente.id)))) {
                    cliente_id = String(
                        servicoDoc.cliente_id ||
                        (servicoDoc.cliente && (servicoDoc.cliente._id || servicoDoc.cliente.id)) ||
                        ''
                    );
                }
            }
            if (clienteDoc && clienteDoc._id) {
                cliente_id = String(clienteDoc._id);
            }
        }

        // Monta objeto de atualização do serviço
        const updateServico = {};
        if (descricao_servico !== undefined) updateServico.descricao_servico = descricao_servico;
        if (status !== undefined) {
            updateServico.status = status;
        } else if (req.body.concluido_em || req.body.finalizado) {
            updateServico.status = "concluido";
        }
        if (data_agendada !== undefined && data_agendada !== "") updateServico.data_agendada = new Date(data_agendada);
        if (hora_agendada !== undefined) updateServico.hora_agendada = hora_agendada;
        if (observacoes !== undefined) updateServico.observacoes = observacoes;
        if (tecnico_id !== undefined) updateServico.tecnico_id = tecnico_id;
        if (tecnico !== undefined) updateServico.tecnico = tecnico;
        updateServico.updated_at = new Date();

        const servicoResult = await servicosCollection.updateOne(
            servicoQuery,
            { $set: updateServico }
        );

        // Atualiza cliente se cliente_id válido
        let clienteResult = null;
        if (
            cliente_id &&
            typeof cliente_id === 'string' &&
            cliente_id.trim() !== '' &&
            ObjectId.isValid(cliente_id)
        ) {
            const clientesCollection = db.collection("clientes");
            const clienteAtual = await clientesCollection.findOne({ _id: new ObjectId(cliente_id) });
            if (nomeAntigo && clienteAtual && clienteAtual.nome !== nomeAntigo.trim()) {
                return res.status(400).json({ error: "Nome antigo não confere com o cliente encontrado." });
            }
            const clienteBody = {};
            if (nomeNovo && nomeNovo.trim() !== '') clienteBody.nome = nomeNovo.trim();
            if (telefone_cliente && telefone_cliente.trim() !== '') clienteBody.telefone = telefone_cliente;
            if (endereco_completo && endereco_completo.trim() !== '') clienteBody.endereco = endereco_completo;
            for (const [k, v] of Object.entries(rest)) {
                if (typeof v === 'string' && v.trim() === '') continue;
                if (v !== undefined && v !== null) clienteBody[k] = v;
            }
            if (Object.keys(clienteBody).length > 0) {
                const fakeReq = { params: { id: cliente_id }, body: clienteBody };
                let fakeResData = {};
                const fakeRes = {
                    status: (code) => { fakeResData.status = code; return fakeRes; },
                    json: (data) => { fakeResData.data = data; return fakeResData; }
                };
                await updateClienteController(fakeReq, fakeRes);
                clienteResult = fakeResData;
            }
        }

        if (servicoResult.matchedCount === 0) {
            return res.status(404).json({ error: "Serviço não encontrado" });
        }

        return res.status(200).json({
            message: "Serviço e cliente atualizados com sucesso!",
            servico: servicoResult,
            cliente: clienteResult?.data || null
        });
    } catch (error) {
        return res.status(500).json({ error: "Erro interno no servidor", details: error.message });
    }
};
