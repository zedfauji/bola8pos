"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const r = (0, express_1.Router)();
r.get('/', (_req, res) => res.json({ customers: [] }));
r.post('/redeem', (_req, res) => res.json({ ok: true }));
r.post('/promotion', (_req, res) => res.json({ ok: true }));
exports.default = r;
