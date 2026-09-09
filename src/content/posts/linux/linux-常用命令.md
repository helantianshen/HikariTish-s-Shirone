---
title: Linux 常用命令
published: 2026-07-18
description: 按目录、文件、文本、进程、网络和权限等场景整理 Linux 常用命令、参数与示例。
tags:
  - linux
  - 运维
category: Linux
pinned: false
draft: false
comment: true
lang: zh_CN
---

# Linux 常用命令速查

> 共收录 **37 个命令**，按 **10 大分类** 组织，支持大纲快速跳转。

## 速查表

| 命令 | 分类 | 用途 |
|------|------|------|
| `pwd` | 导航与目录 | 打印当前工作目录的绝对路径 |
| `cd` | 导航与目录 | 切换当前工作目录 |
| `ls` | 文件查看 | 列出目录内容（最常用） |
| `cat` | 文件查看 | 查看/合并/创建文件 |
| `head / tail` | 文件查看 | 查看文件开头/末尾，tail -f 实时追踪 |
| `file` | 文件查看 | 检测文件类型（不依赖扩展名） |
| `stat` | 文件查看 | 显示文件详细元数据（权限/inode/时间戳） |
| `mkdir` | 文件与目录管理 | 创建新目录 |
| `touch` | 文件与目录管理 | 创建空文件或更新时间戳 |
| `cp` | 文件与目录管理 | 复制文件或目录 |
| `mv` | 文件与目录管理 | 移动文件/目录或重命名 |
| `rename` | 文件与目录管理 | 批量重命名（支持正则） |
| `rm` | 文件与目录管理 | 删除文件或目录 |
| `ln` | 文件与目录管理 | 创建硬链接或软链接（符号链接） |
| `find` | 搜索与查找 | 按条件搜索文件（名称/大小/时间/权限） |
| `locate` | 搜索与查找 | 基于文件名数据库快速查找文件 |
| `grep` | 搜索与查找 | 在文件中搜索匹配模式的行（三剑客之一） |
| `grep (进阶)` | 搜索与查找 | 段落级匹配、多条件组合、正则高级用法 |
| `which` | 搜索与查找 | 查找可执行程序的路径（$PATH） |
| `whereis` | 搜索与查找 | 查找程序的二进制/源码/man手册页 |
| `type` | 搜索与查找 | 判断命令类型（别名/内建/外部/函数） |
| `sed` | 文本处理 | 流编辑器：查找替换/删除/提取文本 |
| `awk` | 文本处理 | 按列处理结构化文本（日志/CSV） |
| `xargs` | 文本处理 | 将管道输入转为命令行参数 |
| `tar` | 打包与压缩 | 打包/解压归档文件（.tar.gz/.tar.bz2/.tar.xz） |
| `gzip / gunzip` | 打包与压缩 | gzip 压缩/解压单个文件 |
| `zip / unzip` | 打包与压缩 | ZIP 格式压缩/解压（跨平台通用） |
| `du` | 磁盘与统计 | 统计目录/文件磁盘占用 |
| `df` | 磁盘与统计 | 查看磁盘剩余空间 |
| `wc` | 磁盘与统计 | 统计文件行数/单词数/字节数 |
| `chmod` | 权限管理 | 修改文件或目录权限 |
| `chown` | 权限管理 | 修改文件或目录的所有者和所属组 |
| `lsof` | 进程管理 | 列出进程打开的文件（排查端口占用） |
| `kill` | 进程管理 | 向进程发送信号（终止进程） |
| `top` | 进程管理 | 实时监控系统进程和CPU/内存 |
| `free` | 进程管理 | 显示内存使用情况 |
| `netstat` | 网络 | 显示网络连接和端口监听状态 |

---

## 导航与目录

### pwd

#### 命令用途

`pwd`（Print Working Directory）打印当前工作目录的绝对路径。

#### 命令格式

```bash
pwd [选项]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-L` | 显示逻辑路径（默认，保留符号链接） |
| `-P` | 显示物理路径（解析所有符号链接） |

#### 常见用例

```bash
# 显示当前目录
pwd
# 输出：/home/user/projects

# 显示物理路径（如果当前目录是通过软链接进入的）
pwd -P
```


### cd

#### 命令用途

`cd`（Change Directory）切换当前工作目录。是 shell 内建命令（非外部程序）。

#### 命令格式

```bash
cd [目录路径]
```

#### 常用快捷路径

| 路径 | 说明 |
|------|------|
| `cd` 或 `cd ~` | 回到当前用户的家目录 |
| `cd -` | 回到上一次所在的目录（反复执行可在两个目录间切换） |
| `cd ..` | 回到上级目录 |
| `cd ../..` | 回到上两级目录 |
| `cd /` | 切换到根目录 |
| `cd -P <路径>` | 跟随物理路径（解析符号链接） |

#### 常见用例

```bash
# 进入指定目录
cd /var/log

# 回到上级目录
cd ..

# 回到家目录
cd ~
# 或
cd

# 回到上次所在的目录
cd -

# 进入当前用户桌面（~ 展开）
cd ~/Desktop
```


---

## 文件查看

### ls

#### 命令用途

`ls`（List）列出目录内容，是 Linux 中使用频率最高的命令之一。

#### 命令格式

```bash
ls [选项] [路径]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-l` | 长格式显示（权限、大小、时间等详细信息） |
| `-a` | 显示所有文件，包括 `.` 开头的隐藏文件 |
| `-h` | 人类可读的文件大小（配合 `-l` 使用，如 1K, 234M, 2G） |
| `-t` | 按修改时间排序，最新的在前 |
| `-r` | 反向排序 |
| `-S` | 按文件大小排序 |
| `-R` | 递归列出子目录内容 |
| `-d` | 列出目录本身而非其内容 |
| `--color=auto` | 按文件类型着色输出 |

#### 常见用例

```bash
# 列出当前目录内容
ls

# 长格式 + 人类可读大小
ls -lh

# 显示所有文件（含隐藏文件）
ls -la

# 按修改时间排序，最新的在前
ls -lt

# 按文件大小排序，最大的在前
ls -lSh

# 递归列出所有文件
ls -lR

# 只列出目录本身的信息（而非目录内的文件）
ls -ld /home/user
```


### cat

#### 命令用途

`cat`（Concatenate）查看文件内容、合并多个文件、创建简单文件。

#### 命令格式

```bash
cat [选项] [文件...]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-n` | 显示行号（包括空行） |
| `-b` | 显示行号（跳过空行） |
| `-s` | 将连续的空行压缩为一行 |
| `-A` | 显示所有不可见字符（`$` 表示行尾、`^I` 表示 Tab） |
| `-E` | 在每行末尾显示 `$` |

#### 常见用例

```bash
# 查看文件内容
cat file.txt

# 显示行号
cat -n file.txt

# 合并多个文件并输出
cat file1.txt file2.txt > merged.txt

# 向已有文件追加内容
cat append.txt >> existing.txt

# 创建新文件并写入内容（Ctrl+D 结束）
cat > newfile.txt

# 查看文件并压缩空行
cat -s file.txt
```


### head / tail

#### 命令用途

