# 项目进度交接(2026-09-02)

> 给未来的会话(和作者自己)快速接续用。详细契约见 `docs/SPEC.md`;数据来源见 `docs/DATA_SOURCE.md`。

## 这是什么
给作者(大三、Python 刚入门、3 个月后考六级)自己用的 **CET-6 背单词 App**:三态归类(熟悉/陌生/不会)、陌生/不会双库、复习重分类、进度存 localStorage。纯 HTML/CSS/JS,无构建步骤。

## 当前状态
- **M1 完成 ✅**:词表 5716 词(六级 ∪ 四级基础),`app/` v1 本地验证通过;已提交 GitHub。
- 本地调试:在 `app/` 执行 `python -m http.server 8000` → http://localhost:8000
- 仓库:**https://github.com/yuxi7131/CET-6-memory-app**(public)
- 标签:`v1.0`(首个可用版)、`v1.1`(云构建配置版)

## 正在进行的云端任务(2026-09-02 晚上触发,尚未验证)
1. **Deploy web to GitHub Pages**(推 main 触发):把 `./app` 发布成网页
2. **Build Android APK**(打 v1.1 标签触发):Capacitor 云端构建签名 APK + 自动 Release

**下一步先做的验收 / 待用户操作:**
- [ ] 用户到 `仓库 Settings → Pages → Source` 选 **GitHub Actions**(唯一必须手动的一步)
- [ ] 到 `仓库 Actions` 页看两条是否绿;APK 构建约 3~8 分钟
- [ ] 网页应出现在 `https://yuxi7131.github.io/CET-6-memory-app/`
- [ ] APK 下载页:`https://github.com/yuxi7131/CET-6-memory-app/releases/tag/v1.1`(或 Actions 里 artifact `cet6-apk`),真机安装、断网可背词
- [ ] 若 Build Android APK 变红:把报错发给助手修(大概率是签名/脚手架小问题)

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
