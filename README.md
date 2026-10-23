# TwoMaster_Web

Two Master 5.9.62 网页试玩版。

游玩地址：https://sunseekerrx.github.io/TwoMaster_Web/

## 使用说明

- 使用桌面浏览器打开游玩地址，等待首次加载完成。
- 当前单 HTML 文件约 565 MB，首次加载需要下载完整游戏。
- 当前网页版尚不支持原有局域网联机。
- 本版包含更新后的 100 张技能、36 件装备和 30 颗宝石图标。

## 发布结构

游戏文件保存在 Release `v5.9.62` 的 `TwoMaster.html` 附件中。
GitHub Actions 下载该附件，校验 SHA-256，再将其作为 `index.html` 发布到 GitHub Pages。
仓库不包含 Unity 工程。

重新部署：在 Actions 中打开 `Publish Two Master Web`，选择 `Run workflow`。
更新游戏版本时，需要同时更新 Release 标签、工作流下载地址及 SHA-256。