- `head`：查看文件的**开头**若干行，默认 10 行
- `tail`：查看文件的**末尾**若干行，默认 10 行；`tail -f` 可实时追踪文件新增内容

#### 命令格式

```bash
head [选项] [文件]
tail [选项] [文件]
```

#### 常用参数（head & tail 通用）

| 参数 | 说明 |
|------|------|
| `-n <N>` | 显示 N 行（如 `-n 20`） |
| `-c <N>` | 显示 N 字节 |
| `-q` | 不显示文件名头 |

**tail 专属参数：**

| 参数 | 说明 |
|------|------|
| `-f` | 实时追踪文件末尾新增内容（`Ctrl+C` 退出，最常用） |
| `-F` | 同 `-f`，但文件被删除/轮转后会自动重新打开（更健壮） |
| `-n +N` | 从第 N 行开始显示到末尾（如 `+20` 表示跳过前 19 行） |

#### 常见用例

```bash
# ========== head ==========

# 查看文件前 20 行
head -n 20 file.txt

# 查看文件前 100 字节
head -c 100 file.txt

# ========== tail ==========

# 查看文件最后 20 行
tail -n 20 file.txt

# 实时追踪日志文件（调试必备）
tail -f app.log

# 同时追踪多个日志文件
tail -f app.log error.log

# 从第 50 行开始显示到末尾
tail -n +50 file.txt

# 查看日志中最新 100 条并持续追踪
tail -n 100 -f app.log
```


### file

#### 命令用途

`file` 检测并显示文件类型（文本/二进制/图片/压缩包/可执行文件等），不依赖文件扩展名。

#### 命令格式

```bash
file [选项] 文件...
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-i` | 输出 MIME 类型（适合脚本解析） |
| `-b` | 简洁输出（不显示文件名） |
| `-z` | 尝试查看压缩文件内部类型 |
| `-L` | 跟随软链接查看目标文件类型 |

#### 常见用例

```bash
# 查看单个文件类型
file unknown_file

# 查看目录下所有文件类型
file *

# 获取 MIME 类型
file -i image.png
# 输出：image/png; charset=binary

# 批量检查上传文件类型
file -i uploads/*
```


### stat

#### 命令用途

`stat` 显示文件或目录的详细元数据：大小、权限、inode、时间戳、设备号等。

#### 命令格式

```bash
stat [选项] 文件/目录
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-c <格式>` | 自定义输出格式（如 `%s` 大小、`%a` 八进制权限、`%y` 修改时间） |
| `-f` | 显示文件系统信息而非文件信息 |
| `-L` | 跟随软链接 |

#### 输出时间戳说明

| 时间 | 含义 |
|------|------|
| **Access (atime)** | 最后访问时间（读取文件内容） |
| **Modify (mtime)** | 最后修改时间（修改文件内容） |
| **Change (ctime)** | 最后状态变更时间（修改权限/所有者等元数据） |

#### 常见用例

```bash
# 查看文件完整信息
stat file.txt

# 只查看文件大小
stat -c %s file.txt

# 只查看八进制权限
stat -c %a file.txt

# 查看目录所在文件系统信息
stat -f /home

# 格式化输出多字段
stat -c "Size: %s bytes | Owner: %U | Perms: %a" file.txt
```


---

## 文件与目录管理

### mkdir

#### 命令用途

`mkdir`（Make Directory）用于创建新目录。

#### 命令格式

```bash
mkdir [选项] 目录名
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-p` | 递归创建父级目录，目录已存在时不报错 |
| `-m` | 创建时指定目录权限（如 `-m 755`） |
| `-v` | 显示创建过程的详细信息 |

#### 常见用例

```bash
# 创建单个目录
mkdir mydir

# 递归创建多层目录（自动创建不存在的父目录）
mkdir -p /home/user/projects/myapp/src

# 同时创建多个目录
mkdir dir1 dir2 dir3

# 创建目录并指定权限
mkdir -m 755 public_dir
```


### touch

#### 命令用途

`touch` 用于创建空文件，或更新已有文件的时间戳（访问时间和修改时间）。

#### 命令格式

```bash
touch [选项] 文件名
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-a` | 仅修改访问时间 |
| `-m` | 仅修改修改时间 |
| `-t` | 指定具体时间戳（格式：`[[CC]YY]MMDDhhmm[.ss]`） |
| `-c` | 不创建不存在的文件 |

#### 常见用例

```bash
# 创建空文件
touch file.txt

# 同时创建多个空文件
touch a.txt b.txt c.txt

# 更新已有文件的修改时间为当前时间（不改变内容）
touch existing_file.txt

# 创建空文件 + 连续编号（Shell 大括号展开）
touch file_{1..5}.txt  # 生成 file_1.txt ~ file_5.txt
```


### cp

#### 命令用途

`cp`（Copy）用于复制文件或目录。

#### 命令格式

```bash
cp [选项] 源 目标
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-r` / `-R` | 递归复制整个目录（复制目录时必须使用） |
| `-i` | 覆盖前询问确认 |
| `-f` | 强制覆盖（不询问） |
| `-u` | 仅当源文件比目标文件新时才复制（增量更新） |
| `-p` | 保留原文件的权限、时间戳等属性 |
| `-a` | 归档模式，等同于 `-dpR`，保留所有属性并递归复制 |
| `-v` | 显示详细的复制过程 |
| `-n` | 不覆盖已存在的文件 |

#### 常见用例

```bash
# 复制文件到目标路径
cp source.txt /home/user/backup/

# 复制并重命名
cp source.txt dest.txt

# 递归复制整个目录
cp -r /home/user/project /home/user/project_backup

# 复制前询问是否覆盖
cp -i file.txt /tmp/

# 归档复制（保留权限、时间戳、软链接等，常用于备份）
cp -a /var/www /backup/www

# 复制并显示进度
cp -rv source_dir/ dest_dir/
```


### mv

#### 命令用途

`mv`（Move）用于移动文件或目录，也可用于重命名。

#### 命令格式

```bash
mv [选项] 源 目标
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-i` | 覆盖前询问确认 |
| `-f` | 强制覆盖（不询问） |
| `-n` | 不覆盖已存在的文件 |
| `-u` | 仅当源文件比目标文件新或目标文件不存在时才移动 |
| `-v` | 显示详细的移动过程 |
| `-b` | 覆盖前创建备份（生成 `~` 后缀的备份文件） |

#### 常见用例

```bash
# 重命名文件
mv oldname.txt newname.txt

# 重命名目录
mv old_dir new_dir

# 移动文件到目标目录
mv file.txt /home/user/documents/

# 移动多个文件到同一目录
mv a.txt b.txt c.txt /target/dir/

# 使用通配符移动
mv *.log /var/logs/archive/

# 移动并询问覆盖
mv -i file.txt /tmp/
```


> **技巧**：`mv` 在同一文件系统内的移动非常快（仅修改 inode 指针），跨文件系统时则会实际复制后删除。


### rename

#### 命令用途

`rename` 用于批量重命名文件和目录，支持正则表达式和替换模式，比 `mv` 更适合批量操作。

