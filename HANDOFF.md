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
- **GitHub**：`Aezir/copie`（**公开**——为免费版 Netlify CI 放行而公开；代码无密钥，用户数据在另一个私有仓 `copie-data` 和本机浏览器里）。本项目就是仓库根目录（`copie/` 文件夹 = git 仓库根）。提交邮箱固定用 GitHub noreply（`109808984+Aezir@users.noreply.github.com`），别改回私人邮箱（历史已为隐私改写过一次）。
- **本地路径**：`D:\projtects\copie\`（2026-09-07 重新克隆；旧路径 `D:\Documents\DailyResearch\copie\` 已弃）。**唯一源文件是 `index.html`**（旧的 copybox.html 已并入并删除）。
- **线上**：https://copwe.netlify.app （Netlify，主站，壳 APK 加载的是这个）；**备用 https://copie-lake.vercel.app**（Vercel，2026-09-07 因 Netlify 免费额度用尽临时部署，发布用 **`bash deploy-vercel.sh`**：它把文件拷到一个没有 .git 的临时目录再发。直接在仓库目录里 `vercel deploy` 会被判 BLOCKED——Vercel 拿 git 提交作者邮箱对账号，noreply 邮箱对不上。缓存头在 vercel.json，`.vercelignore` 排除了 APK 等）。
- **部署方式**：已接**持续部署**——`git push` 到 main **自动上线**（Netlify 通过 deploy key 拉私有仓库 + GitHub webhook 触发）。也可手动 `netlify deploy --prod`（CLI 已登录，目录已关联站点；`.netlify/` 被 `.gitignore` 忽略）。
- **Netlify 徽标**（"Powered by Netlify"）：在 Netlify 面板 **Project configuration → General → Powered by Netlify badge** 关掉（按项目、免费版可关，无 CLI/toml 办法）。

## 四、技术栈 & 文件
- 纯 **HTML+CSS+JS 单文件**，无框架、无构建、无外部依赖（图标是 **Remix Icon 4.5.0** 的 SVG path 内联进来的，离线可用）。
- 文件：
  - `index.html` —— App 本体（结构+样式+逻辑全在里面）
  - `sw.js` —— Service Worker，离线缓存外壳
  - `manifest.webmanifest` —— PWA 清单
  - `icon.svg` —— App 图标（粉底 #FF9292 + 白色卡片堆叠，与壳 APK 图标同款；仓库里曾长期是旧的蓝渐变，线上早已是粉的）
  - `guide.html` —— 使用教程页（关于卡片里「使用教程」链接；曾只在线上、未进仓库，2026-09-07 补入）
  - `netlify.toml` —— 发布目录=根、入口/SW 不缓存
  - `README.md` / `HANDOFF.md`

## 五、数据模型
- **IndexedDB**：库名 `copybox`（**DB_VER=2**），store `entries`（keyPath `id`）+ store `backups`（keyPath `at`，本机快照，最多 8 份）。
- 一条记录 `entry`：
  ```
  { id, title, tags:[string], blocks:[string], fav:bool, pinned:bool, createdAt, updatedAt, syncAt }
  ```
  - `syncAt`：**每次 `put()` 都刷新**（除同步写入），只给同步合并用，**不参与排序**（排序仍用 `updatedAt`，见第八节）。
- 删除墓碑：`localStorage['copie.tomb']` = `{id: 删除时间}`，`del()` 自动记，`put()` 同 id 自动撤，90 天剪枝。随数据一起上云。
  - `blocks`：一条记录下面**一行行平级的文本块**（每块独立复制/就地编辑）。没有"字段名/值"配对。
  - `normalize(raw)` 会把任意旧格式（早期 fields:[{label,value}]）迁移成 blocks。

## 六、主要功能（都在 index.html）
- 列表：标题左 + 彩色标签右（`tagColor()` 按名字 hash 配色）+ 淡色更新日期。
- 每条可展开，里面每个文本块**就地编辑**（contenteditable）+ 各自复制按钮。
- **左滑手势**（pointer events）：露出 **置顶 / 收藏 / 删除** 三个圆图标（缩放"展开"，非底部垫按钮）。置顶排最前。
- 顶栏：搜索、筛选(按标签)、排序(修改/创建/名称)、一键展开折叠、多选、新建、设置。
- **多选**：顶栏下方工具条 = 全选 / 批量改标签 / 批量删除 / 完成。
- 设置整页：导出/导入 JSON、**本地快照（查看/恢复/手动留底）**、**更新日志（「更新」标题旁小图标，数据在 `CHANGELOG` 数组，每次发版在最前面加一条）**、复制全部、**云同步（立即同步 / 自动同步开关 / 连接）**、**检查软件更新**、关于。
- 编辑用**居中弹框**（非底部 sheet）。

## 七、云同步逻辑（关键，2026-09-07 重写）
- 配置存 `localStorage['copie.sync']`：`{token, pass, repo, path:'copie-data.json', branch:'main', auto, savedAt, lastSync, lastErr, _sha}`。`auto!==false` 即"自动同步"开着（启动时 + 改动后）。
- 数据存私有仓库 `<GitHub用户名>/copie-data` 的 `copie-data.json`，GitHub Contents API。payload `version:4`：`{app, version, savedAt, count, enc, kdf, iv, ct}`，密文里是 `{entries, deleted}`（deleted = 墓碑表）。
- **启动本地优先**：先读 IndexedDB 渲染，再 `bootSync()`：顶部横幅 `#syncBar` 显示"自动同步中…"，后台 `syncNow(false)` 逐条合并，完成后横幅显示结果（失败点横幅进设置）。只在 `auto!==false` 时跑。每天首次打开自动留一份快照。
- **同步 = 逐条合并**（`syncNow(manual)`）：拉云端 → `mergeSets(本机, 云端, 合并后的墓碑)`：同 id 取 `syncAt` 晚者；一边独有的补上；墓碑时间 ≥ 条目 `syncAt` 则删。有差异才写本机（`applyMerged` 只 put/del 差异条，**绝不 clear 库**）、才上传。
- **触发**：设置页「立即同步」（manual=true，会弹确认、报结果）；开着自动同步时任何 `put/del` 后 `touched()` 防抖 1.5s 调 `syncNow(false)`。
- **安全阀**：① 合并会让本机少 ≥3 条且超过一半 → 自动同步直接跳过并记 `lastErr`，手动先 confirm；② 本机合并后为空而云端有数据 → 自动拒绝上传，手动先 confirm。写本机前自动留 `sync` 快照。
- 首次连接（新设备）就是普通合并：本机空 → 全拉回来，不上传。旧版明文 / v3 payload 都能读，下次上传自动转 v4。
- token/主密码只存本机；同步需 https/CORS 环境。

