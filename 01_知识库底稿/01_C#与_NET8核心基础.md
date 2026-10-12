# C#与.NET8核心基础 · 上位机核心面试题库

> 本模块共收录 **3** 道上位机核心考点。严格遵循《C#上位机知识库准录与评估规范》编制。

---

## 1. 深度剖析 struct 与 class 的内存分配、装箱拆箱机制与性能差异，为什么工控数据包往往定义为结构体？

- **题目标识**：`CS-01`
- **重要程度**：⭐⭐⭐⭐ (4星)
- **核心标签**：`语言基础` `struct与class` `值类型与引用类型` `装箱拆箱`

### 💡 30秒速记提纲（面试张口就来）
> 1. **内存定位**：`struct` 是值类型（分配在线程栈或包含它的父对象堆上），赋值为完整深拷贝；`class` 是引用类型（对象分配在托管堆，栈上仅保存 4/8 字节地址指针），赋值仅复制引用。
> 2. **装箱与拆箱开销**：当将 `struct` 赋值给 `object` 或接口时发生装箱（在堆上分配新内存并把值拷进去），逆过程为拆箱。高频装箱会严重污染托管堆并触发 GC。
> 3. **工控青睐 struct 的原因**：工控通信帧（如传感器坐标、Modbus 报文）数据量小（通常几十字节），定义为 `readonly struct` 或 `ref struct` 可实现**零 GC 垃圾分配、极高的 CPU 缓存局部性（Cache Locality）**，且内存布局连续，方便与硬件紧凑对齐。

### 🔍 深入原理解析
### 1. 结构体与类对比全貌
- 继承：结构体隐式继承自 `System.ValueType`，不能继承类或结构体，但可实现接口；类支持单继承。
- 构造函数：C# 10 之前结构体不支持无参构造，C# 10+ 支持；结构体不可有析构函数。
- 传递语义：方法传参时结构体按值拷贝（若结构体超过 16 字节拷贝开销较大，应搭配 `in` 或 `ref` 关键字实现只读引用传递避免拷贝）。

### 🛠️ 上位机实战避坑（工程案例）
在步态测控系统的传感器数据管道中，定义了传感器时序数据：
```csharp
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public readonly struct SensorDataPacket {
    public readonly long Timestamp;
    public readonly float ForceX;
    public readonly float ForceY;
    public readonly float ForceZ;
}
```
该结构体每秒产生 1000 个实例，通过只读传递直接流转，全生命周期 0 次堆内存分配，完全不给 GC 增加任何负担。

### ⚠️ 常见连环追问
- Q: 什么是 readonly struct？有何优化效果？（答：告知编译器其所有字段均不可变，当使用 in 关键字传参时，编译器无需为其创建防御性副本 Defensive Copy，显著提升只读传递性能）

---

## 2. C# 中委托（Delegate）与事件（Event）的底层区别？为什么不能直接暴露公共委托？弱事件模式解决什么痛点？

- **题目标识**：`CS-02`
- **重要程度**：⭐⭐⭐⭐ (4星)
- **核心标签**：`语言基础` `委托与事件` `弱事件模式` `MulticastDelegate`

### 💡 30秒速记提纲（面试张口就来）
> 1. **底层机制**：委托本质是一个类，继承自 `MulticastDelegate`，内部维护目标对象 `_target` 和方法指针 `_methodPtr` 以及调用链列表；事件是基于委托封装的**受保护机制**，在底层自动生成私有委托字段和 `add / remove` 访问器。
> 2. **为什么不直接用 public 委托**：若使用 `public Action OnDataReceived`，外部外部代码可以直接执行 `OnDataReceived = null;` 粗暴清空所有其他模块的订阅，或在外部随意越权调用 `OnDataReceived()`；而 `event` 关键字限制外部**只能使用 `+=` 和 `-=`**，只能由所属类自身内部触发广播，保障封装安全性。
> 3. **弱事件模式**：发布者持有订阅者的强引用常导致内存泄漏，弱事件通过弱引用管理订阅列表，解耦生命周期。

### 🔍 深入原理解析
### 1. 编译后的代码真相
当你写：
```csharp
public event Action<int> DataChanged;
```
C# 编译器会自动生成如下逻辑：
```csharp
private Action<int> DataChanged; // 私有委托
public void add_DataChanged(Action<int> value) { ... } // 线程安全的 Delegate.Combine
public void remove_DataChanged(Action<int> value) { ... } // 线程安全的 Delegate.Remove
```
外部完全无法做赋值操作，彻底防止非法篡改。

### 🛠️ 上位机实战避坑（工程案例）
在工控设备驱动开发中：设备状态变更、报警事件均严格声明为 `public event EventHandler<AlarmArgs> DeviceAlarmed`，外部业务模块只能挂载监听，不能从外部伪造触发报警。对于需要频繁开闭的临时诊断浮窗，使用 `WeakEventManager<TSource, TEventArgs>.AddHandler` 订阅设备单例事件，彻底免除弹窗忘记注销导致的内存泄漏隐患。

### ⚠️ 常见连环追问
- Q: 委托调用的执行顺序是怎样的？如果链条中一个方法抛出异常会怎样？（答：按订阅顺序同步依次执行；若其中一个抛出异常且未被内部捕获，调用链会中断，后续方法将不会被执行；若需保证全部执行，需通过 GetInvocationList() 遍历并独立 try-catch 调用）

---

## 3. string 的不可变性（Immutability）与字符串驻留池（String Interning）原理？上位机日志拼接为何必须用 StringBuilder？

- **题目标识**：`CS-03`
- **重要程度**：⭐⭐⭐ (3星)
- **核心标签**：`语言基础` `string` `不可变性` `StringBuilder`

### 💡 30秒速记提纲（面试张口就来）
> 1. **不可变性**：`string` 一旦在托管堆上创建，其包含的字符内容不可修改；任何修改（如 `+`、`Replace`）都会在堆上分配一个全新的 string 对象并复制内容。
> 2. **驻留池**：CLR 维护了一个全局哈希表，编译期字面量相同的字符串在进程内只保留一份单例引用以节约内存。
> 3. **日志与数据拼接**：若在串口或高频循环中使用 `str += newStr`，每次拼接都会复制旧内容并申请新堆空间，造成海量碎片和 GC 压力；`StringBuilder` 内部维护字符数组缓冲区（默认动态倍增容量），仅在容量不足时扩容，实现 O(1) 均摊追加。

### 🔍 深入原理解析
### 1. 性能对比
在拼接 10,000 次字符串场景下：
- `string +=`：产生 10,000 个堆对象，涉及海量内存复制，耗时数百毫秒并触发多次 Gen 0 GC。
- `StringBuilder`：仅扩容十几次，耗时不到 1 毫秒，内存占用极小。
- 在 C# 6+ 字符串内插（`$"ID: {id}"`）中：如果是单行少数字符串，编译器优化为 `string.Format`，简单易读；若是循环拼接必须使用 `StringBuilder`。

### 🛠️ 上位机实战避坑（工程案例）
上位机调试串口与工业总线数据监听窗口：当下位机高频打印 Hex 报文时，如果用 `textBox.Text += hexStr` 会瞬间卡死界面。标准架构：后台用 `StringBuilder` 维护最新环形日志缓冲区，配合定时器或限频刷新器一次性批量赋值更新，保证流畅度。

### ⚠️ 常见连环追问
- Q: string.Intern() 和 string.IsInterned() 的作用？（答：手动将运行时动态生成的字符串放入驻留池或查询是否存在，用于海量重复字典字符串的去重优化）

---
