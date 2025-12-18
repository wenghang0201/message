import * as fs from "fs";

/**
 * 工具函数
 */
export default class Tool {

  /**
   * 转化时间
   * @param time 时间戳
   */
  public static handleTime(time: number): string {
    //初始化
    var nowDate: Date = new Date(time);

    //日期赋值
    let year: string = nowDate.getUTCFullYear() + "";
    let month: string = nowDate.getUTCMonth() + 1 + "";
    month = month.length > 1 ? month : "0" + month;
    let day: string = nowDate.getUTCDate() + "";
    day = day.length > 1 ? day : "0" + day;

    //时间赋值
    let hours: string = nowDate.getUTCHours() + "";
    hours = hours.length > 1 ? hours : "0" + hours;
    let minutes: string = nowDate.getUTCMinutes() + "";
    minutes = minutes.length > 1 ? minutes : "0" + minutes;
    let seconds: string = nowDate.getUTCSeconds() + "";
    seconds = seconds.length > 1 ? seconds : "0" + seconds;

    //返回
    return year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" + seconds;
  }

  /**
   * 处理错误原因
   * @param error 错误数据
   */
  public static handleErrorReason(error: any): string {
    //返回错误元婴
    if (error.response && error.response.data && error.response.data.msg) {
      //错误信息
      return error.response.data.msg;
    }

    //返回错误
    return JSON.stringify(error);
  }

  /**
   * 写入配置文件
   * @param path 地址
   * @param data 保存数据
   * @param error 错误回调
   */
  public static writeJson(path: string, data: any, error: Function = null): void {
    //数据赋值
    var writeData: string = data.toString();

    //写入数据
    fs.writeFile(path, writeData, (err: NodeJS.ErrnoException) => {
      //写入失败
      if (err) {
        if (error) error(err);
      }
    });
  }

  /**
   * 读取配置文件
   * @param path 地址
   * @param error 错误回调
   * @param success 成功回调
   */
  public static readJson(path: string, error: Function = null, success: Function = null): void {
    //读取数据
    fs.readFile(path, (err: NodeJS.ErrnoException, data: any) => {
      //读取失败
      if (err) {
        if (error) error(err);
      }

      //数据赋值
      var readData: any = JSON.parse(data);

      //回调函数
      if (success) success(readData);
    });
  }
}