### 2026-09-07 事故：全平台笔记被清空（根因与防范）
旧逻辑是**整份 Last-Write-Wins + 启动自动拉取**：任何一台设备只要"本机看到的是空库、而本机 savedAt 又比云端新"，就会把空数据推上云，其他设备启动时因为云端更新就 `clearStore()` 跟着清空。触发口子有：IndexedDB 被系统/WebView 清掉但 localStorage 里的同步配置还在、上传半途 App 被杀（savedAt 已更新但没推上去，下次启动推空）、批量删除 1.5s 内自动上传、旧版客户端（SW 曾是缓存优先）读不懂加密 payload 当成空。**云端 copie-data 仓库每次上传都是一次 commit，历史都在，可从旧提交找回。** 新逻辑见上：逐条合并 + 墓碑 + 安全阀 + 本机快照 + 启动不拉。

## 八、一个必须知道的设计决定
**轻量操作不刷新 `updatedAt`**（收藏、置顶、加/删文本块、就地编辑都不改），**只有点「整理」保存或新建才更新**。原因：默认按"最近修改"排序，若每次小改都刷新时间，删东西触发重绘时列表会"跳"。用户明确要求列表稳定。

## 九、改代码/验证流程
- 直接编辑 `index.html`。改完用这条给内联脚本做语法体检：
  ```
  cd "D:/projtects/copie"
  node -e "const h=require('fs').readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);require('fs').writeFileSync(process.env.TEMP+'/c.js',m[1]);" && node --check "$TEMP/c.js"
  ```
- 预览窗口是**静态快照**，跑不了 IndexedDB/手势/同步——真要验证让用户在浏览器/线上点，或部署后测。
- 图标：需要新图标时用 `curl https://cdn.jsdelivr.net/npm/remixicon@4.5.0/icons/<分类>/<名>.svg` 取真实 path 再内联，别手写。

## 十、待办 / 可选下一步
- 关掉 Netlify 徽标（用户已知开关位置）。
- 壳 App（MainActivity）可补 `AndroidBridge.getVersionName()` / `openUrl(url)`：网页「检查软件更新」会用它们判断壳版本、跳转 APK 下载；没有也能用（只查网页版本）。
- `version.json` 的 `web` 字段 = 网页版本（给「检查更新」用），`versionName` = 壳 APK 版本，两者独立。
- App 图标可再打磨。
