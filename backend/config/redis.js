const redis = require("redis");

const client = redis.createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});

client.on("error", (err) => console.error("Redis Error:", err));

client.connect().then(() => console.log("Connected to Redis"));

module.exports = client;
