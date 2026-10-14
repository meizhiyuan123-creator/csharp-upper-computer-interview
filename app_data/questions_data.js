// C# 上位机面试知识库数据集 - 自动生成
window.INTERVIEW_QUESTIONS = [
  {
    "id": "WPF-01",
    "module": "WPF与工业桌面开发",
    "stars": 5,
    "tags": [
      "WPF",
      "UI卡顿",
      "Dispatcher",
      "死锁防范"
    ],
    "title": "WPF 中跨线程更新 UI 的底层机制是什么？Dispatcher.Invoke 与 BeginInvoke 有何本质区别？如何避免主线程死锁？",
    "summary": "1. **定性**：WPF 遵循单线程单元（STA）模型，UI 元素只能由创建它的主 UI 线程访问，后台线程必须通过关联的 `Dispatcher` 调度。\n2. **底层原理**：`Invoke` 是同步阻塞调用，当前后台线程挂起等待 UI 线程执行完；`BeginInvoke` 是异步入队立即返回，将委托推入 UI 消息循环优先级队列。\n3. **防死锁与避坑**：禁止在 UI 线程上对含有 `Dispatcher.Invoke` 的后台 Task 调用 `.Result` 或 `.Wait()`（经典双向等待死锁）；工控高频刷新推荐使用 `BeginInvoke` + 降频合并，避免 UI 消息泵被撑爆。",
    "detail": "### 1. STA 与线程亲和性（Thread Affinity）\nWPF 几乎所有控件都继承自 `DispatcherObject`。其内部维护了一个 `VerifyAccess()` 方法，每次读写属性都会检查当前调用线程的 ManagedThreadId 是否等于创建该对象的 UI 线程 ID。如果不一致，立即抛出 `InvalidOperationException`。\n\n### 2. Invoke vs BeginInvoke 底层差异\n- **Invoke(Action, DispatcherPriority)**：向 Dispatcher 的优先队列插入操作项（DispatcherOperation），然后通过内部 Win32 消息循环或同步信号量阻塞调用方线程，直到 UI 线程调度并执行完成。如果 UI 线程正忙，后台线程会一直处于等待阻塞状态。\n- **BeginInvoke(Action, DispatcherPriority)**：仅仅是将操作项包装后推入 Dispatcher 队列，返回 `DispatcherOperation` 句柄，后台线程立即继续往下执行，实现完全解耦。\n\n### 3. 典型死锁诱发与防御\n- **死锁场景**：UI 线程调用 `var res = Task.Run(() => { Application.Current.Dispatcher.Invoke(...); }).Result;`。UI 线程在等待 Task 结束，而 Task 内部的 Invoke 在等待 UI 线程调度执行，双方互相持有并等待，造成永久死锁。\n- **防御策略**：\n  1. 彻底使用 `async/await`，禁止在 UI 线程同步等待 `.Wait()` 或 `.Result`。\n  2. 善用 `SynchronizationContext` 或在非 UI 逻辑中使用 `.ConfigureAwait(false)` 跳出 UI 上下文。",
    "practice": "在工业上位机（如步态分析或电机测控）中，后台串口/网络每秒收到 100~500 帧高频传感器数据，**绝对不能来一帧就调一次 `Dispatcher.Invoke`**，否则主线程消息循环会被高频切入打崩，造成界面冻结。工程标准做法是：后台存入并发缓冲队列，UI 侧挂载 30~60Hz 的 `DispatcherTimer` 或 CompositionTarget.Rendering，定期批量拉取数据并调用 `BeginInvoke(..., DispatcherPriority.Background)` 批量更新。",
    "follow_ups": [
      "Q: DispatcherPriority 各优先级怎么选？（答：常规更新用 Normal/Render，降频批量绘图用 Background/ContextIdle，避免抢占鼠标键盘交互）",
      "Q: 为什么不建议用 Control.CheckForIllegalCrossThreadCalls = false？（答：WinForms的粗暴开关破坏了线程安全，WPF根本不支持该属性，底层由DispatcherObject强校验）"
    ]
  },
  {
    "id": "WPF-02",
    "module": "WPF与工业桌面开发",
    "stars": 5,
    "tags": [
      "WPF",
      "MVVM",
      "依赖属性",
      "INotifyPropertyChanged"
    ],
    "title": "简述 WPF 的 MVVM 模式及数据绑定核心原理，INotifyPropertyChanged 与 DependencyProperty（依赖属性）有何区别？",
    "summary": "1. **定性**：MVVM 通过 View、ViewModel、Model 将界面展现、业务状态与底层数据彻底解耦，纽带是 WPF 的 Binding 双向绑定系统。\n2. **实现差异**：`INotifyPropertyChanged`（INPC）是在 ViewModel 普通 CLR 属性变更时触发 `PropertyChanged` 事件通知 UI 刷新；`DependencyProperty`（DP）是依托 WPF 全局属性存储系统的静态只读字段，支持样式继承、动画、元数据与值继承。\n3. **上位机选型**：自定义控件内部必须定义依赖属性才能被外部 XAML 绑定；而在 ViewModel 业务层则通过实现 INPC（如 Prism 的 BindableBase 或 CommunityToolkit.Mvvm 的 ObservableObject）来驱动视图。",
    "detail": "### 1. WPF 绑定引擎工作机制\n当 XAML 中声明 `{Binding Path=CurrentSpeed}` 时，WPF 的 BindingEngine 会利用反射或动态方法监听源对象的变更：\n- 如果源实现了 `INotifyPropertyChanged`，BindingEngine 注册其 `PropertyChanged` 弱事件（Weak Event），当属性改变时通知目标 UI 属性更新。\n- 如果是普通属性且未实现 INPC，Binding 只能进行一次性单向读取（OneTime）。\n\n### 2. DependencyProperty 底层机制与优势\n- **内存节约**：普通 CLR 属性每个对象实例都占用内存槽位；而依赖属性是类作用域的 `static readonly DependencyProperty`，通过哈希表字典仅在设置了非默认值时才分配存储空间，一个拥有 200 个属性的 UI 控件，默认情况下内存消耗极小。\n- **高级特性支持**：支持属性值继承（如 FontSize）、Style 样式变更、Trigger 触发器响应、故事板动画（StoryBoard）插值驱动。",
    "practice": "在上位机开发自定义仪器仪表控件（如自定义跑台电机速度计、足底压力色谱图）时，为了让外部能在 XAML 中直接双向绑定 `Speed` 或 `PressureValue`，必须使用 `DependencyProperty.Register` 注册依赖属性；而在 ViewModel 编写时，使用 CommunityToolkit.Mvvm 的 `[ObservableProperty]` 源生成器自动生成高效的 INPC 代码，既消除了反射开销，又保持了代码极其简洁。",
    "follow_ups": [
      "Q: 为什么 ViewModel 中不能直接使用 DependencyProperty 代替 INPC？（答：DP 必须继承自 DependencyObject，这会导致 ViewModel 强依赖 WPF UI 库，无法做跨平台单元测试，且破坏了 MVVM 的纯洁性）",
      "Q: 如果 Binding 绑定的集合需要动态增删元素，使用普通 List 可以吗？（答：不行，必须使用 ObservableCollection<T>，其实现了 INotifyCollectionChanged 接口）"
    ]
  },
  {
    "id": "WPF-03",
    "module": "WPF与工业桌面开发",
    "stars": 5,
    "tags": [
      "WPF",
      "高帧率图像",
      "WriteableBitmap",
      "渲染性能优化"
    ],
    "title": "工业上位机中，高帧率工业相机图像（如 120 FPS）或海量测控波形在 WPF 中如何实现无卡顿高性能渲染？",
    "summary": "1. **卡顿根因**：传统创建 `BitmapSource` 并频繁赋值给 `Image.Source` 会导致托管堆产生海量大对象（LOH）并引发 GC 频繁触发卡顿，且 WPF 的 DX 渲染管线合成成本过高。\n2. **核心解法**：使用 `WriteableBitmap` 实现内存直接映射，复用单一图像对象，结合后台非托管内存拷贝（`RtlMoveMemory` 或指针直接写入）以及 `Lock() / AddDirtyRect() / Unlock()` 机制更新脏区。\n3. **实战配合**：将数据采集、解压与渲染彻底分频解耦，后台 120 FPS 异步写入缓冲队列，前台 UI 渲染通过 `CompositionTarget.Rendering` 限制为 30/60 FPS 刷新，杜绝无效超额渲染。",
    "detail": "### 1. 传统渲染的致命缺陷\n如果每次相机回调都 `new BitmapImage` 或 `BitmapSource.Create`：\n- 每一帧 1080P RGB 图像约 6MB，120 FPS 下每秒产生超过 700MB 临时对象，数秒内直接打爆 Gen 2 和 LOH（大对象堆），触发频繁的 GC Stop-The-World，界面肉眼可见持续卡死掉帧。\n\n### 2. WriteableBitmap 高性能管线原理\n- 在初始化时分配固定分辨率的 `WriteableBitmap` 实例，绑定至 UI 的 `Image` 控件。\n- 每一帧相机底层 SDK 回调（通常给的是非托管内存指针 `IntPtr pBuffer`）：\n  ```csharp\n  writeableBitmap.Lock();\n  // 直接通过非托管内存复制，避免托管堆分配\n  unsafe {\n      Buffer.MemoryCopy(pBuffer.ToPointer(), writeableBitmap.BackBuffer.ToPointer(), bufferSize, bufferSize);\n  }\n  writeableBitmap.AddDirtyRect(new Int32Rect(0, 0, width, height));\n  writeableBitmap.Unlock();\n  ```\n- WPF 的渲染引擎只会将 GPU 显存与脏矩形同步，实现零 GC 分配和毫秒级 GPU 贴图更新。",
    "practice": "在三路工业相机同步采集系统中：相机 SDK 采用独立后台线程无锁环形队列（RingBuffer）拉取裸流，落盘线程通过 `System.Threading.Channels` 异步流式写入 SSD，而 UI 预览模块通过 `WriteableBitmap` 共享内存做降频渲染（例如 30FPS 刷新），将 CPU 占用从原先的 80%+ 骤降至 15% 以内，彻底告别掉帧与卡顿。",
    "follow_ups": [
      "Q: 海量测控实时动态波形（如 10 万点传感器曲线）在 WPF 中怎么画？（答：禁止使用 XAML Polyline 或 Canvas 频繁创建 Path，应使用专用高性能组件如 ScottPlot、SciChart，或者重写 OnRender 使用 DrawingContext.DrawLines 直连底层渲染流）"
    ]
  },
  {
    "id": "WPF-04",
    "module": "WPF与工业桌面开发",
    "stars": 4,
    "tags": [
      "WPF",
      "Prism",
      "模块化架构",
      "EventAggregator"
    ],
    "title": "Prism 框架在工业上位机中如何实现模块化解耦？EventAggregator 与传统 C# Event 相比有何本质区别？",
    "summary": "1. **模块化价值**：上位机系统通常包含相机模块、运动控制模块、传感器分析模块与报表模块，Prism 通过 `IModule` 动态加载，实现不同工控机型的插件化装配。\n2. **IOC生命周期**：基于 DryIoc 或 Unity 注册服务为 Singleton（硬件通信服务单例）或 Transient，降低硬编码依赖。\n3. **EventAggregator 机制**：传统 Event 要求发布者与订阅者互相持有引用（强耦合且易引起内存泄漏）；事件聚合器基于中介者模式与**弱引用（WeakReference）**，实现跨模块发布/订阅，支持指定主线程调度并自动回收死监听。",
    "detail": "### 1. Prism 模块化目录结构与装配\n通过 `ModuleCatalog` 可以从代码、XAML 或扫描指定 Plugins 文件夹动态发现并初始化模块。各模块通过 `IModule.RegisterTypes` 向全局容器注入各自的 ViewModel 和驱动服务。\n\n### 2. EventAggregator 底层弱引用实现\n- 传统委托事件：发布者对象内部保存了订阅者对象的强引用列表。若订阅者是临时打开的弹窗或短生命周期页面且未手动 `-=` 注销事件，发布者（往往是长生命周期的设备通信单例）就会导致该页面永远无法被 GC 回收，形成典型内存泄漏。\n- `EventAggregator`：通过 `PubSubEvent<TPayload>` 管理订阅，底层维护 `WeakReference` 弱引用。当订阅者页面关闭后，即使没显式 Unsubscribe，GC 也能安全回收它。\n- **线程调度内置**：`eventAggregator.GetEvent<DevAlarmEvent>().Subscribe(OnAlarm, ThreadOption.UIThread)` 可直接声明在主 UI 线程回调，省去手动 Dispatcher 调度的繁琐。",
    "practice": "在多通道神经机电测控上位机中，设计了统一硬件抽象层（HAL）。通过 Prism 模块化机制，当现场从“3路相机单跑台”配置切换为“转棒疲劳仪+双路电刺激”配置时，只需替换配置文件加载的 Module DLL，核心业务架构代码完全无需修改复用率达 80% 以上。",
    "follow_ups": [
      "Q: RegionManager 的原理是什么？（答：在 View 中预留占位符 Region，由控制器动态将指定的 UserControl 导航/注入到该区域，实现界面的多视窗动态拼装）"
    ]
  },
  {
    "id": "COMM-01",
    "module": "工业通信与测控协议",
    "stars": 5,
    "tags": [
      "通信",
      "串口RS485",
      "TCP",
      "粘包断包"
    ],
    "title": "工业上位机通过串口（RS485/RS232）或 TCP 与下位机/PLC 通信时，如何彻底解决粘包、半包与数据不完整问题？",
    "summary": "1. **定性**：底层通信（无论 TCP 流式传输还是串口缓冲区轮询读取）都是无边界的字节流（Stream），没有天然的“数据包”概念，粘包与半包是物理层与传输层的必然现象。\n2. **核心解法**：设计**应用层协议定界机制**（定长法、特殊包头包尾法、或【帧头 + 长度域 + 数据载荷 + CRC校验 + 帧尾】结构）。\n3. **工程落地**：上位机维护环形缓冲区或 `MemoryStream` 缓存，采用状态机解析：先找帧头，字节不足等下次，字节满足则校验 CRC，校验通过切分完整数据包并投递，校验失败滑移 1 字节重新寻头。",
    "detail": "### 1. 粘包与断包产生根因\n- **粘包（多合一）**：下位机连续快速发送两帧（如 `AA 01 02 FF` 与 `AA 02 03 FF`），上位机单次 `SerialPort.Read` 一次性读出 8 字节。\n- **半包（一拆多）**：下位机发出一帧 20 字节的数据，上位机串口缓冲区由于波特率与扫描周期差异，第一次读到 12 字节，第二次读到 8 字节。\n\n### 2. 状态机分包算法标准流程\n```\n[接收字节] -> 追加到 Buffer 缓冲区\n  └─> 检查缓冲区长度是否 >= 最小帧头长度\n        ├─ 是 -> 扫描帧头 (例如 0x5A 0xA5)\n        │          ├─ 找到帧头 -> 读取长度字段 L\n        │          │                ├─ Buffer.Length >= L -> 提取该帧 -> 校验 CRC16\n        │          │                │                            ├─ 成功 -> 触发 OnPacketReceived，从 Buffer 剔除这 L 字节\n        │          │                │                            └─ 失败 -> 剔除帧头首字节，向后滑动 1 字节继续找\n        │          │                └─ 字节数不足 L -> 退出等待下一次数据到来\n        │          └─ 未找到帧头 -> 清理无用杂质字节\n        └─ 否 -> 退出等待\n```",
    "practice": "在 RS485 设备通信模块中，针对 Modbus-RTU 这种依赖无传输字符间隔（3.5个字符时间）判帧的协议，若波特率为 115200，3.5T 仅约 0.35ms，操作系统线程调度抖动极易导致半包。实战方案是结合协议长度预判与自实现滑动窗口环形缓冲区（RingBuffer），收到后先根据功能码（如 0x03 读保持寄存器其返回长度为 3 + 字节计数 + 2 字节 CRC）动态计算预期整包长度，配合 CRC16 校验，实现了千万次通信 0 粘包 0 误判。",
    "follow_ups": [
      "Q: 为什么串口通信在大量干扰时不能只用 Try-Catch 忽略异常？（答：工业现场变频器或强电干扰会导致串行信号毛刺，丢弃会导致寄存器时序错乱，必须有 CRC 校验和重发机制）"
    ]
  },
  {
    "id": "COMM-02",
    "module": "工业通信与测控协议",
    "stars": 5,
    "tags": [
      "通信",
      "Modbus-RTU",
      "CRC16",
      "指令队列与重连"
    ],
    "title": "Modbus-RTU 协议的帧结构是什么？PLC/从机响应超时的重发机制与多指令优先级队列如何设计？",
    "summary": "1. **帧结构**：【从机地址 1B】 + 【功能码 1B】 + 【数据段 N 字节】 + 【CRC16 校验低字节 + 高字节】。\n2. **通信半双工特性**：RS485 是半双工总线，任何时刻只能有一台主机发起问询并等待单台从机应答，严禁多线程并发裸写串口，否则必然导致总线总线数据冲突乱码。\n3. **架构解法**：设计**线程安全的单线程消费指令队列（Command Queue）**，支持优先级插队（如急停指令高优先级插队），结合 `CancellationTokenSource` 超时令牌控制单次等待（如 200ms），失败自动重发 3 次，连续多次超时触发状态机断线报警与重连。",
    "detail": "### 1. 常用功能码速记\n- `0x01` / `0x02`：读线圈（Coil） / 读离散输入（Discrete Input）\n- `0x03` / `0x04`：读保持寄存器（Holding Register） / 读输入寄存器（Input Register）\n- `0x05` / `0x06`：写单个线圈 / 写单个保持寄存器\n- `0x10` (16)：写多个保持寄存器（批量下发速度或参数常用）\n\n### 2. 健壮的工控指令调度队列架构\n```csharp\npublic class ModbusCommandChannel {\n    // 基于优先级队列或双端队列\n    private readonly PriorityQueue<ModbusCommand, int> _queue = new();\n    private readonly SemaphoreSlim _lock = new(1, 1);\n\n    public async Task ProcessQueueAsync(CancellationToken ct) {\n        while (!ct.IsCancellationRequested) {\n            var cmd = await DequeueNextAsync();\n            for (int retry = 0; retry < 3; retry++) {\n                await SendBytesAsync(cmd.RequestBytes);\n                var (success, response) = await WaitForResponseAsync(cmd.TimeoutMs);\n                if (success && VerifyCrc(response)) {\n                    cmd.SetResult(response);\n                    break;\n                }\n                if (retry == 2) cmd.SetException(new TimeoutException());\n            }\n        }\n    }\n}\n```",
    "practice": "在科研医疗仪器上位机中，电机的实时速度采集属于常规周期性指令（低优先级），而用户的“急停按键”或“限位光电触发”属于紧急指令（高优先级）。指令队列支持优先级调度，当触发急停时立即将 0x06 写寄存器停止指令插入队首，在 20ms 内完成伺服停机，保障实验人机安全。",
    "follow_ups": [
      "Q: CRC16 查表法和直接移位计算法哪个好？（答：查表法以 512 字节空间换时间，微秒级完成，工控高频通信首选查表法）",
      "Q: 断线重连时，串口 Port.Open 容易卡死几秒怎么办？（答：必须将重连逻辑完全移到后台 Task 执行，禁止在 UI 主线程直接调用 serialPort.Open()）"
    ]
  },
  {
    "id": "COMM-03",
    "module": "工业通信与测控协议",
    "stars": 4,
    "tags": [
      "通信",
      "OPC UA",
      "Modbus对比",
      "节点订阅"
    ],
    "title": "OPC UA 与传统 Modbus 相比有哪些核心优势？在上位机中如何实现节点数据订阅（Subscription）与值变化监听？",
    "summary": "1. **协议层级差异**：Modbus 是扁平寄存器地址（只有无含义的 40001 偏移），无数据类型语义；OPC UA 是面向对象的工业通信标准，支持自描述信息模型、命名空间、丰富数据类型与严密安全加密认证（X.509 证书）。\n2. **通信模式跨越**：Modbus 只能由上位机不断低效轮询（Polling），占用总线带宽；OPC UA 支持**发布-订阅（Pub/Sub）机制**，仅在 PLC 变量发生变化时主动推送（Report by Exception）。\n3. **C# 开发实现**：基于官方 `Opc.UaFx` 或 `Opc.Ua.Client` 库，建立 Session 会话后创建 `Subscription`，添加 `MonitoredItem` 监听指定 NodeId，挂载 `Notification` 事件实现无感知异步更新。",
    "detail": "### 1. 核心对比矩阵\n| 维度 | Modbus-RTU / TCP | OPC UA |\n| :--- | :--- | :--- |\n| **数据模型** | 扁平寄存器（0/1/3/4区），无元数据 | 树状节点（NodeId）、对象、变量、方法、强类型 |\n| **传输开销** | 必须定时轮询（大量重复读），总线负载重 | 变化推送（MonitoredItem），节省 80% 工业网络带宽 |\n| **安全性** | 明文传输，无权限控制，易受攻击 | 支持 TLS/SSL 加密、数字签名、用户角色权限鉴权 |\n| **跨平台** | 依赖串口或 Socket 报文解析 | 跨平台统一标准，原生支持 Linux/Windows/Docker |",
    "practice": "在多通道机电综合测控上位机中，设计了 Modbus + OPC UA 双层架构：底层小型自研控制器采用 Modbus-RTU 快速直连，厂区西门子 S7-1500 PLC 与环境智能网关通过 OPC UA 对接。通过订阅 PLC 的报警节点，当出现急停或过载时毫秒级收到推送并触发上位机联锁停机，无需上位机耗费 CPU 循环轮询。",
    "follow_ups": [
      "Q: OPC UA 订阅的 PublishingInterval 和 SamplingInterval 有什么区别？（答：SamplingInterval 是服务器采样硬件寄存器的周期，PublishingInterval 是服务器向客户端批量推送更新包的周期）"
    ]
  },
  {
    "id": "THR-01",
    "module": "多线程与高并发",
    "stars": 5,
    "tags": [
      "多线程",
      "Channel",
      "高频采集",
      "生产消费模型"
    ],
    "title": "System.Threading.Channels 与传统的 BlockingCollection / ConcurrentQueue 相比有什么优势？上位机高频采集的生产-消费模型如何落地？",
    "summary": "1. **定性**：`Channel<T>` 是 .NET Core 3.0+ 引入的高性能原生异步生产-消费管道，专为 `async/await` 异步生态设计。\n2. **本质区别**：`BlockingCollection<T>` 的消费是基于线程阻塞（`Take()` 占用真实操作系统线程等待）；而 `Channel<T>` 的 `ReadAsync()` 是**纯异步等待，不占用任何线程**，并支持背压控制（Backpressure BoundedChannel）。\n3. **上位机落地**：创建 `Channel.CreateBounded<FrameData>(new BoundedChannelOptions(100) { FullMode = BoundedChannelFullMode.DropOldest })`，传感器极速写入，后台单个 Task 异步拉取并落盘，既绝不阻塞采集，又限制了内存上限。",
    "detail": "### 1. 核心性能演进对比\n- `ConcurrentQueue<T>`：无等待唤醒通知机制，消费者必须通过 `Thread.Sleep` 轮询或自旋，消耗无谓 CPU，或配合外部 `AutoResetEvent`，代码复杂。\n- `BlockingCollection<T>`：内部封装并发集合与信号量，但其等待只能是同步阻塞线程（Thread Block）。如果有 20 个传感器通道，就需要 20 个物理线程常驻等待，资源浪费。\n- `System.Threading.Channels`：基于值任务 `ValueTask` 优化，分配极少。当管道无数据时，`await reader.WaitToReadAsync()` 挂起状态机释放线程回线程池；数据到来瞬间被调度激活。\n\n### 2. 背压模式（Backpressure）对工控稳定性的决定性意义\n当系统遇到磁盘卡顿或外部压力时，无界队列会导致对象无限堆积最终 `OutOfMemoryException`。`BoundedChannel` 提供四种防爆仓策略：\n- `Wait`：生产者异步等待空间；\n- `DropOldest`：**上位机实时监控最爱**——主动丢弃最旧数据，确保界面始终反映最新的工况；\n- `DropNewest` / `DropWrite`：保护历史数据不受冲击。",
    "practice": "在步态动力学测控系统中，足底接触传感器以 500Hz 频率上报压力矩阵。采用单生产者单消费者的 `Channel.CreateBounded<SensorPacket>(1000)`，开启 `SingleWriter = true, SingleReader = true` 极致无锁优化模式。采集线程只管往 Channel `TryWrite`，后台单一后台 Task `await foreach` 批量异步写入 SQLite，即使系统突发卡顿也不会丢掉最新关键时序特征。",
    "follow_ups": [
      "Q: SingleWriter 和 SingleReader 设置为 true 有什么底层好处？（答：Channel 内部会切换为更加轻量高效的单线程无竞争队列实现，完全省去多线程争用时的锁与 CAS 开销）"
    ]
  },
  {
    "id": "THR-02",
    "module": "多线程与高并发",
    "stars": 5,
    "tags": [
      "多线程",
      "async/await",
      "状态机",
      "死锁防范"
    ],
    "title": "async / await 底层实现机制是什么？状态机是如何工作的？上位机开发中为什么禁止 async void？",
    "summary": "1. **底层机制**：编译器在编译阶段将 async 方法改写为一个实现了 `IAsyncStateMachine` 接口的**结构体状态机**，把代码按照 await 拆分为多个断点状态分支（MoveNext）。\n2. **执行流程**：遇到 await 时，先检查 Task 是否已完成；若未完成，调用 `awaiter.UnsafeOnCompleted` 挂载延续任务（Continuation），保存局部变量并立即向调用方返回未完成的 Task；任务完成后由回调触发 `MoveNext` 恢复执行后面的代码。\n3. **禁止 async void 的铁律**：`async void` 方法抛出的异常无法被外部 `try-catch` 捕获，会直接逃逸到 `SynchronizationContext` 导致上位机进程无预警直接崩溃（Crash），且调用方无法对其 `await`，无法跟踪任务生命周期。",
    "detail": "### 1. 编译器生成的状态机关键逻辑\n```csharp\n// 伪代码示意\nstruct <MyMethodAsync>d__1 : IAsyncStateMachine {\n    public int <>1__state;\n    public AsyncTaskMethodBuilder <>t__builder;\n    private TaskAwaiter <>u__1;\n\n    public void MoveNext() {\n        switch (<>1__state) {\n            case 0: // 恢复状态\n                goto Label_Resume;\n        }\n        // 第一段同步代码\n        var awaiter = DoWorkAsync().GetAwaiter();\n        if (!awaiter.IsCompleted) {\n            <>1__state = 0;\n            <>u__1 = awaiter;\n            // 注册回调，释放当前线程\n            <>t__builder.AwaitUnsafeOnCompleted(ref awaiter, ref this);\n            return;\n        }\n    Label_Resume:\n        // 第二段代码\n    }\n}\n```\n\n### 2. 上位机中 async void 的唯一合法场景\n只有在 **WPF 顶层 UI 事件处理器**（如 `private async void BtnStart_Click(object sender, RoutedEventArgs e)`）中允许使用，因为事件签名的委托类型是 `void (object, RoutedEventArgs)`，此时必须在方法内部用完整的 `try-catch` 包裹住所有逻辑，记录错误日志并弹窗提醒，严禁异常漏出！",
    "practice": "在工业设备运行期间，上位机 7x24 小时无人值守。曾有工程师在设备断线重连后台方法中写了 `private async void ReconnectLoop()`，当现场网线被拔出抛出 `SocketException` 时，由于没有返回 Task 托管，该异常直接打穿全局未捕获异常管道导致整个上位机软件瞬间闪退，酿成生产事故。规范做法：必须返回 `async Task` 并由顶层统筹捕获与重试。",
    "follow_ups": [
      "Q: ConfigureAwait(false) 的作用是什么？在上位机何时使用？（答：通知调度器在后续恢复时不强求返回原来的 SynchronizationContext，在编写底层驱动、通信库、算法运算等与 UI 无关的代码时应全部加上，避免不必要地切回 UI 线程造成线程饥饿）"
    ]
  },
  {
    "id": "THR-03",
    "module": "多线程与高并发",
    "stars": 4,
    "tags": [
      "多线程",
      "并发锁",
      "SemaphoreSlim",
      "ReaderWriterLockSlim"
    ],
    "title": "C# 中 lock、Monitor、SemaphoreSlim、ReaderWriterLockSlim 的底层区别与工控选型场景？",
    "summary": "1. **lock 与 Monitor**：`lock(obj)` 语法糖底层就是 `Monitor.Enter / Exit`，基于对象头的 SyncBlock 同步块，是**独占且支持重入**的内核/用户混合锁，**只能同步代码，绝对不能在内部 await**。\n2. **SemaphoreSlim**：支持**异步等待**（`await WaitAsync()`）的轻量级信号量，专门用于限制并发访问资源数量（如限制同时只能有 1 个任务操作串口/Socket）。\n3. **ReaderWriterLockSlim**：读写分离锁，允许多个线程并发读，独占写，适合上位机“高频读实时参数，低频写配置”的高并发场景。",
    "detail": "### 1. 关键差异对比矩阵\n| 锁类型 | 是否支持 await | 是否支持递归重入 | 开销大小 | 核心适用场景 |\n| :--- | :---: | :---: | :---: | :--- |\n| **lock (Monitor)** | ❌ 严禁（会报编译错误） | ✅ 支持 | 小（混合锁，先自旋后阻塞） | 纯内存变量原子修改、同步代码块互斥 |\n| **SemaphoreSlim** | ✅ 原生支持 `WaitAsync` | ❌ 不支持重入 | 较小 | 工业通信端口异步互斥（如串口发包）、异步流限流 |\n| **ReaderWriterLockSlim** | ❌ 严禁 await | ✅ 可配置支持 | 较大 | 多通道并发采集：几百个线程读配置，1个线程写配置 |\n| **Interlocked** | ❌ 硬件原子指令 | N/A | 极小（无锁 CAS） | 计数器统计、帧率累计、标志位无锁切换 |",
    "practice": "在上位机串口通信层：发送指令是 `async Task<byte[]> SendAsync()` 异步方法，由于内部需要 `await Task.Delay` 等待下位机应答，**绝对不能用 `lock`**，此时必须使用 `private readonly SemaphoreSlim _serialLock = new(1, 1);`，通过 `await _serialLock.WaitAsync(); try { ... } finally { _serialLock.Release(); }` 实现完美的异步串行化互斥。",
    "follow_ups": [
      "Q: lock(this) 和 lock(typeof(MyClass)) 为什么是反模式？（答：this 和类型对象都可能被外部代码访问到，如果外部也 lock 了同一个对象，容易引发不可预知的全局死锁，必须使用 private readonly object _locker = new();）"
    ]
  },
  {
    "id": "CLR-01",
    "module": "CLR底层与内存优化",
    "stars": 5,
    "tags": [
      "CLR",
      "GC",
      "内存泄漏",
      "7x24小时运行"
    ],
    "title": "NET CLR 垃圾回收（GC）的三代回收机制是什么？上位机长期 7x24 小时运行，如何排查和预防内存泄漏？",
    "summary": "1. **GC 代际假说**：对象存活时间越长越不易死亡。Gen 0（新分配小对象，回收快，几十微秒）、Gen 1（从 Gen 0 幸存下来的缓冲代）、Gen 2（长生命周期对象，回收成本高）。大于 85,000 字节进入大对象堆（LOH），默认只在 Gen 2 完整 GC 时回收且不压缩碎片。\n2. **上位机常见泄漏元凶**：\n   - **未注销的事件监听**（强引用导致短命对象无法被回收）；\n   - **静态字段（Static）持有对象引用**或静态集合只增不减；\n   - **WPF 数据绑定泄漏**（绑定到未实现 INPC 的普通属性，WPF 会用全局反射表持有强引用）；\n   - **未释放非托管句柄**（工业相机 SDK、串口句柄未调用 Dispose/Close）。\n3. **排查利器**：使用 Visual Studio 诊断工具、dotMemory 或 PerfView 抓取内存快照，对比两个时间点的“存活对象增量（Diff）”排查引用链根（GC Root）。",
    "detail": "### 1. 垃圾回收标记-清除-压缩算法\n1. **标记阶段（Marking）**：从 GC Root（线程栈局部变量、CPU 寄存器、静态变量、终结器队列等）出发，递归遍历所有可达对象，打上存活标记。\n2. **清除与压缩阶段（Plan & Compact）**：未被标记的对象判定为垃圾予以回收。在小对象堆（SOH）中，GC 会移动存活对象紧凑排列以消除内存碎片，并更新所有引用地址。\n3. **GC 停顿对上位机的威胁**：发生全代回收（Gen 2 Full GC）时会触发 Stop-The-World（STW），所有托管线程挂起几十毫秒到数秒，这会导致工业实时通信超时或相机丢帧。\n\n### 2. 内存泄漏根治黄金法则\n- 页面或弹窗关闭时：必须显式在 `Unloaded` 或 `Dispose` 中解绑事件（`-=`），或使用弱事件模式（WeakEventManager）。\n- 频繁创建的大数组（如图像 Buffer）：改用 `ArrayPool<byte>.Shared.Rent(size)` 对象池复用，杜绝频繁冲击 LOH。",
    "practice": "在科研医疗上位机联调测试中，发现软件连续运行 48 小时后内存从 200MB 缓慢爬升到 3.5GB 最终闪退。使用 dotMemory 进行快照对比发现：主窗口每次切换实验模式重新创建的 UserControl 实例多达上千个未被回收；排查发现是设备底层的全局单例报警服务 `DeviceAlarmService.AlarmTriggered += OnAlarm` 在 UserControl 构造时绑定了，但页面销毁时没有解绑，导致长单例死死抓住了页面树。重构为 Prism 的 `EventAggregator` 弱引用事件后，内存稳定在 220MB 平稳运行数月无异常。",
    "follow_ups": [
      "Q: 什么是弱引用（WeakReference）？（答：允许对象被引用的同时，不阻止该对象被 GC 回收；常用于缓存和解耦事件监听）",
      "Q: GC.Collect() 应该在代码中主动调用吗？（答：常规情况下严禁手动调用，会破坏 GC 自身的代际自我调优模型；仅在极特殊场景如刚关闭了一个占用 1GB 内存的庞大独立分析模块且即将开始实时测控时，才在后台低优先级触发）"
    ]
  },
  {
    "id": "CLR-02",
    "module": "CLR底层与内存优化",
    "stars": 4,
    "tags": [
      "CLR",
      "Span",
      "Memory",
      "零拷贝"
    ],
    "title": "Span<T> 与 Memory<T> 的底层原理是什么？在工业高频通信数据包解析中如何实现“零拷贝（Zero-Copy）”？",
    "summary": "1. **定性**：`Span<T>` 是由引用指针与长度构成的 `ref struct`（栈上结构体），能够以统一的方式、类型安全且无需内存拷贝地直接操作托管数组、非托管内存或栈内存连续内存块。\n2. **本质区别**：`Span<T>` 只能存在于线程栈上，不能跨 await、不能作为类字段；`Memory<T>` 是可存放在堆上的通用内存包装器，可以在异步方法（跨 await）中传递，并在需要时通过 `.Span` 快速获取高效切片。\n3. **上位机零拷贝实战**：解析协议时，使用 `span.Slice(offset, length)` 代替传统的 `Array.Copy` 或 `Substring`，切片操作仅需修改指针偏移与长度，时间复杂度 O(1)，0 堆内存分配！",
    "detail": "### 1. 传统解析的内存开销痛点\n假设接收到一个 1024 字节的 Modbus/TCP 复合报文：\n- 传统做法：通过 `new byte[16]`，然后 `Buffer.BlockCopy` 把包头考出来；再 `new byte[100]` 考出数据段；解析字符串又 `Encoding.ASCII.GetString` 生成临时对象。\n- 结果：每秒处理 500 个包，每秒产生几十万次小内存分配，极速污染 Gen 0 堆，加剧 GC 停顿。\n\n### 2. 基于 Span<T> 的零拷贝重构\n```csharp\nReadOnlySpan<byte> packet = buffer.AsSpan(0, bytesRead);\n// 零拷贝提取包头与有效载荷\nvar header = packet.Slice(0, 4);\nushort length = BinaryPrimitives.ReadUInt16BigEndian(packet.Slice(4, 2));\nvar payload = packet.Slice(6, length);\n// 直接在切片上做 CRC 校验\nushort crc = CalculateCRC(payload);\n```\n全流程没有发生任何一次数组复制和对象 `new`，执行速度提升数倍。",
    "practice": "在海康相机高速采集（120 FPS）和传感器高速数据流解析模块中：原始数据包到达后直接封装为 `ReadOnlyMemory<byte>`，通过 Channel 异步发给算法分析模块，在分析内部切片解析使用 `ReadOnlySpan<byte>`。结合 `ArrayPool<byte>.Shared`，整个数据链路从采集到落盘做到“全程零内存分配（Zero Allocation）”，GC 暂停时间降至微秒级。",
    "follow_ups": [
      "Q: 为什么 ref struct Span<T> 不能被装箱，也不能作为 async 方法的参数？（答：因为 ref struct 必须保证生命周期严格在线程栈上，若装箱到托管堆或被 async 状态机类捕获，指针可能悬空指向失效的栈内存，引发内存安全问题）"
    ]
  },
  {
    "id": "CLR-03",
    "module": "CLR底层与内存优化",
    "stars": 4,
    "tags": [
      "CLR",
      "IDisposable",
      "Dispose模式",
      "非托管资源"
    ],
    "title": "详细解释 IDisposable 接口与终结器（Finalizer）的标准 Dispose 模式？SafeHandle 的优势是什么？",
    "summary": "1. **职责分离**：托管资源（由 CLR GC 自动管理回收）；非托管资源（如原生文件句柄、串口句柄、工业相机 Handle、C++ 动态库内存指针等）GC 无法感知大小与释放，必须由程序员显式调用 `Dispose()` 释放。\n2. **标准 Dispose 模式原则**：`Dispose(bool disposing)`，当 `disposing == true` 时释放托管与非托管资源；若用户忘记调用 Dispose，则由垃圾回收器的**析构函数/终结器**在 `disposing == false` 时兜底释放非托管资源。\n3. **SafeHandle**：.NET 提供的封装非托管句柄的安全包装器，能杜绝异步线程终止导致的句柄泄漏，推荐直接使用而无需手写终结器。",
    "detail": "### 1. 标准模式经典代码骨架\n```csharp\npublic class IndustrialCameraDriver : IDisposable {\n    private IntPtr _nativeCameraHandle; // 非托管句柄\n    private SafeHandle _safeHandle;    // 推荐的现代化句柄封装\n    private bool _disposed = false;\n\n    public void Dispose() {\n        Dispose(true);\n        GC.SuppressFinalize(this); // 核心：通知 GC 无需再将其推入终结器队列，节约性能\n    }\n\n    protected virtual void Dispose(bool disposing) {\n        if (!_disposed) {\n            if (disposing) {\n                // 释放托管资源（如其他 IDisposable 对象）\n            }\n            // 释放非托管资源（如调用 C++ SDK 的 Camera_Close(_nativeCameraHandle)）\n            if (_nativeCameraHandle != IntPtr.Zero) {\n                NativeMethods.CameraClose(_nativeCameraHandle);\n                _nativeCameraHandle = IntPtr.Zero;\n            }\n            _disposed = true;\n        }\n    }\n\n    // 终结器（析构函数）：仅作为用户忘记 Dispose 时的最后兜底防线\n    ~IndustrialCameraDriver() {\n        Dispose(false);\n    }\n}\n```",
    "practice": "在海康相机 C# SDK 二次开发中：相机的采集流、曝光控制句柄都是基于 C++ 原生动态库分配的系统资源。必须严格实现标准 `IDisposable`，并在系统关闭或相机重连时显式释放；同时在构造 `Dispose` 时执行 `GC.SuppressFinalize(this)`，避免让短命的驱动包装对象流落到高成本的 Finalizer 终结队列中。",
    "follow_ups": [
      "Q: 为什么重写了析构函数（~ClassName）的对象会在 GC 时多存活一代？（答：GC 发现带终结器的对象死亡时，不会立刻回收它，而是将其挂入 Finalization Queue，等到下一轮 GC 由专用 Finalizer 线程执行析构后才能真正释放其内存）"
    ]
  },
  {
    "id": "VIS-01",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "海康相机SDK",
      "高帧率取流",
      "多线程解耦"
    ],
    "title": "工业相机（如海康 SDK）在高帧率采集（如 120 FPS）场景下，如何设计多线程架构以避免内存剧烈抖动与丢帧？",
    "summary": "1. **三大瓶颈**：高帧率下的回调线程阻塞导致 SDK 驱动底层丢帧、频繁在托管堆分配图像 Buffer 导致频繁 GC、以及 UI 主线程来不及渲染导致消息队列雪崩。\n2. **三级解耦架构**：\n   - **第一级（硬件采集）**：使用 SDK 的回调函数或原生独立后台轮询线程（`MV_CC_GetOneFrameTimeout`），仅负责将裸图像指针数据快速推入预分配的环形无锁缓冲队列（RingBuffer），耗时控制在 1ms 内。\n   - **第二级（算法处理与录像落盘）**：后台专用计算 Task 从队列取出图像，直接在指针或共享内存上调用 OpenCvSharp 做算法分析，并异步送入视频压缩编码器（如 FFmpeg/OpenCV VideoWriter）。\n   - **第三级（UI 预览）**：采用 `WriteableBitmap` 结合定时器以 30 FPS 降频抽帧渲染，彻底与 120 FPS 物理采集脱钩。",
    "detail": "### 1. 内存池技术防抖动\n严禁在相机每帧到来时 `new byte[width * height * 3]`！在 120 FPS 下，1080P RGB 图像每秒产生近 1GB 内存垃圾。工程解决方案：\n- 初始化时申请固定容量的内存池（例如循环复用 10 个固定数组缓冲区）。\n- 相机数据直接 `Buffer.BlockCopy` 或 `Marshal.Copy` 写入租借的缓冲区中，处理完毕后归还池中，全程零托管内存分配。",
    "practice": "在智能步态动力学测控系统中，搭载 3 路高速工业相机同步 120 FPS 采集。早期版本在相机回调里直接转 Bitmap 赋给 WPF 界面，导致 CPU 占用率 90% 且每 10 秒丢 5 帧。重构后：独立封装海康 SDK 采集管线，后台线程通过固定预分配内存缓冲队列接流，录像落盘走异步后台线程写入 NVMe SSD，WPF 端基于 WriteableBitmap 做 30Hz 抽帧同步预览，最终实现连续 3 小时录制 0 丢帧，CPU 占用稳定在 20% 以下。",
    "follow_ups": [
      "Q: 软触发（Software Trigger）与硬外触发（Hardware External Trigger）有何区别？（答：软触发通过上位机下发指令，受网络与系统调度延迟影响有几毫秒抖动；硬触发通过传感器光电信号接相机 GPIO 引脚，纳秒/微秒级响应，多相机高精度同步必须使用硬外触发）"
    ]
  },
  {
    "id": "VIS-02",
    "module": "工业相机与视觉及底层",
    "stars": 4,
    "tags": [
      "底层",
      "P/Invoke",
      "C++交互",
      "结构体封送与内存对齐"
    ],
    "title": "C# P/Invoke 调用 C/C++ 原生动态库（DLL）时，结构体对齐（Pack）、指针传递（IntPtr）与字符串封送的核心规则是什么？",
    "summary": "1. **定性**：P/Invoke（Platform Invoke）是 CLR 提供的跨语言互操作机制，通过 Marshaler（封送拆构器）在托管世界与非托管世界之间转换数据类型。\n2. **结构体传递黄金法则**：必须打上 `[StructLayout(LayoutKind.Sequential, Pack = 1 或 4)]` 特性，保证字段在内存中的偏移与 C/C++ 结构体严格字节对齐，否则字段错位读取必错。\n3. **指针与内存管理铁律**：\n   - 传递数组或大块内存时使用 `IntPtr`；\n   - 若在托管代码中将托管数组地址传给 C++ 长时间使用，必须使用 `GCHandle.Alloc(array, GCHandleType.Pinned)` 固定内存钉住（Pin），防止 GC 在压缩内存时搬动该对象导致 C++ 产生野指针崩溃！",
    "detail": "### 1. 结构体封送对齐典型示范\n```csharp\n// C++ 结构体\n// struct DevConfig { int id; char code[16]; double threshold; };\n\n[StructLayout(LayoutKind.Sequential, Pack = 1, CharSet = CharSet.Ansi)]\npublic struct DevConfig {\n    public int Id;\n    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 16)]\n    public string Code;\n    public double Threshold;\n}\n```\n\n### 2. 回调函数互操作注意事项\n如果将 C# 委托传给 C++ 作为事件回调函数：\n- 必须在 C# 侧使用类成员字段持有该委托实例的强引用！\n- 否则委托容易被 GC 当作无人引用的垃圾悄悄回收，导致 C++ 稍后调用该函数指针时抛出著名的 `ExecutionEngineException` 导致程序硬崩溃。",
    "practice": "在上位机与硬件加密狗及工业算法 C++ DLL 交互中：通过 `[DllImport(\"HardwareDog.dll\", CallingConvention = CallingConvention.Cdecl)]` 调用原生接口。严格指定结构体 `Pack = 1` 并在数据传输完毕后显式通过 `Marshal.FreeHGlobal` 释放申请的非托管内存，杜绝了底层句柄与内存泄露风险。",
    "follow_ups": [
      "Q: CallingConvention.Cdecl 与 StdCall 有什么区别？（答：Cdecl 由调用者清理栈，支持可变参数，C/C++默认；StdCall 由被调用者清理栈，Windows API常用，若约定不匹配会导致调用堆栈不平衡崩溃）"
    ]
  },
  {
    "id": "VIS-03",
    "module": "工业相机与视觉及底层",
    "stars": 4,
    "tags": [
      "视觉",
      "OpenCvSharp",
      "Mat转换",
      "内存泄漏"
    ],
    "title": "OpenCvSharp 图像处理（如 HSV 分割、连通域分析）中，如何高效将 Mat 转为 WPF 界面显示而不发生内存泄漏？",
    "summary": "1. **Mat 的本质**：`OpenCvSharp.Mat` 内部持有的是 C++ 堆上的原生非托管图像矩阵指针，**不受 C# GC 自动回收控制**，必须在使用完毕后显式调用 `mat.Dispose()`，否则分分钟造成非托管内存暴涨。\n2. **转换效率陷阱**：严禁使用 `mat.ToBitmapSource()` 传统方式频繁创建新的图像源，该方法内部会重新申请内存并深拷贝，高频下直接触发卡顿。\n3. **极致性能方案**：通过预先分配的 `WriteableBitmap`，直接获取其 `BackBuffer` 指针，使用 OpenCV 的 `mat.CopyTo` 或 `Buffer.MemoryCopy` 拷贝进显存脏区，或者使用 `OpenCvSharp.WpfExtensions` 的高效写入接口。",
    "detail": "### 1. 典型的 Mat 内存泄漏诱发\n```csharp\n// 错误示范：在高频循坏中链式调用未释放中间临时 Mat\nvar result = srcMat.CvtColor(ColorConversionCodes.BGR2HSV)\n                   .InRange(lower, upper) // 这里产生的临时 Mat 永远没被释放！\n                   .FindContours(...);\n```\n规范写法：中间产物必须用 `using var hsv = new Mat();` 或显式复用预先分配好的全局 Mat。\n\n### 2. 高效转 WriteableBitmap 代码\n```csharp\npublic void UpdateWpfImage(Mat mat, WriteableBitmap wpfBmp) {\n    wpfBmp.Lock();\n    // 确保分辨率和通道匹配（如 Bgr24）\n    unsafe {\n        Buffer.MemoryCopy(mat.DataPointer, wpfBmp.BackBuffer.ToPointer(), \n                          mat.Total() * mat.ElemSize(), mat.Total() * mat.ElemSize());\n    }\n    wpfBmp.AddDirtyRect(new Int32Rect(0, 0, mat.Width, mat.Height));\n    wpfBmp.Unlock();\n}\n```",
    "practice": "在小动物步态接触面分析中：采集到的侧视与底视灰度图像经 HSV 动态分割和形态学闭运算提取足底轮廓。通过复用两个全局工作 `Mat` 缓冲区进行连通域分析（`ConnectedComponentsWithStats`），消除了中间临时对象的反复分配，足印实时跟踪分析耗时稳定在 4ms 以内，满足 120 FPS 准实时分析要求。",
    "follow_ups": [
      "Q: OpenCvSharp 中的 using 语句块在循环中大量出现会导致性能变慢吗？（答：不会，using 编译后是 try-finally 调用 Dispose()，只是调用原生 cvReleaseImage 清理指针，比等待 GC 回收高效得多）"
    ]
  },
  {
    "id": "CS-01",
    "module": "C#与.NET8核心基础",
    "stars": 4,
    "tags": [
      "语言基础",
      "struct与class",
      "值类型与引用类型",
      "装箱拆箱"
    ],
    "title": "深度剖析 struct 与 class 的内存分配、装箱拆箱机制与性能差异，为什么工控数据包往往定义为结构体？",
    "summary": "1. **内存定位**：`struct` 是值类型（分配在线程栈或包含它的父对象堆上），赋值为完整深拷贝；`class` 是引用类型（对象分配在托管堆，栈上仅保存 4/8 字节地址指针），赋值仅复制引用。\n2. **装箱与拆箱开销**：当将 `struct` 赋值给 `object` 或接口时发生装箱（在堆上分配新内存并把值拷进去），逆过程为拆箱。高频装箱会严重污染托管堆并触发 GC。\n3. **工控青睐 struct 的原因**：工控通信帧（如传感器坐标、Modbus 报文）数据量小（通常几十字节），定义为 `readonly struct` 或 `ref struct` 可实现**零 GC 垃圾分配、极高的 CPU 缓存局部性（Cache Locality）**，且内存布局连续，方便与硬件紧凑对齐。",
    "detail": "### 1. 结构体与类对比全貌\n- 继承：结构体隐式继承自 `System.ValueType`，不能继承类或结构体，但可实现接口；类支持单继承。\n- 构造函数：C# 10 之前结构体不支持无参构造，C# 10+ 支持；结构体不可有析构函数。\n- 传递语义：方法传参时结构体按值拷贝（若结构体超过 16 字节拷贝开销较大，应搭配 `in` 或 `ref` 关键字实现只读引用传递避免拷贝）。",
    "practice": "在步态测控系统的传感器数据管道中，定义了传感器时序数据：\n```csharp\n[StructLayout(LayoutKind.Sequential, Pack = 1)]\npublic readonly struct SensorDataPacket {\n    public readonly long Timestamp;\n    public readonly float ForceX;\n    public readonly float ForceY;\n    public readonly float ForceZ;\n}\n```\n该结构体每秒产生 1000 个实例，通过只读传递直接流转，全生命周期 0 次堆内存分配，完全不给 GC 增加任何负担。",
    "follow_ups": [
      "Q: 什么是 readonly struct？有何优化效果？（答：告知编译器其所有字段均不可变，当使用 in 关键字传参时，编译器无需为其创建防御性副本 Defensive Copy，显著提升只读传递性能）"
    ]
  },
  {
    "id": "CS-02",
    "module": "C#与.NET8核心基础",
    "stars": 4,
    "tags": [
      "语言基础",
      "委托与事件",
      "弱事件模式",
      "MulticastDelegate"
    ],
    "title": "C# 中委托（Delegate）与事件（Event）的底层区别？为什么不能直接暴露公共委托？弱事件模式解决什么痛点？",
    "summary": "1. **底层机制**：委托本质是一个类，继承自 `MulticastDelegate`，内部维护目标对象 `_target` 和方法指针 `_methodPtr` 以及调用链列表；事件是基于委托封装的**受保护机制**，在底层自动生成私有委托字段和 `add / remove` 访问器。\n2. **为什么不直接用 public 委托**：若使用 `public Action OnDataReceived`，外部外部代码可以直接执行 `OnDataReceived = null;` 粗暴清空所有其他模块的订阅，或在外部随意越权调用 `OnDataReceived()`；而 `event` 关键字限制外部**只能使用 `+=` 和 `-=`**，只能由所属类自身内部触发广播，保障封装安全性。\n3. **弱事件模式**：发布者持有订阅者的强引用常导致内存泄漏，弱事件通过弱引用管理订阅列表，解耦生命周期。",
    "detail": "### 1. 编译后的代码真相\n当你写：\n```csharp\npublic event Action<int> DataChanged;\n```\nC# 编译器会自动生成如下逻辑：\n```csharp\nprivate Action<int> DataChanged; // 私有委托\npublic void add_DataChanged(Action<int> value) { ... } // 线程安全的 Delegate.Combine\npublic void remove_DataChanged(Action<int> value) { ... } // 线程安全的 Delegate.Remove\n```\n外部完全无法做赋值操作，彻底防止非法篡改。",
    "practice": "在工控设备驱动开发中：设备状态变更、报警事件均严格声明为 `public event EventHandler<AlarmArgs> DeviceAlarmed`，外部业务模块只能挂载监听，不能从外部伪造触发报警。对于需要频繁开闭的临时诊断浮窗，使用 `WeakEventManager<TSource, TEventArgs>.AddHandler` 订阅设备单例事件，彻底免除弹窗忘记注销导致的内存泄漏隐患。",
    "follow_ups": [
      "Q: 委托调用的执行顺序是怎样的？如果链条中一个方法抛出异常会怎样？（答：按订阅顺序同步依次执行；若其中一个抛出异常且未被内部捕获，调用链会中断，后续方法将不会被执行；若需保证全部执行，需通过 GetInvocationList() 遍历并独立 try-catch 调用）"
    ]
  },
  {
    "id": "CS-03",
    "module": "C#与.NET8核心基础",
    "stars": 3,
    "tags": [
      "语言基础",
      "string",
      "不可变性",
      "StringBuilder"
    ],
    "title": "string 的不可变性（Immutability）与字符串驻留池（String Interning）原理？上位机日志拼接为何必须用 StringBuilder？",
    "summary": "1. **不可变性**：`string` 一旦在托管堆上创建，其包含的字符内容不可修改；任何修改（如 `+`、`Replace`）都会在堆上分配一个全新的 string 对象并复制内容。\n2. **驻留池**：CLR 维护了一个全局哈希表，编译期字面量相同的字符串在进程内只保留一份单例引用以节约内存。\n3. **日志与数据拼接**：若在串口或高频循环中使用 `str += newStr`，每次拼接都会复制旧内容并申请新堆空间，造成海量碎片和 GC 压力；`StringBuilder` 内部维护字符数组缓冲区（默认动态倍增容量），仅在容量不足时扩容，实现 O(1) 均摊追加。",
    "detail": "### 1. 性能对比\n在拼接 10,000 次字符串场景下：\n- `string +=`：产生 10,000 个堆对象，涉及海量内存复制，耗时数百毫秒并触发多次 Gen 0 GC。\n- `StringBuilder`：仅扩容十几次，耗时不到 1 毫秒，内存占用极小。\n- 在 C# 6+ 字符串内插（`$\"ID: {id}\"`）中：如果是单行少数字符串，编译器优化为 `string.Format`，简单易读；若是循环拼接必须使用 `StringBuilder`。",
    "practice": "上位机调试串口与工业总线数据监听窗口：当下位机高频打印 Hex 报文时，如果用 `textBox.Text += hexStr` 会瞬间卡死界面。标准架构：后台用 `StringBuilder` 维护最新环形日志缓冲区，配合定时器或限频刷新器一次性批量赋值更新，保证流畅度。",
    "follow_ups": [
      "Q: string.Intern() 和 string.IsInterned() 的作用？（答：手动将运行时动态生成的字符串放入驻留池或查询是否存在，用于海量重复字典字符串的去重优化）"
    ]
  },
  {
    "id": "CLASSIC-01",
    "module": "经典题与历史归档",
    "stars": 4,
    "tags": [
      "操作系统",
      "多线程",
      "死锁",
      "四大必要条件"
    ],
    "title": "操作系统中死锁产生的四个必要条件是什么？上位机多线程编程中如何有效预防与克服死锁？",
    "summary": "1. **死锁四大必要条件**：互斥条件、请求与保持条件、不剥夺条件、循环等待（环路等待）条件。\n2. **核心破坏手段**：破坏“循环等待”最为有效——在代码中**严格固定锁的获取顺序**（例如总是先锁 A，再锁 B）；或者破坏“请求与保持”——使用带有超时的锁尝试（如 `Monitor.TryEnter(obj, timeout)` 或 `SemaphoreSlim.WaitAsync(timeout)`），超时未获取立即释放已持有的锁并回退重试。\n3. **规避 UI 死锁**：禁止在 UI 主线程对异步 Task 调用 `.Result` 或 `.Wait()` 同步阻塞。",
    "detail": "### 1. 经典死锁代码模拟\n线程 1 持有 LockA 试图获取 LockB；线程 2 持有 LockB 试图获取 LockA。两线程永久僵持。\n\n### 2. 工控上位机死锁预防规范\n1. **全局锁顺序规范**：如果涉及多个设备（如串口端口锁与电机状态锁），所有业务模块必须按照固定的全局等级制度依次加锁。\n2. **采用超时重试机制**：使用 `await sema.WaitAsync(TimeSpan.FromSeconds(2))`，若超时抛出日志告警并释放资源，而不是无限挂起导致整机卡死。\n3. **最小化锁范围**：不要在锁块内执行耗时的 I/O 操作、文件写入或调用不受控的外部回调。",
    "practice": "在多轴运动控制联动中，X 轴与 Y 轴拥有各自的硬件互斥锁。为防止插补计算与原点回归两组并发线程出现反向死锁，规定所有跨轴联动操作必须按“X轴 -> Y轴 -> Z轴”的字母表固定顺序申请资源，从数学逻辑上彻底斩断了形成环路等待的可能性。",
    "follow_ups": [
      "Q: 银行家算法的基本原理是什么？（答：一种避免死锁的动态资源分配算法，在分配前试探分配后系统是否依然处于安全状态，若是才真正分配，否则让进程等待）"
    ]
  },
  {
    "id": "CLASSIC-02",
    "module": "经典题与历史归档",
    "stars": 3,
    "tags": [
      "操作系统",
      "进程与线程",
      "内存模型"
    ],
    "title": "进程（Process）与线程（Thread）的本质区别是什么？在 Windows 上位机环境下如何权衡？",
    "summary": "1. **资源与调度**：进程是**操作系统资源分配的独立基本单位**（拥有独立的虚拟地址空间、句柄表、安全上下文）；线程是**CPU 调度与执行的基本单位**，同一进程内的所有线程共享该进程的地址空间和全局资源。\n2. **开销差异**：进程创建和上下文切换开销大，崩溃时相互隔离互不影响；线程创建与切换轻量（通常只占用约 1MB 栈空间），但同一进程内某个线程如果发生访问违规（如 AccessViolationException）可能直接导致整个进程崩溃。\n3. **上位机选型**：常规测控系统采用单进程多线程模型（高效通信与低延迟共享内存）；对于稳定性要求极高的高危硬件（如不稳定易崩溃的第三方驱动），通常采用**独立看门狗进程或跨进程架构**进行物理隔离保护。",
    "detail": "### 1. 深入对比\n- **内存隔离**：进程间通信（IPC）必须通过命名管道（NamedPipe）、共享内存（MemoryMappedFile）或 Socket；线程间通信只需直接读写共享内存变量（需注意线程同步安全）。\n- **异常隔离**：托管环境下的普通异常可用 try-catch 拦截，但如果是 C++ 原生 DLL 导致的硬崩溃，线程级崩溃会拖垮整个宿主上位机。",
    "practice": "在上位机系统中，主程序负责测控与 UI 显示；针对某老旧分析仪不稳定的第三方驱动，单独编写了一个无界面的 Console 辅助进程进行托管，二者通过命名管道进行高速二进制通信。即使第三方驱动偶发崩溃，主上位机不仅不会闪退，还能自动检测并拉起重启该辅助进程，实现了工业级的容灾弹性。",
    "follow_ups": [
      "Q: 什么是纤程（Fiber）与协程？C# 的 async/await 和线程是什么关系？（答：async/await 是语言级协程/用户态调度，并不等同于创建新线程，是在少量线程池线程之间复用 CPU）"
    ]
  },
  {
    "id": "CLASSIC-03",
    "module": "经典题与历史归档",
    "stars": 3,
    "tags": [
      "面向对象",
      "重载与重写",
      "虚方法",
      "多态"
    ],
    "title": "方法重载（Overload）与方法重写（Override）的深层区别？C# new 隐藏父类方法的区别与危害？",
    "summary": "1. **重载（Overload）**：编译期多态（早绑定），在同一类中，方法名相同但参数列表（个数、类型、顺序）不同，调用哪个版本在编译阶段即由静态类型确定。\n2. **重写（Override）**：运行时多态（晚绑定），子类重写基类带 `virtual` 或 `abstract` 的方法，方法签名必须完全一致，通过对象的**虚方法表（vtable）**动态分派实际执行逻辑。\n3. **new 隐藏的危害**：`new` 仅仅是隐藏基类方法（断开了虚方法分派链），若将子类实例赋值给基类变量，调用时执行的将是基类的旧逻辑而非子类的新逻辑，容易产生隐蔽的逻辑 Bug，上位机中应尽量避免，优先规范使用 `override`。",
    "detail": "### 1. 虚方法表（vtable）底层分派过程\n- 每个包含虚方法的类在被加载时，CLR 会为其生成一个方法表（Method Table）。\n- 类的每个对象实例头包含一个指向该方法表指针（TypeHandle）。\n- 当执行 `baseRef.DoAction()` 时，CLR 先查对象头找到真实运行时类型的 Method Table，再按槽位偏移调用对应地址，因此无论变量声明是什么类型，执行的都是当前真实实例的派生方法。\n\n### 2. 代码对比展示\n```csharp\nclass Base { public virtual void Run() => Console.Write(\"Base\"); }\nclass SubOverride : Base { public override void Run() => Console.Write(\"SubO\"); }\nclass SubNew : Base { public new void Run() => Console.Write(\"SubN\"); }\n\nBase b1 = new SubOverride(); b1.Run(); // 输出 SubO (多态生效)\nBase b2 = new SubNew();      b2.Run(); // 输出 Base (多态失效！容易踩坑)\n```",
    "practice": "在硬件抽象层（HAL）设计中，定义了抽象基类 `DeviceControllerBase`，声明虚方法 `public virtual async Task InitializeAsync()`。不同硬件子类（如 `SerialMotorController` 和 `TcpMotorController`）统一使用 `override` 重写。上层业务以基类指针统一调度启动流程，完美发挥多态优势。",
    "follow_ups": [
      "Q: 抽象类（abstract）和接口（interface）在多态设计上如何选择？（答：IS-A 强血缘关系且需共享部分通用实现时用抽象类；CAN-DO 能力契约或多实现多重继承时用接口）"
    ]
  },
  {
    "id": "CLASSIC-04",
    "module": "经典题与历史归档",
    "stars": 3,
    "tags": [
      "网络通信",
      "TCP与UDP",
      "三次握手",
      "工业应用选型"
    ],
    "title": "TCP 与 UDP 协议的核心区别？工业测控场景下视频流、控制指令与传感器数据应如何选型？",
    "summary": "1. **协议特性**：TCP 是面向连接、可靠、基于字节流的双向通信协议（有三次握手、确认重传、拥塞控制和滑动窗口）；UDP 是无连接、不可靠、面向数据报的轻量传输协议（无连接状态，尽最大努力交付）。\n2. **工业选型策略**：\n   - **控制指令与参数配置**：必须选 **TCP**（或基于 TCP 的 Modbus-TCP / OPC UA），控制电机启停、调速绝对不允许丢包或乱序。\n   - **高帧率工业相机裸流 / 实时视频**：优先选 **UDP**（如工业千兆网相机标准 GigE Vision 基于 UDP 广播），即使偶发丢弃一个像素包也不可触发全局阻塞，保证画面低延迟。\n   - **高频传感器瞬态波形**：若数据量极大且注重实时性可采用 UDP，并在应用层做序号去重与校验。",
    "detail": "### 1. 核心对比表\n| 特性 | TCP | UDP |\n| :--- | :--- | :--- |\n| **连接性** | 面向连接（三次握手建立，四次挥手断开） | 无连接（直接发包） |\n| **可靠性** | 极高（超时重传、丢包重发、顺序保证） | 不保证送达，不保证顺序 |\n| **传输方式** | 流式传输（Stream），存在粘包现象 | 报文传输（Datagram），保留完整边界 |\n| **头部开销** | 至少 20 字节，状态机复杂 | 仅 8 字节，极简高速 |\n| **传输延迟** | 遇丢包会等待重传（队头阻塞 Head-of-Line Blocking） | 延迟极低且平稳，无等待 |",
    "practice": "在 3 路工业相机测控系统中，千兆网相机取流底层基于 GigE Vision 协议（基于 UDP 构建），即使网络偶发闪烁也保证 120 FPS 采集不发生队头阻塞；而向 PLC 下发跑台速度设定值与安全互锁信号时，严格采用 TCP 上的 Modbus-TCP 协议，确保每一条关键指令都被确认识别。",
    "follow_ups": [
      "Q: TCP 粘包问题在 UDP 中存在吗？（答：不存在！UDP 是面向报文的，操作系统会完整保留发送端的数据边界，每次 recvfrom 读到的就是一整个完整的数据报）"
    ]
  },
  {
    "id": "VIS-04",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "工业相机",
      "硬件抽象层",
      "HAL",
      "SDK封装",
      "海康与大华"
    ],
    "title": "工业相机硬件抽象层（HAL）设计：如何优雅封装海康、大华等不同品牌 SDK 并实现上层业务无缝平滑切换？",
    "summary": "1. **定性**：遵循依赖倒置原则（DIP）与面向接口编程，在上层业务与底层厂商 SDK 之间构建统一的**硬件抽象层（HAL，Hardware Abstraction Layer）**。\n2. **核心机制**：定义 `ICamera` 通用契约接口（曝光、增益、采流、触发、回调），统一输出不依赖厂商的原始帧数据模型（包含宽高、格式、非托管指针）；各品牌 SDK 编写适配器类实现该接口。\n3. **无缝替换**：驱动内部消除厂商专有枚举（通过字典映射），错误码统一转译为自定义业务异常；通过依赖注入（DI）与工厂模式配置加载，实现换相机时上层业务代码 0 修改。",
    "detail": "### 1. 硬件抽象层（HAL）分层设计架构\n```\n[业务展示层 / ViewModel] -> 依赖抽象\n       │\n       ▼\n[统一硬件抽象层 (HAL)] : ICamera 接口, CameraFrame 实体, CameraException 异常体系\n       ▲                      ▲\n       │ (实现)                │ (实现)\n[海康驱动适配器 (HikDriver)]    [大华驱动适配器 (DahuaDriver)]\n       │                      │\n       ▼                      ▼\n[海康原生 MvCamera SDK]        [大华原生 DaHua Camera SDK]\n```\n\n### 2. 核心通用接口契约设计（示例代码）\n```csharp\npublic interface ICamera : IDisposable {\n    string DeviceId { get; }\n    bool IsConnected { get; }\n    bool IsGrabbing { get; }\n    event EventHandler<CameraFrameReceivedEventArgs> FrameReceived;\n    \n    Task OpenAsync();\n    Task CloseAsync();\n    Task StartGrabbingAsync();\n    Task StopGrabbingAsync();\n    void SetExposureTime(float microSeconds);\n    void SetGain(float gain);\n    void SetTriggerMode(TriggerMode mode);\n    void TriggerSoftware();\n}\n\n// 统一输出帧实体，抹平厂商私有结构\npublic class CameraFrameReceivedEventArgs : EventArgs {\n    public IntPtr DataPointer { get; init; }\n    public int Width { get; init; }\n    public int Height { get; init; }\n    public int Stride { get; init; }\n    public PixelFormat Format { get; init; }\n    public long Timestamp { get; init; }\n}\n```\n\n### 3. 依赖注入与工厂配置动态加载\n在 `App.xaml.cs` 容器注册中：\n```csharp\n// 通过配置文件动态决定注入海康还是大华\nstring vendor = ConfigurationManager.AppSettings[\"CameraVendor\"];\nservices.AddSingleton<ICamera>(sp => vendor switch {\n    \"Dahua\" => new DahuaCameraDriver(cameraId),\n    _ => new HikCameraDriver(cameraId)\n});\n```",
    "practice": "在三路工业相机测控项目中，当客户从海康千兆网工业相机更换为大华 USB3.0 相机时：由于整个系统严格依赖 `ICamera` 接口与统一的 `CameraFrameReceivedEventArgs`，开发人员仅需单独编写 `DahuaCameraDriver` 适配实现类并配置 DI 容器。上层的 HSV 动态分析算法、视频录像落盘以及 WriteableBitmap 渲染管线代码完全零修改，设备切换由原本预估的 2 周缩短为半天联调完成交付。",
    "follow_ups": [
      "Q: 各厂商相机的像素格式（PixelFormat）枚举和命名差异如何消除？（答：在 HAL 层定义统一的标准像素格式枚举，各驱动在接收到原始回调帧后通过预建映射表转译，或驱动层提供统一转 Bgr24 的无锁快速转换）",
      "Q: 软触发与硬触发的调用逻辑在接口层如何通用？（答：在 ICamera 统一暴露 TriggerMode 属性与 TriggerSoftware() 方法，底层海康调用 MV_CC_SetTriggerMode / MV_CC_TriggerSoftware，大华调用 CameraSetTriggerMode / CameraSoftTrigger）"
    ]
  },
  {
    "id": "WPF-05",
    "module": "WPF与工业桌面开发",
    "stars": 4,
    "tags": [
      "架构设计",
      "MVVM",
      "MVC对比",
      "WPF",
      "Avalonia"
    ],
    "title": "桌面端架构选型：MVVM 与传统 MVC 的本质区别是什么？为什么现代桌面客户端（WPF/Avalonia）更青睐 MVVM？",
    "summary": "1. **核心差异**：MVC 中 Controller 作为中枢持有 View 与 Model，需要编写命令式代码去操作 View 刷新；MVVM 中彻底去除了 Controller，ViewModel 纯粹作为 View 的状态抽象，**完全不持有 View 的任何引用**。\n2. **技术纽带**：MVVM 依赖 XAML 强大的**双向数据绑定（Binding）与属性通知机制**（INotifyPropertyChanged），数据发生变更自动驱动 UI，用户在 UI 的输入自动回写数据，彻底省去手动操作控件属性的样板代码。\n3. **桌面端首选原因**：ViewModel 完全脱离 View 控件生命周期，可以**脱离界面直接进行 100% 自动化的业务单元测试**；同时实现了“界面设计（XAML）”与“逻辑开发（C#）”的真正解耦并行。",
    "detail": "### 1. 经典架构模式图谱演进\n- **MVC（Model-View-Controller）**：用户事件由 View 送给 Controller，Controller 更新 Model，Controller 再命令 View 更新（或者 Model 改变触发 View 刷新）。Controller 与 View 互相持有，桌面端容易形成庞大臃肿且难以测试的 Controller。\n- **MVVM（Model-View-ViewModel）**：\n  - **View**：仅负责 XAML 布局、样式、动画，声明 `{Binding Path=Speed}`；\n  - **ViewModel**：封装视图状态与命令（ICommand），实现 `INotifyPropertyChanged`，**绝对不包含任何 UI 命名空间（不引用 System.Windows）**；\n  - **Model**：纯粹的业务领域模型与数据持久层。\n\n### 2. 核心价值对比表\n| 维度 | 传统 MVC | WPF/Avalonia MVVM |\n| :--- | :--- | :--- |\n| **UI 更新方式** | 命令式代码：`txtSpeed.Text = val.ToString()` | 声明式数据绑定：`Text=\"{Binding Speed}\"` |\n| **控制器/VM依赖** | Controller 强依赖 View 接口或具体类 | ViewModel 对 View 完全无感知（0 依赖） |\n| **单元测试** | 极难，因为 Controller 绑死控件句柄与生命周期 | 极易，直接实例化 ViewModel 测试属性与 Command |\n| **开发协同** | 逻辑与界面混杂在 Code-Behind，难以协同 | 设计师专注 XAML，程序员专注 ViewModel |",
    "practice": "在复杂上位机仪器界面重构中：早期的 WinForms/Code-Behind 模式在一个窗体里塞了上万行代码，包含串口解析、数据计算与控件属性赋值，增加一个电机控件导致整个页面频繁报错且无法做自动化测试。重构为 Prism MVVM 架构后，ViewModel 成为纯粹的 C# POCO 类，针对跑台调速、紧急停机编写了 50 多个单元测试用例在 CI 流水线秒级跑通，代码质量与稳定性大幅提升。",
    "follow_ups": [
      "Q: MVVM 模式中，ViewModel 如何在不直接引用 View 的前提下通知弹窗或关闭窗口？（答：通过抽象的 IDialogService 弹窗服务接口注入，或者利用 Prism 的 EventAggregator / CommunityToolkit.Mvvm 的 WeakReferenceMessenger 发送跨模块通知）",
      "Q: 为什么不能为了省事在 ViewModel 里调用 this.FindName(\"controlName\")？（答：这样破坏了 ViewModel 不依赖 View 的核心契约，使得 ViewModel 无法在无界面的单元测试环境中运行，退化为了 Code-Behind 坏味道）"
    ]
  },
  {
    "id": "CS-04",
    "module": "C#与.NET8核心基础",
    "stars": 4,
    "tags": [
      "语言特性",
      "泛型约束",
      "async/await",
      "Span",
      "委托事件",
      "特性"
    ],
    "title": "在实际工业测控/桌面客户端项目中，你深度用过哪些 C# 高级特性？具体解决了什么工程问题？",
    "summary": "1. **泛型与泛型约束**：封装通用的设备指令队列与数据仓储基类 `Repository<T> where T : class, IEntity, new()`，消除装箱拆箱并保证编译期类型安全。\n2. **委托、事件与弱事件**：实现设备层到 UI 层的解耦广播；结合 `WeakEventManager` 根除长生命周期服务与临时弹窗未解绑引发的内存泄漏。\n3. **async/await 异步编程**：彻底解决串口/网络/硬件 I/O 阻塞导致 UI 卡死的问题，确保界面 60 FPS 流畅操作。\n4. **Span<T> / Memory<T> 零拷贝**：在高频传感器与千兆网数据包切片中实现 0 堆内存分配，消除 GC 停顿抖动。\n5. **特性（Attribute）与反射/源生成器**：自定义通信报文序列化特性 `[PacketField(Offset, Length)]`，大幅精简报文打包解包代码。",
    "detail": "### 1. 结合工程场景的 5 大核心高级特性图谱\n- **特性一：泛型约束（Generic Constraints）**\n  - *实战*：`public class CommandQueue<TCommand> where TCommand : IModbusCommand, new()`。限制只能传入合法的指令类型，避免运行时类型强转引发 `InvalidCastException`。\n- **特性二：async/await 与 Task 状态机**\n  - *实战*：通信发送指令必须使用 `await serialPort.BaseStream.ReadAsync(...)`，释放当前线程回线程池，彻底告别 UI 线程“假死”。\n- **特性三：Span<T> 栈切片与零拷贝**\n  - *实战*：下位机 1024 字节复合报文，通过 `ReadOnlySpan<byte>.Slice()` 切片验证 CRC，全链路 0 次托管堆内存分配。\n- **特性四：模式匹配（Pattern Matching）**\n  - *实战*：使用 C# 8+ switch 表达式处理不同设备报警：\n    ```csharp\n    string message = alarm switch {\n        OverHeatAlarm h => $\"电机过热: {h.Temperature}℃\",\n        DisconnectAlarm => \"总线断开重连中\",\n        _ => \"未知报警\"\n    };\n    ```\n- **特性五：自定义特性（Attribute）与源生成器**\n  - *实战*：利用 CommunityToolkit.Mvvm 的 `[ObservableProperty]` 源生成器，在编译期自动生成 `INotifyPropertyChanged` 样板代码，兼顾代码极其简洁与零反射高性能。",
    "practice": "在步态动力学上位机中，结合了特性与泛型构建了统一二进制协议序列化组件：对下位机结构体打上 `[StructLayout(LayoutKind.Sequential, Pack = 1)]` 特性，利用 `MemoryMarshal.Cast<byte, T>(span)` 实现纳秒级结构体与字节数组互转，单次数据包解析耗时小于 1 微秒，CPU 占用率忽略不计。",
    "follow_ups": [
      "Q: 为什么在工控通信方法中不要轻易使用反射遍历字段？（答：反射在每次调用时涉及元数据查找和类型检查，高频循环下性能极差；应在初始化时预热缓存委托，或改用编译期源生成器 Source Generator）"
    ]
  },
  {
    "id": "WPF-06",
    "module": "WPF与工业桌面开发",
    "stars": 3,
    "tags": [
      "跨平台桌面",
      "Avalonia",
      "多进程",
      "IPC",
      "StreamJsonRpc"
    ],
    "title": "C# 现代桌面端跨平台方案（Avalonia）与大型桌面客户端多进程 IPC 架构如何设计？",
    "summary": "1. **Avalonia 跨平台优势**：基于 Skia 跨平台图形渲染引擎，拥有与 WPF 极其相似的 XAML 语法与 MVVM 体验，一套代码原生运行在 Windows、macOS、Linux（信创国产生态环境）以及 Android/iOS。\n2. **多进程架构核心价值**：将**不稳定易崩溃的第三方驱动（如老旧 C++ DLL）或极耗 CPU 的音视频编解码**剥离为独立的无界面后台进程，与主 UI 进程实现物理级容灾隔离。\n3. **IPC 通信选型**：进程间通信优先选择**命名管道（NamedPipe）**或本地 Socket，上层协议采用 **StreamJsonRpc** 或 **MessagePack** 实现强类型异步 RPC 调用。",
    "detail": "### 1. Avalonia 与 WPF 核心对比\n| 维度 | WPF | Avalonia |\n| :--- | :--- | :--- |\n| **平台支持** | 仅限 Windows（依赖 Win32 / DirectX） | 真正的跨平台（Windows, macOS, Linux, WebAssembly） |\n| **底层渲染** | 基于 DirectX 9/11 合成 | 基于 Skia 跨平台 2D 渲染引擎 |\n| **样式系统** | 类似 CSS 简单的 Setter | 类似 CSS 的高级选择器系统（`:pointerover`） |\n| **架构兼容** | MVVM, INPC, ICommand | 100% 兼容 CommunityToolkit.Mvvm, ReactiveUI |\n\n### 2. 大型客户端多进程 IPC 架构落地\n```\n[主客户端进程 (WPF / Avalonia)]\n         ▲\n         │ (双向异步 RPC: StreamJsonRpc / 命名管道)\n         ▼\n[驱动与算法守护进程 (Console App / Background Worker)]\n         │ (P/Invoke 调用不稳定 C++ SDK)\n         ▼\n[第三方硬件 / 相机 / 仪器]\n```\n- 主进程通过 `Process.Start` 启动子进程并建立两端命名管道连接。\n- 子进程若发生非托管内存段错误（Crash），主进程捕获管道中断事件，弹窗提示并自动拉起重启子进程，主程序界面永不闪退。",
    "practice": "在多通道综合测控系统中，某老旧光谱仪驱动 DLL 偶发内存访问越界导致宿主进程直接被操作系统终止。重构为多进程架构：单独编写了一个无界面的 Console 守护进程承载该驱动，主 WPF 界面通过命名管道使用 StreamJsonRpc 进行数据同步。系统上线后，即使该驱动偶发崩溃，主界面能在 1 秒内自动拉起子进程无缝恢复，整机 7x24 小时运行可用率达到 99.99%。",
    "follow_ups": [
      "Q: StreamJsonRpc 与 gRPC 相比有什么优势？（答：StreamJsonRpc 极其轻量，支持在双向 Stream 如命名管道上直接运行，无需依赖重量级的 HTTP/2 协议栈与证书配置，非常适合本机进程间通信）"
    ]
  },
  {
    "id": "COMM-04",
    "module": "工业通信与测控协议",
    "stars": 5,
    "tags": [
      "通信",
      "单线程时隙轮询",
      "高低频调度",
      "RS485总线防冲突"
    ],
    "title": "多个低频和高频读取之间，单线程通信怎么保证不冲突？各读取之间不会冲突呢？",
    "summary": "1. **物理约束定性**：RS485/Modbus 是严格半双工总线，物理链路同一时刻只允许一个数据包传输，严禁多线程并发裸写串口，必须收归到**单个通信 Worker 线程或通道 Actor**。\n2. **核心机制（时隙节拍轮询 Time-Slice Polling）**：通信循环以最小公约数时基（如 10ms TICK）运行。维护模运算计数器，高频数据（如电机当前速度 50Hz）每 2 个 TICK 调度一次，低频数据（如机箱温度 1Hz）每 100 个 TICK 调度一次。\n3. **防冲突与插队仲裁**：采用“双队列架构”，主调度器优先消费高优先级的紧急写入指令队列（急停、调速），无写指令时再执行周期轮询时隙，保证高低频读取天然串行化、零冲突。",
    "detail": "### 1. 多频段轮询调度器时序设计\n```\n时基 TICK (10ms) ───► [ TICK 0 ] ───► [ TICK 1 ] ───► [ TICK 2 ] ...\n                       │                │                │\n                       ▼                ▼                ▼\n                   读高频点位(50Hz)   读高频点位(50Hz)   读高频+低频(1Hz)\n                       +                +                +\n                   检查高优写队列    检查高优写队列    检查高优写队列\n```\n- **单一职责 Worker**：整个物理端口只由一个后台线程通过阻塞队列或自旋时隙调度，彻底杜绝了“线程A发命令还没收到响应，线程B就强行发送导致下位机解析乱码”的灾难。\n- **时隙防饥饿**：每次问询设置严格超时 15ms，无论成功还是超时均立即结束当前事务，保证后续节拍 TICK 准时推进，低频点位绝不会被高频饿死。",
    "practice": "在步态跑台测控上位机中，跑台伺服电机的编码器反馈要求 50Hz 高频读取（20ms），而张力传感器与控制器机箱温度只需 1Hz（1000ms）。采用时隙调度引擎：基础节拍定为 10ms。当 TICK % 2 == 0 发送高频 0x03 报文；当 TICK % 100 == 1 发送低频温度报文。两者在时隙上完全错开，RS485 总线利用率稳定在 45%，连续运行数月无任何指令碰撞与乱码报错。",
    "follow_ups": [
      "Q: 如果下位机高频点位偶尔响应超时，低频点位会被一直饿死吗？（答：不会，每次问询设置严格超时 15ms，超时立即跳过当前时隙，不阻塞后续节拍递增）",
      "Q: 为什么不能直接为高频和低频各开一个后台线程？（答：RS485 硬件物理层是半双工差分信号，两个线程同时向串口发送字节流会在总线上发生电平冲突叠加，下位机只能收到乱码校验错误）"
    ]
  },
  {
    "id": "COMM-05",
    "module": "工业通信与测控协议",
    "stars": 5,
    "tags": [
      "通信",
      "背压机制",
      "防雪崩",
      "超时熔断",
      "断线重连状态机"
    ],
    "title": "如果队列里数据过多，读寄存器老是出现超时或者重连的情况，你怎么处理？",
    "summary": "1. **积压根因**：下位机卡顿或强电干扰导致响应延迟增大（如从 5ms 飙升至 500ms），而上位机上层仍在盲目高频入队，引发队列无限膨胀与超时雪崩。\n2. **背压治理（Drop-Oldest 丢弃旧数据）**：工业周期采集数据具有强时效性，“过去的旧数据毫无价值，唯有最新数据才有意义”。队列设置有界上限（如 MaxSize = 10），满额时丢弃最旧的历史读请求，或使用覆盖写（Single-Slot）。\n3. **熔断与容灾重连**：连续 3 次超时触发“熔断保护”，暂停常规高频轮询，进入“心跳探测降级状态”；重连使用后台 Task 配合指数退避（200ms -> 500ms -> 1s），杜绝在 UI 线程同步调用 `SerialPort.Open()` 造成界面卡死。",
    "detail": "### 1. 防雪崩容灾状态机设计\n```\n[正常通信态 (Connected)]\n     │ (连续 3 次超时)\n     ▼\n[熔断降级态 (Suspended)] ──► 清空积压的读队列，向 UI 发出通信告警\n     │\n     ▼\n[链路探测重连态 (Reconnecting)] ──► 后台 Task + 指数退避探针单包问询\n     ├─ 成功 ──► 恢复 [正常通信态]\n     └─ 持续失败 ──► 保持低频探测 (2s一次)，避免打爆串口驱动\n```\n- **背压控制**：使用 .NET 的 `System.Threading.Channels` 创建有界通道 `Channel.CreateBounded<T>(new BoundedChannelOptions(5) { FullMode = BoundedChannelFullMode.DropOldest })`，当下位机响应迟钝时，自动淘汰旧采集任务，只执行最新采集，根绝队列膨胀。",
    "practice": "现场由于变频器启动瞬间产生强共模干扰，导致 RS485 偶发 2 秒通信中断。早期系统采用无界 Queue，2 秒内积压了 100 多个读请求，链路恢复后下位机被海量旧请求淹没持续超时死锁。重构引入 Channel<T> 有界通道，容量设为 5，满时策略设置为 DropOldest；同时增加连续超时熔断探针。改造后遭遇干扰系统仅闪烁提示一次通信重试，干扰消除后 50ms 内无感自愈。",
    "follow_ups": [
      "Q: 写控制指令（如电机启动/停止）也能用 DropOldest 丢弃吗？（答：绝不可以！周期读可以丢，但关键写指令必须通过 TaskCompletionSource 保留并保证可靠送达，若彻底超时必须向上抛出硬件异常提示操作员）",
      "Q: 串口 SerialPort 在断开后直接调用 Open() 为什么有时会卡住几秒？（答：Win32 底层在释放串口句柄或等待驱动 I/O 取消时会有阻塞，必须在后台 Task 异步执行并配合 CancellationToken 控制等待）"
    ]
  },
  {
    "id": "COMM-06",
    "module": "工业通信与测控协议",
    "stars": 5,
    "tags": [
      "通信",
      "Modbus",
      "功能码",
      "CRC16查表法",
      "底层报文"
    ],
    "title": "你说一下 Modbus 的一些内容，讲一下你用的哪些？校验可以讲一讲。",
    "summary": "1. **RTU vs TCP**：Modbus-RTU 走物理串口，依赖 3.5T 字符空闲判帧，末尾带 2 字节 CRC16；Modbus-TCP 走网络，去掉了从机地址和 CRC，增加了 7 字节 MBAP 报文头（包含事务元标识符与长度域）。\n2. **核心功能码**：常用四类区：`0x01/0x05`（读/写单个线圈）、`0x02`（读离散输入）、`0x03/0x06`（读/写单个保持寄存器）、`0x10`（写多个保持寄存器，常用于参数批量下发）。\n3. **CRC16 查表机理**：生成多项式为 0xA001。工业级代码**坚决禁止循环 8 次按位移位计算**，必须采用预生成的 256 项高低字节双查找表（LUT），利用单字节查表异或，微秒级完成，杜绝 CPU 浪费。",
    "detail": "### 1. CRC16 高性能查表实现核心代码\n```csharp\npublic static class FastCrc16 {\n    private static readonly byte[] AuchCRCHi = { /* 256 元素静态常量表 */ };\n    private static readonly byte[] AuchCRCLo = { /* 256 元素静态常量表 */ };\n\n    public static ushort Compute(ReadOnlySpan<byte> buffer) {\n        byte crchigh = 0xFF;\n        byte crclow = 0xFF;\n        foreach (byte b in buffer) {\n            int index = crchigh ^ b;\n            crchigh = (byte)(crclow ^ AuchCRCHi[index]);\n            crclow = AuchCRCLo[index];\n        }\n        return (ushort)((crchigh << 8) | crclow);\n    }\n}\n```\n- **RTU 帧格式**：[从机地址 1B] + [功能码 1B] + [起始寄存器 2B] + [寄存器数量 2B] + [CRC16 低字节] + [CRC16 高字节]。",
    "practice": "在与伺服控制器通信时，下发目标速度与加速度需要同时修改 40010 和 40011 两个连续寄存器。若使用两次 0x06 单写，可能发生控制器在执行完第一条指令时发生时序中断，导致“速度改了但加速度未改”的设备抖动故障。实战必须使用 0x10（写多个保持寄存器）将两项参数打包在单个事务原子下发，彻底保障了多参数同步一致性。",
    "follow_ups": [
      "Q: Modbus-RTU 报文里的从机地址最大是多少？（答：从机地址范围 1~247，0 是广播地址，从机不回传响应）",
      "Q: 为什么 Modbus-RTU 经常使用 3.5 字符时间分包但在高速波特率下容易误判？（答：波特率 115200 下 3.5T 仅约 0.35ms，操作系统线程调度抖动动辄几毫秒，单靠时间间隔判帧极易误切包，必须结合功能码与长度域进行状态机预判）"
    ]
  },
  {
    "id": "COMM-07",
    "module": "工业通信与测控协议",
    "stars": 4,
    "tags": [
      "通信",
      "块读取BlockRead",
      "离散轮询",
      "点位规划",
      "总线利用率"
    ],
    "title": "你是读写一次性全部读出来，还是按所需数据去轮询？",
    "summary": "1. **核心权衡**：一次性读能减少总线握手 RTT 次数提升吞吐，但若地址跨度大则引入空洞浪费带宽；按需读灵活但请求频次高、总线开销大。\n2. **量化考量**：Modbus-RTU 每次请求都有固定 8 字节往返开销（约 10~15ms）。如果 20 个点离散单点读需 20 次交互（耗时 300ms）；若地址规整为连续块，单次 `0x03` 读取仅需 1 次交互（耗时 20ms），吞吐性能提升 15 倍。\n3. **工程落地黄金法则**：下位机 PLC/固件做“寄存器点位规整重排”，将高频监控点集中在连续地址段做**批量块读取（Block Read）**；低频配置参数做**按需惰性读取**。",
    "detail": "### 1. 块读取合并算法设计\n上位机自适应点位合并策略：\n- 将待采寄存器地址排序；\n- 计算相邻地址间隙，若 `Addr[i+1] - Addr[i] <= 3`（间隙小于 3 个字），把中间未使用的空洞寄存器一起打包读出来；\n- 若间隙过大或遇到从机禁止访问的保留地址，则断开分为新的 Block。\n- 单包读取上限严格受限于 Modbus 协议规范的 125 个寄存器（250 字节）。",
    "practice": "在综合机电测控实验台中，原有程序分散读取电机的电流、转速、母线电压、温度等 16 个寄存器，总轮询耗时高达 280ms，无法捕获瞬间电流突变。重构方案：协助嵌入式工程师将这 16 个点在寄存器映射表中紧凑排列在 40001~40016。上位机改用单条 0x03 块读取指令，单次轮询时间锐减至 18ms，采样频率轻松拉升至 50Hz，成功抓取到了电机堵转瞬间的毫秒级浪涌曲线。",
    "follow_ups": [
      "Q: Modbus 一次性最多能读多少个保持寄存器？（答：根据协议规范，数据域字节数最大 250 字节，故一次最多读取 125 个寄存器）",
      "Q: 读离散线圈 0x01 与读保持寄存器 0x03 为什么不能混在一个包里？（答：Modbus 功能码与寄存器区域是一对一的，不同区域的地址映射不同，必须分开发起问询）"
    ]
  },
  {
    "id": "VIS-05",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "多相机同步",
      "硬件触发",
      "主从级联",
      "帧对齐"
    ],
    "title": "你们是三个相机吧？三个相机同步采集的话，怎么做多相机的时间对齐？",
    "summary": "1. **同步指标要求**：步态动力学在 120 FPS 下帧间隙仅 8.33ms，多视角空间 3D 重建要求相机间时间差必须小于 100 微秒，否则空间点出现几何畸变。\n2. **硬件物理对齐**：采用 **TTL 硬件外触发主从级联**（主相机 Line2 输出 Strobe 脉冲，光耦隔离并联至从机 Line0 触发输入），或由外部信号源/PLC 发送 120Hz 脉冲硬触发，实现物理曝光微秒级同频同相。\n3. **上位机帧对齐结构设计**：提取每路相机硬件生成的 `Hardware FrameID` 和 `Device Nanosecond Timestamp`。维护滑动时间窗字典 `ConcurrentDictionary<long, SynchronizedFrameGroup>`，当三路相机相同 FrameID 均就绪后打包投递给算法；若超时（如 20ms）未集齐则判定丢帧并告警。",
    "detail": "### 1. 硬件外触发走线拓扑\n```\n[高精度脉冲发生器 / 主相机 Line2 Strobe]\n       │ (120Hz TTL 脉冲硬线并联)\n       ├─────────────────┬─────────────────┐\n       ▼                 ▼                 ▼\n[相机1 Line0 Input] [相机2 Line0 Input] [相机3 Line0 Input]\n   (左侧视视角)         (右侧视视角)         (底视足底视角)\n```\n### 2. 帧对齐聚合调度器核心逻辑\n- 每路相机回调接收到帧时，提取固件 FrameID；\n- 放入 `ConcurrentDictionary<long, SynchronizedGroup>` 暂存槽；\n- 检查该 FrameID 下的相机数是否达到 3 台；若达到，原子性移除并触发下游算法流；\n- 启动定时清理，超过 20ms 未集齐的三相机帧组标记为丢帧并上报丢帧指标。",
    "practice": "在三相机步态分析实验中，早期仅使用系统时间 DateTime.Now 匹配多相机图像，由于 Windows 调度抖动（误差 15ms），导致左脚着地画面与右侧脚悬空画面匹配在一起，空间 3D 重建彻底失真。改为硬件 Line0 硬外触发 + 相机硬件纳秒时间戳校验后，三台相机曝光时间差严格控制在 5 微秒以内，三维步态重构误差小于 0.2mm。",
    "follow_ups": [
      "Q: 若其中一台相机偶然丢了一帧，聚合器会导致后续所有帧都卡死等待吗？（答：不会，聚合器挂载定时清理定时器，超过 20ms 未收齐的帧组被标记为缺陷帧强制清理，绝不阻塞后续帧）",
      "Q: 硬件外触发的信号线如果长达 10 米，如何防止现场强电磁干扰？（答：必须采用带屏蔽层的双绞线，使用高速光耦隔离，并选用差分信号驱动器如 RS422 电平传输）"
    ]
  },
  {
    "id": "VIS-06",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "软件触发局限",
      "IEEE 1588 PTP",
      "TTL硬触发",
      "时间对齐精度"
    ],
    "title": "那没考虑软件同步吗？高帧率多相机为什么软件同步不可行？",
    "summary": "1. **软件触发致命死穴**：网络协议栈传输延迟（GVCP 报文单次 1~5ms 抖动）+ Windows 非实时操作系统线程调度抖动（10~15ms 时间片）。在 120 FPS（周期 8.33ms）下，三台相机软触发离散度甚至大于一个完整帧周期，无法实现有效时间对齐。\n2. **IEEE 1588 PTP 协议机制**：基于以太网硬件时间戳的精密时钟同步协议，通过主从时钟交换报文消除网络抖动，能将多相机时钟对齐至亚微秒级（< 1μs）；通过 GigE Vision 的 `Action Command` 广播定时触发曝光。\n3. **实战选型权衡**：硬件 TTL 外触发最可靠、成本低、抗网络干扰强，是工控高帧率首选；PTP 适合远距离无走线条件的大型分布式多相机系统（需交换机与网卡支持 PTP 硬件时间戳）。",
    "detail": "### 1. 三种同步机制全景对比表\n| 维度 | 软件触发 (Software Trigger) | IEEE 1588 PTP + Action Command | 硬件 TTL/Strobe 硬触发 |\n| :--- | :--- | :--- | :--- |\n| **同步精度** | 5ms ~ 20ms（完全失真） | 1μs ~ 10μs（微秒级） | **< 1μs（纳秒级物理响应）** |\n| **适用帧率** | < 10 FPS 低速离散检测 | 60 ~ 120 FPS 分布式 | **120 ~ 1000+ FPS 极速测控** |\n| **布线复杂度** | 仅网线 | 仅网线（需支持 PTP 的千兆交换机） | 需额外部署 GPIO 航空插头屏蔽线 |\n| **操作系统依赖** | 强依赖 Windows 线程调度 | 无依赖（相机硬件解析时钟） | 纯物理电平跳变，完全独立于 OS |",
    "practice": "某视觉项目试图通过 C# 发送 MV_CC_SetCommandValue(\"TriggerSoftware\") 循环触发 3 台千兆网相机，发现无论怎么优化 Task 调度，三台相机捕获的运动物体位移均有明显错位。现场直接改接 GPIO 航插硬线：由伺服控制器的 OC 门输出 120Hz 脉冲经高速光耦隔离后直连 3 台相机 Line0，当天彻底解决位移错乱问题。",
    "follow_ups": [
      "Q: PTP 同步中 Master 相机是怎么选出来的？（答：通过最佳主时钟算法 BMCA 自动竞选，或上位机指定网卡/主相机为固定 Master）",
      "Q: 什么是 GigE Vision 的 Action Command？（答：由上位机向局域网广播一条特制 UDP 报文，所有收到该指令的相机在约定的相同时钟时刻同步开始曝光）"
    ]
  },
  {
    "id": "VIS-07",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "120FPS无丢帧",
      "千兆网网卡调优",
      "巨型帧",
      "无锁队列"
    ],
    "title": "120 帧视频流如何保证不丢帧？千兆网与网卡参数如何优化？",
    "summary": "1. **吞吐量量化**：120 FPS 下，单台 1080P Mono 图像带宽约 240MB/s（已超单千兆网口 125MB/s 极限，需 ROI 裁剪或多网卡独立总线）。三相机总吞吐极大，链路任何微小抖动都会导致溢出丢帧。\n2. **底层驱动调优四件套**：网卡开启巨型帧（Jumbo Packet 9014 字节）、接收描述符（Rx Descriptors）调至最大 2048、关闭网卡节能模式、微调海康包间隔（SCPD）。\n3. **应用层管线设计**：采集回调仅做指针无锁推入（RingBuffer / `Channel<T>`），耗时 < 50μs；使用非托管 Native 内存池，杜绝托管堆 GC；落盘流式直写 NVMe 固态硬盘，UI 30Hz 降频抽帧渲染。",
    "detail": "### 1. 全链路 0 丢帧四层保障模型\n```\n[物理/网卡层]  巨型帧 9014B + PCI-E 独立控制器 + 接收描述符 2048\n     │ (UDP 裸流极速收包)\n     ▼\n[SDK 驱动层]  开启海康驱动加速过滤器 (MvGigEIFFilter) + SCPD 包间隔匹配\n     │ (SDK 接收环形缓冲)\n     ▼\n[应用采集层]  回调线程最简化 -> 零拷贝推入 ArrayPool/RingBuffer (< 50μs)\n     │\n     ├─► [落盘通道] 独立后台 Task -> Stream 流式直写 NVMe SSD\n     └─► [渲染通道] UI CompositionTarget.Rendering -> 30Hz 抽帧渲染\n```",
    "practice": "在步态测控上位机 120 FPS 高速采集调试时，相机每录制 30 秒就偶发丢 3 帧。经排查：普通网卡驱动默认 MTU 为 1500 字节，每秒引发数十万次 CPU 硬中断；且网卡与显卡共享同一条 PCI-E x1 通道引发瞬时拥塞。改造方案：更换为 Intel I350 独立双口千兆网卡，开启 Jumbo Frame 9014，网卡接收缓冲调至 2048，应用层改用 Channel<T> 有界通道接流。系统连续 4 小时 120 FPS 压测，达到 0 丢包、0 丢帧。",
    "follow_ups": [
      "Q: 为什么不开巨型帧会导致 CPU 占用极高并丢帧？（答：1500 字节下每秒中断数十万次，操作系统上下文切换打爆 CPU；开启 9000 字节后中断次数锐减 80%，网络吞吐大幅稳定）",
      "Q: 采集回调线程中可以直接调用 OpenCV 的 cvtColor 吗？（答：绝对不可以！图像转换耗时几毫秒，会直接把 SDK 内部接收环形缓冲区撑爆导致驱动底层直接丢帧，必须异步抛出到工作队列处理）"
    ]
  },
  {
    "id": "VIS-08",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "数据完整性",
      "AI算法解耦",
      "落盘优先",
      "离线全量分析"
    ],
    "title": "如何保证数据完整地被分析？高吞吐实时流与重算力 AI 算法速率失配处理方案",
    "summary": "1. **核心矛盾**：120 FPS 数据产生速率为 8.33ms/帧，而复杂的深度学习算法单帧推理耗时可能需要 15~30ms，实时在线逐帧分析在算力上必然过载。\n2. **战略原则（落盘与数据采集高于一切）**：原始数据具有不可再生性，“只要原始数据完整保存在磁盘，任何算法都能在实验后 100% 完整重现”。\n3. **双通道流水线工程落地**：\n   - **主通道（无损录像）**：最高优先级，无锁流式写入 NVMe 磁盘，保证 120 FPS 原始数据 100% 留存；\n   - **次通道（实时预览与降采样分析）**：每 4 帧抽验 1 帧（30Hz）进行姿态估计与运动学初筛，保障操作员实时掌握实验状态；\n   - **离线全量回放兜底**：实验停止后，系统后台自动加载无损视频文件进行 120 FPS 逐帧精准离线重跑，输出完整分析报告。",
    "detail": "### 1. 采集-落盘-分析解耦流水线\n```\n[120 FPS 相机同步流]\n         │ (推入主缓冲区)\n         ▼\n[广播分流器 (Channel)]\n   ├─► [落盘通道 (最高优先级)] ──► NVMe 高速写入 (100% 完整帧，0 丢失)\n   └─► [在线 AI 通道 (自适应抽帧)] ──► 30Hz 准实时姿态初判 (动态丢弃积压)\n                                             │\n                                             ▼ (实验结束)\n                               [离线全量回放引擎] ──► 从 NVMe 逐帧回灌 120 FPS\n                                                     输出科研级高精度报告\n```",
    "practice": "在小动物步态三维运动学实验中，要求追踪 16 个骨骼关键点并计算关节角度。客户初期坚持要 120 FPS 全实时在线精准推理，导致系统运行 10 秒后 GPU 显存耗尽崩溃。技术负责人推动架构重构：确立“实验中保落盘 + 30Hz 关键特征实时指示，实验后自动离线重算”。上位机在采集结束后无缝弹出进度条，在后台 1 分钟内完成全量 120 FPS 离线重算，既保障了实验现场 0 卡死，又完全满足了科研数据 100% 完整性的严苛要求。",
    "follow_ups": [
      "Q: 离线视频采用有损压缩（如 H.264）会对算法精度有影响吗？（答：有影响，工业与科研级图像应采用无损编码如 FFmpeg FFV1、Raw 裸流或高质量 MJPEG，防止压缩伪影干扰亚像素边缘提取）",
      "Q: 录像落盘时如果磁盘 I/O 偶发被操作系统卡死怎么办？（答：落盘队列设计 2~4GB 的内存突发写缓冲池，能够吸收操作系统几秒钟的 I/O 挂起抖动）"
    ]
  },
  {
    "id": "VIS-09",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "海康SDK二次开发",
      "丢帧排查",
      "帧错乱",
      "网络统计",
      "GC排障"
    ],
    "title": "如果遇到丢帧、帧错乱，你会从哪些方向排查？海康 SDK 二次开发丢包排查全链路指南",
    "summary": "1. **结构化排查体系**：坚决杜绝无头绪乱试，严格遵循“物理拓扑 -> 网卡驱动 -> SDK 报文参数 -> CLR 托管层”自底向上四层诊断。\n2. **海康专有诊断接口**：利用 `MV_CC_GetNetworkStat` 获取 `nLostPacket`（网络丢包数）和 `nLostFrame`（驱动丢帧数），迅速区分是网络硬件问题还是上位机软件消费不及时。\n3. **核心排查重点清单**：六类屏蔽网线与千兆握手、Jumbo Packet 9014、网卡接收描述符 2048、海康 SCPD 发送间隔、采集回调耗时是否超标、以及 .NET 堆中是否存在高频 GC Stop-The-World。",
    "detail": "### 1. 四层诊断全景导图\n```\n[物理/拓扑] ──► 网线是否 CAT6A？网口是否跑在 1000M？是否多网口共用 PCI-E x1 导致总线瓶颈？\n     │\n[网卡驱动]   ──► 巨型帧 Jumbo Packet 是否开启 9014？Rx 描述符是否改到 2048？节能降频关闭？\n     │\n[SDK 参数]   ──► MV_CC_GetNetworkStat 查 nLostPacket。GevSCPS 设为 8192~9000，微调 GevSCPD。\n     │\n[C# 运行时]  ──► 回调耗时是否 > 1ms？是否存在 new byte[] 导致 Gen2/LOH GC 停顿？FrameID 是否跳跃？\n```",
    "practice": "现场一台工控机偶发每隔几分钟严重丢帧 10~20 帧。使用 PerfView 工具对上位机进程进行火焰图捕获，发现丢帧时刻与 .NET CLR 的一次长时间垃圾回收（Gen 2 GC Pause 达 80ms）完全重合！进一步排查代码发现：一位新手工程师在图像显示辅助类中，每帧都 new byte[1920*1080*3]，这些 6MB 的大数组直接进入 LOH 大对象堆，引发高频 Full GC。改用 ArrayPool<byte> 和非托管 Native 内存池后，GC 停顿彻底降为 0，丢帧彻底消失。",
    "follow_ups": [
      "Q: 帧错乱（Frame Disordering）通常是什么原因？（答：多相机采集时未按硬件 FrameID 严格校验，或者后台多线程并发消费队列时未维护顺序；必须通过硬件 FrameID 单调递增校验或单线程消费）",
      "Q: 海康 SDK 中的 GevSCPD 参数代表什么含义？（答：Stream Channel Packet Delay，即相机发送每个 UDP 数据包之间的微秒间隔，调大该参数可降低交换机瞬间拥塞丢包，但会轻微降低最大帧率上限）"
    ]
  },
  {
    "id": "VIS-10",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "AI视觉集成",
      "ONNX Runtime",
      "多进程隔离",
      "IPC",
      "共享内存"
    ],
    "title": "AI 视觉算法集成这块是怎么做的？ONNX Runtime 原生嵌入 vs 多进程 IPC 隔离",
    "summary": "1. **主流两大流派**：\n   - **流派 A（ONNX Runtime 原生同进程嵌入）**：算法导出为 ONNX，C# 引用官方 NuGet 库直接跑，内存零拷贝直灌 Tensor，性能极致、部署单一，适合工业已定型轻量模型；\n   - **流派 B（独立进程物理隔离）**：算法在独立 Python/C++ 守护进程中跑，通过**共享内存（MemoryMappedFile）**传递图像、命名管道传递结果，实现物理级容灾崩溃隔离。\n2. **工程防崩溃考量**：第三方 Python/C++ 深度学习库（如 PyTorch、CUDA 驱动）极易发生底层段错误（Access Violation），非托管崩溃会导致宿主 C# 进程直接闪退且无法用 try-catch 捕获。稳定性要求极高的 7x24 小时产线强烈推荐**多进程 IPC 隔离**。",
    "detail": "### 1. 两大方案多维权衡\n| 维度 | ONNX Runtime 同进程嵌入 | 独立守护进程 IPC 隔离 (MemoryMappedFile) |\n| :--- | :--- | :--- |\n| **推理延迟** | 极低（直接共享 Native 指针，零拷贝） | 极低（共享内存传递仅几十微秒，几乎无额外拷贝） |\n| **内存开销** | 较小（单进程资源共享） | 稍大（需维护两套进程与通信管道） |\n| **容灾与稳定性**| 风险高：C++ 底层崩则整个上位机主程序闪退 | **极高：算法崩溃主界面不闪退，1秒内自动拉起重启** |\n| **依赖与部署** | 简单（仅需几颗官方 DLL） | 需管理子进程生命周期与心跳保活 |",
    "practice": "在步态分析与足底压力综合测控系统中：早期采用 Python 脚本通过 Python.NET 进程内互操作，因 Python GIL 锁与 CUDA 显存碎片偶发内存越界，导致操作员测试录制中途软件直接闪退，丢失实验数据。重构为“独立算法守护进程”：主 WPF 上位机负责设备采流与界面交互，通过 MemoryMappedFile 开辟 64MB 环形图像共享内存，子进程读取推理并经由命名管道回传关键点坐标。整机上线后再无任何因算法引发的闪退事故。",
    "follow_ups": [
      "Q: C# 中 ONNX Runtime 如何使用 GPU 加速？（答：引入 Microsoft.ML.OnnxRuntime.Gpu，在 SessionOptions 中配置 AppendExecutionProvider_CUDA 或 AppendExecutionProvider_Dml 使用 DirectML）",
      "Q: 共享内存如何通知子进程有新帧到来？（答：使用跨进程具名 EventWaitHandle 事件量，主进程写完触发 Set()，子进程 WaitOne() 唤醒读取，延迟在 10 微秒以内）"
    ]
  },
  {
    "id": "VIS-11",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "OpenCvSharp",
      "非托管内存泄漏",
      "Mat生命周期",
      "ROI",
      "缓冲区复用"
    ],
    "title": "OpenCvSharp 应用要点有哪些？非托管内存泄漏与性能调优",
    "summary": "1. **非托管内存失控本因**：`OpenCvSharp.Mat` 内部仅是一个微型 C# 句柄，底层 C++ `cv::Mat` 图像数据分配在非托管堆。**C# GC 只能看到几十字节的托管壳，根本感知不到数兆字节的图像内存**，依赖 GC 终结器必然导致非托管内存暴涨 OOM。\n2. **四大黄金法则**：\n   - 临时 Mat 必须使用 `using` 或显式 `.Dispose()`；\n   - 循环算法严禁链式调用未解引用的中间产物；\n   - ROI 区域裁剪利用 `new Mat(src, rect)` 头拷贝指针共享，避免无意义的 `.Clone()` 全图深拷贝；\n   - 高频算子输入输出复用预分配好的全局工作 `Mat` 缓冲区。",
    "detail": "### 1. 致命泄漏反面教材与标准示范\n```csharp\n// 致命错误：链式调用产生 2 个未释放的中间临时非托管 Mat\nvar edges = src.CvtColor(ColorConversionCodes.BGR2GRAY).Canny(50, 150);\n\n// 工业标准写法：全局复用中间 Mat 实例\nprivate readonly Mat _grayMat = new();\nprivate readonly Mat _edgeMat = new();\n\npublic void Process(Mat src) {\n    Cv2.CvtColor(src, _grayMat, ColorConversionCodes.BGR2GRAY);\n    Cv2.Canny(_grayMat, _edgeMat, 50, 150);\n    // 处理 _edgeMat，无需频繁创建与释放\n}\n```",
    "practice": "在连续足印形态学跟踪模块中，系统连续运行 2 小时后工控机内存占用从 2GB 飙升至 16GB 最终报 OutOfMemoryException。排查发现工程师在找轮廓方法内部调用了 Cv2.FindContours，中间创建了数百个临时 Mat 未做 Dispose。重构为“工作缓冲区池化”并严守 using 规约后，系统 7x24 小时长时间运行，内存曲线平滑稳定在 1.8GB，无任何泄漏波动。",
    "follow_ups": [
      "Q: Mat 的 SubMat/ROI 操作如果释放了原 Mat 会怎样？（答：内部有引用计数器，但若使用底层指针直接操作可能发生悬空野指针，必须保证原图生命周期覆盖 ROI 使用周期）",
      "Q: OpenCvSharp 中的 Parallel.For 和 Cv2.SetNumThreads 有何区别？（答：Cv2.SetNumThreads 控制 OpenCV 内部 C++ 底层算子多线程并行，Parallel.For 是 C# 托管层多图并发；对于高帧率图像通常采用单张图单核流水线处理，避免多核切分的小开销）"
    ]
  },
  {
    "id": "VIS-12",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "DeepLabCut",
      "骨骼点检测",
      "模型裁剪",
      "TensorRT",
      "卡尔曼平滑"
    ],
    "title": "DeepLabCut 这个深度学习库你是直接调用的吗？怎么调整参数优化模型的？",
    "summary": "1. **落地路径界定**：严禁在生产上位机中直接拉起庞大的 Python DLC 运行库。正确路径是“Python 离线标注与迁移训练 -> 导出 ONNX/Engine -> C# 上位机通过 ONNX Runtime / TensorRT 引擎原生加载”。\n2. **速度优化三板斧**：\n   - 骨干网络轻量化：将耗时的 ResNet-50 裁剪替换为 MobileNetV2 或 ResNet-18；\n   - 限制 ROI：仅对活动跑台区域下采样输入；\n   - FP16 半精度量化：单帧耗时从 35ms 压减至 6ms 以内，满足 120 FPS 准实时吞吐。\n3. **后处理工程滤波**：设置置信度动态阈值（$p > 0.6$）剔除飞点；对输出的关键点时序轨迹挂载**一维卡尔曼滤波器（Kalman Filter）**，消除实验装置遮挡与光照噪点导致的坐标跳变。",
    "detail": "### 1. 模型工程落地调优四部曲\n```\n[离线迁移学习] ──► 骨干网络精简 (ResNet-50 -> MobileNetV2)\n       │\n[格式导出转换] ──► 导出为 ONNX，使用 TensorRT 进行 FP16 半精度加速优化\n       │\n[线上 C# 推理] ──► ONNX Runtime 填充 Tensor，提取 (x, y, confidence)\n       │\n[后处理平滑]   ──► 置信度阈值过滤 + 卡尔曼轨迹滤波 (消除突发噪点飞点)\n```",
    "practice": "在小动物步态评估中，老鼠爪子在高速运动触地时常被跑台侧向亚克力板的划痕反射光干扰，DLC 模型偶发在单帧将爪子坐标识别到半空中（飞点）。上位机算法管线引入时序卡尔曼滤波与足长物理约束：当两帧间距离突变超过生物力学生理最大速度阈值时，自动用卡尔曼先验预测值替代，彻底消除了骨骼角度曲线上的毛刺与伪突变。",
    "follow_ups": [
      "Q: DLC 输出热图（Heatmap）和坐标怎么转换的？（答：DLC 输出每个关键点的置信度热力图，通过取热图最大响应峰值 argmax 并结合局部高斯插值得到亚像素级别的精准坐标）",
      "Q: 为什么工控/科研中骨骼点检测容易在反光金属表面失效？（答：镜面反射破坏了特征梯度，除了算法层增加反光数据增强外，现场最有效的做法是在光源前加偏振镜并在工业镜头加装正交偏振片消除高光）"
    ]
  },
  {
    "id": "VIS-13",
    "module": "工业相机与视觉及底层",
    "stars": 5,
    "tags": [
      "视觉",
      "OpenCV与WPF",
      "WriteableBitmap",
      "跨线程更新",
      "内存对齐",
      "Stride"
    ],
    "title": "OpenCV 做视觉处理，在 WPF 程序中，Mat 图像跟 WPF 图像转换的话，有什么注意的？",
    "summary": "1. **为什么不能用 ToBitmapSource()**：其内部每次都申请全新的托管内存并进行全图深拷贝，高帧率下每秒产生几百兆大对象堆垃圾，直接触发 GC 停顿与界面肉眼可见的卡死。\n2. **WriteableBitmap 零拷贝机制**：初始化单例 `WriteableBitmap`，更新时调用 `Lock()` 获取非托管显存首地址 `BackBuffer`，直接利用 `Buffer.MemoryCopy` 将 Mat 数据指针拷入，标记脏矩形 `AddDirtyRect` 后 `Unlock()`。\n3. **两大深水区避坑**：\n   - **跨线程所有权**：WriteableBitmap 具有 UI 线程亲和性，后台图像处理完成后，通过 `Dispatcher.BeginInvoke` 写入，或前台挂载 `CompositionTarget.Rendering` 节拍器主动去后台共享指针拉取；\n   - **Stride 步长与颜色通道**：OpenCV 是 BGR 排布，WPF 是 `Bgr24`；且宽度不是 4 的倍数时必须做行跨度对齐（Stride Alignment），否则图像发生斜向撕裂。",
    "detail": "### 1. 极致高效渲染代码模板\n```csharp\npublic unsafe void RenderMatToWriteableBitmap(Mat mat, WriteableBitmap targetBmp) {\n    if (targetBmp.Dispatcher.CheckAccess()) {\n        UpdateInternal(mat, targetBmp);\n    } else {\n        targetBmp.Dispatcher.BeginInvoke(() => UpdateInternal(mat, targetBmp), DispatcherPriority.Render);\n    }\n}\n\nprivate unsafe void UpdateInternal(Mat mat, WriteableBitmap bmp) {\n    bmp.Lock();\n    // 直接内存拷贝，0 堆内存分配\n    Buffer.MemoryCopy(mat.DataPointer, bmp.BackBuffer.ToPointer(), \n                      mat.Total() * mat.ElemSize(), mat.Total() * mat.ElemSize());\n    bmp.AddDirtyRect(new Int32Rect(0, 0, mat.Width, mat.Height));\n    bmp.Unlock();\n}\n```",
    "practice": "在双目相机 1280x1024 预览界面开发中，初期界面只要放大或调节曝光就偶发画面错位成一道道斜纹黑白乱码。排查发现当裁剪 ROI 宽度为奇数（如 801 像素）时，OpenCV 单行字节数为 801 * 3 = 2403，不满足 Windows 图像 4 字节对齐要求。在更新函数中严格加入 int stride = (width * 3 + 3) & ~3; 并使用 Mat.Step 对齐拷贝后，彻底杜绝了图像错位撕裂问题。",
    "follow_ups": [
      "Q: WriteableBitmap 在高刷新率下会产生撕裂吗？（答：不会，WriteableBitmap 的 Lock/Unlock 与 AddDirtyRect 深度整合在 WPF 的 DirectX 双缓冲渲染管线中，由 DWM 窗口桌面管理器统一进行垂直同步同步合成）",
      "Q: 如果 Mat 是单通道灰度图，WPF 怎么显示？（答：WPF WriteableBitmap 格式指定为 PixelFormats.Gray8，无需转换为三通道，节约 66% 显存带宽）"
    ]
  },
  {
    "id": "WPF-07",
    "module": "WPF与工业桌面开发",
    "stars": 5,
    "tags": [
      "WPF",
      "Prism",
      "EventAggregator",
      "弱引用",
      "事件地狱",
      "模块化通信"
    ],
    "title": "Prism 使用心得有哪些？事件聚合器与治理“事件地狱”避坑",
    "summary": "1. **核心价值三要点**：模块化动态注册（`IModule`）、区域解耦动态装配（`RegionManager`）、以及基于弱引用的事件总线（`EventAggregator`）。\n2. **弱引用防泄漏本质**：传统 .NET 事件强引用订阅者容易引发内存泄漏，Prism 的 `PubSubEvent` 内部基于 `WeakReference` 维护订阅列表，ViewModel 销毁时无需手动注销也不会引发泄漏。\n3. **避坑与反思（治理事件地狱）**：严禁把 EventAggregator 当作全能共享数据中枢！过度使用会导致“发散式通信、调用链断裂、难以断点排查”。**原则：数据共享走单例服务（State Service）直接注入，唯有跨模块单向通知（如急停广播、主题切换）才走 EventAggregator**。",
    "detail": "### 1. 经典“事件地狱”坏味道 vs 正确治理\n- **错误坏味道（事件满天飞）**：\n  ViewModelA 发布 MotorSpeedChangedEvent，ViewModelB 订阅后修改参数再发布 PidAdjustEvent，ViewModelC 再次转发... 导致出现环形依赖与不可预料的并发竞争时序。\n- **最佳治理范式**：\n  建立统一的 `IMotionStateService`（单例状态机），所有轴状态集中管理并暴露响应式属性。EventAggregator 仅保留极少数系统级全局事件：`EmergencyStopEvent`、`UserLoginChangedEvent`。",
    "practice": "在步态测控上位机研发初期，开发团队滥用 EventAggregator 进行相机帧、Modbus 采集点位与跑台速度的跨模块通知，导致每秒触发上千次事件分发，主线程频繁切入卡顿且难以单步 Debug。技术负责人执行架构治理：将高频数据流收归到专用的 GaitDataStreamService 响应式数据流服务中，仅保留“急停硬件联锁”走事件聚合器广播，系统架构瞬间清爽，消息吞吐延迟从 40ms 降至 2ms。",
    "follow_ups": [
      "Q: Prism 的 PubSubEvent 订阅时，ThreadOption 有哪几种？（答：PublisherThread 发布者同线程、UIThread 自动调度到主 UI 线程、BackgroundThread 线程池异步执行；工控界面更新必须指定 ThreadOption.UIThread）",
      "Q: Prism 的 ViewModelLocator 是如何找到对应的 ViewModel 的？（答：默认通过命名约定规则，将 Views.FooView 映射为 ViewModels.FooViewModel 并通过 DI 容器自动解析注入）"
    ]
  },
  {
    "id": "WPF-08",
    "module": "WPF与工业桌面开发",
    "stars": 5,
    "tags": [
      "WPF",
      "架构重构",
      "多进程硬件隔离",
      "反应式编程Rx",
      "配置驱动",
      "HAL"
    ],
    "title": "如果现在让你重构这套步态测控系统，你觉得哪些架构还可以改进？",
    "summary": "1. **反思一：硬件与算法的“物理级多进程隔离”**：老架构将海康相机 C++ SDK、Python AI 推理全部塞在主 WPF 进程中，第三方非托管底层崩溃直接导致主软件闪退。重构必须将不稳定硬件驱动和高算力算法独立为守护进程，通过共享内存与命名管道进行 IPC 通信，主程序永远稳健运行。\n2. **反思二：引入反应式编程（System.Reactive / Rx）**：步态传感器、足底压力、相机时间戳本质上是高速“事件流”。老架构手工维护大量的并发队列与锁，代码臃肿；重构采用 Rx 的 `Sample`（降频采样）、`Buffer`（批量聚合）、`CombineLatest`（多源数据对齐），使数据流管线声明式极简。\n3. **反思三：配置驱动型硬件抽象（HAL）**：将具体厂商（海康/大华）和 PLC 寄存器地址从业务逻辑中彻底解耦，通过 JSON 拓扑配置 + DI 容器装配，实现现场换硬件 0 代码改动。",
    "detail": "### 1. 现代化工业上位机重构拓扑\n```\n┌────────────────────────────────────────────────────────┐\n│               主界面展示层 (WPF / MVVM)                 │\n│         - Prism 模块化 UI, WriteableBitmap 预览         │\n└───────────────────────────▲────────────────────────────┘\n                            │ (NamedPipe 异步 RPC + 共享内存)\n┌───────────────────────────▼────────────────────────────┐\n│          守护与驱动中枢进程 (Background Worker)          │\n│   ┌────────────────────────────────────────────────┐   │\n│   │   统一硬件抽象层 (HAL): ICamera / IMotion      │   │\n│   └────────────────────────────────────────────────┘   │\n│         │ (Rx 流式合并)              │ (P/Invoke)       │\n│         ▼                           ▼                   │\n│   [AI ONNX 算法引擎]          [海康 / 大华 / 伺服]     │\n└────────────────────────────────────────────────────────┘\n```",
    "practice": "在步态测控系统重构中，通过将“多路相机同步采集与落盘”剥离为独立运行的 Console 后台服务，主 WPF 仅作为监控客户端连接。在一次实验中，某相机固件因高温触发断线重连异常，若在老架构下主程序早已闪退，而在新架构下主界面仅弹窗提示“左侧相机离线”，后台驱动进程自动执行 3 次无感重连并恢复，实验数据丝毫无损。",
    "follow_ups": [
      "Q: 为什么工业上位机不推崇过度使用微服务，而更推荐单机多进程？（答：单机多进程既能实现物理崩溃隔离，又能利用本地共享内存达到微秒级低延迟，避免网络微服务带来的序列化开销与复杂网络拓扑运维成本）",
      "Q: 在 HAL 硬件抽象中，如何处理不同设备专有的高级特性（如海康相机的超清无损算法）？（答：采用特性查询模式或扩展接口模式，如 ((IHikExtension)camera)?.EnableSuperResolution()，不污染基础 ICamera 抽象接口）"
    ]
  },
  {
    "id": "WPF-09",
    "module": "WPF与工业桌面开发",
    "stars": 5,
    "tags": [
      "WPF",
      "MVVM落地痛点",
      "高频数据刷新",
      "工控弹窗抽象",
      "生命周期管理",
      "性能瓶颈"
    ],
    "title": "做 MVVM 设计开发的时候，有没有遇到哪些点，你觉得用这种前后端分离的设计比较难搞的？有没有印象深刻的点？",
    "summary": "1. **痛点一：高频数据流与 Binding 机制的性能冲突**：百赫兹传感器若每次都触发 `PropertyChanged`，WPF 属性反射与消息泵立即卡死。解法：ViewModel 内部做缓冲分频，数据采集归采集，UI 通知定时 30Hz 批量打包推送。\n2. **痛点二：多层工控模态弹窗与生命周期解耦**：ViewModel 不持有 View，但工控现场频繁需要急停确认、参数超限、回零交互弹窗。解法：抽象出 `IDialogService` 接口通过 DI 注入，异步返回结果 `var res = await _dialog.ShowConfirmAsync(...)`。\n3. **痛点三：长短生命周期失配引发内存泄漏**：短生命周期弹窗绑定了全局长生命周期通信服务事件未解绑，导致 View 永久无法释放。解法：弱事件模式、Prism 弱事件聚合器，或在 Unloaded 事件中规范注销。",
    "detail": "### 1. 弹窗服务抽象标准模式\n```csharp\npublic interface IDialogService {\n    Task<bool> ShowConfirmAsync(string title, string message);\n    Task ShowAlarmModalAsync(AlarmLevel level, string errorDetail);\n}\n\n// ViewModel 中完全不依赖具体的 Window / MessageBox\npublic class MainViewModel : BindableBase {\n    private readonly IDialogService _dialog;\n    public MainViewModel(IDialogService dialog) => _dialog = dialog;\n\n    public async Task OnEmergencyStopTriggered() {\n        bool confirm = await _dialog.ShowConfirmAsync(\"急停确认\", \"是否立即切断伺服动力电？\");\n        if (confirm) ExecuteHardwareCutoff();\n    }\n}\n```",
    "practice": "在医疗测控上位机研发中，新手工程师在 ViewModel 中直接 new ErrorAlertWindow().ShowDialog()，导致该 ViewModel 强引用了具体的 WPF 窗口类，无法进行脱机单元测试，且在自动化测试流水线上直接挂死。重构为 IDialogService 后，单元测试中只需用 Moq 模拟注入 Mock<IDialogService>，直接模拟用户点击“确定”或“取消”，实现了 100% 自动化的工控业务逻辑测试。",
    "follow_ups": [
      "Q: MVVM 模式下，自定义绘图控件（如足底压力热力图）如何与 ViewModel 高效交互？（答：不要用海量小控件做 Binding，而是在控件内暴露单个依赖属性绑定后，重写控件的 OnRender 使用 DrawingContext 直接绘制，将性能提升百倍）",
      "Q: 密码输入框 PasswordBox 为什么不支持直接 Text 绑定？在 MVVM 中如何安全处理？（答：PasswordBox 出于安全考虑不将明文暴露为依赖属性，工控安全做法是使用附加属性绑定 SecureString，或者在登录命令执行时通过参数 CommandParameter 传递密码控件自身）"
    ]
  }
];
