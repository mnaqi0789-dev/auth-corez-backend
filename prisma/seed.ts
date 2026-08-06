import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_ADMIN_EMAIL = "admin@corez.dev";
const DEMO_ADMIN_PASSWORD = "Admin@12345";
const DEMO_USER_EMAIL = "user@corez.dev";
const DEMO_USER_PASSWORD = "User@12345";

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function main() {
  await prisma.token.deleteMany();
  await prisma.session.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.authEvent.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: DEMO_ADMIN_EMAIL,
      passwordHash: await hash(DEMO_ADMIN_PASSWORD),
      role: "admin",
      emailVerified: true,
    },
  });

  const demoUser = await prisma.user.create({
    data: {
      email: DEMO_USER_EMAIL,
      passwordHash: await hash(DEMO_USER_PASSWORD),
      role: "user",
      emailVerified: true,
    },
  });

  const sampleUsers = [
    { email: "sara.khan@corez.dev", role: "user", emailVerified: true },
    { email: "ali.raza@corez.dev", role: "user", emailVerified: true },
    { email: "hina.tariq@corez.dev", role: "user", emailVerified: false },
    { email: "omar.siddiqui@corez.dev", role: "user", emailVerified: true },
    { email: "zara.ahmed@corez.dev", role: "user", emailVerified: true },
    { email: "bilal.nasir@corez.dev", role: "user", emailVerified: false },
    { email: "mahnoor.iqbal@corez.dev", role: "user", emailVerified: true },
    { email: "fahad.malik@corez.dev", role: "admin", emailVerified: true },
    {
      email: "locked.example@corez.dev",
      role: "user",
      emailVerified: true,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 1000 * 60 * 30),
    },
  ];

  const createdUsers = [admin, demoUser];

  for (const u of sampleUsers) {
    const created = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: await hash("Password@123"),
        role: u.role,
        emailVerified: u.emailVerified,
        failedLoginAttempts: u.failedLoginAttempts ?? 0,
        lockedUntil: u.lockedUntil ?? null,
      },
    });
    createdUsers.push(created);
  }

  const ipPool = [
    "103.21.244.10",
    "182.191.4.55",
    "45.115.60.12",
    "68.183.94.7",
  ];
  const uaPool = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0",
  ];

  for (const [i, u] of createdUsers.entries()) {
    await prisma.session.create({
      data: {
        userId: u.id,
        refreshToken: `seed-refresh-${u.id}-${i}`,
        userAgent: uaPool[i % uaPool.length],
        ipAddress: ipPool[i % ipPool.length],
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    await prisma.authEvent.create({
      data: {
        type: "login_success",
        userId: u.id,
        ipAddress: ipPool[i % ipPool.length],
        metadata: { seed: true },
      },
    });

    if (i % 3 === 0) {
      await prisma.authEvent.create({
        data: {
          type: "login_failed",
          userId: u.id,
          ipAddress: ipPool[(i + 1) % ipPool.length],
          metadata: { seed: true, reason: "invalid_password" },
        },
      });
    }
  }

  await prisma.authEvent.create({
    data: {
      type: "account_locked",
      userId: createdUsers[createdUsers.length - 1].id,
      ipAddress: ipPool[0],
      metadata: { seed: true },
    },
  });

  console.log("Seed complete");
  console.log(`Admin login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
  console.log(`User login: ${DEMO_USER_EMAIL} / ${DEMO_USER_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
