import yup from "yup";
import chalk from "chalk";
import { getDb } from "../../db.js";
import { ObjectId } from "mongodb";
import fetch from "node-fetch";
import { sendTecnicoAssignmentConfirmationEmail } from "../../../utils/EmailServices.js";

const ASSIGNMENT_WEBHOOK_URL = process.env.ASSIGNMENT_WEBHOOK_URL || "https://yamamotto-dev.app.n8n.cloud/webhook/Conclusão";

const schema = yup.object().shape({
    tecnico_id: yup.mixed().required("tecnico_id é obrigatório"),
    tecnico: yup.string().trim(),
    data_agendada: yup.string().required("data_agendada é obrigatória"),
    hora_agendada: yup
        .string()
        .matches(/^\d{2}:\d{2}$/, "hora_agendada deve estar no formato HH:MM")
        .required("hora_agendada é obrigatória"),
    observacoes: yup.string(),
});

function logStructured(level, event, data = {}) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        event,
        ...data,
    };

    const line = JSON.stringify(payload);
    if (level === "error") {
        console.error(line);
        return;
    }

    if (level === "warn") {
        console.warn(line);
        return;
    }

    console.log(line);
}

function serializeService(service, fallbackId = null) {
    if (!service) {
        return null;
    }

    const { _id, ...rest } = service;
    const resolvedId = typeof _id === "string"
        ? _id
        : typeof _id?.toHexString === "function"
            ? _id.toHexString()
            : fallbackId;

    // Garante que ordem_de_servico sempre exista, mesmo se null
    return {
        id: resolvedId,
        ...rest,
        ordem_de_servico: typeof rest.ordem_de_servico !== "undefined" ? rest.ordem_de_servico : null,
    };
}

async function findTecnicoById(usuariosCollection, tecnicoId) {
    if (!tecnicoId) {
        return null;
    }

    const normalizedId = String(tecnicoId).trim();
    const filters = [{ _id: normalizedId }];

    if (ObjectId.isValid(normalizedId)) {
        filters.unshift({ _id: new ObjectId(normalizedId) });
    }

    for (const filter of filters) {
        const tecnico = await usuariosCollection.findOne(filter, {
            projection: { _id: 1, nome: 1, name: 1, email: 1, typeUser: 1 },
        });

        if (tecnico) {
            return tecnico;
        }
    }

    return null;
}

function toObjectIdOrString(value) {
    const normalized = String(value || "").trim();

    if (!normalized) {
        return null;
    }

    if (ObjectId.isValid(normalized)) {
        return new ObjectId(normalized);
    }

    return normalized;
}

async function findByFlexibleId(collection, idValue, projection = {}) {
    if (!collection) {
        return null;
    }

    const normalized = String(idValue || "").trim();

    if (!normalized) {
        return null;
    }

    const objectIdOrString = toObjectIdOrString(normalized);
    const filters = [{ _id: normalized }];

    if (objectIdOrString instanceof ObjectId) {
        filters.unshift({ _id: objectIdOrString });
    }

    for (const filter of filters) {
        const item = await collection.findOne(filter, { projection });
        if (item) {
            return item;
        }
    }

    return null;
}

function getCollectionIfAvailable(db, collectionName) {
    try {
        return db.collection(collectionName);
    } catch (error) {
        logStructured("warn", "optional_collection_unavailable", {
            collectionName,
            error: error?.message || "colecao indisponivel",
        });
        return null;
    }
}

function formatEndereco(cliente = {}) {
    const safeCliente = cliente || {};

    return [
        safeCliente.rua || safeCliente?.endereco?.rua,
        safeCliente.numero || safeCliente?.endereco?.numero,
        safeCliente.complemento || safeCliente?.endereco?.complemento,
        safeCliente.bairro || safeCliente?.endereco?.bairro,
        safeCliente.cidade || safeCliente?.endereco?.cidade,
        safeCliente.estado || safeCliente?.endereco?.estado,
        safeCliente.cep || safeCliente?.endereco?.cep,
    ].filter(Boolean).join(", ");
}

function formatDatePtBr(dateValue) {
    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString("pt-BR");
}

