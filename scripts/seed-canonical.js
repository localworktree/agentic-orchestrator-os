// scripts/seed-canonical.js
const Redis = require("ioredis")
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

async function seed() {
  await redis.set("canonical:active_version", "v1")

  await redis.set("canonical:actions:v1", JSON.stringify({
    delete: ["delete", "remove", "destroy"],
    create: ["create", "add", "insert"],
    update: ["update", "modify", "change"],
    refund: ["refund", "return", "credit"]
  }))

  await redis.set("canonical:fields:v1", JSON.stringify({
    target: ["target", "id", "user_id", "uid", "order_id"],
    amount: ["amount", "value", "total", "price"]
  }))

  await redis.set("canonical:tool_rules:v1", JSON.stringify({
    billing: { required_fields: ["amount"], normalize: ["currency_to_number"] },
    user: { normalize: ["strip_prefix:user_"] }
  }))

  console.log("✅ Canonicalization v1 seeded")
  process.exit(0)
}

seed()