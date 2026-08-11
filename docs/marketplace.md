# uTools 应用市场素材

## 基本信息

- 应用名称：JSON 解构
- 一句话简介：一键递归展开多层转义的 JSON 对象和数组。
- 首版说明：支持复制文本直接唤起、左右对照、自动复制、嵌套错误路径提示以及深浅主题。

## 应用介绍与用户手册

JSON 解构用于递归展开多层转义的 JSON 对象和数组，以左右对照方式展示原文与格式化结果。你可以在 uTools 中输入“JSON 解构”或“递归解析 JSON”打开插件，粘贴或编辑内容后点击“解构并复制”；也可以先在任意应用复制 JSON，呼出 uTools 并选择“递归解构 JSON”，让插件直接接收、处理所复制的文本。

处理成功后，结果会自动写入剪贴板；若系统剪贴板不可用，结果仍会显示，可点击“复制结果”或手动复制。插件仅接受严格 JSON，不支持 JSON5、注释、单引号、尾逗号或 JavaScript 对象字面量。

macOS 使用 `Command+Enter` 执行、`Command+Shift+C` 复制结果；Windows/Linux 使用 `Ctrl+Enter` 执行、`Ctrl+Shift+C` 复制结果。所有处理均在设备本地完成，不联网，不上传、存储、记录或分享输入；详见 [`docs/privacy.md`](privacy.md)。

## 截图清单

- 处理前后的左右对照界面。
- 复制文本后自动处理并显示成功状态。
- 含嵌套错误路径的警告界面。

## 提交检查清单

- [x] 运行 `npm test` 并确认全部测试通过。
- [x] 运行 `npm run build:release` 重新生成发布目录。
- [x] 确认 `release/utools-json-unwrapper` 只包含 `plugin.json`、`index.html`、`styles.css`、`src/app.js`、`src/json-unwrapper.js`、`src/utools-adapter.js` 和 `assets/logo.png`。
- [ ] 在 uTools 开发者工具中选择 `release/utools-json-unwrapper` 目录进行打包或发布。
- [ ] 完成 macOS 基本冒烟测试。
- [ ] 完成 Windows 基本冒烟测试；若暂时无法验证，在发布说明中明确注明。
- [x] 备齐 Logo、一句话简介、版本说明和用户手册。
- [ ] 备齐截图。
- [x] `package.json` 中的版本号 `1.0.0` 符合语义化版本规范（SemVer）；UPXS 包及应用市场中的版本号仍待生成/发布时核验。

## 当前验证状态

- 自动化证据基于提交 `9e6f823`，验证日期为 2026-08-11：`npm test` 共 19 项通过、0 项失败、0 项跳过；发布构建成功且目录仅包含清单中的 7 个运行时文件；源码与发布版清单入口/Logo 路径有效；运行时与构建 JavaScript 语法检查及 `git diff --check` 均通过。
- 代表性命令行探针调用 `unwrapJsonText` 检查了：顶层及字段内的多层 JSON 字符串展开、输入 `{"outer":{"bad":"{\"x\":]"}}` 时的 `$.outer.bad` 嵌套错误路径、`"42"`/`"true"`/`"null"`/`"hello"` 等字段字符串保持不变，以及 `maxDepth: 1` 时在 `$.a` 报告深度限制。
- 安全检查仅为对发布文件进行有限的静态字符串/API 检查：未发现网络、持久化、分析接口或明显密钥模式；该结果不等同于完整安全审计。
- 已生成发布目录：`release/utools-json-unwrapper`。
- 本机只读检查发现 `/Applications/uTools.app`，但尚未实际验证 uTools 开发者工具挂载、uTools 中的自动剪贴板行为、macOS/Windows 运行时冒烟、UPXS 生成与安装（含 UPXS/应用市场版本号）、截图，以及账号提交与审核。
