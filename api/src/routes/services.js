import express from "express";
const router = express.Router();

// GET comprovante de pagamento (imagem)
import { getComprovantePagamentoImage } from "../controllers/servises/ComprovantePagamento.js";
// Rota para exibir a imagem do comprovante de pagamento
router.get("/admin/services/comprovante/:id", getComprovantePagamentoImage);
import {
    uploadServiceConclusionPhotos,
    uploadServiceContextPhotos,
} from "../middlewares/upload.js";
import multer from "multer";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { requireAdminOrGerente } from "../middlewares/requireAdminOrGerente.js";
import {
    createService,
    adminAtribuirTecnico,
    adminDashboard,
    getServicesAdminLista,
    getServices,
    getServicesAdminCompleto,
    getServiceById,
    getServicePhoto,
    getServiceContextPhoto,
    uploadServiceContextPhotos as uploadServiceContextPhotosController,
    updateService,
    deleteService,
    finalizeService,
    getServiceFinalizacao,
    getTecnicoDashboard,
    marcarNaoRealizado,
    getTecnicoAgenda,
    getServicosPorDia,
    getProximasVisitas,
    checkinService,
    getServiceContextPhotos,
    getServiceInstalacaoPhotos,
    getServiceAllPhotos,
} from "../controllers/servises/index.js";
import { uploadComprovantePagamento, getComprovantePagamento } from "../controllers/servises/ComprovantePagamento.js";
import { removeServicePhoto, desconcluirService } from "../controllers/servises/AdminServiceActions.js";
import { updateServicoCompleto } from "../controllers/servises/updateServicoCompleto.js";
import { iniciarService } from "../controllers/servises/IniciarService.js";
import { pausarService } from "../controllers/servises/PausarService.js";

// Multer para upload de comprovante (até 5 imagens)
const comprovanteUpload = multer({ storage: multer.memoryStorage(), limits: { files: 5, fileSize: 10 * 1024 * 1024 } });

/**
 * @swagger
 * /api/admin/services/{id}/fotos/{tipo}/{fileId}:
 *   delete:
 *     summary: Remover foto de serviço (admin)
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *       - in: path
 *         name: tipo
 *         required: true
 *         schema:
 *           type: string
 *           enum: [porta_cliente, instalacao, conclusao]
 *         description: Tipo da foto
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do arquivo no GridFS
 *     responses:
 *       200:
 *         description: Foto removida com sucesso
 *       404:
 *         description: Serviço ou foto não encontrada
 */
router.delete(
    "/admin/services/:id/fotos/:tipo/:fileId",
    requireAdmin,
    removeServicePhoto
);

/**
 * @swagger
 * /api/admin/services/{id}/desconcluir:
 *   post:
 *     summary: Desconcluir serviço (remover conclusão)
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     responses:
 *       200:
 *         description: Serviço desconcluído com sucesso
 *       404:
 *         description: Serviço não encontrado
 */
router.post(
    "/admin/services/:id/desconcluir",
    requireAdmin,
    desconcluirService
);

/**
 * @swagger
 * /api/admin/services/{id}/comprovante:
 *   post:
 *     summary: Upload de comprovante de pagamento (imagem)
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - comprovante
 *             properties:
 *               comprovante:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Comprovante salvo com sucesso
 *       400:
 *         description: Upload inválido
 *       404:
 *         description: Serviço não encontrado
 */
router.post(
    "/admin/services/:id/comprovante",
    requireAdmin,
    comprovanteUpload.array("comprovante", 5),
    uploadComprovantePagamento
);

/**
 * @swagger
 * /api/admin/services/{id}/comprovante:
 *   get:
 *     summary: Exibir comprovante de pagamento do serviço
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     responses:
 *       200:
 *         description: Dados do comprovante
 *       404:
 *         description: Comprovante não encontrado
 */
router.get(
    "/admin/services/:id/comprovante",
    requireAdmin,
    getComprovantePagamento
);

/**
 * @swagger
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       required:
 *         - numero_pedido
 *         - pedido_id
 *         - cliente_id
 *         - status
 *         - data_agendada
 *         - hora_agendada
 *         - descricao_servico
 *         - status
 *       properties:
 *         numero_pedido:
 *           type: string
 *           description: Número do pedido vinculado ao serviço
 *         pedido_id:
 *           type: string
 *           description: ID do pedido relacionado
 *         cliente_id:
 *           type: string
 *           description: ID do cliente
 *         tecnico_id:
 *           type: string
 *           nullable: true
 *           description: ID do técnico responsável
 *         descricao_servico:
 *           type: string
 *           description: Descrição do serviço
 *         data_agendada:
 *           type: string
 *           format: date-time
 *           description: Data agendada para o serviço
 *         status:
 *           type: string
 *           enum: [aguardando, atribuido, iniciado, pausado, concluido, nao_realizado]
 *           description: Status do serviço
 *         observacoes:
 *           type: string
 *           description: Observações do serviço
 *         hora_agendada:
 *           type: string
 *           description: Hora agendada para o serviço
 *     ServiceFinalization:
 *       type: object
 *       properties:
 *         checklist:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               item:
 *                 type: string
 *               status:
 *                 type: boolean
 *         fotos:
 *           type: array
 *           items:
 *             type: string
 *             description: URLs das fotos
 *         assinatura:
 *           type: string
 *           description: URL da assinatura digital
 *         observacoes:
 *           type: string
 *           description: Observações finais
 */

