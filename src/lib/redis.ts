import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedis() {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  client.on("error", (err) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[Redis]", err.message);
    }
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export const CACHE_KEYS = {
  trending: "trending:hashtags",
  userFeed: (userId: string) => `feed:${userId}`,
  notifications: (userId: string) => `notif:unread:${userId}`,
  userProfile: (username: string) => `profile:${username}`,
  whoToFollow: (userId: string) => `wtf:${userId}`,
} as const;

export const TTL = {
  trending: 60 * 5,      // 5 minutes
  feed: 60 * 2,          // 2 minutes
  profile: 60 * 10,      // 10 minutes
  whoToFollow: 60 * 15,  // 15 minutes
} as const;
