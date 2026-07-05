import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import apiRedirect from "./routes/index.js";
import { StatusCodes } from "http-status-codes";
import chalk from "../chalk-stub.js";

const server = express();

server.use(morgan("dev"));
server.use(cors());
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

// Rotas da API
server.use("/api/v1", apiRedirect);
server.use("/pages", express.static(path.resolve("./public/pages")));

// 404 Error Handler
server.use((req, res) => {
    console.log(chalk.yellow("Sistema 💻 : Rota não encontrada"));
    return res.status(StatusCodes.NOT_FOUND).json({
        error: {
            message: "Not Found",
            status: StatusCodes.NOT_FOUND,
        },
    });
});

// Exporta o handler para o Vercel
export default function handler(req, res) {
    server(req, res);
}