/**
 * @swagger
 * /api/services:
 *   post:
 *     summary: Criar novo serviço
 *     tags: [Serviços]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Service'
 *     responses:
 *       201:
 *         description: Serviço criado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post("/services", createService);

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Listar serviços
 *     tags: [Serviços]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limite de resultados por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [aguardando, atribuido, iniciado, pausado, concluido, nao_realizado]
 *         description: Filtrar por status
 *       - in: query
 *         name: tecnicoId
 *         schema:
 *           type: string
 *         description: Filtrar por técnico
 *       - in: query
 *         name: clienteId
 *         schema:
 *           type: string
 *         description: Filtrar por cliente
 *       - in: query
 *         name: dataInicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial para filtro
 *       - in: query
 *         name: dataFim
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final para filtro
 *     responses:
 *       200:
 *         description: Lista de serviços
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 services:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Service'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pages:
 *                   type: integer
 */
router.get("/services", getServices);

/**
 * @swagger
 * /api/services/admin/completo:
 *   get:
 *     summary: "[LEGADO] Listar serviços com dados de finalização consolidados"
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [aguardando, atribuido, iniciado, pausado, concluido, nao_realizado]
 *       - in: query
 *         name: tecnico_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: cliente_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: numero_pedido
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de serviços com checklist/foto/assinatura
 */
router.get("/services/admin/completo", getServicesAdminCompleto);

/**
 * @swagger
 * /api/admin/services:
 *   get:
 *     summary: Listar serviços com dados enriquecidos de cliente e técnico (admin)
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [aguardando, atribuido, iniciado, pausado, concluido, nao_realizado]
 *         description: Filtrar por status
 *       - in: query
 *         name: tecnico_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: cliente_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: numero_pedido
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista paginada com nome_cliente, telefone_cliente, endereco_cliente, nome_tecnico
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 count:
 *                   type: integer
 *                 services:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       numero_pedido:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [aguardando, atribuido, iniciado, pausado, concluido, nao_realizado]
 *                       nome_cliente:
 *                         type: string
 *                       telefone_cliente:
 *                         type: string
 *                       endereco_cliente:
 *                         type: string
 *                       nome_tecnico:
 *                         type: string
 *                       data_agendada:
 *                         type: string
 *                         format: date-time
 *                       hora_agendada:
 *                         type: string
 *                       descricao_servico:
 *                         type: string
 *                       checklist:
 *                         type: array
 *                         items:
 *                           type: string
 *                       motivo_nao_realizacao:
 *                         type: string
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado
 */
router.get("/admin/services", requireAdmin, getServicesAdminLista);

/**
 * @swagger
 * /api/gerente/services:
 *   get:
 *     summary: Listar serviços com dados enriquecidos (admin ou gerente)
 *     tags: [Admin]
 *     parameters:
 *       - in: header
 *         name: x-admin-key
 *         schema:
 *           type: string
 *         required: false
 *         description: Chave de admin (quando configurada)
 *       - in: header
 *         name: x-user-type
 *         schema:
 *           type: string
 *           enum: [admin, gerente]
 *         required: false
 *         description: Fallback por perfil de usuário
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [aguardando, atribuido, iniciado, pausado, concluido, nao_realizado]
 *       - in: query
 *         name: tecnico_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: cliente_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: numero_pedido
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista paginada de serviços
 *       403:
 *         description: Acesso negado
 */
router.get("/gerente/services", requireAdminOrGerente, getServicesAdminLista);

/**
 * @swagger
 * /api/services/{id}/admin/atribuir:
 *   patch:
 *     summary: Atribuir técnico e agendar visita (admin)
 *     description: Atualiza o técnico, data e hora agendada de um serviço. Não há mais integração automática com sistemas externos ou geração de ordem de serviço.
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tecnico_id, data_agendada, hora_agendada]
 *             properties:
 *               tecnico_id:
 *                 type: string
 *               data_agendada:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-20"
 *               hora_agendada:
 *                 type: string
 *                 example: "09:00"
 *               observacoes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Técnico atribuído — status muda para "atribuido"
 *       400:
 *         description: Dados obrigatórios ausentes
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Serviço não encontrado
 */
