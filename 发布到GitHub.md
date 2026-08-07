# GitHub Pages 发布与维护

本网页没有后台和构建步骤，适合直接从公开仓库发布。

## 当前线上版本

- 仓库：<https://github.com/mianmiancn-bit/word-review-tool>
- 网页：<https://mianmiancn-bit.github.io/word-review-tool/>
- 旧版单词复习页仍保留在：<https://mianmiancn-bit.github.io/word-review-tool/blue.html>

## 第一次发布（已于 2026-08-07 完成）

如果远程仓库尚未创建，登录 GitHub，点击右上角 `+`，选择 `New repository`。
2. 仓库名称可填写 `vocabulary-dictation`，可见性选择 `Public`，不要勾选自动创建 README。
3. 在本文件夹打开 PowerShell，依次执行：

```powershell
git init
git add .
git commit -m "Initial vocabulary dictation site"
git branch -M main
git remote add origin https://github.com/你的用户名/vocabulary-dictation.git
git push -u origin main
```

4. 打开仓库页面，进入 `Settings` → `Pages`。
5. 在 `Build and deployment` 中选择：
   - Source：`Deploy from a branch`
   - Branch：`main`
   - Folder：`/(root)`
6. 点击 `Save`。发布完成后，地址通常是：

```text
https://你的用户名.github.io/vocabulary-dictation/
```

## 后续更新

修改文件后执行：

```powershell
git add .
git commit -m "Update vocabulary site"
git push
```

GitHub 会自动重新发布。发布失败时，到仓库的 `Actions` 页面查看 Pages 部署日志。

## 隐私与公开范围

- GitHub Pages 网页和公开仓库中的 317 条词汇对所有人可见。
- 默写答案、进度和“太简单”移出清单只存在访问者自己的浏览器中。
- 不要把 `话题词汇积累`、原件备份、ETS PDF 或音频复制进这个仓库。

官方说明：

- [配置 GitHub Pages 发布源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [创建 GitHub Pages 网站](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

