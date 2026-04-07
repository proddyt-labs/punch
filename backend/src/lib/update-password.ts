import bcrypt from "bcrypt";
import { prisma } from "./prisma";

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.log("Usage: npx tsx src/lib/update-password.ts <username> <password>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ where: { username: username.toLowerCase() } });
  if (!user) {
    console.error(`User "${username}" not found`);
    process.exit(1);
  }

  const newHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  console.log(`Password updated for "${username}"`);
  const verify = await bcrypt.compare(password, newHash);
  console.log(`Verify: ${verify ? "SUCCESS" : "FAILED"}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