router.patch("/services/:id/admin/atribuir", requireAdmin, adminAtribuirTecnico);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Dashboard administrativo — resumo e desempenho por técnico
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     responses:
 *       200:
 *         description: Estatísticas gerais e desempenho individual de técnicos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resumo:
 *                   type: object
 *                   properties:
 *                     aguardando:
 *                       type: integer
 *                     atribuidos:
 *                       type: integer
 *                     concluidos:
 *                       type: integer
 *                     nao_realizados:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     taxa_conclusao:
 *                       type: integer
 *                     tecnicos_ativos:
 *                       type: integer
 *                 desempenho_tecnicos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tecnico_id:
 *                         type: string
 *                       nome:
 *                         type: string
 *                       concluidos:
 *                         type: integer
 *                       nao_realizados:
 *                         type: integer
 *                       pendentes:
 *                         type: integer
 *                       total:
 *                         type: integer
 *                       taxa_conclusao:
 *                         type: integer
 *       403:
 *         description: Acesso negado
 */
router.get("/admin/dashboard", requireAdmin, adminDashboard);

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     summary: Obter serviço por ID
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     responses:
 *       200:
 *         description: Dados do serviço
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Serviço não encontrado
 */
router.get("/services/:id", getServiceById);

/**
 * @swagger
 * /api/uploads/services/{fileId}:
 *   get:
 *     summary: Baixar foto de serviço armazenada no MongoDB
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do arquivo no GridFS
 *     responses:
 *       200:
 *         description: Conteúdo binário da imagem
 *       404:
 *         description: Foto não encontrada
 */
router.get("/uploads/services/:fileId", getServicePhoto);

/**
 * @swagger
 * /api/uploads/services/context/{fileId}:
 *   get:
 *     summary: Baixar foto de contexto do serviço armazenada no MongoDB
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do arquivo de contexto no GridFS
 *     responses:
 *       200:
 *         description: Conteúdo binário da imagem de contexto
 *       404:
 *         description: Foto de contexto não encontrada
 */
router.get("/uploads/services/context/:fileId", getServiceContextPhoto);

/**
 * @swagger
 * /api/admin/services/{id}/fotos-contexto:
 *   post:
 *     summary: Enviar fotos de contexto (porta do cliente)
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - foto
 *             properties:
 *               foto:
 *                 type: array
 *                 maxItems: 5
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Fotos de contexto enviadas com sucesso
 *       400:
 *         description: Upload inválido
 *       404:
 *         description: Serviço não encontrado
 */
router.post(
    "/admin/services/:id/fotos-contexto",
    requireAdmin,
    uploadServiceContextPhotos,
    uploadServiceContextPhotosController
);

/**
 * @swagger
 * /api/admin/services/{id}/fotos-contexto:
 *   get:
 *     summary: Listar fotos de contexto (porta do cliente)
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de fotos de contexto
 *       404:
 *         description: Serviço não encontrado
 */
router.get("/admin/services/:id/fotos-contexto", requireAdmin, getServiceContextPhotos);

/**
 * @swagger
 * /api/services/{id}/fotos-instalacao:
 *   get:
 *     summary: Listar fotos de instalação do serviço
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de fotos de instalação
 *       404:
 *         description: Serviço não encontrado
 */
router.get("/services/:id/fotos-instalacao", getServiceInstalacaoPhotos);

/**
 * @swagger
 * /api/services/{id}/fotos:
 *   get:
 *     summary: Listar todas as fotos relacionadas ao serviço
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fotos consolidadas (porta_cliente, instalacoes, conclusao)
 *       404:
 *         description: Serviço não encontrado
 */
router.get("/services/:id/fotos", getServiceAllPhotos);

/**
 * @swagger
 * /api/services/{id}:
 *   patch:
 *     summary: Atualizar serviço
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Payload JSON para marcar como nao_realizado
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [aguardando, atribuido, iniciado, pausado, concluido, nao_realizado]
 *               checklist:
 *                 oneOf:
 *                   - type: string
 *                     description: Array JSON serializado com os itens do checklist
 *                   - type: array
 *                     items:
 *                       type: string
 *               assinatura:
 *                 type: string
 *                 description: Assinatura em base64 ou URL já hospedada
 *               foto:
 *                 type: array
 *                 maxItems: 2
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Envie 1 ou 2 imagens nos formatos image/jpeg, image/jpg, image/png, image/webp, image/heic ou image/heif, com até 10MB por arquivo
 *     responses:
 *       200:
 *         description: Serviço atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 foto_url:
 *                   type: string
 *                   nullable: true
 *                   description: Primeira foto para compatibilidade retroativa
 *                 fotos_urls:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Erro de validação do payload ou do upload
 *       404:
 *         description: Serviço não encontrado
 */