> **注意**：Linux 上有两个版本的 `rename`：
> - **Perl 版**（`prename`）：模式为 `rename 's/旧/新/' *.txt`，功能强大（Ubuntu/Debian 默认）
> - **util-linux 版**：模式为 `rename 旧 新 文件名`，功能简单
> - 本节以更强大的 Perl 版为准

#### 命令格式

```bash
rename [选项] 's/旧模式/新模式/' 文件列表
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-n` | 预览模式：只显示将要重命名的操作，不实际执行（**强烈建议先预览**） |
| `-v` | 显示重命名详情 |
| `-f` | 强制覆盖已存在的目标文件 |

#### 常见用例

```bash
# ========== 文件批量重命名 ==========

# 预览：将所有 .txt 改为 .md（不实际执行）
rename -n 's/\.txt$/.md/' *.txt

# 确认无误后执行
rename -v 's/\.txt$/.md/' *.txt

# 将所有 .jpeg 后缀改为 .jpg
rename 's/\.jpeg$/\.jpg/' *.jpeg

# 将所有文件名中的空格替换为下划线
rename 's/ /_/g' *

# 去除所有文件名中的 "copy" 前缀
rename 's/^copy //' *

# 将文件名中的大写字母转为小写
rename 'y/A-Z/a-z/' *

# 给所有 .jpg 文件添加前缀 "photo_"
rename 's/^/photo_/' *.jpg

# 批量添加序号前缀（如 01_, 02_, 03_ ...）
rename -n 's/^/our $i; sprintf("%02d_", $i++)/e' *.txt

# ========== 目录批量重命名 ==========

# 预览：将所有目录名中的空格替换为下划线
rename -n 's/ /_/g' */

# 执行目录重命名
rename 's/ /_/g' */

# 将目录名统一小写
rename 'y/A-Z/a-z/' */

# ========== 结合 find 精确重命名 ==========

# 递归查找并重命名所有子目录下的 .html 为 .md
find . -name "*.html" -exec rename 's/\.html$/.md/' {} \;
```


### rm

#### 命令用途

`rm`（Remove）用于删除文件或目录。

> **⚠️ 危险命令**：删除后不可恢复，请谨慎使用。

#### 命令格式

```bash
rm [选项] 文件/目录
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-r` / `-R` | 递归删除目录及其内容（删除目录时必须使用） |
| `-f` | 强制删除，忽略不存在的文件，不提示确认 |
| `-i` | 删除前逐一询问确认 |
| `-v` | 显示删除过程的详细信息 |
| `-d` | 删除空目录（等同于 `rmdir`） |

#### 常见用例

```bash
# 删除单个文件
rm file.txt

# 删除多个文件
rm a.txt b.txt c.txt

# 强制删除，不提示
rm -f file.txt

# 递归删除整个目录及其所有内容
rm -r mydir

# 强制递归删除（最危险，不确认）
rm -rf mydir

# 删除前逐一确认
rm -i *.txt

# 删除所有 .log 文件
rm *.log

# 通配符递归删除（如删除所有 node_modules）
rm -rf **/node_modules
```


> **安全建议**：尽量避免直接使用 `rm -rf /` 或在脚本中使用不可信的变量路径。可以用 `trash-cli` 等工具将文件移入回收站代替直接删除。


### ln

#### 命令用途

`ln`（Link）创建文件之间的链接，分为两种：

| 类型 | 说明 | 特点 |
|------|------|------|
| **硬链接** | 同一文件的多条路径，共享同一 inode | 不能跨文件系统、不能链接目录、删除原文件不影响 |
| **软链接（符号链接）** | 指向目标路径的快捷方式 | 可跨文件系统、可链接目录、删除原文件则链接断裂 |

#### 命令格式

```bash
ln [选项] 目标 链接名
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-s` | 创建软链接（符号链接），**最常用** |
| `-f` | 强制覆盖已存在的目标 |
| `-n` | 不覆盖已存在的目录软链接 |
| `-v` | 显示详细过程 |

#### 常见用例

```bash
# 创建软链接（最常用）
ln -s /opt/app/current/bin/start.sh ./start

# 创建目录的软链接
ln -s /data/logs ./logs

# 强制覆盖已有软链接
ln -sf /opt/app/v2.0 ./app

# 创建硬链接（文件多重入口）
ln /home/user/data.txt /backup/data.txt

# 查看软链接指向
readlink -f ./app
# 或
ls -l ./app
```


> **软链接 vs 硬链接选择**：99% 的场景用软链接（`ln -s`），硬链接主要用于防止重要文件被误删。


---

## 搜索与查找

### find

#### 命令用途

`find` 在目录树中搜索文件，支持按名称、类型、大小、时间等条件过滤，并可对匹配的文件执行操作。

#### 命令格式

```bash
find [路径] [条件] [动作]
```

#### 常用条件

| 条件 | 说明 |
|------|------|
| `-name "pattern"` | 按文件名匹配（区分大小写），支持通配符 |
| `-iname "pattern"` | 按文件名匹配（不区分大小写） |
| `-type f` | 只查找普通文件 |
| `-type d` | 只查找目录 |
| `-size +100M` | 查找大于 100MB 的文件（`-` 小于，`+` 大于） |
| `-mtime -7` | 7 天内修改过的文件（`+7` 表示 7 天前） |
| `-user <用户名>` | 按文件所有者查找 |
| `-perm <权限>` | 按权限查找（如 `-perm 755`） |
| `-empty` | 查找空文件或空目录 |
| `-maxdepth <层级>` | 限制最大搜索深度 |

#### 常用动作

| 动作 | 说明 |
|------|------|
| `-print` | 打印匹配的文件路径（默认） |
| `-delete` | 删除匹配的文件 |
| `-exec <命令> {} \;` | 对每个匹配结果执行命令，`{}` 为占位符 |
| `-exec <命令> {} +` | 同上，但批量传递结果（性能更优） |

#### 常见用例

```bash
# 查找当前目录及子目录中所有 .log 文件
find . -name "*.log"

# 查找并删除所有 .tmp 文件
find . -name "*.tmp" -delete

# 查找大于 100MB 的文件
find / -type f -size +100M

# 查找 7 天内修改过的文件
find . -type f -mtime -7

# 查找所有空文件并删除
find . -type f -empty -delete

# 查找所有 .txt 文件并统计行数
find . -name "*.txt" -exec wc -l {} +

# 限制搜索深度为 2 层
find . -maxdepth 2 -name "*.md"
```


### locate

#### 命令用途

`locate` 通过查询系统预建的**文件名数据库**来快速查找文件路径，速度远快于 `find`（无需实时遍历文件系统）。

> **注意**：locate 依赖数据库（通常由 `updatedb` 定期更新），新增文件可能查不到，需手动执行 `sudo updatedb` 刷新。

#### 命令格式

```bash
locate [选项] 关键词
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-i` | 忽略大小写 |
| `-c` | 只显示匹配数量（不列出路径） |
| `-l <N>` | 限制输出前 N 条结果 |
| `-r` | 使用正则表达式匹配 |
| `-b` | 只匹配文件名（不含目录路径部分） |
| `-e` | 只显示文件系统中实际存在的文件（排除已被删除的） |

