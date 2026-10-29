# 项目视觉系统：fixture 对照与组件验收

Figma 文件：<https://www.figma.com/design/wbcGZwxsUSTjA3oALLEaBX>。基准来自当前工作树 HEAD `81480c73ef17d49936b4adf9571d40f60b595c95` 加未提交变更，采集依据与逐文件哈希见 [verification.txt](../site-system-source/verification.txt) 和 [manifest.json](../site-system-source/manifest.json)。源画面为真实 React 组件、Chromium 156/DPR 1、fixture HTTP 响应；不是后端登录联调。390px 为桌面浏览器窄视口，不是 iOS/Safari 实机。

Fixture 为 Application 空间、Feedback tester / feedback@example.test、普通 user；没有 Administration/Platform。Todo 为 Review the visual system、Verify shared components（已完成）、Check mobile layout。

## 同条件整页对照

| 页面 | 当前代码源图 | Figma 截图 | Figma frame |
|---|---|---|---|
| 首页 1440 dark | [源图](../site-system-source/home-1440x1000-dark.png) | [Figma](fixture-home-1440-dark.png) | [节点](https://www.figma.com/design/wbcGZwxsUSTjA3oALLEaBX?node-id=18-3048) |
| 首页 1440 light | [源图](../site-system-source/home-1440x1000-light.png) | [Figma](fixture-home-1440-light.png) | [节点](https://www.figma.com/design/wbcGZwxsUSTjA3oALLEaBX?node-id=18-3303) |
| 首页 390 dark | [源图](../site-system-source/home-390x1000-dark.png) | [Figma](fixture-home-390-dark.png) | [节点](https://www.figma.com/design/wbcGZwxsUSTjA3oALLEaBX?node-id=18-3566) |
| 首页 390 light | [源图](../site-system-source/home-390x1000-light.png) | [Figma](fixture-home-390-light.png) | [节点](https://www.figma.com/design/wbcGZwxsUSTjA3oALLEaBX?node-id=18-3569) |
| Todo 1440 dark | [源图](../site-system-source/todos-1440x1000-dark.png) | [Figma](fixture-todos-1440-dark.png) | [节点](https://www.figma.com/design/wbcGZwxsUSTjA3oALLEaBX?node-id=18-3646) |
| Todo 1440 light | [源图](../site-system-source/todos-1440x1000-light.png) | [Figma](fixture-todos-1440-light.png) | [节点](https://www.figma.com/design/wbcGZwxsUSTjA3oALLEaBX?node-id=18-3956) |
| 搜索弹层 1440 dark | [源图](../site-system-source/search-dialog-1440x1000-dark.png) | [Figma](fixture-search-dialog-1440-dark.png) | [节点](https://www.figma.com/design/wbcGZwxsUSTjA3oALLEaBX?node-id=20-3563) |

逐张按全视口目视核对了导航和身份、侧栏与 inset、顶栏、卡片、列表和分页。桌面 inset 实例为 x=256、y=8、1176×984，顶栏 64px；首页卡片为 x=272、y=96、365×298；移动卡片为 x=16、y=88、358×294；Todo 内容为 x=272、宽 1144，右侧到 x=1416。卡片只有一个 Todo，鼠标双击、触屏和键盘行为在组件说明中保留。桌面 light inset 使用背景变量、radius-xl 和 shadow-sm；主题按钮按语义模式显示 Sun/Moon。

移动搜索稳定态是 40×36px。旧宽图由 150ms 宽度过渡的中间帧复现，不代表当前稳定尺寸。详见源 `verification.txt`。

## 可复用性核验

- 文件有 141 个变量、297 个组件（包含变体和图标）、23 个组件集、7 个文本样式、4 个效果样式。默认语义模式为 Dark，另有 Light。
- 首页 frame 的 Sidebar、Header、Sidebar Inset、Tool Card 均为本地主组件实例；Todo 列表、输入框、按钮、复选框和图标使用本地实例。页面文字和布局容器可编辑，没有以整页截图填充。
- Inset 背景绑定 `background`、圆角绑定 `radius-xl`、效果为 `shadow-sm`；卡片绑定 `card`、`border`、`radius-xl` 和 `shadow-sm`。Button/Input 状态表见 [dark](fixture-controls-dark.png) 和 [light](fixture-controls-light.png)。暗色输入背景透明度解析为白色 4.5%，outline hover 为 7.5%；focus ring 为 ring 50%，invalid ring 为 light destructive 20% / dark 40%。
- 四个规范 Button 尺寸集各有六种样式及 default/hover/focus/disabled/invalid。通过实例属性逐一切换全部 120 个组合，未发现缺失；Select 的两尺寸 × 四状态共八个组合也逐一切换成功。旧 Button 集保留供已有实例兼容，新设计应使用各尺寸集。
- 可逆传播测试：把 `space-6` 从 24 临时改为 25，首页卡片实例 padding 从 24 变为 25；恢复后回到 24。将卡片主组件标题临时改为 `Todos QA`，页面实例同步，恢复后为 `Todos`。

基础组件和视觉样本的验收与完整业务原型是两件事：本次未制作完整导航、弹层和 Todo 业务原型。组件说明记录了源码行为；不能把 Figma 单击模拟当作桌面鼠标双击。没有声称社区库主组件引用或 Code Connect 映射。Figma 使用 Inter，浏览器使用 Inter Variable；字体栅格化、导航字重观感、中文系统 fallback 和抗锯齿可能有细微差异，本次目视对照不声称逐像素相同。
