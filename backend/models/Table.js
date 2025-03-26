const pool = require("../config/db");

const createTable = async (number, type) => {
    const result = await pool.query("INSERT INTO tables (number, type, status) VALUES ($1, $2, 'available') RETURNING *", [number, type]);
    return result.rows[0];
};

const updateTable = async (id, status) => {
    const result = await pool.query("UPDATE tables SET status=$1 WHERE id=$2 RETURNING *", [status, id]);
    return result.rows[0];
};

const deleteTable = async (id) => {
    await pool.query("DELETE FROM tables WHERE id=$1", [id]);
    return { message: "Table deleted" };
};

module.exports = { createTable, updateTable, deleteTable };
