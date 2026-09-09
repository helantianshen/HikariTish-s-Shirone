---
title: GoLand 调优
published: 2026-08-07
description: 整理 GoLand 的 JVM、代码缓存、GC 与 Go 工具进程参数，改善大型项目中的内存占用和响应速度。
tags:
  - AI 工具
  - 开发环境
  - 性能优化
category: 配置AI工作站
pinned: false
draft: false
comment: true
lang: zh_CN
---

## 自定义虚拟机选项

```
-Xms2048m  
-Xmx9216m  
-XX:ReservedCodeCacheSize=2048m  
-XX:+UseG1GC  
-XX:ParallelGCThreads=10  
-XX:ConcGCThreads=6  
-Dfile.encoding=UTF-8  
-Dsun.jnu.encoding=UTF-8  
-XX:+HeapDumpOnOutOfMemoryError  
-XX:HeapDumpPath=$USER_HOME/goland_oom.hprof  
-Dide.managed.by.toolbox=C:\Users\80945\AppData\Local\JetBrains\Toolbox\bin\jetbrains-toolbox.exe  
-Dtoolbox.notification.token=218f9334-8614-446c-ac7b-85f2e51ff4fe  
-Dtoolbox.notification.portFile=C:\Users\80945\AppData\Local\JetBrains\Toolbox\cache\ports\5ac24f52-2bff-41e8-896f-1dd4469e1226.port  
-Dgo.gopls.heap.size=6144m  
-Dgo.dlv.heap.size=4096m  
-Dgo.modules.index.parallelism=8  
-Dfile.encoding=UTF-8、-Dsun.jnu.encoding=UTF-8  
-XX:+HeapDumpOnOutOfMemoryError、-XX:HeapDumpPath=$USER_HOME/goland_oom.hprof  
--add-opens=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED  
--add-opens=java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED
```