function resolveAssignmentRequester(req) {
    const headers = req.headers || {};

    const email = String(
        headers["x-user-email"] ||
        headers["x-assigned-by-email"] ||
        req.body?.atribuido_por_email ||
        ""
    ).trim();

    const nome = String(
        headers["x-user-name"] ||
        headers["x-assigned-by-name"] ||
        req.body?.atribuido_por_nome ||
        ""
    ).trim();

    const id = String(
        headers["x-user-id"] ||
        headers["x-assigned-by-id"] ||
        req.body?.atribuido_por_id ||
        ""
    ).trim();

    return {
        email: email || null,
        nome: nome || null,
        id: id || null,
    };
}

async function sendAtribuicaoWebhook(payload) {
    try {
        const webhookUrl = encodeURI(ASSIGNMENT_WEBHOOK_URL);
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const responseBody = await response.text();
            throw new Error(`Webhook retornou ${response.status}: ${responseBody}`);
        }

        return { ok: true };
    } catch (error) {
        logStructured("warn", "admin_atribuir_tecnico_webhook_failed", {
            webhookUrl: ASSIGNMENT_WEBHOOK_URL,
            error: error?.message || "erro ao enviar webhook",
        });

        return { ok: false, error: error?.message || "erro ao enviar webhook" };
    }
}


// Permite injeção de automação nos testes
let automationRunner = null;
export function setAutomationRunnerForTests(runner) {
    automationRunner = runner;
}
export function resetAutomationRunnerForTests() {
    automationRunner = null;
}

