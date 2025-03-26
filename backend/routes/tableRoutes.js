const express = require("express");
const router = express.Router();
const { createTable, updateTable, deleteTable } = require("../models/Table");

router.post("/", async (req, res) => {
    try {
        const table = await createTable(req.body.number, req.body.type);
        res.json(table);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const table = await updateTable(req.params.id, req.body.status);
        res.json(table);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const response = await deleteTable(req.params.id);
        res.json(response);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
