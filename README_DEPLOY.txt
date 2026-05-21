部署说明：
1. 公开页面：index.html
2. 内部后台：admin-internal-9f3k2x.html
   不要在公开页面放这个链接。只有知道 URL 的人能打开。
3. 前端读取：data/data.json
4. 后台本地编辑后点击“导出 data.json”，把导出的 data.json 上传覆盖仓库里的 data/data.json。
5. GitHub Pages 更新后，所有用户会读取同一份 data/data.json。
6. 这不是强安全后台，只是隐藏 URL。真正权限控制需要 Supabase、Cloudflare Worker 或 GitHub API + 后端代理。
