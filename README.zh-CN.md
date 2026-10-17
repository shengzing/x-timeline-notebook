# X Timeline Notebook

[English](README.md) | 简体中文

一款本地优先（local-first）的 Chrome MV3 扩展，用于把你在 X / Twitter 个人主页上读到的内容保存为个人阅读笔记。

![Platform](https://img.shields.io/badge/platform-Chrome%20MV3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 它做什么

当你浏览 X 个人主页时，X Timeline Notebook 会把浏览器中已经展示给你看的信息保存在你自己的浏览器里：

- 发布时间
- 正文内容
- 帖子中的链接
- 图片 / 视频地址
- 帖子链接
- 作者 handle 与昵称

它面向个人阅读笔记、研究记录和本地资料留存。

## 特性

- 边读边保存时间线信息
- 每个主页一份独立的本地笔记本
- 逐页辅助阅读模式，可随时手动停止
- 页面与弹窗中实时显示累计与本轮计数
- 按帖子 ID 去重
- 支持 JSONL 与 CSV 导出
- 无统计埋点、无远程上传、无账号体系

## 请在规则允许的范围内使用

本扩展不会绕过登录、频控、验证机制或任何其他访问控制，只处理你的浏览器本来就能看到的信息。

你需要自行负责：

- 遵守 X 的服务条款、开发者政策及适用法律；
- 尊重版权与他人的权利；
- 在需要授权的场景下，先取得授权再使用或转载内容。

请仅将本项目用于合法的个人笔记与研究，不要用它构建垃圾信息、骚扰、监控或批量数据产品。

## 数据字段

| 字段 | 说明 |
|---|---|
| `publishedAt` | 帖子发布时间 |
| `author.handle` / `author.name` | 作者信息 |
| `content` | 正文内容 |
| `links` | 帖子中出现的链接 |
| `media` | 图片与视频地址 |
| `tweetUrl` | 帖子链接 |
| `statusId` | 帖子 status ID |
| `sourceUrl` | 保存笔记时所在的页面 |
| `savedAt` | 保存时间 |

## 安装

1. 打开 `chrome://extensions/`。
2. 开启右上角**开发者模式**。
3. 点击**加载已解压的扩展程序**。
4. 选择本仓库的根目录。
5. 打开某个个人主页，例如 `https://x.com/wquguru`。

## 使用方法

### 边读边存

打开 X 个人主页正常阅读即可，浏览器中显示的时间线信息会自动保存到你的本地笔记本。

### 辅助阅读模式

1. 点击扩展图标。
2. 输入你计划浏览的帖子数量。
3. 点击**开始**。
4. 扩展会逐页翻动时间线，直到达到你的浏览目标。
5. 任何时刻都可以点击**停止**。

辅助阅读刻意控制节奏、必须由用户手动启动，并带有手动停止按钮，设计目的不是绕过平台控制。

### 导出

在弹窗中点击**导出**，可以选择：

- 当前主页笔记导出为 JSONL
- 当前主页笔记导出为 CSV
- 全部笔记导出为 JSONL
- 全部笔记导出为 CSV

## 本地数据

所有数据仅存储在 `chrome.storage.local` 中，最多保留 5000 条笔记。你可以随时在弹窗中清除当前主页的笔记或全部笔记。

## 已知限制

- X 的页面结构经常变动，选择器可能需要随之更新。
- 受保护账号和受限页面，如果你的浏览器本来就无法合法查看，本扩展同样无法获取。
- 部分动态加载的媒体地址，要等帖子出现在可视区域后才可能拿到。

## 开发

```bash
node --check src/content.js
node --check src/background.js
node --check popup/popup.js
python3 -m json.tool manifest.json > /dev/null
```

## 隐私

详见 [PRIVACY.md](PRIVACY.md)。

## 安全

详见 [SECURITY.md](SECURITY.md)。

## 参与贡献

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