#### 常见用例

```bash
# 查找所有包含 "nginx" 的文件路径
locate nginx

# 忽略大小写查找
locate -i nginx.conf

# 只显示匹配数量
locate -c ".py"

# 限制只显示前 10 条结果
locate -l 10 ".log"

# 使用正则查找以 .yml 结尾的文件
locate -r '\.yml$'

# 只匹配文件名中的关键词（不含路径）
locate -b nginx.conf

# 手动更新数据库后查找最新文件
sudo updatedb && locate newfile.txt
```


> **场景选择**：模糊搜索文件名用 `locate`（快），按时间/大小/类型搜索用 `find`（精确）。


### grep

#### 命令用途

`grep`（Global Regular Expression Print）在文件中搜索匹配指定模式的行，是三剑客（grep / sed / awk）之一。

#### 命令格式

```bash
grep [选项] "模式" [文件...]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-i` | 忽略大小写 |
| `-r` / `-R` | 递归搜索目录 |
| `-n` | 显示匹配行的行号 |
| `-v` | 反向匹配（显示不包含模式的行） |
| `-c` | 只显示匹配行数（计数） |
| `-l` | 只显示包含匹配内容的文件名 |
| `-w` | 匹配整个单词 |
| `-A <N>` | 显示匹配行及其后 N 行 |
| `-B <N>` | 显示匹配行及其前 N 行 |
| `-C <N>` | 显示匹配行及其前后各 N 行 |
| `-o` | 只输出匹配的部分（而非整行） |
| `-E` | 启用扩展正则表达式（等同于 `egrep`） |

#### 常见用例

```bash
# 在文件中搜索关键词
grep "error" app.log

# 忽略大小写搜索
grep -i "warning" app.log

# 递归搜索目录中所有文件
grep -r "TODO" ./src/

# 显示行号
grep -n "function" main.py

# 统计匹配行数
grep -c "error" app.log

# 显示匹配行及其前后各 3 行上下文
grep -C 3 "panic" app.log

# 排除注释行和空行查看配置文件
grep -v "^#" /etc/nginx/nginx.conf | grep -v "^$"

# 匹配整个单词（防止误匹配）
grep -w "int" source.c

# 使用正则表达式
grep -E "error|warning|fatal" app.log
```


### grep (进阶)

#### 查找特定文本段落

> `grep` 基础用法见上文，本节补充段落级文本匹配和高级过滤技巧。

#### 查找一段包含多行上下文的特定文本

```bash
# 查找 "panic" 及其前后各 5 行上下文（快速定位事故现场）
grep -C 5 "panic" app.log

# 查找 "error" 及其之后 10 行（看错误的后续影响）
grep -A 10 "error" app.log

# 查找 "exception" 及其之前 10 行（看异常发生前做了什么）
grep -B 10 "exception" app.log
```

#### 多条件组合查找

```bash
# 查找同时包含 "error" 和 "timeout" 的行（管道串联）
grep "error" app.log | grep "timeout"

# 查找包含 "error" 或 "warning" 或 "fatal" 的行（扩展正则）
grep -E "error|warning|fatal" app.log

# 查找匹配 "error" 的文件的文件名，再去那些文件里搜 "timeout"
grep -rl "error" ./logs/ | xargs grep -n "timeout"
```

#### 正则表达式高级匹配

```bash
# 查找 IP 地址（匹配 xxx.xxx.xxx.xxx 格式）
grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' access.log

# 查找所有邮箱地址
grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' file.txt

# 查找以 "2024-01" 开头且包含 "ERROR" 的日志行
grep -E '^2024-01.*ERROR' app.log

# 查找空白行（快速定位格式问题）
grep -n '^$' file.txt

# 反选：显示非注释且非空行（查看有效配置）
grep -v '^\s*#' config.conf | grep -v '^\s*$'
```


### which

#### 命令用途

`which` 在 `$PATH` 环境变量指定的路径中**查找可执行程序**的位置，告诉你运行某个命令时实际执行的是哪个二进制文件。

#### 命令格式

```bash
which [选项] 程序名
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-a` | 显示所有匹配的可执行文件路径（不限于第一个） |
| `--skip-alias` | 跳过别名查找 |
| `--skip-functions` | 跳过 shell 函数查找 |

#### 常见用例

```bash
# 查找 python 命令的实际路径
which python
# 输出：/usr/bin/python

# 查找多个命令的路径
which python node npm

# 显示所有匹配的可执行文件（多个版本时很有用）
which -a python
# 输出：
# /home/user/.pyenv/shims/python
# /usr/bin/python

# 确认命令来源（排查环境变量冲突）
which java
```


> **排查场景**：你装了软件但运行报版本不对时，`which` 帮你确认系统到底在跑哪个路径的程序。


### whereis

#### 命令用途

`whereis` 查找程序的**二进制文件、源代码、man 手册页**的路径。比 `which` 搜索范围更广（标准文档目录也会搜）。

#### 命令格式

```bash
whereis [选项] 程序名
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-b` | 只查找二进制文件 |
| `-m` | 只查找 man 手册页 |
| `-s` | 只查找源代码 |
| `-u` | 查找不寻常的文件（缺少某项的条目） |
| `-B <目录>` | 在指定目录中查找二进制文件 |
| `-M <目录>` | 在指定目录中查找手册页 |

#### 常见用例

```bash
# 查找 nginx 的所有相关路径
whereis nginx
# 输出：nginx: /usr/sbin/nginx /etc/nginx /usr/share/nginx /usr/share/man/man8/nginx.8.gz

# 只查找二进制文件
whereis -b python

# 只查找 man 手册页
whereis -m ls

# 在自定义目录查找
whereis -B /usr/local/bin -m nginx
```


### type

#### 命令用途

`type` 是 **shell 内建命令**，用于判断一个命令是外部程序、shell 内建命令、别名还是函数。当命令行为异常时，用 `type` 确认其真实身份。

#### 命令格式

```bash
type [选项] 命令名
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-a` | 显示所有匹配（包括别名、内建、外部程序） |
| `-t` | 简洁输出类型：`alias` / `keyword` / `function` / `builtin` / `file` |
| `-p` | 只显示外部程序路径（等同于 `which`） |

#### 常见用例

```bash
# 判断命令类型
type ls
# 输出：ls is aliased to `ls --color=auto'

# 显示所有同名定义（内建 + 外部都列出）
type -a echo
# 输出：
# echo is a shell builtin
# echo is /usr/bin/echo

