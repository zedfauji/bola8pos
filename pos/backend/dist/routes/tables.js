"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const r = (0, express_1.Router)();
r.get('/', (_req, res) => res.json({ tables: [] }));
r.post('/:id/start', (req, res) => {
    const { id } = req.params;
    res.json({ ok: true, id });
});
r.post('/:id/stop', (req, res) => {
    const { id } = req.params;
    res.json({ ok: true, id });
});
exports.default = r;
