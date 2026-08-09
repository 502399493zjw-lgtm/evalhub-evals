# assets

本目录不复制二进制素材。平台封面或品牌位应引用作者在 `libtv.md` 发布的权威透明 Logo：

```text
https://libtv.md/assets/logo-zangai-text.png
sha256 e3bf841329f81c1f4b269f930299306cbc9a614a030049ba5e9369ad65a02086
4477 × 3519 RGBA PNG
```

该文件与工作区权威素材 `/Users/xixiangyu/dev/MG动画复刻测试/素材/logo.png` 的 sha256 完全一致，按视觉规范使用 `logo-only` 模式：不附加模型版本、角标卡片、边框、发光或其他重绘。

重要边界：Logo 不是评测证据，不得写入 `detail_profile.figures` 或显示成“原始图表”。当前 EvalHub 投稿 schema 没有封面字段；平台若要替换默认绿色机台，应在应用自身的 slug 封面映射中为 `zangai-bench` 配置上面的权威 URL，并在机台屏幕内使用 `object-fit: contain`。详情页其余部分只使用可回溯到题目、评分器与作者官网的文本、事实表和官方成绩数据；没有为了填充模块而生成示意图、截图或推测性曲线。
