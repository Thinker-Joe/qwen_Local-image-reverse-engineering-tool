import requests
import os
import json
import argparse

def analyze_single_image(api_url, image_path, prompt=None, api_key=None):
    """
    分析单张图片
    
    @param {string} api_url - API服务地址
    @param {string} image_path - 图片文件路径
    @param {string} prompt - 提问内容（可选）
    @param {string} api_key - API密钥（可选）
    @return {dict} - API响应
    """
    # 准备请求数据
    files = {'image': open(image_path, 'rb')}
    data = {}
    
    if prompt:
        data['prompt'] = prompt
    
    if api_key:
        data['api_key'] = api_key
    
    # 发送请求
    response = requests.post(f"{api_url}/api/analyze", files=files, data=data)
    
    # 关闭文件
    files['image'].close()
    
    # 返回结果
    return response.json()

def analyze_batch_images(api_url, image_paths, prompt=None, api_key=None):
    """
    批量分析图片
    
    @param {string} api_url - API服务地址
    @param {list} image_paths - 图片文件路径列表
    @param {string} prompt - 提问内容（可选）
    @param {string} api_key - API密钥（可选）
    @return {dict} - API响应
    """
    # 准备请求数据
    files = [('images', open(path, 'rb')) for path in image_paths]
    data = {}
    
    if prompt:
        data['prompt'] = prompt
    
    if api_key:
        data['api_key'] = api_key
    
    # 发送请求
    response = requests.post(f"{api_url}/api/analyze_batch", files=files, data=data)
    
    # 关闭文件
    for _, file in files:
        file.close()
    
    # 返回结果
    return response.json()

def save_results(results, output_dir='.'):
    """
    保存分析结果到文件
    
    @param {dict|list} results - 分析结果
    @param {string} output_dir - 输出目录
    """
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    if isinstance(results, list):
        # 批量结果
        for item in results:
            if 'filename' in item and 'result' in item:
                filename = os.path.splitext(item['filename'])[0] + '.txt'
                output_path = os.path.join(output_dir, filename)
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(item['result'])
                print(f"结果已保存到: {output_path}")
    else:
        # 单个结果
        if 'result' in results:
            output_path = os.path.join(output_dir, 'result.txt')
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(results['result'])
            print(f"结果已保存到: {output_path}")

def main():
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='图片分析客户端')
    parser.add_argument('--api-url', default='http://localhost:5000', help='API服务地址')
    parser.add_argument('--api-key', help='API密钥')
    parser.add_argument('--prompt', default='图中描绘的是什么景象?', help='提问内容')
    parser.add_argument('--output', default='.', help='结果输出目录')
    parser.add_argument('--batch', action='store_true', help='批量处理模式')
    parser.add_argument('images', nargs='+', help='图片文件路径')
    
    args = parser.parse_args()
    
    try:
        if args.batch:
            # 批量处理模式
            print(f"正在批量分析 {len(args.images)} 张图片...")
            response = analyze_batch_images(args.api_url, args.images, args.prompt, args.api_key)
            
            if response.get('success'):
                print("分析成功!")
                save_results(response.get('results', []), args.output)
            else:
                print(f"分析失败: {response.get('error', '未知错误')}")
        else:
            # 单张处理模式
            if len(args.images) > 1:
                print("警告: 在非批量模式下只会处理第一张图片。使用 --batch 参数进行批量处理。")
            
            image_path = args.images[0]
            print(f"正在分析图片: {image_path}")
            response = analyze_single_image(args.api_url, image_path, args.prompt, args.api_key)
            
            if response.get('success'):
                print("分析成功!")
                save_results(response, args.output)
                print(f"分析结果: {response.get('result')}")
            else:
                print(f"分析失败: {response.get('error', '未知错误')}")
    
    except Exception as e:
        print(f"发生错误: {str(e)}")

if __name__ == '__main__':
    main() 