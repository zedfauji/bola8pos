import { createContext, useState } from "react";

export const TableContext = createContext();

export const TableProvider = ({ children }) => {
    const [tables, setTables] = useState([]);

    const updateTables = (newTables) => {
        setTables(newTables);
    };

    return (
        <TableContext.Provider value={{ tables, updateTables }}>
            {children}
        </TableContext.Provider>
    );
};
