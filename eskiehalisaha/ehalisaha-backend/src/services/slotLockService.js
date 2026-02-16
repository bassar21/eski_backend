const redis = require('../config/redis');
const db = require('../config/database');

const LOCK_DURATION = parseInt(process.env.SLOT_LOCK_DURATION) || 300;
const GRACE_PERIOD = parseInt(process.env.GRACE_PERIOD) || 60;

class SlotLockService {
  static async lockSlot(pitchId, dateTime, userId) {
    const slotKey = `slot:${pitchId}:${dateTime}`;
    const dbCheckKey = `dbcheck:${slotKey}`;
    
    const dbStatus = await redis.get(dbCheckKey);
    if (dbStatus === 'booked') {
      return { success: false, reason: 'Slot zaten dolu', ttl: 0 };
    }
    
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if current and current ~= ARGV[1] then
        return redis.call('TTL', KEYS[1])
      end
      redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
      return -1
    `;
    
    const result = await redis.eval(
      luaScript,
      1,
      slotKey,
      userId.toString(),
      LOCK_DURATION
    );
    
    if (result > 0) {
      return { success: false, reason: 'Slot başkası tarafından inceleniyor', ttl: result };
    }
    
    this.verifySlotAvailability(pitchId, dateTime, slotKey);
    
    return { success: true, expiresIn: LOCK_DURATION };
  }

  static async extendLock(pitchId, dateTime, userId) {
    const slotKey = `slot:${pitchId}:${dateTime}`;
    const currentOwner = await redis.get(slotKey);
    
    if (currentOwner === userId.toString()) {
      await redis.expire(slotKey, GRACE_PERIOD);
      return { success: true, expiresIn: GRACE_PERIOD };
    }
    
    return { success: false, reason: 'Kilit size ait değil' };
  }

  static async releaseLock(pitchId, dateTime, userId) {
    const slotKey = `slot:${pitchId}:${dateTime}`;
    
    const luaScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redis.eval(luaScript, 1, slotKey, userId.toString());
    return result === 1;
  }

  static async verifySlotAvailability(pitchId, dateTime, cacheKey) {
    try {
      const result = await db.query(
        `SELECT id FROM bookings 
         WHERE pitch_id = $1 
         AND start_time <= $2 
         AND end_time > $2 
         AND status IN ('Confirmed', 'Pending')`,
        [pitchId, dateTime]
      );
      
      if (result.rows.length > 0) {
        await redis.set(`dbcheck:${cacheKey}`, 'booked', 'EX', 3600);
      }
    } catch (error) {
      console.error('Slot verification error:', error);
    }
  }

  static async checkMultipleSlots(pitchId, startTime, endTime, userId) {
    const slots = [];
    const current = new Date(startTime);
    const end = new Date(endTime);
    
    while (current < end) {
      const slotKey = `slot:${pitchId}:${current.toISOString()}`;
      const lockOwner = await redis.get(slotKey);
      
      if (lockOwner && lockOwner !== userId.toString()) {
        return { success: false, reason: 'Bir veya daha fazla slot dolu', slots };
      }
      
      slots.push(slotKey);
      current.setHours(current.getHours() + 1);
    }
    
    return { success: true, slots };
  }
}

module.exports = SlotLockService;
