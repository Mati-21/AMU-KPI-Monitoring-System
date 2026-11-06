import crypto from 'crypto';
import { prisma } from '../config/database.js';

/**
 * Staff numbers are given by the system, never typed: "ST-" and 11 digits, such as ST-39394723487.
 * They are random, so a number says nothing about who holds it or when they joined. One that an archived person
 * held is not reused either, so an old number never points at someone new.
 */

const MAX_ATTEMPTS = 10;

export const newStaffNumber = async (db = prisma) => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const staffNumber = `ST-${crypto.randomInt(10 ** 10, 10 ** 11)}`;
    const taken = await db.person.findFirst({ where: { OR: [{ staffNumber }, { archivedStaffNumber: staffNumber }] }, select: { id: true } });
    if (!taken) return staffNumber;
  }
  throw new Error('Could not find a free staff number');
};

export default { newStaffNumber };
