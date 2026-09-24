import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends  PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });

    PrismaService.pool = pool;
  }

  async onModuleInit() {
    await PrismaService.pool.query("SELECT 1");
  }

  async onModuleDestroy() {
    await PrismaService.pool.end();
  }
}
