# JSON 编辑器 for uTools

一款完全本地运行的 uTools JSON 工作台，用于编辑、格式化并递归展开被转义的 JSON 对象和数组。

## 功能

- 递归展开对象、数组及其中多层字符串化的 JSON 对象和数组。
- 从 uTools 文本入口进入或向空编辑器粘贴完整 JSON 时自动递归解析并格式化。
- CodeMirror 编辑器提供行号、语法高亮、节点折叠、搜索、撤销和实时 JSON 校验。
- 提供递归解析、2 空格格式化、压缩、单层转义与去转义；转义操作优先处理选区。
- 解析和复制相互独立，只有显式复制时才写入剪贴板。
- 兼容 JSON 字符串内部的非标准单字符转义，例如 URL 中的 `\&`。
- 不限制输入字符长度；递归展开仍保留 100 层安全上限。
- 保留无法解析的嵌套字符串，并以 JSONPath 风格路径显示警告。
- 响应系统深浅主题和窄窗口工具栏布局。
- 编辑器依赖全部打包在本地，不联网，不上传、存储或记录输入。

插件优先采用严格 JSON 语法；严格解析失败时，仅兼容字符串内部的非标准单字符转义。插件不支持 JSON5、JavaScript 对象字面量、注释、单引号或尾逗号。字符串形式的数字、布尔值和 `null` 不会转换为原始类型。

## 使用方法

插件提供两种自动入口：

1. 在 uTools 中输入“JSON 编辑器”“JSON 格式化”或“JSON 解构”打开插件，在空编辑器粘贴完整 JSON；插件会自动递归解析并格式化。
2. 在任意应用复制 JSON 文本，呼出 uTools，选择“使用 JSON 编辑器打开”；插件会直接接收并自动解析文本。

解析后可以继续直接编辑。手动编辑只实时校验，不会自动重排内容；需要再次递归展开时点击“递归解析”。点击“复制”才会写入剪贴板。

格式化和压缩处理整个文档且不会展开字符串化字段。转义/去转义在有选区时处理选区，否则处理整个文档，每次只增加或移除一层。

如果某段嵌套字符串看起来像对象或数组却不是有效 JSON，其他字段仍会继续处理，警告区会标出对应路径。复制失败时，结果仍会显示，可手动选择复制。

快捷键：

- macOS：`Command+Enter` 执行，`Command+Shift+C` 复制结果。
- Windows/Linux：`Ctrl+Enter` 执行，`Ctrl+Shift+C` 复制结果。
- 搜索：`Command/Ctrl+F`，使用 `Enter`/`Shift+Enter` 切换匹配项。

## 本地预览

在项目根目录运行：

```bash
npm install
npm run build:app
python3 -m http.server 4173
```

然后访问 `http://localhost:4173`。普通浏览器没有 uTools 剪贴板 API，因此可以预览和处理内容；点击“复制”时会提示手动复制。

## 运行测试

项目需要 Node.js 18 或更高版本：

```bash
npm test
```

## 接入 uTools

源码开发时，先运行 `npm run build:app`，再打开 uTools 开发者工具，创建或接入项目并选择项目根目录下的 `plugin.json`。分别验证功能指令入口、复制文本入口、自动粘贴解析、编辑校验、全部工具、显式复制、快捷键和深浅主题。

## 打包 UPXS

先在项目根目录生成干净的发布目录：

```bash
npm run build:release
```

该命令先用 esbuild 将 CodeMirror 和应用源码打进本地 `dist/app.js`，再替换 `release/utools-json-unwrapper`。发布目录只包含 `plugin.json`、`index.html`、`styles.css`、`dist/app.js` 和 PNG Logo，不包含依赖目录、测试、开发文档或源码模块。`package.json` 中的 `1.0.0` 仅是源码包的参考版本，发布目录本身不嵌入版本号。在 uTools 开发者工具中选择 `release/utools-json-unwrapper/plugin.json`，按离线包或应用市场流程继续操作。

## 发布到应用市场

应用名称、简介、首版说明、截图方案和提交检查项见 [`docs/marketplace.md`](docs/marketplace.md)。发布前重新运行 `npm run build:release`，在 uTools 开发者工具中选择 `release/utools-json-unwrapper` 目录，手动设置并确认本次应用市场版本，准备 Logo、介绍、版本说明、用户手册和截图，填写发布信息并提交审核；只有审核通过后，插件才会进入应用市场。

隐私说明见 [`docs/privacy.md`](docs/privacy.md)。
