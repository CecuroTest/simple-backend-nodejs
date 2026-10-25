const { QuotaExceededError } = require("./errors");

// Arbitrary constant key that serialises quota checks across connections.
const KITTEN_QUOTA_LOCK_KEY = 4210001;

const createKittenService = ({ sequelize, Kitten, maxKittens }) => ({
  async list({ limit, offset }) {
    const { rows, count } = await Kitten.findAndCountAll({
      order: [["id", "ASC"]],
      limit,
      offset,
    });
    return { kittens: rows, total: count };
  },

  // Count + insert run under one advisory lock so concurrent
  // requests cannot overshoot the quota.
  async create({ name, age }) {
    return sequelize.transaction(async (transaction) => {
      await sequelize.query("SELECT pg_advisory_xact_lock(:key)", {
        replacements: { key: KITTEN_QUOTA_LOCK_KEY },
        transaction,
      });
      const count = await Kitten.count({ transaction });
      if (count >= maxKittens) {
        throw new QuotaExceededError(maxKittens);
      }
      return Kitten.create({ name, age }, { transaction });
    });
  },

  // Returns true when a row was deleted.
  async remove(id) {
    const deleted = await Kitten.destroy({ where: { id } });
    return deleted > 0;
  },
});

module.exports = { createKittenService, KITTEN_QUOTA_LOCK_KEY };
