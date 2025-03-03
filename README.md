# 图片分析API服务

这是一个基于通义千问视觉大模型的图片分析API服务，可以分析图片内容并返回描述结果。

## 功能特点

- 支持单张图片分析和批量图片分析
- 支持自定义提问内容
- 支持PNG、JPEG、WEBP格式图片
- 提供RESTful API接口
- 包含Python客户端示例

## 安装依赖

```bash
pip install flask openai requests
```

## 运行服务器

```bash
# 设置API密钥环境变量（可选）
export DASHSCOPE_API_KEY=your-api-key

# 启动服务器
python app.py
```

服务器默认在 http://localhost:5000 运行。

## API接口

### 1. 分析单张图片

**请求**:
- URL: `/api/analyze`
- 方法: `POST`
- 内容类型: `multipart/form-data`
- 参数:
  - `image`: 图片文件
  - `prompt`: 提问内容（可选，默认为"图中描绘的是什么景象?"）
  - `api_key`: API密钥（可选，如果服务器已配置环境变量）

**响应**:
```json
{
    "success": true,
    "result": "分析结果文本"
}
```

### 2. 批量分析图片

**请求**:
- URL: `/api/analyze_batch`
- 方法: `POST`
- 内容类型: `multipart/form-data`
- 参数:
  - `images`: 多个图片文件
  - `prompt`: 提问内容（可选，默认为"图中描绘的是什么景象?"）
  - `api_key`: API密钥（可选，如果服务器已配置环境变量）

**响应**:
```json
{
    "success": true,
    "results": [
        {
            "filename": "image1.jpg",
            "result": "第一张图片的分析结果"
        },
        {
            "filename": "image2.jpg",
            "result": "第二张图片的分析结果"
        }
    ]
}
```

## 使用客户端示例

提供了一个Python客户端示例，可以方便地调用API服务。

### 分析单张图片

```bash
python client_example.py --api-key your-api-key path/to/image.jpg
```

### 批量分析图片

```bash
python client_example.py --api-key your-api-key --batch path/to/image1.jpg path/to/image2.jpg
```

### 自定义提问内容

```bash
python client_example.py --api-key your-api-key --prompt "这张图片中有哪些物体?" path/to/image.jpg
```

### 指定输出目录

```bash
python client_example.py --api-key your-api-key --output results path/to/image.jpg
```

## 注意事项

- API密钥可以通过环境变量 `DASHSCOPE_API_KEY` 设置，或者在请求中提供
- 大图片可能需要较长处理时间
- 服务器会临时保存上传的图片，处理完成后会自动删除
- 默认情况下，服务器在开发模式下运行，生产环境请关闭调试模式

## 许可证

MIT许可证 