import { getDb } from "../../db.js";
import mongodb from "mongodb";

const { ObjectId } = mongodb;

const ACTIVE_STATUSES = ["aguardando", "atribuido", "iniciado", "pausado"];

function toObjectIdOrString(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (ObjectId.isValid(normalized)) return new ObjectId(normalized);
  return normalized;
}

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

function extractCoordsFromEntity(entity = {}) {
  if (!entity || typeof entity !== "object") return null;

  const candidates = [
    entity,
    entity.location,
    entity.localizacao,
    entity.cliente_location,
    entity.localizacao_cliente,
    entity.endereco,
    entity.endereco_cliente,
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

function getFreshnessPenalty(updatedAt) {
  const ts = new Date(updatedAt || 0).getTime();
  if (!ts || Number.isNaN(ts)) return 3;

  const elapsedMinutes = (Date.now() - ts) / 60000;
  if (elapsedMinutes <= 30) return 0;
  if (elapsedMinutes <= 120) return 1;
  if (elapsedMinutes <= 360) return 2;
  return 4;
}

function resolveServiceCoords(service, client) {
  const serviceCoords = extractCoordsFromEntity(service);
  if (serviceCoords) return serviceCoords;

  const clientCoords = extractCoordsFromEntity(client);
  if (clientCoords) return clientCoords;

  return null;
}

export const suggestNearestTecnico = async (req, res) => {
  const { id } = req.params;
  const includeGerentes = String(req.query.include_gerentes || "true").toLowerCase() !== "false";

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "ID do serviço inválido" });
  }

  try {
    const db = await getDb();
    const servicosCollection = db.collection("servicos");
    const usuariosCollection = db.collection("usuários");
    const clientesCollection = db.collection("clientes");

    const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }

    let client = null;
    const rawClientId = service.cliente_id;
    if (rawClientId) {
      const maybeObjectId = toObjectIdOrString(rawClientId);
      const filters = [{ _id: String(rawClientId) }];
      if (maybeObjectId instanceof ObjectId) filters.unshift({ _id: maybeObjectId });

      for (const filter of filters) {
        // eslint-disable-next-line no-await-in-loop
        const found = await clientesCollection.findOne(filter);
        if (found) {
          client = found;
          break;
        }
      }
    }

    const targetCoords = resolveServiceCoords(service, client);

    const userTypes = includeGerentes ? ["tecnico", "gerente"] : ["tecnico"];
    const usuarios = await usuariosCollection
      .find({ typeUser: { $in: userTypes } })
      .project({
        _id: 1,
        nome: 1,
        name: 1,
        email: 1,
        telefone: 1,
        typeUser: 1,
        lastLocation: 1,
      })
      .toArray();

    const candidatesWithLocation = usuarios
      .map((u) => {
        const coords = extractCoordsFromEntity(u.lastLocation);
        if (!coords) return null;

        return {
          id: String(u._id),
          nome: String(u.nome || u.name || "Técnico"),
          email: String(u.email || ""),
          telefone: String(u.telefone || ""),
          typeUser: String(u.typeUser || "tecnico"),
          lastLocation: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            updated_at: u?.lastLocation?.updated_at || null,
          },
        };
      })
      .filter(Boolean);

    if (candidatesWithLocation.length === 0) {
      return res.status(404).json({
        message: "Nenhum técnico com localização ativa encontrado",
      });
    }

    const workloadAgg = await servicosCollection
      .aggregate([
        { $match: { status: { $in: ACTIVE_STATUSES }, tecnico_id: { $ne: null } } },
        { $group: { _id: "$tecnico_id", total: { $sum: 1 } } },
      ])
      .toArray();

    const workloadMap = new Map();
    workloadAgg.forEach((item) => {
      const idKey = String(item?._id || "");
      if (idKey) workloadMap.set(idKey, Number(item?.total || 0));
    });

    const ranked = candidatesWithLocation
      .map((tecnico) => {
        const activeCount = workloadMap.get(tecnico.id) || 0;
        const freshnessPenalty = getFreshnessPenalty(tecnico.lastLocation?.updated_at);

        let distanceKm = null;
        if (targetCoords) {
          distanceKm = haversineKm(targetCoords, {
            latitude: tecnico.lastLocation.latitude,
            longitude: tecnico.lastLocation.longitude,
          });
        }

        const score =
          (distanceKm != null ? distanceKm : 100000) +
          activeCount * 2 +
          freshnessPenalty;

        return {
          tecnico_id: tecnico.id,
          nome: tecnico.nome,
          email: tecnico.email,
          telefone: tecnico.telefone,
          typeUser: tecnico.typeUser,
          distance_km: distanceKm,
          active_count: activeCount,
          freshness_penalty: freshnessPenalty,
          score,
          lastLocation: tecnico.lastLocation,
        };
      })
      .sort((a, b) => a.score - b.score);

    const suggestion = ranked[0];

    return res.status(200).json({
      message: "Sugestão de técnico calculada com sucesso",
      target: {
        service_id: String(service._id),
        has_coordinates: Boolean(targetCoords),
        coordinates: targetCoords,
      },
      suggestion,
      candidates: ranked.slice(0, 10),
    });
  } catch (error) {
    console.error("Erro ao sugerir técnico mais próximo:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};
