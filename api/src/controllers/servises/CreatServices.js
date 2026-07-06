import yup from "yup";
import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";
import { sendPushNotification } from "../../utils/PushNotifications.js";

export const createService = async (req, res) => {
    const servicePayload = Array.isArray(req.body) ? req.body[0] : req.body;

    if (!servicePayload || typeof servicePayload !== "object") {
        return res.status(400).json({ error: ["Payload inválido"] });
    }

    const schema = yup.object().shape({
        numero_pedido: yup.string().required(),
        pedido_id: yup.string().required(),
        cliente_id: yup.string().required(),
        tecnico_id: yup.string().nullable(),
        status: yup.string().nullable(),
        data_agendada: yup.mixed().test('is-date', 'data_agendada inválida', v => v === null || !v || !isNaN(new Date(v))) .required(),
        hora_agendada: yup.string().required(),
        descricao_servico: yup.string().required(),
        observacoes: yup.string().nullable(),
        checkin_data: yup.mixed().test('is-date', 'checkin_data inválido', v => v === null || !v || !isNaN(new Date(v))).nullable(),
        concluido_em: yup.mixed().test('is-date', 'concluido_em inválido', v => v === null || !v || !isNaN(new Date(v))).nullable(),
        nao_realizado_motivo: yup.string().nullable(),
        ordem_de_servico: yup.string().nullable(),
        created_at: yup.mixed().test('is-date', 'created_at inválido', v => v === null || !v || !isNaN(new Date(v))).nullable(),
        updated_at: yup.mixed().test('is-date', 'updated_at inválido', v => v === null || !v || !isNaN(new Date(v))).nullable(),
    });

    try {
        await schema.validate(servicePayload, { abortEarly: false });
    } catch (error) {
        return res.status(400).json({ error: error.errors });
    }

    let {
        numero_pedido,
        pedido_id,
        cliente_id,
        tecnico_id,
        status,
        data_agendada,
        hora_agendada,
        descricao_servico,
        observacoes,
        checkin_data,
        concluido_em,
        nao_realizado_motivo,
        ordem_de_servico,
        created_at,
        updated_at,
    } = servicePayload;

    // Se não vier tecnico_id, define como null
    if (typeof tecnico_id === 'undefined') {
        tecnico_id = null;
    }

    // Garante que status sempre será 'aguardando' ao criar
    status = status && typeof status === 'string' && status.trim() !== '' ? status : 'aguardando';

    // Garante que ordem_de_servico seja null ou valor válido (nunca string vazia ou número aleatório)
    if (!ordem_de_servico || typeof ordem_de_servico !== 'string' || ordem_de_servico.trim() === '') {
        ordem_de_servico = null;
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        const result = await servicosCollection.insertOne({
            numero_pedido: String(numero_pedido),
            pedido_id,
            cliente_id,
            tecnico_id,
            status,
            data_agendada: new Date(data_agendada),
            hora_agendada,
            descricao_servico,
            observacoes: observacoes || null,
            checkin_data: checkin_data ? new Date(checkin_data) : null,
            concluido_em: concluido_em ? new Date(concluido_em) : null,
            nao_realizado_motivo: nao_realizado_motivo || null,
            ordem_de_servico: ordem_de_servico,
            created_at: created_at ? new Date(created_at) : new Date(),
            updated_at: updated_at ? new Date(updated_at) : new Date(),
        });

        console.log(chalk.green(`Sistema 💻 : Serviço Cadastrado com Sucesso: ${result.insertedId} ✅`));

        // Dispara notificação push se houver técnico atribuído
        if (tecnico_id) {
            sendPushNotification(
                tecnico_id,
                "Nova Atribuição de Serviço",
                `Você recebeu o serviço BLING-${numero_pedido}: ${descricao_servico}`
            ).catch(err => console.error("Erro ao disparar push:", err));
        }

        return res.status(201).json({
            message: "Serviço criado com sucesso!",
            serviceId: result.insertedId
        });
    } catch (error) {
        console.error("Erro ao criar serviço:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
