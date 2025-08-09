"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const r = (0, express_1.Router)();
r.get('/', (_req, res) => res.json({ orders: [] }));
r.post('/', (_req, res) => res.json({ ok: true }));
r.post('/:id/send-to-kitchen', (req, res) => {
    res.json({ ok: true, id: req.params.id });
});
r.post('/:id/split', (req, res) => {
    res.json({ ok: true, id: req.params.id });
});
exports.default = r;
