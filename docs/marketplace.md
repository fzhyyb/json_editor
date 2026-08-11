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

- [ ] 运行 `npm test` 并确认全部测试通过。
- [ ] 运行 `npm run build:release` 重新生成发布目录。
- [ ] 确认 `release/utools-json-unwrapper` 只包含 `plugin.json`、`index.html`、`styles.css`、`src/app.js`、`src/json-unwrapper.js`、`src/utools-adapter.js` 和 `assets/logo.png`。
- [ ] 在 uTools 开发者工具中选择 `release/utools-json-unwrapper` 目录进行打包或发布。
- [ ] 完成 macOS 基本冒烟测试。
- [ ] 完成 Windows 基本冒烟测试；若暂时无法验证，在发布说明中明确注明。
- [ ] 备齐 Logo、一句话简介、版本说明、用户手册和截图。
- [ ] 版本号遵循语义化版本规范（SemVer）。
