"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const tables_1 = __importDefault(require("./routes/tables"));
const orders_1 = __importDefault(require("./routes/orders"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const loyalty_1 = __importDefault(require("./routes/loyalty"));
const employees_1 = __importDefault(require("./routes/employees"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/tables', tables_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/inventory', inventory_1.default);
app.use('/api/loyalty', loyalty_1.default);
app.use('/api/employees', employees_1.default);
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: '*' } });
io.on('connection', (socket) => {
    socket.on('disconnect', () => { });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`API listening on ${PORT}`);
});
