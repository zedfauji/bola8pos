import React, { useContext, useEffect } from "react";
import { TableContext } from "../context/TableContext";
import { fetchTables } from "../services/apiService";

const TableManagement = () => {
    const { tables, updateTables } = useContext(TableContext);

    useEffect(() => {
        fetchTables().then(updateTables);
    }, []);

    return (
        <div>
            <h1>Table Management</h1>
            <ul>
                {tables.map((table) => (
                    <li key={table.id}>{table.number} - {table.status}</li>
                ))}
            </ul>
        </div>
    );
};

export default TableManagement;
