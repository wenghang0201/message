/**
 * 应用程序配置
 */
class AppConfig {
  public assetsUrl: string = "resource/"; // 资源存储路径
  public serverPort: number = 9001; // 服务端口
  public resourceAddress: string = "http://127.0.0.1:9001"; // 资源访问地址
}

export default new AppConfig();
