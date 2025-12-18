import * as fs from "fs";

/**
 * 工具类
 */
class Tool {

  /**
   * 读取JSON文件
   */
  public readJson(
    filePath: string,
    onError: (err: Error) => void,
    onSuccess: (data: any) => void
  ): void {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        onError(err);
        return;
      }

      try {
        const jsonData = JSON.parse(data);
        onSuccess(jsonData);
      } catch (parseErr) {
        onError(parseErr as Error);
      }
    });
  }

  /**
   * 写入JSON文件
   */
  public writeJson(
    filePath: string,
    data: any,
    onError: (err: Error) => void,
    onSuccess: () => void
  ): void {
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFile(filePath, jsonString, "utf8", (err) => {
      if (err) {
        onError(err);
        return;
      }
      onSuccess();
    });
  }

  /**
   * 格式化时间
   */
  public formatTime(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

export default new Tool();
