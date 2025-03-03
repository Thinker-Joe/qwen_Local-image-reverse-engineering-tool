# OldX图片反推工具

一个基于通义千问视觉大模型的图片分析工具，提供直观的Web界面和API服务，可以分析图片内容并生成详细描述。

## 功能特点

- **多模型支持**：支持多种通义千问视觉模型（Max、Plus、2.5系列等）
- **批量处理**：支持同时分析多张图片
- **自定义提示词**：可自定义提问内容，默认为英文详细描述
- **会话恢复**：支持浏览器刷新后恢复之前的分析会话
- **自动保存**：自动保存分析结果为文本文件和ZIP压缩包
- **防止刷新**：任务进行中自动防止页面意外刷新
- **友好界面**：拖放上传、进度显示、结果预览
- **RESTful API**：提供完整的API接口，方便集成

## 安装说明

### 系统要求
- Python 3.8 或更高版本
- 现代浏览器（Chrome、Firefox、Edge等）

### 安装依赖

```bash
pip install flask==2.3.3 requests==2.31.0
```

或使用项目提供的启动脚本自动设置环境：

- **Windows**：双击 `start.bat`
- **Linux/Mac**：执行 `./start.sh`

## 使用说明

### 启动服务器

1. 使用启动脚本（推荐）：
   - Windows: 双击运行 `start.bat`
   - Linux/Mac: 执行 `./start.sh`

2. 手动启动：
   ```bash
   # 设置API密钥环境变量（可选）
   export DASHSCOPE_API_KEY=your-api-key
   
   # 启动服务器
   python app.py
   ```

服务器默认在以下地址运行：
- http://127.0.0.1:5000
- http://[本机IP]:5000（局域网访问）

### Web界面使用

1. **设置API密钥**：
   - 在界面顶部输入您的通义千问API密钥并保存
   - API密钥将保存在浏览器本地存储中，不会发送到其他服务器

2. **选择模型**：
   - 从下拉菜单中选择合适的模型
   - 可选模型包括：通义千问VL Max、Plus、2.5系列等

3. **自定义提示词**：
   - 默认提示词为英文详细描述
   - 可根据需要自定义提示词内容

4. **上传图片**：
   - 拖放图片到上传区域，或点击选择文件
   - 支持PNG、JPEG、WEBP格式
   - 支持批量上传多张图片

5. **开始分析**：
   - 点击"开始分析"按钮
   - 显示处理进度和实时状态

6. **查看结果**：
   - 每张图片的分析结果会显示在右侧
   - 可展开/收起查看完整内容
   - 可下载单个结果或所有结果

7. **会话管理**：
   - 刷新页面后可恢复之前的会话
   - 任务进行中会自动保护页面防止意外刷新

## API接口

### 1. 分析单张图片

**请求**:
- URL: `/api/analyze`
- 方法: `POST`
- 内容类型: `multipart/form-data`
- 参数:
  - `image`: 图片文件
  - `prompt`: 提示词（可选）
  - `api_key`: API密钥（可选）
  - `model`: 模型名称（可选，默认为"qwen-vl-max-latest"）

**响应**:
```json
{
    "success": true,
    "result": "分析结果文本",
    "input_tokens": 123,
    "output_tokens": 456
}
```

### 2. 批量分析图片

**请求**:
- URL: `/api/analyze_batch`
- 方法: `POST`
- 内容类型: `multipart/form-data`
- 参数:
  - `images`: 多个图片文件
  - `prompt`: 提示词（可选）
  - `api_key`: API密钥（可选）
  - `model`: 模型名称（可选，默认为"qwen-vl-max-latest"）

**响应**:
```json
{
    "success": true,
    "results": [
        {
            "filename": "image1.jpg",
            "result": "第一张图片的分析结果",
            "input_tokens": 123,
            "output_tokens": 456
        },
        {
            "filename": "image2.jpg",
            "result": "第二张图片的分析结果",
            "input_tokens": 789,
            "output_tokens": 321
        }
    ]
}
```

### 3. 保存结果

**请求**:
- URL: `/api/save_result`
- 方法: `POST`
- 内容类型: `multipart/form-data`
- 参数:
  - `file`: 文件内容
  - `folder`: 保存文件夹（可选）

**响应**:
```json
{
    "success": true,
    "path": "保存路径"
}
```

## Python客户端示例

提供了一个Python客户端示例，可以方便地调用API服务：

```bash
# 分析单张图片
python client_example.py --api-key your-api-key path/to/image.jpg

# 批量分析图片
python client_example.py --api-key your-api-key --batch path/to/image1.jpg path/to/image2.jpg

# 自定义提示词
python client_example.py --api-key your-api-key --prompt "这张图片中有哪些物体?" path/to/image.jpg

# 指定输出目录
python client_example.py --api-key your-api-key --output results path/to/image.jpg
```

## 注意事项

- **API密钥**：需要通义千问平台的API密钥，可通过环境变量设置或在界面输入
- **资源消耗**：大图片和高分辨率图片可能需要较长处理时间
- **结果保存**：分析结果会保存在`output`目录下，每次任务创建独立文件夹
- **会话状态**：浏览器刷新后可恢复会话，但关闭浏览器后会话将丢失
- **并发限制**：基于API调用频率，建议批量处理时使用合理的批量大小

## 开发者信息

- **作者**：OldX
- **B站**：AI-老X
- **版本**：1.0.0

## 许可证

MIT许可证 