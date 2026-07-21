import prisma from "../prisma";
import { ISessionRepository } from "./interfaces";

export const sessionRepository: ISessionRepository = {
  create(data) {
    return prisma.session.create({ data });
  },

  findByRefreshToken(refreshToken) {
    return prisma.session.findUnique({ where: { refreshToken } });
  },

  revoke(id) {
    return prisma.session.update({
      where: { id },
      data: { revoked: true },
    });
  },

  async revokeAllForUser(userId) {
    await prisma.session.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  },

  findActiveByUserId(userId) {
    return prisma.session.findMany({
      where: { userId, revoked: false },
    });
  },
};
