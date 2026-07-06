import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";
import mongodb from "mongodb";
import { sendPushNotification } from "../../utils/PushNotifications.js";
const { ObjectId } = mongodb;

const ACTIVE_SERVICE_STATUSES = ["atribuido", "iniciado", "pausado"];
const AUTO_ASSIGN_MAX_ACTIVE = Math.max(Number.parseInt(process.env.AUTO_ASSIGN_MAX_ACTIVE || "3", 10), 0);
const AUTO_ASSIGN_BATCH = Math.max(Number.parseInt(process.env.AUTO_ASSIGN_BATCH || "1", 10), 1);
const AUTO_ASSIGN_ENABLED = String(process.env.AUTO_ASSIGN_ON_LOCATION || "true").toLowerCase() !== "false";
const AUTO_ASSIGN_ONLY_TECHNICIAN_ID = String(process.env.AUTO_ASSIGN_ONLY_TECHNICIAN_ID || "").trim();

function toNumberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toCoords(candidate = {}) {
    const latitude = toNumberOrNull(candidate.latitude ?? candidate.lat);
    const longitude = toNumberOrNull(candidate.longitude ?? candidate.lng ?? candidate.lon);

    if (latitude == null || longitude == null) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

    return { latitude, longitude };
}

function extractCoords(entity = {}) {
    if (!entity || typeof entity !== "object") return null;

    const candidates = [
        entity,
        entity.location,
        entity.localizacao,
        entity.endereco,
        entity.endereco_cliente,
        entity.localizacao_cliente,
        entity.geo,
        entity.coordinates,
        entity.coordenadas,
    ];

    for (const candidate of candidates) {
        const coords = toCoords(candidate);
        if (coords) return coords;
    }

    return null;
}

function haversineKm(a, b) {
    const toRad = (value) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);

    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function normalizeObjectId(value) {
    const id = String(value || "").trim();
    if (!id) return null;
    if (ObjectId.isValid(id)) return new ObjectId(id);
    return id;
}

function buildUnassignedServiceFilter() {
    return {
        status: "aguardando",
        $or: [
            { tecnico_id: null },
            { tecnico_id: "" },
            { tecnico_id: { $exists: false } },
        ],
    };
}

function buildTecnicoIdQueryVariants(tecnicoId) {
    const variants = [String(tecnicoId)];
    if (ObjectId.isValid(String(tecnicoId))) {
        variants.push(new ObjectId(String(tecnicoId)));
    }
    return variants;
}

function resolveServiceCoords(service, client) {
    const serviceCoords = extractCoords(service);
    if (serviceCoords) return serviceCoords;
    const clientCoords = extractCoords(client);
    if (clientCoords) return clientCoords;
    return null;
}

