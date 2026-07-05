import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";

const getChecklistFromLegacyDoc = (legacyChecklist) => {
    if (!legacyChecklist || typeof legacyChecklist !== "object") {
        return null;
    }

    const entries = Object.entries(legacyChecklist)
        .filter(([key]) => !["_id", "servico_id", "created_at", "updated_at"].includes(key))
        .filter(([, value]) => value === true)
        .map(([key]) => key);

    return entries.length > 0 ? entries : null;
};

export const getServicesAdminCompleto = async (req, res) => {
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const checklistCollection = db.collection("servicos_checklist");
        const fotosCollection = db.collection("servico_fotos");
        const assinaturaCollection = db.collection("servico_assinatura");

        const { status, tecnico_id, cliente_id, pedido_id, numero_pedido } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (tecnico_id) filter.tecnico_id = tecnico_id;
        if (cliente_id) filter.cliente_id = cliente_id;
        if (pedido_id) filter.pedido_id = pedido_id;
        if (numero_pedido) filter.numero_pedido = numero_pedido;

        const services = await servicosCollection
            .find(filter)
            .sort({ created_at: -1 })
            .toArray();

        if (services.length === 0) {
            return res.status(200).json({
                message: "Serviços listados com sucesso!",
                count: 0,
                services: [],
            });
        }

        const serviceIds = services.map((service) => service._id);

        const [legacyChecklists, legacyFotos, legacyAssinaturas] = await Promise.all([
            checklistCollection.find({ servico_id: { $in: serviceIds } }).toArray(),
            fotosCollection.find({ servico_id: { $in: serviceIds } }).toArray(),
            assinaturaCollection.find({ servico_id: { $in: serviceIds } }).toArray(),
        ]);

        const checklistByServiceId = new Map(
            legacyChecklists.map((doc) => [doc.servico_id.toString(), doc])
        );

        const fotosByServiceId = new Map();
        for (const foto of legacyFotos) {
            const key = foto.servico_id.toString();
            if (!fotosByServiceId.has(key)) {
                fotosByServiceId.set(key, []);
            }
            fotosByServiceId.get(key).push(foto.url_foto);
        }

        const assinaturaByServiceId = new Map(
            legacyAssinaturas.map((doc) => [doc.servico_id.toString(), doc.assinatura_url])
        );

        const servicesFormatted = services.map((service) => {
            const serviceId = service._id.toString();
            const legacyChecklist = checklistByServiceId.get(serviceId);
            const legacyChecklistItems = getChecklistFromLegacyDoc(legacyChecklist);
            const legacyFotosUrls = fotosByServiceId.get(serviceId) || [];
            const legacyAssinaturaUrl = assinaturaByServiceId.get(serviceId) || null;
            const fotosUrls = Array.isArray(service.fotos_urls) && service.fotos_urls.length > 0
                ? service.fotos_urls.filter(Boolean)
                : service.foto_url
                    ? [service.foto_url]
                    : legacyFotosUrls;

            const checklist = Array.isArray(service.checklist)
                ? service.checklist
                : legacyChecklistItems;

            const assinaturaUrl = service.assinatura_url || legacyAssinaturaUrl;
            const fotoUrl = service.foto_url || fotosUrls[0] || legacyFotosUrls[0] || null;

            return {
                ...service,
                id: serviceId,
                numero_pedido: service.numero_pedido ?? null,
                checklist: checklist || [],
                fotos: fotosUrls,
                foto_url: fotoUrl,
                fotos_urls: fotosUrls,
                assinatura_url: assinaturaUrl,
                motivo_nao_realizacao:
                    service.motivo_nao_realizacao || service.nao_realizado_motivo || null,
                has_comprovante: !!(service.comprovante_pagamento && service.comprovante_pagamento.fileId),
            };
        });

        console.log(
            chalk.blue(
                `Sistema 💻 : ${servicesFormatted.length} serviço(s) completo(s) carregado(s) para admin 🔍`
            )
        );

        return res.status(200).json({
            message: "Serviços completos listados com sucesso!",
            count: servicesFormatted.length,
            services: servicesFormatted,
        });
    } catch (error) {
        console.error("Erro ao buscar serviços completos para admin:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
