#!/usr/bin/env bash
# 发布到 Vercel（copie-lake.vercel.app）。
# 必须从一个没有 .git 的临时目录发：直接在仓库里发，Vercel 会拿 git 提交作者（GitHub noreply 邮箱）
# 去对 Vercel 账号，对不上就把部署判成 BLOCKED（TEAM_ACCESS_REQUIRED）。
set -e
cd "$(dirname "$0")"
STAGE="${TMP:-/tmp}/copie-vercel-stage"
rm -rf "$STAGE"; mkdir -p "$STAGE/.vercel"
cp index.html sw.js manifest.webmanifest icon.svg guide.html version.json vercel.json "$STAGE/"
printf '{"projectId":"prj_J3xifeE3LeVPOcJMOXxFdDl2Kf0D","orgId":"team_5Y3FAnKRUiC1YaKq2M0RG6Gt","projectName":"copie"}' > "$STAGE/.vercel/project.json"
cd "$STAGE" && vercel deploy --prod --yes --scope aezirs-projects
