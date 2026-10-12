# C# 上位机面试核心知识库 & 交互式自测记忆系统 🎯

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Online-brightgreen?style=flat-square)](https://meizhiyuan123-creator.github.io/csharp-upper-computer-interview/)
[![.NET 8](https://img.shields.io/badge/.NET-8.0-blue?style=flat-square)](https://dotnet.microsoft.com/)
[![WPF](https://img.shields.io/badge/UI-WPF%20%7C%20Prism-purple?style=flat-square)](https://github.com/dotnet/wpf)
[![License](https://img.shields.io/badge/License-MIT-orange?style=flat-square)](#)

> **面向岗位**：C# / .NET / WPF 上位机开发 ｜ 设备测控软件 ｜ 工业视觉 ｜ 硬件通信  
> **核心特色**：**完全剔除已过时的历史技术（WebForms/Remoting等）**，依据第一性原理深度提炼 **WPF 渲染性能、工业通信（Modbus/串口粘包）、多线程数据流（Channel）、CLR 内存优化与 GC、海康相机 SDK 取流及 C# P/Invoke 底层交互**！

📱 **在线刷题网址（手机/PC 自适应）**：  
👉 [https://meizhiyuan123-creator.github.io/csharp-upper-computer-interview/](https://meizhiyuan123-creator.github.io/csharp-upper-computer-interview/)

---

## 🌟 核心功能特性

1. **🃏 抽认自测模式（Flashcard Active Recall）**：
   - 默认折叠答案，避免“看懂即记住”的认知错觉，强制进行主动回忆。
   - 包含 **【💡 30秒核心速记提纲】**，面试先给出高密度定性结论；随后展开 **【🔍 深入原理解析】**、**【🛠️ 上位机实战避坑】** 与 **【⚠️ 面试官连环追问】**。
2. **📊 熟练度打标与本地记忆**：
   - 支持 `[✅ 已掌握]`、`[🤔 待复习]`、`[🔥 重点攻关]` 三种状态标记。
   - 基于浏览器 `localStorage` 离线持久化，刷新不丢失，支持一键筛选“未掌握”题目冲刺复习。
3. **🎯 严苛的 1~5 星评星与分级过滤**：
   - **⭐⭐⭐⭐⭐ 5星必背**：决定面试生死的基石（WPF Dispatcher、Modbus 粘包、Channel 采集、GC 三代机制）。
   - **⭐⭐⭐⭐ 4星高频**：架构与硬实力拉开差距（Prism 模块化、P/Invoke 指针封送、海康相机高帧率解耦、各种锁机制）。
   - **⭐⭐⭐ 3星基础**：语言基础底蕴（struct vs class、委托与事件底层、重载重写、TCP vs UDP）。
4. **📱 移动端极致适配**：
   - 响应式现代工控暗黑美学，完美支持 iPhone 与 Android 竖屏触控。
   - 支持 Safari / Chrome **“添加到主屏幕”** 作为轻量级 Web App 沉浸式随时刷题。

---

## 📂 知识库架构索引

```text
├── C#上位机知识库准录与评估规范.md    # 本地题库增删与星级评定最高规范
├── index.html                        # 纯原生、零依赖的前端自测系统
│
├── 01_知识库底稿/                     # 结构化 Markdown 文档
│   ├── 01_C#与_NET8核心基础.md       # 结构体与类、装箱拆箱、委托事件底层
│   ├── 02_CLR底层与内存优化.md       # GC代际机制、内存泄漏排查、Span零拷贝
│   ├── 03_多线程与高并发.md          # Channel高频采集、async/await状态机、各类锁
│   ├── 04_WPF与工业桌面开发.md       # Dispatcher跨线程、MVVM依赖属性、WriteableBitmap渲染
│   ├── 05_工业通信与测控协议.md       # 串口/RS485粘包断包、Modbus-RTU队列、OPC UA
│   ├── 06_工业相机与视觉及底层.md     # 海康工业相机SDK、P/Invoke封送、OpenCvSharp
│   └── 07_经典题与历史归档.md        # 死锁四条件、进程与线程、虚方法、网络协议
│
└── 02_面试复盘记/                     # 存放各公司面试实战复盘记录
```

---

## 📖 贡献与新题录入规范

后续添加新面试题时，均严格遵循项目内的 [`C#上位机知识库准录与评估规范.md`](./C#上位机知识库准录与评估规范.md)，包含“三必录、三不录”原则，确保题库始终具备工业现场级最高含金量。
