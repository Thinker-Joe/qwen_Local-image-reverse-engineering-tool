from flask import Flask, request, jsonify, send_from_directory, redirect
import os
import base64
import tempfile
import uuid
import requests
import json
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_url_path='', static_folder='.')

# base64 编码格式
def encode_image(image_path):
    """
    将图片文件编码为Base64格式
    
    @param {string} image_path - 图片文件路径
    @return {string} - Base64编码后的图片数据
    """
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def analyze_image(image_path, prompt="图中描绘的是什么景象?", api_key=None, model="qwen-vl-max-latest"):
    """
    分析图片内容
    
    @param {string} image_path - 图片文件路径
    @param {string} prompt - 提问内容
    @param {string} api_key - API密钥
    @param {string} model - 使用的模型名称
    @return {dict} - 包含分析结果和token计数的字典
    """
    # 获取图片格式
    image_format = "png"  # 默认格式
    if image_path.lower().endswith(('.jpg', '.jpeg')):
        image_format = "jpeg"
    elif image_path.lower().endswith('.webp'):
        image_format = "webp"
    
    logger.info(f"处理图片: {os.path.basename(image_path)}, 格式: {image_format}, 使用模型: {model}")
    
    # 编码图片
    base64_image = encode_image(image_path)
    logger.info(f"图片编码完成，大小: {len(base64_image) // 1024} KB")
    
    try:
        # 使用API密钥
        api_key = api_key or os.getenv('DASHSCOPE_API_KEY')
        if not api_key:
            logger.error("未提供API密钥")
            raise Exception("未提供API密钥，请设置DASHSCOPE_API_KEY环境变量或在请求中提供api_key参数")
        
        # 准备请求数据
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": [{"type":"text","text": "You are a helpful assistant."}]
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/{image_format};base64,{base64_image}"}
                        },
                        {"type": "text", "text": prompt}
                    ]
                }
            ]
        }
        
        logger.info(f"发送API请求，提问内容: {prompt}, 使用模型: {model}")
        
        # 发送请求
        response = requests.post(
            "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
            headers=headers,
            json=payload
        )
        
        # 检查响应
        if response.status_code != 200:
            error_detail = response.text
            logger.error(f"API请求失败，状态码: {response.status_code}, 响应: {error_detail}")
            try:
                error_json = response.json()
                if 'error' in error_json:
                    error_detail = error_json['error'].get('message', error_json['error'])
            except:
                pass
            raise Exception(f"API请求失败，状态码: {response.status_code}, 错误: {error_detail}")
        
        # 解析响应
        result = response.json()
        logger.info("API请求成功")
        
        # 提取token计数信息
        input_tokens = result.get('usage', {}).get('prompt_tokens', 0)
        output_tokens = result.get('usage', {}).get('completion_tokens', 0)
        
        logger.info(f"Token计数 - 输入: {input_tokens}, 输出: {output_tokens}")
        
        return {
            'result': result['choices'][0]['message']['content'],
            'input_tokens': input_tokens,
            'output_tokens': output_tokens
        }
        
    except Exception as e:
        # 记录详细错误信息
        error_message = f"API调用失败: {str(e)}"
        logger.error(error_message, exc_info=True)
        raise Exception(error_message)

