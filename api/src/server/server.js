import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import apiRedirect from "../routes/index.js";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { StatusCodes } from "http-status-codes";
import chalk from "../chalk-stub.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import { getDb } from "../db.js";

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve("./public/uploads")));

// configuração da sessão
getDb().then(db => {
    app.use(
        session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({ client: db.client }),
            cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 dia
        })
    );
}
    );

// Busca as Rotas
app.use("/api/v1", apiRedirect);
app.use("/api", apiRedirect); // alias sem /v1 para compatibilidade com o app mobile
app.use("/pages", express.static(path.resolve("./public/pages")));
app.use("/assets", express.static(path.resolve("./public/assets")));

// configuração de documentação do Swagger
const opotions = {
    definition: {
        openapi: "3.1.0",
        info: {
            title: "API Bling",
            version: "1.0.0",
            description: "API para integração com o Bling"
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 3000}/api/v1`
            }
        ]
    },
    apis: ["./controllers/*/*.js", "./routes/*.js"],
}

const specs = swaggerJsdoc(opotions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// erro 404 - rota não encontrada
    app.use((req, res) => {
        console.log(chalk.yellow("Sistema 💻 : Rota não encontrada"));
        return res.status(StatusCodes.NOT_FOUND).json({
            error: {
                message: "Não foi possível encontrar a rota solicitada",
                status: StatusCodes.NOT_FOUND,
            },
        });
    });

// iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(chalk.green(`Sistema 💻 : Servidor rodando na porta ${PORT}`));
});

// Ping automático para evitar que o Render durma
const PING_URL = process.env.PING_URL || "https://apibling-z8wn.onrender.com";
setInterval(() => {
    fetch(PING_URL)
        .then(() => console.log("Ping enviado para manter o Render acordado"))
        .catch(() => console.log("Falha ao enviar ping (Render pode estar dormindo)"));
}, 1000 * 60 * 14); // a cada 14 minutos (menos que 15 para garantir)
