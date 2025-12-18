import { AppDataSource } from "../data-source";
import Log from "../utils/log.util";

/**
 * 初始化数据库连接
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await AppDataSource.initialize();
    Log.info("✅ 数据库连接成功");
  } catch (error) {
    Log.error(`❌ 数据库初始化错误: ${error}`);
    throw error;
  }
}

// 重新导出AppDataSource以保持向后兼容性
export { AppDataSource };
