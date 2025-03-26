const client = require("../config/redis");

const cacheMiddleware = async (req, res, next) => {
    const key = req.originalUrl;
    try {
        const cachedData = await client.get(key);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        res.sendResponse = res.json;
        res.json = async (body) => {
            await client.setEx(key, 3600, JSON.stringify(body)); // Cache for 1 hour
            res.sendResponse(body);
        };
        next();
    } catch (error) {
        console.error("Redis cache error:", error);
        next();
    }
};

module.exports = cacheMiddleware;
