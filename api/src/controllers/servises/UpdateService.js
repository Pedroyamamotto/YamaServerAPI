import yup from "yup";
import chalk from "chalk";
import { getDb } from "../../db.js";
import { ObjectId } from "mongodb";
import {
    deleteServicePhotos,
    saveServicePhotos,
} from "../../services/servicePhotoStorage.js";

const normalizeStoredPhotoUrls = (service = {}) => {
    if (Array.isArray(service.fotos_urls) && service.fotos_urls.length > 0) {
        return service.fotos_urls.filter(Boolean);
    }

    if (service.foto_url) {
        return [service.foto_url];
    }

    return [];
};

const parseChecklistInput = (checklist) => {
    if (checklist === undefined || checklist === null || checklist === "") {
        return undefined;
    }

    if (Array.isArray(checklist)) {
        return checklist;
    }

    if (typeof checklist === "string") {
        const parsed = JSON.parse(checklist);
        if (!Array.isArray(parsed)) {
            throw new Error("Campo checklist deve ser um array de strings");
        }
        return parsed;
    }

    throw new Error("Formato inválido para checklist");
};

export const updateService = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID inválido" });
    }

    const schema = yup.object().shape({
        pedido_id: yup.string(),
        numero_pedido: yup.string(),
        cliente_id: yup.string(),
        tecnico_id: yup.mixed(),
        status: yup.string(),
        data_agendada: yup.date(),
        hora_agendada: yup.string(),
        descricao_servico: yup.string(),
        observacoes: yup.string(),
        checkin_data: yup.date(),
        concluido_em: yup.date(),
        nao_realizado_motivo: yup.string(),
        motivo_nao_realizacao: yup.string(),
        motivo_sem_comprovante: yup.string(),
        assinatura: yup.string(),
        assinatura_url: yup.string(),
    });

    const isMultipart = req.is("multipart/form-data");
    const incomingBody = { ...req.body };

    try {
        if (incomingBody.checklist !== undefined) {
            incomingBody.checklist = parseChecklistInput(incomingBody.checklist);
        }
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }

    try {
        await schema.validate(incomingBody, { abortEarly: false });
    } catch (error) {
        return res.status(400).json({ message: error.errors?.[0] || "Dados inválidos" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        const existingService = await servicosCollection.findOne({ _id: new ObjectId(id) });
        
        if (!existingService) {
            return res.status(404).json({ message: "Serviço não encontrado" });
        }

        const updateData = { ...incomingBody };

        if (updateData.assinatura && !updateData.assinatura_url) {
            updateData.assinatura_url = updateData.assinatura;
        }

        if (updateData.status === "nao_realizado" && updateData.motivo_nao_realizacao) {
            updateData.nao_realizado_motivo = updateData.motivo_nao_realizacao;
        }

        if (updateData.status === "concluido") {
            if (!updateData.checklist || !Array.isArray(updateData.checklist) || updateData.checklist.length === 0) {
                return res.status(400).json({ message: "Checklist é obrigatório para concluir serviço" });
            }
            if (!updateData.assinatura && !updateData.assinatura_url) {
                return res.status(400).json({ message: "Assinatura é obrigatória para concluir serviço" });
            }
            if (isMultipart && Array.isArray(req.files) && req.files.length > 0) {
                try {
                    const uploadedPhotos = await saveServicePhotos(req.files, id);
                    updateData.fotos_urls = uploadedPhotos.map((photo) => photo.url);
                    updateData.foto_url = updateData.fotos_urls[0] ?? null;
                    const previousPhotoUrls = normalizeStoredPhotoUrls(existingService);
                    if (previousPhotoUrls.length > 0) {
                        await deleteServicePhotos(previousPhotoUrls);
                    }
                    // Envia para o n8n como tipo "instalacao" se houver fotos
                    const { cliente_id, numero_pedido } = existingService;
                    const { saveServiceContextPhotos } = await import("../../services/servicePhotoStorage.js");
                    await saveServiceContextPhotos(req.files, {
                        serviceId: id,
                        tipo: "instalacao",
                        numeroPedido: numero_pedido,
                        idCliente: cliente_id,
                    });
                } catch (error) {
                    console.error("Erro ao salvar fotos da conclusão do serviço no MongoDB:", {
                        serviceId: id,
                        message: error.message,
                    });
                    return res.status(500).json({ message: "Erro ao salvar fotos do serviço" });
                }
            }
            updateData.concluido_em = new Date();
            
            // Calcula o tempo trabalhado final se o serviço estiver iniciado e adiciona ao tempo total
            let tempo_trabalhado_ms = existingService.tempo_trabalhado_ms || 0;
            if (existingService.iniciado_em) {
                const iniciado = new Date(existingService.iniciado_em);
                const agora = new Date();
                tempo_trabalhado_ms += (agora.getTime() - iniciado.getTime());
            }
            updateData.tempo_trabalhado_ms = tempo_trabalhado_ms;
            updateData.iniciado_em = null; // Zera iniciado_em ao concluir
        }

        if (updateData.status === "nao_realizado" && !updateData.nao_realizado_motivo) {
            return res.status(400).json({ message: "motivo_nao_realizacao é obrigatório para status nao_realizado" });
        }

        // Converter datas se fornecidas
        if (updateData.data_agendada) {
            updateData.data_agendada = new Date(updateData.data_agendada);
        }
        if (updateData.checkin_data) {
            updateData.checkin_data = new Date(updateData.checkin_data);
        }
        if (updateData.concluido_em) {
            updateData.concluido_em = new Date(updateData.concluido_em);
        }

        updateData.updated_at = new Date();

        const result = await servicosCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        const finalPhotoUrls = Array.isArray(updateData.fotos_urls)
            ? updateData.fotos_urls
            : normalizeStoredPhotoUrls(existingService);
        const finalPhotoUrl = updateData.foto_url ?? finalPhotoUrls[0] ?? null;

        console.log(chalk.yellow(`Sistema 💻 : Serviço Atualizado com Sucesso: ${id} 🔄`));

        if (updateData.status === "concluido") {
            return res.status(200).json({
                success: true,
                message: "Serviço concluído",
                foto_url: finalPhotoUrl,
                fotos_urls: finalPhotoUrls,
            });
        }

        if (updateData.status === "nao_realizado") {
            return res.status(200).json({
                success: true,
                message: "Serviço atualizado",
                foto_url: finalPhotoUrl,
                fotos_urls: finalPhotoUrls,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Serviço atualizado com sucesso!",
            modifiedCount: result.modifiedCount,
            foto_url: finalPhotoUrl,
            fotos_urls: finalPhotoUrls,
        });
    } catch (error) {
        console.error("Erro ao atualizar serviço:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
