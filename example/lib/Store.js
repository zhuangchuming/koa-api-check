const Redis = require("ioredis");
const { Store } = require("koa-session2");
let prefix = 'backmg';
class RedisStore extends Store {
    constructor() {
        super();
        this.redis = new Redis();
    }

    async get(sid) {
        let data = await this.redis.get(`${prefix}-SESSION:${sid}`);
        return JSON.parse(data);
    }

    async set(session, { sid =  this.getID(24), maxAge = 1000000 } = {}) {
        try {
            // Use redis set EX to automatically drop expired sessions
            await this.redis.set(`${prefix}-SESSION:${sid}`, JSON.stringify(session), 'EX', maxAge / 1000);
        } catch (e) {}
        return sid;
    }

    async destroy(sid) {
        return await this.redis.del(`${prefix}-SESSION:${sid}`);
    }
}

module.exports = RedisStore;