# Smart Q — 部署到 Vercel 指南

## 一、准备

系统已就绪，代码在 `smartq/` 文件夹。数据库（Supabase）已建好并在用。
部署前确认本地能跑：

```bash
cd smartq
npm install
npm run build   # 应全绿
npm run dev     # http://localhost:3000
```

## 二、把代码推上 GitHub

Vercel 从 Git 仓库部署，所以先建一个仓库（私有即可）：

```bash
cd smartq
git init
git add .
git commit -m "Smart Q admin system"
# 在 GitHub 建一个空的私有仓库 smartq，然后：
git remote add origin https://github.com/<你的用户名>/smartq.git
git branch -M main
git push -u origin main
```

> `.env.local` 已被 `.gitignore` 忽略，不会上传密钥（正确做法）。中文字体
> `public/fonts/*.otf` 会一起上传（PDF 需要，约 16MB，正常）。

## 三、在 Vercel 部署

1. 打开 https://vercel.com → 用 GitHub 登录 → **Add New → Project**
2. 选中刚推上去的 `smartq` 仓库 → Import
3. Framework 会自动识别为 **Next.js**，无需改
4. 展开 **Environment Variables**，填两个（值和你本地 `.env.local` 里的一样）：

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://lqvqkhvzsehbyrxlgtjx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | （你的 anon key，见 Supabase → Project Settings → API）|

5. 点 **Deploy**，等 1–2 分钟即可拿到网址（形如 `https://smartq.vercel.app`）

## 四、部署后设置

1. **登录**：用 `quan030299@gmail.com` / 你的密码登录线上版
2. **改密码**：Supabase → Authentication → Users → 你的账号 → 改成强密码
   （现在是 `123456`，务必换掉）
3. **加员工账号**（可选）：Supabase → Authentication → Add user 建员工邮箱密码，
   触发器会自动建 profile 且默认为 `staff`（看不到成本）。想升 owner 才跑：
   ```sql
   update profiles set role='owner' where id=(select id from auth.users where email='员工邮箱');
   ```

## 五、Supabase Auth 回调（如果登录后跳回登录页）

Supabase → Authentication → URL Configuration →
把你的 Vercel 网址加进 **Site URL** 和 **Redirect URLs**（例如 `https://smartq.vercel.app`）。

## 六、以后改代码

改完 `git push`，Vercel 自动重新部署。
数据库 schema 有变动时，把新的 SQL 贴进 Supabase SQL Editor 跑一次即可。

---

## 环境变量清单（总）

`.env.local`（本地）与 Vercel（线上）都需要这两个：

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

数据库 schema 见 `supabase/schema.sql`。
