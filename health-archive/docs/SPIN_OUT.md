# 迁到新 GitHub 仓库

本目录（`health-archive/`）已打包为**可独立成库**的项目。在 `thinking` 仓库外新建 repo 时，按下面做即可。

## 方式 A：只拷贝内容（推荐）

在 GitHub 新建**空仓库**（不要勾选 README），然后：

```bash
# 1. 克隆新仓库
git clone git@github.com:<你>/<新仓库名>.git
cd <新仓库名>

# 2. 从 thinking 仓库复制（在 thinking 仓库同级目录执行）
rsync -av \
  --exclude '.venv' \
  --exclude 'data/health.db' \
  --exclude 'data/records/*' \
  --exclude '.env' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  /path/to/thinking/health-archive/ ./

# 3. 首次提交
git add .
git commit -m "Initial commit: personal health log (Phase 1)"
git push -u origin main
```

Windows 无 rsync 时：手动复制 `health-archive` 文件夹内所有文件到新仓库根目录（跳过 `.venv`、`data/health.db`、`.env`）。

## 方式 B：用打包脚本

在 `thinking` 仓库内：

```bash
bash health-archive/scripts/package-for-new-repo.sh ~/health-log
cd ~/health-log
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:<你>/<新仓库名>.git
git push -u origin main
```

## 新仓库建议设置

1. **Private**（健康类项目默认私有，即使用户数据不在 git 里）
2. 开启 **Secret scanning**（GitHub 默认）
3. 不要开启 GitHub Pages 跑完整 App（见 [ROADMAP.md](ROADMAP.md)）
4. 添加 `.env` 后仅在本地 / 部署环境存在

## 与 thinking 仓库的关系

- `thinking` 保留噜噜等创作项目
- 健康档案单独维护，避免混在一个 public 仓库里
