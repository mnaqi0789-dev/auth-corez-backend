import prisma from "../prisma";
import { IUserRepository } from "./interfaces";

export const userRepository: IUserRepository = {
  findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data) {
    return prisma.user.create({ data });
  },

  incrementFailedLoginAttempts(id) {
    return prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  },

  resetFailedLoginAttempts(id) {
    return prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  },

  lockAccountUntil(id, until) {
    return prisma.user.update({
      where: { id },
      data: { lockedUntil: until },
    });
  },
};
