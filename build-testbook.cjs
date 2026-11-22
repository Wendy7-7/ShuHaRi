// 把测试书 Markdown 渲染为可打印 HTML（浅色主题，适合发给测试者/打印）
const fs = require("fs");
const path = require("path");
const { marked } = require("./node_modules/marked");

const mdPath = path.join(__dirname, "测试书-LearnPlatform-v1.0.md");
const htmlPath = path.join(__dirname, "测试书-LearnPlatform-v1.0.html");
const md = fs.readFileSync(mdPath, "utf8");
const body = marked.parse(md);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>LearnPlatform 测试书 v1.0</title>
<style>
  :root { --ink: #1f2328; --muted: #57606a; --line: #d0d7de; --bg: #ffffff; --soft: #f6f8fa; --accent: #0969da; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; max-width: 900px; padding: 48px 40px 80px;
    font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
    color: var(--ink); background: var(--bg); line-height: 1.75; font-size: 15px;
  }
  h1 { font-size: 28px; border-bottom: 3px solid var(--accent); padding-bottom: 10px; }
  h2 { font-size: 21px; margin-top: 42px; padding-left: 10px; border-left: 5px solid var(--accent); }
  h3 { font-size: 17px; margin-top: 28px; color: #30363d; }
  p { margin: 10px 0; }
  blockquote { margin: 14px 0; padding: 10px 16px; background: var(--soft); border-left: 4px solid var(--accent); color: var(--muted); }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13.5px; }
  th, td { border: 1px solid var(--line); padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: var(--soft); font-weight: 600; }
  tr:nth-child(even) td { background: #fbfcfd; }
  code { background: #eff1f3; border-radius: 4px; padding: 1px 5px; font-size: 12.5px; font-family: Consolas, monospace; }
  pre { background: var(--soft); border: 1px solid var(--line); border-radius: 6px; padding: 14px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  hr { border: none; border-top: 1px dashed var(--line); margin: 34px 0; }
  li { margin: 4px 0; }
  input[type="checkbox"] { margin-right: 6px; }
  @media print {
    body { padding: 0; font-size: 12.5px; max-width: none; }
    h2 { page-break-after: avoid; }
    table, pre, blockquote { page-break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
${body}
</body>
</html>
`;

fs.writeFileSync(htmlPath, html);
console.log("HTML 已生成:", htmlPath, (html.length / 1024).toFixed(0) + "KB");