# 只输出类型（适合脚本判断）
type -t cd       # 输出：builtin
type -t python   # 输出：file
type -t ll       # 输出：alias
```


> **对比总结**：

| 命令 | 查什么 | 数据来源 |
|------|--------|----------|
| `locate` | 按文件名模糊搜索任意文件路径 | 文件名数据库（需 `updatedb`） |
| `which` | 查找可执行程序的路径 | `$PATH` 环境变量 |
| `whereis` | 查找程序的二进制/源码/man | 标准系统目录 |
| `type` | 判断命令的真实身份 | Shell 内建记录 |
| `find` | 按条件实时搜索文件 | 实时遍历文件系统 |


---

## 文本处理

### sed

#### 命令用途

`sed`（Stream Editor）流编辑器，用于对文本进行过滤、查找替换、删除、插入等操作。处理管道数据或大文件时效率极高，是三剑客（grep / sed / awk）之一。

#### 命令格式

```bash
sed [选项] '动作' [文件]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-n` | 静默模式，不自动打印每一行（通常配合 `p` 使用） |
| `-i` | 直接修改文件内容（原地编辑，**不可逆**） |
| `-i.bak` | 原地编辑但创建 `.bak` 备份文件 |
| `-e` | 执行多个 sed 命令 |
| `-r` / `-E` | 启用扩展正则表达式 |

#### 常用动作

| 动作 | 说明 |
|------|------|
| `s/A/B/g` | 查找替换：将 A 替换为 B，`g` 表示全局替换（每行所有匹配） |
| `/pattern/d` | 删除匹配 pattern 的行 |
| `/pattern/p` | 打印匹配 pattern 的行（配合 `-n`） |
| `Nd` | 删除第 N 行（如 `5d` 删除第 5 行） |
| `M,Np` | 打印第 M 到 N 行（配合 `-n`） |
| `/start/,/end/p` | 打印从匹配 start 到匹配 end 的段落（配合 `-n`） |
| `a\文本` | 在匹配行后追加一行 |
| `i\文本` | 在匹配行前插入一行 |

#### 常见用例

```bash
# ========== 查找替换（最常用） ==========

# 将文件中的 "foo" 替换为 "bar"（仅输出，不修改文件）
sed 's/foo/bar/g' file.txt

# 原地替换并创建 .bak 备份（推荐）
sed -i.bak 's/foo/bar/g' file.txt

# 原地替换，不备份（谨慎使用）
sed -i 's/foo/bar/g' file.txt

# 只替换每行第一个匹配（去掉 g）
sed -i 's/foo/bar/' file.txt

# 使用替代分隔符（路径场景用 # 或 | 避免转义地狱）
sed -i 's#/old/path#/new/path#g' config.txt

# 只替换第 3 行到第 10 行之间的内容
sed -i '3,10s/foo/bar/g' file.txt

# ========== 查找并提取特定段落 ==========

# 提取文件中从 "BEGIN" 到 "END" 之间的所有行
sed -n '/BEGIN/,/END/p' file.txt

# 提取第 5 到 15 行
sed -n '5,15p' file.txt

# 删除从 "DEBUG-START" 到 "DEBUG-END" 的整段内容
sed -i '/DEBUG-START/,/DEBUG-END/d' file.txt

# ========== 删除操作 ==========

# 删除所有空行
sed -i '/^$/d' file.txt

# 删除第 1 行（去表头）
sed -i '1d' file.txt

# 删除所有以 # 开头的注释行
sed -i '/^#/d' config.conf

# 删除行尾空格
sed -i 's/:space:*$//' file.txt

# ========== 提取输出到新文件 ==========

# 从日志中提取所有包含 "ERROR" 的行并保存
sed -n '/ERROR/p' app.log > errors.log
```


### awk

#### 命令用途

`awk` 是一种强大的文本处理语言，擅长按列处理结构化文本（如日志、CSV、命令输出），是三剑客（grep / sed / awk）之一。

#### 命令格式

```bash
awk [选项] '条件 {动作}' [文件]
```

#### 内建变量

| 变量 | 说明 |
|------|------|
| `$0` | 整行内容 |
| `$1, $2, $3...` | 第 1 列、第 2 列、第 3 列……（默认以空白分隔） |
| `$NF` | 最后一列 |
| `$(NF-1)` | 倒数第二列 |
| `NR` | 当前行号 |
| `NF` | 当前行的列数 |
| `FS` | 输入字段分隔符（默认空格/制表符） |
| `OFS` | 输出字段分隔符 |

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-F"分隔符"` | 指定字段分隔符（如 `-F":"` 按冒号分隔，`-F","` 按逗号分隔） |
| `-v var=val` | 传入外部变量 |

#### 常见用例

```bash
# ========== 按列提取 ==========

# 打印第 1 列和第 3 列
awk '{print $1, $3}' file.txt

# 按冒号分隔，打印第 1 列和第 7 列
awk -F: '{print $1, $7}' /etc/passwd

# 打印最后一列
awk '{print $NF}' file.txt

# 打印行号 + 内容
awk '{print NR, $0}' file.txt

# ========== 条件过滤 ==========

# 打印第 3 列大于 100 的行
awk '$3 > 100 {print}' file.txt

# 打印第 1 列等于 "ERROR" 的行
awk '$1 == "ERROR" {print}' app.log

# 打印第 2 列包含 "nginx" 的行
awk '$2 ~ /nginx/' app.log

# ========== 统计计算 ==========

# 对第 2 列求和
awk '{sum += $2} END {print sum}' file.txt

# 统计文件中不同值的出现次数
awk '{count[$1]++} END {for (i in count) print i, count[i]}' file.txt

# 计算第 3 列的平均值
awk '{sum += $3; n++} END {print sum/n}' file.txt

# ========== 实战场景 ==========

# 查找 "ERROR" 行，打印时间戳和错误信息
awk '/ERROR/ {print $1, $3, $4, $5}' app.log

# 查找状态码为 500 的请求，统计每个路径的出现次数
awk '$9 == 500 {count[$7]++} END {for (p in count) print p, count[p]}' access.log

# 按逗号分隔处理 CSV 文件
awk -F, '{print $1, $3}' data.csv
```


### xargs

#### 命令用途

`xargs` 将标准输入转换为命令行参数，解决参数过长和管道不能传参的问题。常与 `find`、`grep` 等命令组合使用。

#### 命令格式

```bash
command | xargs [选项] [命令]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-n <N>` | 每次传递 N 个参数给目标命令 |
| `-I {}` | 用 `{}` 作为占位符，精确控制参数位置 |
| `-0` | 以 null 字符分隔输入（配合 `find -print0` 处理含空格的文件名） |
| `-p` | 执行前询问确认 |
| `-t` | 执行前打印命令 |
| `-P <N>` | 并行执行 N 个进程 |

#### 常见用例

```bash
# 将 grep 找到的文件传给 sed 做批量替换
grep -rl "old_text" ./src/ | xargs sed -i 's/old_text/new_text/g'

# 将 find 找到的文件传给 rm 删除
find . -name "*.tmp" | xargs rm -f

# 安全版：处理含空格的文件名（find -print0 + xargs -0）
find . -name "*.log" -print0 | xargs -0 rm -f

# 批量修改文件权限
find . -name "*.sh" | xargs chmod +x

# 每次处理 5 个文件
ls *.jpg | xargs -n 5 mv -t /backup/images/

# 使用占位符（精确控制参数位置）
find . -name "*.txt" | xargs -I {} cp {} {}.bak

# 并行压缩所有日志文件（4 个进程同时处理）
find . -name "*.log" | xargs -P 4 -I {} gzip {}

# 批量创建目录
echo "dir1 dir2 dir3" | xargs mkdir -p
```


---

