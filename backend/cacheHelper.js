const redisClient = require("./redisClient");

exports.cacheGetOrSet = async function(key, ttlSeconds, fetchFn) {
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      console.log("cache hit!");
      return JSON.parse(cached);
    }

    const freshData = await fetchFn();

    await redisClient.setEx(key, ttlSeconds, JSON.stringify(freshData));
    return freshData;
  } catch (error) {
    // On Redis failure, fallback to fetch function, do not block user
    console.error("Redis Error:", error); 
    return fetchFn();
  }
};