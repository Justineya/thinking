# 登录页模板（Allos 风格 · 中文）

以后新项目想要同款登录页，复制这两份文件即可：

- `app/static/auth.css` — 居中卡片、绿色健康风、中文友好字体
- `app/static/login.html` — 结构模板（Logo + 卡片 + 用户名/密码）

后端参考 `app/auth.py` + `app/middleware.py` + `app/main.py` 里的 `/login` 路由。

## 视觉要点（对照 Allos）

| 元素 | 做法 |
|------|------|
| 布局 | `min-height: 100vh` 垂直居中，`max-width: 24rem` |
| 品牌 | 顶部 Logo + 产品名 + 一行 tagline |
| 卡片 | 圆角 16px、浅边框、轻阴影 |
| 表单 | 标签在上、输入框圆角、主按钮全宽绿色 |
| 错误 | 红色浅底提示条 |
| 字体 | 系统字体 + PingFang SC / 微软雅黑 |

## VitaRing 配置

`.env`：

```dotenv
APP_NAME=VitaRing
APP_TAGLINE=个人健康全景 · 随手记症状 · AI 读你自己的时间线
APP_USERNAME=admin
APP_PASSWORD=你的密码
SECRET_KEY=随机字符串
```

- `APP_PASSWORD` 为空：本地开发免登录
- 设置密码后：所有页面和 API 需登录

## 关于 Allos 汉化

Allos 是英文 Next.js 大项目（600+ 依赖），**整站汉化工作量很大**，不建议 fork 汉化。

VitaRing 已采用：

- 全中文界面
- 同款登录页风格
- 更轻的功能范围（症状日记为主）

若将来需要 Allos 级功能，建议在 VitaRing 里按需加模块，而不是汉化 Allos。