@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    """
    API端点：分析上传的图片
    
    请求格式：
    - 使用multipart/form-data格式
    - 字段：
      - image: 图片文件
      - prompt: 提问内容（可选）
      - api_key: API密钥（可选）
      - model: 模型名称（可选）
    
    响应格式：
    {
        "success": true/false,
        "result": "分析结果",
        "input_tokens": 输入token数量,
        "output_tokens": 输出token数量,
        "error": "错误信息"（如果有）
    }
    """
    try:
        # 检查是否有文件上传
        if 'image' not in request.files:
            logger.warning("没有上传图片")
            return jsonify({"success": False, "error": "没有上传图片"}), 400
        
        file = request.files['image']
        if file.filename == '':
            logger.warning("没有选择图片")
            return jsonify({"success": False, "error": "没有选择图片"}), 400
        
        # 获取其他参数
        prompt = request.form.get('prompt', "图中描绘的是什么景象?")
        api_key = request.form.get('api_key', None)
        model = request.form.get('model', "qwen-vl-max-latest")
        
        logger.info(f"接收到分析请求，文件: {file.filename}, 提问: {prompt}, 模型: {model}")
        
        # 保存上传的文件到临时目录
        temp_dir = tempfile.gettempdir()
        temp_filename = f"{uuid.uuid4()}_{file.filename}"
        temp_path = os.path.join(temp_dir, temp_filename)
        file.save(temp_path)
        logger.info(f"图片已保存到临时文件: {temp_path}")
        
        try:
            # 分析图片
            result_data = analyze_image(temp_path, prompt, api_key, model)
            logger.info("图片分析成功")
            return jsonify({
                "success": True, 
                "result": result_data['result'],
                "input_tokens": result_data['input_tokens'],
                "output_tokens": result_data['output_tokens']
            })
        finally:
            # 删除临时文件
            if os.path.exists(temp_path):
                os.remove(temp_path)
                logger.info("临时文件已删除")
    
    except Exception as e:
        logger.error(f"处理请求时出错: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/analyze_batch', methods=['POST'])
def api_analyze_batch():
    """
    API端点：批量分析上传的图片
    
    请求格式：
    - 使用multipart/form-data格式
    - 字段：
      - images: 多个图片文件
      - prompt: 提问内容（可选）
      - api_key: API密钥（可选）
      - model: 模型名称（可选）
    
    响应格式：
    {
        "success": true/false,
        "results": [
            {
                "filename": "文件名",
                "result": "分析结果",
                "input_tokens": 输入token数量,
                "output_tokens": 输出token数量
            },
            ...
        ],
        "error": "错误信息"（如果有）
    }
    """
    try:
        # 检查是否有文件上传
        if 'images' not in request.files:
            return jsonify({"success": False, "error": "没有上传图片"}), 400
        
        files = request.files.getlist('images')
        if len(files) == 0 or files[0].filename == '':
            return jsonify({"success": False, "error": "没有选择图片"}), 400
        
        # 获取其他参数
        prompt = request.form.get('prompt', "图中描绘的是什么景象?")
        api_key = request.form.get('api_key', None)
        model = request.form.get('model', "qwen-vl-max-latest")
        
        logger.info(f"接收到批量分析请求，文件数量: {len(files)}, 提问: {prompt}, 模型: {model}")
        
        results = []
        temp_files = []
        
        try:
            # 保存所有上传的文件到临时目录
            for file in files:
                temp_dir = tempfile.gettempdir()
                temp_filename = f"{uuid.uuid4()}_{file.filename}"
                temp_path = os.path.join(temp_dir, temp_filename)
                file.save(temp_path)
                temp_files.append((file.filename, temp_path))
            
            # 分析图片
            for filename, temp_path in temp_files:
                try:
                    result_data = analyze_image(temp_path, prompt, api_key, model)
                    results.append({
                        "filename": filename, 
                        "result": result_data['result'],
                        "input_tokens": result_data['input_tokens'],
                        "output_tokens": result_data['output_tokens']
                    })
                except Exception as e:
                    results.append({
                        "filename": filename, 
                        "error": str(e),
                        "input_tokens": 0,
                        "output_tokens": 0
                    })
            
            return jsonify({"success": True, "results": results})
        
        finally:
            # 删除所有临时文件
            for _, temp_path in temp_files:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            logger.info("所有临时文件已删除")
    
    except Exception as e:
        logger.error(f"处理批量请求时出错: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/create_folder', methods=['POST'])
def api_create_folder():
    """
    API端点：创建任务文件夹
    
    请求格式：
    {
        "folder_name": "文件夹名称"
    }
    
    响应格式：
    {
        "success": true/false,
        "path": "文件夹路径",
        "error": "错误信息"（如果有）
    }
    """
    try:
        data = request.json
        folder_name = data.get('folder_name')
        
        if not folder_name:
            return jsonify({"success": False, "error": "未提供文件夹名称"}), 400
        
        # 确保文件夹名称安全
        folder_name = os.path.basename(folder_name)
        
        # 创建output文件夹（如果不存在）
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            logger.info(f"创建output文件夹: {output_dir}")
        
        # 创建任务文件夹
        task_dir = os.path.join(output_dir, folder_name)
        if not os.path.exists(task_dir):
            os.makedirs(task_dir)
            logger.info(f"创建任务文件夹: {task_dir}")
        
        return jsonify({
            "success": True,
            "path": task_dir
        })
    
    except Exception as e:
        logger.error(f"创建文件夹时出错: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/save_result', methods=['POST'])
def api_save_result():
    """
    API端点：保存结果文件
    
    请求格式：
    - 使用multipart/form-data格式
    - 字段：
      - file: 文件数据
      - folder: 文件夹名称
    
    响应格式：
    {
        "success": true/false,
        "path": "文件路径",
        "error": "错误信息"（如果有）
    }
    """
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "没有上传文件"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "没有选择文件"}), 400
        
        folder = request.form.get('folder', '')
        if not folder:
            return jsonify({"success": False, "error": "未提供文件夹名称"}), 400
        
        # 确保文件夹名称安全
        folder = os.path.basename(folder)
        
        # 确保output文件夹存在
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # 确保任务文件夹存在
        task_dir = os.path.join(output_dir, folder)
        if not os.path.exists(task_dir):
            os.makedirs(task_dir)
        
        # 保存文件
        filename = os.path.basename(file.filename)
        file_path = os.path.join(task_dir, filename)
        file.save(file_path)
        
        logger.info(f"文件已保存: {file_path}")
        
        return jsonify({
            "success": True,
            "path": file_path
        })
    
    except Exception as e:
        logger.error(f"保存文件时出错: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/')
def index():
    """
    返回主页
    """
    return app.send_static_file('index.html')

@app.route('/api-docs')
def api_docs():
    """
    返回API文档
    """
    return """
    <html>
    <head>
        <title>图片分析API</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            h2 { color: #444; margin-top: 20px; }
            h3 { color: #555; margin-top: 15px; }
            code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; font-family: monospace; }
            ul { padding-left: 20px; }
            li { margin-bottom: 5px; }
        </style>
    </head>
    <body>
        <h1>图片分析API</h1>
        
        <p>这是一个基于通义千问视觉大模型的图片分析API服务。</p>
        
        <h2>API端点</h2>
        
        <h3>1. 分析单张图片</h3>
        <code>POST /api/analyze</code>
        
        <p>请求参数（multipart/form-data）：</p>
        <ul>
            <li><strong>image</strong>: 图片文件</li>
            <li><strong>prompt</strong>: 提问内容（可选，默认为"图中描绘的是什么景象?"）</li>
            <li><strong>api_key</strong>: API密钥（可选，如果服务器已配置环境变量）</li>
            <li><strong>model</strong>: 模型名称（可选，默认为"qwen-vl-max-latest"）</li>
        </ul>
        
        <h3>2. 批量分析图片</h3>
        <code>POST /api/analyze_batch</code>
        
        <p>请求参数（multipart/form-data）：</p>
        <ul>
            <li><strong>images</strong>: 多个图片文件</li>
            <li><strong>prompt</strong>: 提问内容（可选，默认为"图中描绘的是什么景象?"）</li>
            <li><strong>api_key</strong>: API密钥（可选，如果服务器已配置环境变量）</li>
            <li><strong>model</strong>: 模型名称（可选，默认为"qwen-vl-max-latest"）</li>
        </ul>
        
        <h2>使用示例</h2>
        <pre>
curl -X POST http://localhost:5000/api/analyze \\
  -F "image=@/path/to/image.jpg" \\
  -F "prompt=描述这张图片中的主要内容" \\
  -F "api_key=your-api-key"
        </pre>
    </body>
    </html>
    """

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 