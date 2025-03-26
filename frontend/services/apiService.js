const API_URL = process.env.REACT_APP_API_URL;

export const fetchTables = async () => {
    const response = await fetch(`${API_URL}/tables`);
    return await response.json();
};
