export interface User {
  id: string
  name: string
  avatar: string
}

export interface Contact extends User {
  // 可以在此处添加特定于联系人的其他字段
}
