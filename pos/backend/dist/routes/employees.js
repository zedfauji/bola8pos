"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const r = (0, express_1.Router)();
r.get('/', (_req, res) => res.json({ employees: [] }));
r.post('/shifts', (_req, res) => res.json({ ok: true }));
r.get('/performance', (_req, res) => res.json({ metrics: [] }));
exports.default = r;
