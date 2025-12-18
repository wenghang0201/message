import log4js = require("log4js");
import * as path from "path";

/**
 * 日志工具类
 */
class Log {
  private _log4js: log4js.Logger;

  /**
   * 初始化日志系统
   */
  public init(): void {
    const configPath = path.join(process.cwd(), "config/log4js.json");
    log4js.configure(configPath);
    this._log4js = log4js.getLogger();
  }

  /**
   * 信息日志
   */
  public info(message: string): void {
    this._log4js.info(message);
  }

  /**
   * 警告日志
   */
  public warn(message: string): void {
    this._log4js.warn(message);
  }

  /**
   * 错误日志
   */
  public error(message: string): void {
    this._log4js.error(message);
  }

  /**
   * 调试日志
   */
  public debug(message: string): void {
    this._log4js.debug(message);
  }

  /**
   * 追踪日志
   */
  public trace(message: string): void {
    this._log4js.trace(message);
  }
}

export default new Log();