async function autoAssignServicesForTecnico({ db, tecnicoId, tecnicoNome }) {
    if (!AUTO_ASSIGN_ENABLED) {
        return { assignedCount: 0, reason: "disabled" };
    }

    if (AUTO_ASSIGN_ONLY_TECHNICIAN_ID && String(tecnicoId) !== AUTO_ASSIGN_ONLY_TECHNICIAN_ID) {
        return { assignedCount: 0, reason: "test_mode_other_technician" };
    }

    const servicosCollection = db.collection("servicos");
    const clientesCollection = db.collection("clientes");
    const usuariosCollection = db.collection("usuários");

    const tecnicoIdVariants = buildTecnicoIdQueryVariants(tecnicoId);
    const activeCount = await servicosCollection.countDocuments({
        tecnico_id: { $in: tecnicoIdVariants },
        status: { $in: ACTIVE_SERVICE_STATUSES },
    });

    const capacity = Math.max(AUTO_ASSIGN_MAX_ACTIVE - activeCount, 0);
    if (capacity <= 0) {
        return { assignedCount: 0, reason: "capacity_reached", activeCount };
    }

    const pending = await servicosCollection
        .find(buildUnassignedServiceFilter())
        .sort({ created_at: 1 })
        .limit(60)
        .toArray();

    if (pending.length === 0) {
        return { assignedCount: 0, reason: "no_pending", activeCount };
    }

    const workloadAgg = await servicosCollection
        .aggregate([
            {
                $match: {
                    status: { $in: ACTIVE_SERVICE_STATUSES },
                    tecnico_id: { $ne: null },
                },
            },
            {
                $group: {
                    _id: "$tecnico_id",
                    total: { $sum: 1 },
                },
            },
        ])
        .toArray();

    const workloadByTecnicoId = new Map();
    workloadAgg.forEach((item) => {
        const key = String(item?._id || "").trim();
        if (!key) return;
        workloadByTecnicoId.set(key, Number(item?.total || 0));
    });

    const allTecnicos = await usuariosCollection
        .find({ typeUser: "tecnico" })
        .project({
            _id: 1,
            nome: 1,
            name: 1,
            lastLocation: 1,
        })
        .toArray();

    const eligibleTecnicos = allTecnicos
        .map((tecnico) => {
            const idStr = String(tecnico?._id || "").trim();
            if (!idStr) return null;

            if (AUTO_ASSIGN_ONLY_TECHNICIAN_ID && idStr !== AUTO_ASSIGN_ONLY_TECHNICIAN_ID) {
                return null;
            }

            const coords = extractCoords(tecnico?.lastLocation);
            if (!coords) return null;

            const workload = Number(workloadByTecnicoId.get(idStr) || 0);
            const capacityLeft = Math.max(AUTO_ASSIGN_MAX_ACTIVE - workload, 0);
            if (capacityLeft <= 0) return null;

            return {
                id: idStr,
                nome: String(tecnico?.nome || tecnico?.name || "Técnico"),
                location: coords,
                workload,
                capacityLeft,
            };
        })
        .filter(Boolean);

    const currentTecnicoEntry = eligibleTecnicos.find((item) => item.id === String(tecnicoId));
    if (!currentTecnicoEntry) {
        return {
            assignedCount: 0,
            reason: "not_eligible_or_no_live_location",
            activeCount,
        };
    }

    const clientIdSet = new Set();
    pending.forEach((service) => {
        const id = String(service?.cliente_id || "").trim();
        if (id) clientIdSet.add(id);
    });

    const clientFilters = [];
    for (const id of clientIdSet) {
        const maybeId = normalizeObjectId(id);
        clientFilters.push({ _id: id });
        if (maybeId instanceof ObjectId) {
            clientFilters.push({ _id: maybeId });
        }
    }

    const clients = clientFilters.length > 0
        ? await clientesCollection.find({ $or: clientFilters }).toArray()
        : [];

    const clientsById = new Map();
    clients.forEach((client) => {
        const idStr = String(client?._id || "");
        if (idStr) clientsById.set(idStr, client);
    });

    const ranked = pending
        .map((service) => {
            const clientId = String(service?.cliente_id || "").trim();
            const client = clientsById.get(clientId) || null;
            const serviceCoords = resolveServiceCoords(service, client);
            if (!serviceCoords) {
                return null;
            }

            let nearestTecnico = null;
            let nearestDistanceKm = Number.POSITIVE_INFINITY;

            eligibleTecnicos.forEach((candidate) => {
                const candidateDistance = haversineKm(candidate.location, serviceCoords);
                if (candidateDistance < nearestDistanceKm) {
                    nearestDistanceKm = candidateDistance;
                    nearestTecnico = candidate;
                    return;
                }

                if (candidateDistance === nearestDistanceKm && nearestTecnico) {
                    if (candidate.workload < nearestTecnico.workload) {
                        nearestTecnico = candidate;
                    }
                }
            });

            if (!nearestTecnico || nearestTecnico.id !== String(tecnicoId)) {
                return null;
            }

            const createdAtMs = new Date(service?.created_at || 0).getTime() || Number.MAX_SAFE_INTEGER;

            return {
                service,
                distanceKm: nearestDistanceKm,
                createdAtMs,
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
            return a.createdAtMs - b.createdAtMs;
        });

    const assignLimit = Math.min(AUTO_ASSIGN_BATCH, capacity, ranked.length);
    const now = new Date();
    const horaAgora = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const assignedServiceIds = [];

    for (let i = 0; i < assignLimit; i += 1) {
        const chosen = ranked[i]?.service;
        if (!chosen?._id) continue;

        // Evita corrida: só atualiza se continuar aguardando e sem técnico.
        // eslint-disable-next-line no-await-in-loop
        const result = await servicosCollection.updateOne(
            {
                _id: chosen._id,
                ...buildUnassignedServiceFilter(),
            },
            {
                $set: {
                    tecnico_id: String(tecnicoId),
                    status: "atribuido",
                    updated_at: now,
                    atribuicao_automatica: true,
                    atribuido_por: "sistema-auto-localizacao",
                    data_agendada: chosen?.data_agendada || now,
                    hora_agendada: chosen?.hora_agendada || horaAgora,
                    observacoes: chosen?.observacoes
                        ? `${chosen.observacoes} | Autoatribuição por localização em tempo real`
                        : "Autoatribuição por localização em tempo real",
                },
            }
        );

        if (result.modifiedCount > 0) {
            const serviceId = String(chosen._id);
            assignedServiceIds.push(serviceId);

            sendPushNotification(
                String(tecnicoId),
                "Nova atribuição automática",
                `Olá ${tecnicoNome || "Técnico"}, você recebeu uma nova OS automaticamente.`
            ).catch((error) => {
                console.error("Erro ao disparar push de autoatribuição:", error?.message || error);
            });
        }
    }

    return {
        assignedCount: assignedServiceIds.length,
        assignedServiceIds,
        activeCount,
        capacity,
        nearestRule: true,
    };
}

export const saveLocation = async (req, res) => {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do usuário inválido" });
    }

    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ message: "latitude e longitude são obrigatórios" });
    }

    try {
        const db = await getDb();
        const usuariosCollection = db.collection("usuários");

        const tecnico = await usuariosCollection.findOne({ _id: new ObjectId(id) }, {
            projection: {
                _id: 1,
                nome: 1,
                name: 1,
                typeUser: 1,
            },
        });

        if (!tecnico) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const result = await usuariosCollection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    lastLocation: {
                        latitude: Number(latitude),
                        longitude: Number(longitude),
                        updated_at: new Date()
                    }
                } 
            }
        );

        console.log(chalk.blue(`Sistema 💻 : Localização salva para o técnico ${id}: ${latitude}, ${longitude}`));

        let autoAssignment = {
            assignedCount: 0,
            reason: "not_tecnico",
        };

        if (String(tecnico?.typeUser || "").toLowerCase() === "tecnico") {
            autoAssignment = await autoAssignServicesForTecnico({
                db,
                tecnicoId: id,
                tecnicoNome: String(tecnico?.nome || tecnico?.name || "Técnico"),
            });
        }

        return res.status(200).json({
            message: "Localização salva com sucesso!",
            autoAssignment,
        });
    } catch (error) {
        console.error("Erro ao salvar localização:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