## 打包与压缩

### tar

#### 命令用途

`tar`（Tape Archive）用于将多个文件打包为一个归档文件（`*.tar`），常与 `gzip`/`bzip2`/`xz` 结合使用实现打包+压缩。是 Linux 中最通用的归档工具。

#### 命令格式

```bash
tar [选项] [归档文件] [源文件/目录...]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-c` | 创建新的归档文件（create） |
| `-x` | 解压归档文件（extract） |
| `-t` | 列出归档文件内容而不解压（list） |
| `-v` | 显示处理过程的详细信息（verbose） |
| `-f` | 指定归档文件名（**必须放在最后，后跟文件名**） |
| `-z` | 使用 gzip 压缩或解压（`.tar.gz` / `.tgz`） |
| `-j` | 使用 bzip2 压缩或解压（`.tar.bz2`，体积更小但更慢） |
| `-J` | 使用 xz 压缩或解压（`.tar.xz`，压缩率最高） |
| `-C <目录>` | 解压到指定目标目录 |
| `--exclude=<模式>` | 排除匹配的文件或目录 |

#### 三种压缩格式对比

| 格式 | 参数 | 后缀 | 压缩率 | 速度 |
|------|------|------|--------|------|
| gzip | `-z` | `.tar.gz` / `.tgz` | 中等 | 快（最通用） |
| bzip2 | `-j` | `.tar.bz2` | 较高 | 较慢 |
| xz | `-J` | `.tar.xz` | 最高 | 最慢 |

#### 常见用例

```bash
# ========== 打包 & 压缩 ==========

# 将目录打包为 .tar.gz（最常用）
tar -czvf archive.tar.gz /path/to/dir/

# 将目录打包为 .tar.bz2（体积更小）
tar -cjvf archive.tar.bz2 /path/to/dir/

# 将目录打包为 .tar.xz（体积最小）
tar -cJvf archive.tar.xz /path/to/dir/

# 打包多个目录和文件到一个归档
tar -czvf backup.tar.gz /var/log/ /etc/nginx/ /home/user/data.txt

# 打包但排除某些文件/目录
tar -czvf project.tar.gz --exclude=node_modules --exclude=.git ./myproject/

# ========== 解压 ==========

# 解压 .tar.gz 到当前目录
tar -xzvf archive.tar.gz

# 解压 .tar.bz2
tar -xjvf archive.tar.bz2

# 解压 .tar.xz
tar -xJvf archive.tar.xz

# 解压到指定目录
tar -xzvf archive.tar.gz -C /opt/app/

# ========== 查看 ==========

# 查看归档内容（不解压）
tar -tzvf archive.tar.gz

# 查看归档中是否包含某个文件
tar -tzvf archive.tar.gz | grep "filename"
```


> **记忆技巧**：
> - 打包压缩：`tar -czvf` = **c**reate + g**z**ip + **v**erbose + **f**ile
> - 解压：`tar -xzvf` = e**x**tract + g**z**ip + **v**erbose + **f**ile
> - 查看：`tar -tzvf` = lis**t** + g**z**ip + **v**erbose + **f**ile


### gzip / gunzip

#### 命令用途

`gzip` 用于压缩单个文件（生成 `.gz` 文件），`gunzip` 用于解压。通常配合 `tar` 使用，但也可单独处理单个文件。

> **注意**：`gzip` 只能压缩单个文件，不能压缩目录。压缩目录需先用 `tar` 打包。

#### 命令格式

```bash
gzip [选项] 文件
gunzip [选项] 文件.gz
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-k` | 保留原文件（默认压缩后会删除原文件） |
| `-v` | 显示压缩/解压详情 |
| `-c` | 输出到标准输出（可重定向到新文件，保留原文件） |
| `-1 ~ -9` | 压缩级别：`-1` 最快（压缩率低），`-9` 最慢（压缩率高），默认 `-6` |
| `-r` | 递归压缩目录下的每个文件（非打包） |
| `-t` | 测试压缩文件完整性 |
| `-f` | 强制覆盖 |

#### 常见用例

```bash
# 压缩单个文件（原文件被替换为 .gz）
gzip largefile.log

# 压缩并保留原文件
gzip -k largefile.log

# 解压 .gz 文件
gunzip largefile.log.gz
# 等价于
gzip -d largefile.log.gz

# 查看压缩文件内容（不解压）
zcat largefile.log.gz
zless largefile.log.gz  # 分页查看

# 最高压缩率
gzip -9 -k largefile.log
```


### zip / unzip

#### 命令用途

`zip` 用于创建 ZIP 格式压缩包（Windows/Linux/macOS 通用），`unzip` 用于解压。与 `tar.gz` 不同，`zip` 可以**直接压缩目录**，无需先打包。

#### 命令格式

```bash
zip [选项] 压缩包名.zip 文件/目录...
unzip [选项] 压缩包名.zip
```

#### 常用参数

**zip 参数：**

| 参数 | 说明 |
|------|------|
| `-r` | 递归压缩目录及其子目录 |
| `-q` | 静默模式，不显示压缩过程 |
| `-e` | 加密压缩（需要输入密码） |
| `-x <模式>` | 排除匹配的文件，如 `-x "*.log" "*.tmp"` |
| `-<0-9>` | 压缩级别：`-0` 仅存储不压缩，`-9` 最高压缩率 |

**unzip 参数：**

| 参数 | 说明 |
|------|------|
| `-l` | 列出压缩包内容而不解压 |
| `-d <目录>` | 解压到指定目录 |
| `-o` | 覆盖已存在的文件不提示 |
| `-n` | 不覆盖已存在的文件 |
| `-q` | 静默模式 |

#### 常见用例

```bash
# ========== 压缩 ==========

# 压缩单个目录（必须加 -r 递归）
zip -r project.zip myproject/

# 压缩多个文件
zip backup.zip file1.txt file2.txt file3.txt

# 压缩目录但排除某些文件
zip -r project.zip myproject/ -x "*.log" "*.tmp" "node_modules/*"

# 加密压缩（会提示输入密码）
zip -re secure.zip secret_folder/

# ========== 解压 ==========

# 解压到当前目录
unzip archive.zip

# 解压到指定目录
unzip archive.zip -d /opt/extracted/

# 查看压缩包内容（不解压）
unzip -l archive.zip

# 静默解压并覆盖
unzip -oq archive.zip
```


---

## 磁盘与统计

### du

#### 命令用途

`du`（Disk Usage）统计文件或目录占用的磁盘空间大小。

#### 命令格式

```bash
du [选项] [文件/目录]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-h` | 人类可读格式（K, M, G） |
| `-s` | 只显示总计（不列出子目录详情） |
| `-a` | 显示所有文件（含普通文件，非仅目录） |
| `-c` | 显示总计行 |
| `--max-depth=<N>` | 限制显示深度（如 `--max-depth=1` 只显示一层子目录） |
| `--exclude=<模式>` | 排除匹配的文件/目录 |

#### 常见用例

