# Copie 项目交接（HANDOFF）

给接手的新会话/新窗口：读完这份就能上手。

## 一、这是什么
**Copie** —— 一个"手机窗口形状"的**单文件网页 App（PWA）**，用来存 baseurl/key、常用参数、人设、小剧场等**经常要整段复制**的内容。定位是"复制箱 + 跨设备同步"。

## 二、用户与协作风格（重要）
- 用户很 **junior**，没系统学过编程；目标是成长为全栈，能给 AI 精准需求。
- 沟通用**大白话**，禁 AI 腔；讲解只到**框架层**（做什么、为什么），不逐行讲代码，用户不手写代码。
- 动手前先用 2~4 句"专业白话"复述需求让用户拍板，再实施。
- 全局说明见 `~/.claude/CLAUDE.md`。

## 三、仓库与托管
- **GitHub**：`Aezir/copie`（**私有**）。本项目就是仓库根目录（`copie/` 文件夹 = git 仓库根）。
- **本地路径**：`D:\Documents\DailyResearch\copie\`。**唯一源文件是 `index.html`**（旧的 copybox.html 已并入并删除）。
- **线上**：https://copwe.netlify.app （Netlify）。
- **部署方式**：已接**持续部署**——`git push` 到 main **自动上线**（Netlify 通过 deploy key 拉私有仓库 + GitHub webhook 触发）。也可手动 `netlify deploy --prod`（CLI 已登录，目录已关联站点；`.netlify/` 被 `.gitignore` 忽略）。
- **Netlify 徽标**（"Powered by Netlify"）：在 Netlify 面板 **Project configuration → General → Powered by Netlify badge** 关掉（按项目、免费版可关，无 CLI/toml 办法）。

## 四、技术栈 & 文件
- 纯 **HTML+CSS+JS 单文件**，无框架、无构建、无外部依赖（图标是 **Remix Icon 4.5.0** 的 SVG path 内联进来的，离线可用）。
- 文件：
  - `index.html` —— App 本体（结构+样式+逻辑全在里面）
  - `sw.js` —— Service Worker，离线缓存外壳
  - `manifest.webmanifest` —— PWA 清单
  - `icon.svg` —— App 图标（蓝渐变+复制符号）
  - `netlify.toml` —— 发布目录=根、入口/SW 不缓存
  - `README.md` / `HANDOFF.md`

## 五、数据模型
- **IndexedDB**：库名 `copybox`，store `entries`，keyPath `id`。
- 一条记录 `entry`：
  ```
  { id, title, tags:[string], blocks:[string], fav:bool, pinned:bool, createdAt, updatedAt }
  ```
  - `blocks`：一条记录下面**一行行平级的文本块**（每块独立复制/就地编辑）。没有"字段名/值"配对。
  - `normalize(raw)` 会把任意旧格式（早期 fields:[{label,value}]）迁移成 blocks。

## 六、主要功能（都在 index.html）
- 列表：标题左 + 彩色标签右（`tagColor()` 按名字 hash 配色）+ 淡色更新日期。
- 每条可展开，里面每个文本块**就地编辑**（contenteditable）+ 各自复制按钮。
- **左滑手势**（pointer events）：露出 **置顶 / 收藏 / 删除** 三个圆图标（缩放"展开"，非底部垫按钮）。置顶排最前。
- 顶栏：搜索、筛选(按标签)、排序(修改/创建/名称)、一键展开折叠、多选、新建、设置。
- **多选**：顶栏下方工具条 = 全选 / 批量改标签 / 批量删除 / 完成。
- 设置整页：导出/导入 JSON、复制全部、**云同步**、关于。
- 编辑用**居中弹框**（非底部 sheet）。

## 七、云同步逻辑（关键）
- 配置存 `localStorage['copie.sync']`：`{token, repo, path:'copie-data.json', branch:'main', savedAt, lastSync, linked, _sha}`。
- 数据存**自动创建的私有仓库** `<你的GitHub用户名>/copie-data` 里的 `copie-data.json`，走 **GitHub Contents API**（token 只勾 `repo`）。
- 模型 = 整体 **Last-Write-Wins**：payload 带 `savedAt` 时间戳，谁新谁覆盖整份；**首次连接(!linked) 按 id 合并**两端防丢。
- **上传**：`put/del` 被 hook，触发 `touched()` → 若已配置则更新本地 `savedAt` 并**防抖 1.5s 自动 push**。
- **下载**：启动时 `syncNow(false)` 自动拉；`remote.savedAt > 本地` 则覆盖本地，否则 push。
- 拉远端时用 `applyingRemote=true` 抑制 `touched()`，避免"迁移/拉取"被当成本地改动。
- token 只存本机；同步需 **https/CORS** 环境（Netlify 上通，本地 file:// 可能不通）。

## 八、一个必须知道的设计决定
**轻量操作不刷新 `updatedAt`**（收藏、置顶、加/删文本块、就地编辑都不改），**只有点「整理」保存或新建才更新**。原因：默认按"最近修改"排序，若每次小改都刷新时间，删东西触发重绘时列表会"跳"。用户明确要求列表稳定。

## 九、改代码/验证流程
- 直接编辑 `index.html`。改完用这条给内联脚本做语法体检：
  ```
  cd "D:/Documents/DailyResearch/copie"
  node -e "const h=require('fs').readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);require('fs').writeFileSync(process.env.TEMP+'/c.js',m[1]);" && node --check "$TEMP/c.js"
  ```
- 预览窗口是**静态快照**，跑不了 IndexedDB/手势/同步——真要验证让用户在浏览器/线上点，或部署后测。
- 图标：需要新图标时用 `curl https://cdn.jsdelivr.net/npm/remixicon@4.5.0/icons/<分类>/<名>.svg` 取真实 path 再内联，别手写。

## 十、待办 / 可选下一步
- 关掉 Netlify 徽标（用户已知开关位置）。
- 云同步可升级为**逐条合并**（每条带时间戳按条 PK），解决"两台离线各改会整份覆盖"的局限——用户暂用整份 LWW。
- App 图标可再打磨。
