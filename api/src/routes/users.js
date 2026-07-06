import express from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
	createUser,
	loginUser,
	verifyUser,
	resendVerificationCode,
	requestPasswordReset,
	resetPassword,
	logoutUser,
	deleteUser,
	logUserActivity,
	getUserActivities,
	getTecnicos,
	getGerentes,
	updateUser,
	savePushToken,
	saveLocation,
} from "../controllers/Users/index.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - nome
 *         - email
 *         - password
 *         - telefone
 *         - typeUser
 *       properties:
 *         nome:
 *           type: string
 *           description: Nome completo do usuário
 *         email:
 *           type: string
 *           format: email
 *           description: Email do usuário
 *         password:
 *           type: string
 *           description: Senha do usuário
 *         telefone:
 *           type: string
 *           description: Telefone do usuário
 *         typeUser:
 *           type: string
 *           enum: [tecnico, admin]
 *           description: Tipo de usuário
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *     VerifyRequest:
 *       type: object
 *       required:
 *         - email
 *         - code
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         code:
 *           type: string
 *           description: Código de 6 dígitos enviado por email
 *     PasswordResetRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *     PasswordResetConfirm:
 *       type: object
 *       required:
 *         - email
 *         - code
 *         - newPassword
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         code:
 *           type: string
 *           description: Código de reset enviado por email
 *         newPassword:
 *           type: string
 *           description: Nova senha
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Criar novo usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/users", createUser);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Fazer login
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 nome:
 *                   type: string
 *                 typeUser:
 *                   type: string
 *       401:
 *         description: Credenciais inválidas
 *       403:
 *         description: Conta não verificada
 */
router.post("/users/login", loginUser);

/**
 * @swagger
 * /api/users/verify:
 *   post:
 *     summary: Verificar conta de usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyRequest'
 *     responses:
 *       200:
 *         description: Conta verificada com sucesso
 *       400:
 *         description: Código inválido
 *       404:
 *         description: Usuário não encontrado
 */
router.post("/users/verify", verifyUser);

/**
 * @swagger
 * /api/users/resend-verification-code:
 *   post:
 *     summary: Reenviar código de verificação de conta
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Novo código enviado por email
 *       400:
 *         description: Usuário já verificado ou payload inválido
 *       404:
 *         description: Usuário não encontrado
 */
router.post("/users/resend-verification-code", resendVerificationCode);

/**
 * @swagger
 * /api/users/request-password-reset:
 *   post:
 *     summary: Solicitar reset de senha
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordResetRequest'
 *     responses:
 *       200:
 *         description: Código de reset enviado por email
 *       404:
 *         description: Usuário não encontrado
 */
router.post("/users/request-password-reset", requestPasswordReset);

/**
 * @swagger
 * /api/users/reset-password:
 *   post:
 *     summary: Confirmar reset de senha
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordResetConfirm'
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 *       400:
 *         description: Código inválido ou expirado
 */
router.post("/users/reset-password", resetPassword);

/**
 * @swagger
 * /api/users/logout/{id}:
 *   delete:
 *     summary: Fazer logout do usuário
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *       404:
 *         description: Usuário não encontrado
 */
router.delete("/users/logout/:id", logoutUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Deletar usuário
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Usuário deletado com sucesso
 *       404:
 *         description: Usuário não encontrado
 */
router.delete("/users/:id", deleteUser);
router.post("/users/:id/push-token", savePushToken);
router.post("/users/:id/location", saveLocation);

/**
 * @swagger
 * /api/users/activity:
 *   post:
 *     summary: Registrar atividade do usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               action:
 *                 type: string
 *               details:
 *                 type: object
 *     responses:
 *       201:
 *         description: Atividade registrada
 */
router.post("/users/activity", logUserActivity);

/**
 * @swagger
 * /api/users/activity/{userId}:
 *   get:
 *     summary: Obter atividades do usuário
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Lista de atividades
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   action:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   details:
 *                     type: object
 */
router.get("/users/activity/:userId", getUserActivities);

/**
 * @swagger
 * /api/admin/users/tecnicos:
 *   get:
 *     summary: Listar usuários técnicos (admin)
 *     tags: [Admin]
 *     security:
 *       - AdminKey: []
 *     parameters:
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
 *         description: Lista paginada de técnicos
 *       403:
 *         description: Acesso negado
 */
router.get("/admin/users/tecnicos", requireAdmin, getTecnicos);
router.get("/admin/users/gerentes", requireAdmin, getGerentes);
router.patch("/admin/users/:id", requireAdmin, updateUser);

export default router;