```bash
# 查看当前目录下各子目录占用空间（只一层）
du -h --max-depth=1

# 查看指定目录各子项大小，按大小排序
du -h --max-depth=1 /var/ | sort -hr

# 查看当前目录总计大小
du -sh .

# 查看目录下各文件/子目录的大小（递归），取前 20 个最大的
du -ah /var/log/ | sort -hr | head -20

# 查看占用空间最大的前 10 个目录
du -h --max-depth=2 / | sort -hr | head -10

# 排除某些目录后统计
du -sh --exclude=node_modules --exclude=.git ./myproject/
```


### df

#### 命令用途

`df`（Disk Free）显示文件系统的磁盘空间使用情况（整体磁盘、挂载点）。

#### 命令格式

```bash
df [选项] [路径]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-h` | 人类可读格式 |
| `-T` | 显示文件系统类型（ext4 / xfs / tmpfs 等） |
| `-t <类型>` | 只显示指定类型的文件系统 |
| `-x <类型>` | 排除指定类型的文件系统 |
| `-i` | 显示 inode 使用情况而非块使用情况 |
| `-l` | 只显示本地文件系统 |

#### 常见用例

```bash
# 查看所有挂载点磁盘使用情况（人类可读）
df -h

# 查看指定目录所在磁盘的使用情况
df -h /home

# 查看磁盘使用情况并显示文件系统类型
df -hT

# 只显示本地磁盘（排除 tmpfs 等）
df -hl

# 检查 inode 使用率（inode 耗尽也会导致"磁盘满"）
df -i
```


### wc

#### 命令用途

`wc`（Word Count）统计文件的**行数、单词数、字节数**。

#### 命令格式

```bash
wc [选项] [文件...]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-l` | 只统计行数 |
| `-w` | 只统计单词数 |
| `-c` | 只统计字节数 |
| `-m` | 只统计字符数（多字节字符会正确计数） |
| `-L` | 显示最长行的长度 |

#### 常见用例

```bash
# 统计行数（最常用）
wc -l file.txt

# 统计多个文件的总行数
wc -l *.py

# 显示完整统计（行数、单词数、字节数）
wc file.txt

# 统计目录下所有 .py 文件的总行数
find . -name "*.py" | xargs wc -l
# 或
wc -l **/*.py

# 统计进程数
ps aux | wc -l
```


---

## 权限管理

### chmod

#### 命令用途

`chmod`（Change Mode）用于修改文件或目录的权限。

#### 命令格式

```bash
chmod [选项] 权限 文件
```

#### 权限表示法

**数字表示法**：每位数字为 r(4) + w(2) + x(1) 的和。

| 数字 | 权限 | 含义 |
|------|------|------|
| `7` | rwx | 读 + 写 + 执行 |
| `6` | rw- | 读 + 写 |
| `5` | r-x | 读 + 执行 |
| `4` | r-- | 只读 |
| `0` | --- | 无权限 |

三位数字分别代表 **所有者 / 所属组 / 其他人**。

**符号表示法**：`[ugoa][+-=][rwx]`

| 符号 | 含义 |
|------|------|
| `u` | 所有者 (user) |
| `g` | 所属组 (group) |
| `o` | 其他人 (others) |
| `a` | 所有人 (all) |
| `+` | 添加权限 |
| `-` | 移除权限 |
| `=` | 精确设置 |

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-R` | 递归修改目录下所有文件的权限 |

#### 常见用例

```bash
# 所有者可读写执行，组和其他人可读执行（最常用）
chmod 755 script.sh

# 所有用户可读写执行
chmod 777 file.txt

# 私有文件：仅所有者可读写
chmod 600 ~/.ssh/id_rsa

# 给脚本添加执行权限（符号法）
chmod +x script.sh

# 移除所有人的写权限
chmod a-w file.txt

# 递归修改整个目录权限
chmod -R 755 /var/www/html

# 目录通常需要执行权限才能访问，文件通常不需要
find . -type d -exec chmod 755 {} \;  # 目录设 755
find . -type f -exec chmod 644 {} \;  # 文件设 644
```


### chown

#### 命令用途

`chown`（Change Owner）用于修改文件或目录的所有者和所属组。

#### 命令格式

```bash
chown [选项] [所有者][:所属组] 文件
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-R` | 递归修改目录下所有文件的所有者 |
| `-v` | 显示详细的修改过程 |

#### 常见用例

```bash
# 修改文件所有者
chown user1 file.txt

# 同时修改所有者和所属组
chown user1:group1 file.txt

# 只修改所属组
chown :group1 file.txt

# 递归修改目录下所有文件
chown -R www-data:www-data /var/www/html

# 只修改组（同 chgrp）
chown .group1 file.txt
```


---

## 进程管理

### lsof

#### 命令用途

`lsof`（List Open Files）列出当前系统中所有被进程打开的文件。在 Linux 中一切皆文件，因此可用于排查端口占用、文件占用等问题。

#### 命令格式

```bash
lsof [选项] [参数]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-i:端口号` | 查看指定端口的占用情况 |
| `-i` | 列出所有网络连接 |
| `-i -U` | 显示所有打开的端口和 UNIX domain 文件 |
| `-c <进程名>` | 显示指定进程打开的文件 |
| `-p <PID>` | 列出指定 PID 的进程所打开的文件 |
| `-d <fd>` | 显示使用指定文件描述符的进程 |
| `-g <GID>` | 显示归属指定 GID 的进程情况 |
| `+d <目录>` | 显示目录下被进程打开的文件（不递归） |
| `+D <目录>` | 显示目录下被进程打开的文件（递归，耗时较长） |

#### 常见用例

```bash
# 查看 8080 端口被哪个进程占用
lsof -i:8080

# 查看 8000 端口占用（需 root 权限）
lsof -i:8000
# 输出示例：
# COMMAND   PID USER   FD   TYPE   DEVICE SIZE/OFF NODE NAME
# nodejs  26993 root   10u  IPv4 37999514      0t0  TCP *:8000 (LISTEN)

# 显示打开 abc.txt 文件的进程
lsof abc.txt

# 列出进程号为 1234 的进程所打开的文件
lsof -p 1234

# 显示 abc 进程现在打开的文件
lsof -c abc
```


> **注意**：`lsof -i` 通常需要 root 权限才能获取完整信息。


### kill

#### 命令用途

`kill` 用于向进程发送信号，最常用于终止进程。结合 `lsof` 或 `netstat` 查到 PID 后，可使用 `kill` 结束占用端口的进程。

#### 命令格式

```bash
kill [信号] PID
```

#### 常用信号

| 信号编号 | 信号名 | 说明 |
|----------|--------|------|
| `1` | `SIGHUP` | 重新加载配置（挂起） |
| `2` | `SIGINT` | 中断进程（同 Ctrl+C） |
| `9` | `SIGKILL` | 强制杀死进程（不可捕获/忽略） |
| `15` | `SIGTERM` | 优雅终止进程（默认信号） |
| `18` | `SIGCONT` | 继续被暂停的进程 |
| `19` | `SIGSTOP` | 暂停进程 |

#### 常见用例

```bash
# 优雅终止 PID 为 26993 的进程
kill 26993

# 强制杀死 PID 为 26993 的进程（进程无法忽略此信号）
kill -9 26993

