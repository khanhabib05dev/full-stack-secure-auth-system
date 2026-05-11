
import { prisma } from '../lib/prisma';
import { envConfig } from './env';



export const connectToDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log('\n ✅ Connected to database at:', envConfig.DATABASE_URL);
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
};