export const adminAtribuirTecnico = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do serviço inválido" });
    }

    try {
        await schema.validate(req.body, { abortEarly: false });
    } catch (error) {
        return res.status(400).json({ message: error.errors?.[0] || "Dados inválidos" });
    }

    const { tecnico_id, tecnico: tecnicoNomeInformado, data_agendada, hora_agendada, observacoes } = req.body;
    const requester = resolveAssignmentRequester(req);

    logStructured("info", "admin_atribuir_tecnico_started", {
        serviceId: id,
        tecnicoId: tecnico_id,
    });

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const pedidosCollection = getCollectionIfAvailable(db, "pedidos");
        const clientesCollection = getCollectionIfAvailable(db, "clientes");
        const usuariosCollection = db.collection("usuários");

        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            return res.status(404).json({ message: "Serviço não encontrado" });
        }

        const tecnico = await findTecnicoById(usuariosCollection, tecnico_id);
        if (!tecnico) {
            return res.status(404).json({ message: "Técnico não encontrado com o ID fornecido" });
        }

        // Usar o nome do técnico do banco, com fallback para o informado na requisição
        const tecnicoNome = String(tecnicoNomeInformado || tecnico?.nome || tecnico?.name || "").trim();
        if (!tecnicoNome) {
            return res.status(400).json({ message: "Nome do técnico não conseguiu ser resolvido. Verifique se o técnico tem um nome definido no sistema." });
        }

        const updateData = {
            tecnico_id,
            data_agendada: new Date(data_agendada),
            hora_agendada,
            status: "atribuido",
            updated_at: new Date(),
        };
        if (observacoes !== undefined) {
            updateData.observacoes = observacoes;
        }

        const numeroPedido = service.numero_pedido;

        // Integração de automação removida: atribuição é apenas local
        let ordemDeServico = null;

        await servicosCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        const updatedService = await servicosCollection.findOne({ _id: new ObjectId(id) });
        const [cliente, pedido] = await Promise.all([
            findByFlexibleId(clientesCollection, updatedService?.cliente_id, {
                _id: 1,
                nome: 1,
                email: 1,
                telefone: 1,
                celular: 1,
                cpf: 1,
                rua: 1,
                numero: 1,
                complemento: 1,
                bairro: 1,
                cidade: 1,
                estado: 1,
                cep: 1,
                endereco: 1,
            }),
            findByFlexibleId(pedidosCollection, updatedService?.pedido_id, {
                _id: 1,
                bling_pv_id: 1,
                modelo_produto: 1,
                tipo_servico: 1,
                tem_instalacao: 1,
                data_agendamento: 1,
                observacoes: 1,
            }),
        ]);

        const enderecoInstalacao = formatEndereco(cliente);
        const dataInstalacaoFormatada = formatDatePtBr(updatedService?.data_agendada || data_agendada);
        const descricaoInstalacao = updatedService?.descricao_servico || "";

        const webhookPayload = {
            evento: "atribuicao_tecnico",
            nome_tecnico: tecnicoNome,
            data_da_instalacao: dataInstalacaoFormatada,
            local: enderecoInstalacao,
            o_que_vai_ser_instalado: descricaoInstalacao,
            dados_do_cliente: {
                id: cliente?._id?.toString?.() || updatedService?.cliente_id || null,
                nome: cliente?.nome || null,
                email: cliente?.email || null,
                telefone: cliente?.celular || cliente?.telefone || null,
                cpf: cliente?.cpf || null,
                endereco: enderecoInstalacao || null,
            },
            dados_da_instalacao: {
                service_id: id,
                numero_pedido: updatedService?.numero_pedido || null,
                pedido_id: updatedService?.pedido_id || null,
                data_agendada: updatedService?.data_agendada || null,
                hora_agendada: updatedService?.hora_agendada || null,
                status: updatedService?.status || null,
                observacoes: updatedService?.observacoes || null,
                descricao_servico: descricaoInstalacao || null,
                modelo_produto: pedido?.modelo_produto || null,
                tipo_servico: pedido?.tipo_servico || null,
                pedido_observacoes: pedido?.observacoes || null,
            },
            atribuicao: {
                atribuido_em: new Date().toISOString(),
                atribuido_por: {
                    id: requester.id,
                    nome: requester.nome,
                    email: requester.email,
                },
            },
        };

        const webhookResult = await sendAtribuicaoWebhook(webhookPayload);

        if (requester.email) {
            await sendTecnicoAssignmentConfirmationEmail(requester.email, {
                assignedByName: requester.nome,
                tecnicoNome,
                dataInstalacao: dataInstalacaoFormatada,
                horaInstalacao: updatedService?.hora_agendada || hora_agendada,
                localInstalacao: enderecoInstalacao,
                descricaoServico: descricaoInstalacao,
                clienteNome: cliente?.nome,
                numeroPedido: updatedService?.numero_pedido,
                serviceId: id,
            });
        } else {
            logStructured("warn", "admin_atribuir_tecnico_missing_requester_email", {
                serviceId: id,
                message: "Nao foi possivel enviar e-mail de confirmacao porque nenhum e-mail de responsavel foi informado.",
            });
        }

        console.log(chalk.blue(`Sistema 💻 : Técnico ${tecnico_id} atribuído para serviço ${id} 📋`));
        logStructured("info", "admin_atribuir_tecnico_success", {
            serviceId: id,
            numeroPedido: String(numeroPedido),
            tecnico: tecnicoNome,
            automacaoDesativada: !ordemDeServico,
            webhookSent: webhookResult.ok,
        });

        return res.status(200).json({
            success: true,
            message: ordemDeServico
                ? "Técnico atribuído e ordem de serviço gerada com sucesso!"
                : "Técnico atribuído com sucesso! (automação desativada)",
            service: serializeService(updatedService, id),
            tecnico_utilizado: tecnicoNome,
            automacao: ordemDeServico
                ? {
                    desativada: false,
                    ordemDeServico,
                    motivo: null,
                }
                : {
                    desativada: true,
                    motivo: "Automação do Bling desativada nesta rota.",
                },
            webhook: {
                sent: webhookResult.ok,
                url: ASSIGNMENT_WEBHOOK_URL,
                error: webhookResult.error || null,
            },
        });
    } catch (error) {
        console.error("Erro ao atribuir técnico:", error);
        if (error && error.stack) {
            console.error("Stack:", error.stack);
        }
        logStructured("error", "admin_atribuir_tecnico_failed", {
            serviceId: id,
            error: error?.message || "erro interno",
            stack: error?.stack || null,
        });
        return res.status(500).json({ message: error?.message || "Erro interno no servidor" });
    }
};
