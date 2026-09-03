# 项目进度交接(2026-09-02)

> 给未来的会话(和作者自己)快速接续用。详细契约见 `docs/SPEC.md`;数据来源见 `docs/DATA_SOURCE.md`。

## 这是什么
给作者(大三、Python 刚入门、3 个月后考六级)自己用的 **CET-6 背单词 App**:三态归类(熟悉/陌生/不会)、陌生/不会双库、复习重分类、进度存 localStorage。纯 HTML/CSS/JS,无构建步骤。

## 当前状态(2026-09-03 更新:M3 已完成验收)
- **M1 ✅ + M3 ✅**:词表 5716;网页版 + APK 都已上线。
- **网页版已上线**:`https://yuxi7131.github.io/CET-6-memory-app/`(Pages Source 已设为 **GitHub Actions**,由 `pages.yml` 自动部署)
- **APK 首个成功版 = v1.3**:`https://github.com/yuxi7131/CET-6-memory-app/releases/tag/v1.3`(`app-release.apk` 3.2MB,签名可装、断网可背)
- 本地调试:在 `app/` 执行 `python -m http.server 8000` → http://localhost:8000
- 仓库:**https://github.com/yuxi7131/CET-6-memory-app**(public)
- 标签:v1.0 / v1.1(均 APK 失败)→ v1.2(node 修复后仍失败)→ **v1.3(成功)**

### ⚠️ 云构建踩过的坑(已修复,勿回退)
- `build-apk.yml` 的 `node-version` 必须 **≥22**:Capacitor CLI 8.5.1 要求 node>=22,用 20 会 `[fatal] requires NodeJS >=22`
- `build-apk.yml` 的 `java-version` 必须 **21**:Capacitor 8 的 android 模块按 Java 21 编译,用 17 报 `error: invalid source release: 21`
- `pages.yml` 正常运行的前提:仓库 Settings→Pages→Source = **GitHub Actions**(否则 configure-pages 报 `Get Pages site failed / Not Found`)

### 发新版流程(已完全可用)
```bash
git add -A && git commit -m "改了什么" && git push origin main   # → 网页版自动更新
git tag v1.5 && git push origin v1.5                             # → 云端自动打新 APK + Release
```
**❗尚未配固定签名**(仓库 secret `KEYSTORE_B64` + `KEYSTORE_PASS`):每次云端现生成钥匙 → 装新版 APK 前必须先卸载旧版,**背词进度会清空**。想"升级保留进度"就先配这两个 secret(配后一次设置、永久生效)。

## 待办(2026-09-03)
- [x] 网页部署验收(HTTP 200,标题「六级背单词」)
- [x] APK 构建验收(v1.3 已出 Release)
- [ ] 用户真机安装 v1.3,确认可背词 —— 待用户确认
- [ ] (可选/地基)配固定签名;App 加进度导出/导入;push 自动体检(words.json/JS 语法)
- M2(搜索/发音)、M4(听力/每日计划)未开始

## 云端构建方案要点(mobile/ + .github/workflows/)
- `mobile/`:Capacitor 配置(`capacitor.config.json`:appId `com.yuxi.cet6`,appName `六级背单词`,webDir `../app`),依赖 @capacitor/core/cli/android 8.5.1
- `.github/workflows/pages.yml`:push main → upload-pages-artifact `./app` → deploy-pages
- `.github/workflows/build-apk.yml`:node20 + java17(temurin)→ `cap add/sync android` → `gradle assembleRelease` → zipalign+apksigner 签名 → artifact + (tag 时)GitHub Release
- 签名:有 secret `KEYSTORE_B64`+`KEYSTORE_PASS` 用同一把稳定钥匙(升级可覆盖安装);没有则每次构建现生成(也能装,但覆盖旧版需先卸载)
- 构建在 GitHub 云跑,本地**不需要** JDK/Android Studio

## 待定的开放决策(用户随时可改)
- 词库范围:现在 = 六级∪四级(5716)。用户若要"纯六级表"的少而精版,一分钟可换。
- app 名/图标:暂定 六级背单词 / 无自定义图标(可后补)
- 若将来要上商店/正式公开分发:先把词表源从 mahavivo(无 LICENSE)换成 ECDICT(MIT)

## 路线图
- M1 词表+背单词 ✅
- M2 词表搜索/发音 → 未开始
- M3 云端 APK(v1.1 构建中)→ 见本文件上部
- M4 听力/每日计划 → 未开始

## 常用命令
```bash
# 本地跑网页
cd app && python -m http.server 8000
# 提交推送 + 云端构建新 APK
git add -A && git commit -m "..." && git push origin main
git tag v1.2 && git push origin v1.2
```