router.patch("/services/:id", uploadServiceConclusionPhotos, updateService);

/**
 * @swagger
 * /api/services/{id}:
 *   delete:
 *     summary: Deletar serviço
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     responses:
 *       200:
 *         description: Serviço deletado com sucesso
 *       404:
 *         description: Serviço não encontrado
 */
router.delete("/services/:id", deleteService);

/**
 * @swagger
 * /api/services/{id}/finalizacao:
 *   post:
 *     summary: Finalizar serviço com checklist, fotos e assinatura
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceFinalization'
 *     responses:
 *       200:
 *         description: Serviço finalizado com sucesso
 *       400:
 *         description: Dados de finalização inválidos
 *       404:
 *         description: Serviço não encontrado
 */
router.post("/services/:id/finalizacao", finalizeService);

/**
 * @swagger
 * /api/services/{id}/finalizacao:
 *   get:
 *     summary: Obter dados de finalização do serviço
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     responses:
 *       200:
 *         description: Dados de finalização
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceFinalization'
 *       404:
 *         description: Serviço não encontrado ou não finalizado
 */
router.get("/services/:id/finalizacao", getServiceFinalizacao);

/**
 * @swagger
 * /api/services/tecnico/{tecnicoId}/dashboard:
 *   get:
 *     summary: Obter estatísticas do dashboard do técnico
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: tecnicoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do técnico
 *     responses:
 *       200:
 *         description: Estatísticas do dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 novos:
 *                   type: integer
 *                   description: Número de serviços novos
 *                 agendados:
 *                   type: integer
 *                   description: Número de serviços agendados
 *                 concluidos:
 *                   type: integer
 *                   description: Número de serviços concluídos
 *                 total:
 *                   type: integer
 *                   description: Total de serviços
 */
router.get("/services/tecnico/:tecnicoId/dashboard", getTecnicoDashboard);

/**
 * @swagger
 * /api/services/tecnico/{tecnicoId}/proximas-visitas:
 *   get:
 *     summary: Listar próximas visitas do técnico
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: tecnicoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do técnico
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Número máximo de visitas a retornar
 *     responses:
 *       200:
 *         description: Lista de próximas visitas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */
router.get("/services/tecnico/:tecnicoId/proximas-visitas", getProximasVisitas);

/**
 * @swagger
 * /api/services/tecnico/{tecnicoId}/agenda:
 *   get:
 *     summary: Obter agenda mensal do técnico
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: tecnicoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do técnico
 *       - in: query
 *         name: mes
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Mês (1-12)
 *       - in: query
 *         name: ano
 *         schema:
 *           type: integer
 *         description: Ano
 *     responses:
 *       200:
 *         description: Agenda mensal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mes:
 *                   type: integer
 *                 ano:
 *                   type: integer
 *                 dias:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Service'
 */
router.get("/services/tecnico/:tecnicoId/agenda", getTecnicoAgenda);

/**
 * @swagger
 * /api/services/tecnico/{tecnicoId}/dia/{data}:
 *   get:
 *     summary: Obter serviços de uma data específica
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: tecnicoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do técnico
 *       - in: path
 *         name: data
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           description: Data no formato DD-MM-YYYY
 *     responses:
 *       200:
 *         description: Serviços do dia
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */
router.get("/services/tecnico/:tecnicoId/dia/:data", getServicosPorDia);

/**
 * @swagger
 * /api/services/{id}/nao-realizado:
 *   patch:
 *     summary: Marcar serviço como não realizado
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *                 description: Motivo pelo qual o serviço não foi realizado
 *     responses:
 *       200:
 *         description: Serviço marcado como não realizado
 *       404:
 *         description: Serviço não encontrado
 */
router.patch("/services/:id/nao-realizado", marcarNaoRealizado);

/**
 * @swagger
 * /api/services/{id}/checkin:
 *   patch:
 *     summary: Registrar check-in do técnico no local
 *     tags: [Serviços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     responses:
 *       200:
 *         description: Check-in registrado com sucesso
 *       404:
 *         description: Serviço não encontrado
 */
router.patch("/services/:id/checkin", checkinService);

// Rota para editar serviço e cliente juntos
router.put("/servicos/editar-completo/:id", updateServicoCompleto);

// Rotas para iniciar e pausar serviço
router.patch("/services/:id/iniciar", iniciarService);
router.patch("/services/:id/pausar", pausarService);

export default router;