# 重新加载进程配置（常用于让守护进程重读配置文件）
kill -1 1234

# 批量杀死所有名为 "node" 的进程
killall node
# 或强制杀死
killall -9 node

# 按名称查找并杀死进程
pkill -9 nginx
```


> **注意**：优先使用 `kill`（SIGTERM）让进程有机会清理资源；仅当进程无响应时再使用 `kill -9`（SIGKILL）。


### top

#### 命令用途

`top` 实时显示系统中各个进程的资源占用情况，类似 Windows 的任务管理器。用于监控系统整体运行状态和 CPU/内存使用率。

#### 命令格式

```bash
top [选项]
```

#### 常用交互快捷键

| 按键 | 说明 |
|------|------|
| `1` | 展开/折叠每个 CPU 核心的使用情况 |
| `M` | 按内存使用率排序 |
| `P` | 按 CPU 使用率排序 |
| `T` | 按运行时间排序 |
| `k` | 输入 PID 杀死进程 |
| `q` | 退出 top |
| `h` | 显示帮助 |

#### CPU 使用率字段说明

| 字段 | 说明 |
|------|------|
| `%us` | 用户空间程序的 CPU 使用率（未通过 nice 调度） |
| `%sy` | 系统空间（内核）的 CPU 使用率 |
| `%ni` | 用户空间且通过 nice 调度的 CPU 使用率 |
| `%id` | 空闲 CPU 百分比 |
| `%wa` | CPU 等待 I/O 完成的时间占比 |
| `%hi` | CPU 处理硬中断的时间占比 |
| `%si` | CPU 处理软中断的时间占比 |
| `%st` | 被虚拟机"偷走"的 CPU 时间 |

#### 常见用例

```bash
# 启动 top（实时监控）
top

# 指定刷新间隔为 2 秒
top -d 2

# 只监控 PID 为 1234 的进程
top -p 1234

# 批处理模式（输出一次后退出，适合脚本）
top -b -n 1
```


> **CPU 使用率计算**：`%id` 为 99.0 表示 99% 空闲，则系统 CPU 使用率为 `100% - 99% = 1%`。


### free

#### 命令用途

`free` 显示系统内存使用情况，包括物理内存、Swap 交换分区和内核缓冲区。是 Linux 系统监控中最常用的内存查看命令之一。

#### 命令格式

```bash
free [选项]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-b` | 以 Byte 为单位显示 |
| `-k` | 以 KB 为单位显示（默认） |
| `-m` | 以 MB 为单位显示 |
| `-g` | 以 GB 为单位显示 |
| `-h` | 以人类可读的方式显示（自动选择单位） |
| `-t` | 在底部显示内存总和行 |
| `-s <秒>` | 每隔指定秒数持续刷新显示 |
| `-c <次数>` | 配合 `-s` 使用，指定刷新次数后退出 |

#### 输出字段说明

| 字段 | 说明 |
|------|------|
| `total` | 总内存大小 |
| `used` | 已使用内存 |
| `free` | 完全空闲的内存 |
| `shared` | 共享内存（多进程共享） |
| `buff/cache` | 内核缓冲区和页缓存（可释放用于程序） |
| `available` | 应用程序实际可用的内存（含可回收的 buff/cache） |

#### 常见用例

```bash
# 以 KB 为单位显示内存使用情况（默认）
free

# 以 MB 为单位显示
free -m

# 以 GB 为单位显示
free -g

# 以人类可读格式（自动选择合适的单位）
free -h

# 显示总计行
free -t

# 每秒刷新一次内存使用情况（持续监控）
free -s 1

# 每秒刷新，共显示 5 次后退出
free -s 1 -c 5
```


---

## 网络

### netstat

#### 命令用途

`netstat` 用于显示网络连接、路由表、接口统计等网络相关信息。常用于排查端口监听和网络连接状态。

#### 命令格式

```bash
netstat [选项]
```

#### 常用参数

| 参数 | 说明 |
|------|------|
| `-t` | 仅显示 TCP 相关连接 |
| `-u` | 仅显示 UDP 相关连接 |
| `-n` | 拒绝显示别名，以数字形式显示地址和端口 |
| `-l` | 仅列出处于 LISTEN（监听）状态的服务 |
| `-p` | 显示建立连接的程序名和 PID |
| `-a` | 显示所有连接和监听端口 |
| `-r` | 显示路由表 |

#### 常见用例

```bash
# 查看所有 TCP 监听端口及对应进程
netstat -tunlp

# 查看 8000 端口被哪个进程占用
netstat -tunlp | grep 8000

# 查看所有 TCP 端口使用情况
netstat -ntlp

# 查看所有 80 端口使用情况
netstat -ntulp | grep 80

# 查看所有 3306（MySQL）端口使用情况
netstat -ntulp | grep 3306

# 查看所有端口（含 UDP、UNIX socket）
netstat -an
```


---

## 总结

| 分类 | 命令 | 典型场景 |
|------|------|----------|
| 导航 | `pwd` / `cd` | `cd /var/log` → `cd -` 返回 |
| 查看 | `ls` / `cat` / `head` / `tail` / `file` / `stat` | `tail -f app.log` 调试必用 |
| 管理 | `mkdir` / `touch` / `cp` / `mv` / `rename` / `rm` / `ln` | `mkdir -p` 建结构、`ln -s` 版本切换 |
| 搜索 | `find` / `locate` / `grep` / `which` / `whereis` / `type` | `grep -rn` 全局搜代码 |
| 处理 | `sed` / `awk` / `xargs` | `sed -i 's/a/b/g'` 批量替换 |
| 压缩 | `tar` / `gzip` / `zip` | `tar -czvf` 备份、`tar -xzvf` 恢复 |
| 统计 | `du` / `df` / `wc` | `du -sh *` 排查磁盘占用 |
| 权限 | `chmod` / `chown` | `chmod +x deploy.sh` |
| 进程 | `lsof` / `kill` / `top` / `free` | `lsof -i:8080` → `kill -9 PID` |
| 网络 | `netstat` | `netstat -tunlp` 查看监听端口 |

**典型排查流程**：

```bash
# 1. 查看端口占用
lsof -i:8080
# 或
netstat -tunlp | grep 8080

# 2. 找到 PID 后杀死进程
kill -9 <PID>

# 3. 监控系统资源
top
free -h
```

**典型文件操作流程**：

```bash
# 1. 创建项目目录结构
mkdir -p myproject/src/components

# 2. 创建入口文件
touch myproject/src/main.py

# 3. 复制配置文件模板 + 设置权限
cp template.env myproject/.env
chmod 600 myproject/.env

# 4. 打包备份（排除不必要文件）
tar -czvf myproject.tar.gz --exclude=node_modules --exclude=.git ./myproject/

# 5. 查找并清理临时文件
find myproject -name "*.pyc" -delete
```

**典型磁盘排查流程**：

```bash
# 1. 查看整体磁盘使用
df -h

# 2. 逐层排查占用
du -h --max-depth=1 / | sort -hr | head -10

# 3. 查找最大的文件
find /var -type f -size +100M -exec ls -lh {} \; | sort -k5 -hr | head -10
```
