/**
 * 图片分析工具 - 主要JavaScript逻辑
 * 实现图片拖拽上传、Base64编码、API调用和结果处理
 */

// 全局变量
let uploadedFiles = []; // 存储上传的文件
let analysisResults = []; // 存储分析结果
let isProcessing = false; // 是否正在处理
let apiKey = localStorage.getItem('api_key') || '';
let selectedModel = localStorage.getItem('selected_model') || 'qwen-vl-max-latest'; // 默认模型
let customPrompt = localStorage.getItem('custom_prompt') || '';
let currentSortMethod = 'time'; // 当前排序方法：time（默认）、name、length
let currentFilter = 'all'; // 当前筛选条件：all（默认）、success、error
let shouldStopProcessing = false; // 是否应该停止处理
let resultsHeight = localStorage.getItem('results_height') || '600';
let batchSize = parseInt(localStorage.getItem('batch_size') || '1'); // 批量分析数量
let currentTaskFolder = ''; // 当前任务文件夹名称
let preventRefresh = false; // 是否阻止页面刷新

// 费用计算相关变量
let totalInputTokens = 0;
let totalOutputTokens = 0;
const modelRates = {
    'qwen-vl-max-latest': { input: 0.003, output: 0.009 },
    'qwen2.5-vl-7b-instruct': { input: 0.002, output: 0.005 },
    'qwen2.5-vl-72b-instruct': { input: 0.016, output: 0.048 },
    'qvq-72b-preview': { input: 0.012, output: 0.036 },
    'qwen-vl-plus': { input: 0.0015, output: 0.0045 }
};

// DOM元素
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const previewContainer = document.getElementById('preview-container');
const previewList = document.getElementById('preview-list');
const imageCount = document.getElementById('image-count');
const startButton = document.getElementById('start-analysis');
const stopButton = document.getElementById('stop-analysis');
const clearAllButton = document.getElementById('clear-all');
const resultsContainer = document.getElementById('results-container');
const resultsList = document.getElementById('results-list');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const downloadAllContainer = document.getElementById('download-all-container');
const downloadAllButton = document.getElementById('download-all');
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyButton = document.getElementById('save-api-key');
const apiKeyStatus = document.getElementById('api-key-status');
const modelSelect = document.getElementById('model-select');
const saveModelButton = document.getElementById('save-model');
const modelStatus = document.getElementById('model-status');
const customPromptInput = document.getElementById('custom-prompt');
const gridViewButton = document.getElementById('grid-view-btn');
const listViewButton = document.getElementById('list-view-btn');
const costContainer = document.getElementById('cost-container');
const inputTokensElement = document.getElementById('input-tokens');
const outputTokensElement = document.getElementById('output-tokens');
const inputCostElement = document.getElementById('input-cost');
const outputCostElement = document.getElementById('output-cost');
const totalCostElement = document.getElementById('total-cost');
const batchSizeInput = document.getElementById('batch-size');
let restorePrompt;
let discardSessionBtn;
let restoreSessionBtn;
let sessionIndicator;
let sessionIndicatorDot;
let sessionIndicatorText;

// 视图模式
let currentViewMode = 'grid'; // 'grid' 或 'list'
const AUTO_SWITCH_THRESHOLD = 20; // 自动切换到列表视图的图片数量阈值

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 检查localStorage中是否有保存的API密钥
    const savedApiKey = localStorage.getItem('api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        apiKey = savedApiKey;
        apiKeyStatus.textContent = '已加载保存的密钥';
        apiKeyStatus.classList.add('show');
        setTimeout(() => {
            apiKeyStatus.classList.remove('show');
        }, 3000);
    }
    
    // 检查localStorage中是否有保存的模型选择
    const savedModel = localStorage.getItem('selected_model');
    if (savedModel) {
        modelSelect.value = savedModel;
        selectedModel = savedModel;
        modelStatus.textContent = '已加载保存的模型选择';
        modelStatus.classList.add('show');
        setTimeout(() => {
            modelStatus.classList.remove('show');
        }, 3000);
    }
    
    // 加载用户偏好的视图模式
    const preferredView = localStorage.getItem('preferred_view');
    if (preferredView) {
        switchView(preferredView);
    }

    // 初始化拖放区域事件
    initDropArea();
    
    // 初始化按钮事件
    initButtons();

    initTheme();
    initResultsHeight();

    // 添加页面刷新保护
    initRefreshProtection();
});

/**
 * 初始化拖放区域的事件监听
 */
function initDropArea() {
    // 阻止默认拖放行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // 高亮显示拖放区域
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    // 取消高亮显示
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    // 处理拖放的文件
    dropArea.addEventListener('drop', handleDrop, false);
    
    // 处理文件选择
    fileInput.addEventListener('change', handleFiles, false);
    
    // 点击拖放区域触发文件选择，但排除已有file-input-label的点击
    dropArea.addEventListener('click', (e) => {
        // 检查点击事件是否发生在file-input-label或其子元素上
        if (!e.target.closest('.file-input-label')) {
            fileInput.click();
        }
    });
}

/**
 * 初始化按钮事件监听
 */
function initButtons() {
    // 保存API密钥
    saveApiKeyButton.addEventListener('click', () => {
        const newApiKey = apiKeyInput.value.trim();
        if (newApiKey) {
            localStorage.setItem('api_key', newApiKey);
            apiKey = newApiKey;
            apiKeyStatus.textContent = '已保存';
            apiKeyStatus.style.color = '#4caf50';
            apiKeyStatus.classList.add('show');
            setTimeout(() => {
                apiKeyStatus.classList.remove('show');
            }, 2000);
        }
    });
    
    // 保存模型选择
    saveModelButton.addEventListener('click', () => {
        const newModel = modelSelect.value;
        if (newModel) {
            localStorage.setItem('selected_model', newModel);
            selectedModel = newModel;
            modelStatus.textContent = '已保存';
            modelStatus.style.color = '#4caf50';
            modelStatus.classList.add('show');
            setTimeout(() => {
                modelStatus.classList.remove('show');
            }, 2000);
        }
    });
    
    // 批量分析数量
    batchSizeInput.addEventListener('change', () => {
        let value = parseInt(batchSizeInput.value);
        // 确保值在1-20之间
        if (isNaN(value) || value < 1) value = 1;
        if (value > 20) value = 20;
        
        batchSizeInput.value = value;
        localStorage.setItem('batch_size', value);
        batchSize = value;
    });
    
    // 初始化批量分析数量
    batchSizeInput.value = batchSize;
    
    // 开始分析
    startButton.addEventListener('click', startAnalysis);
    
    // 停止分析
    stopButton.addEventListener('click', stopAnalysis);
    
    // 清除所有图片
    clearAllButton.addEventListener('click', clearAll);
    
    // 下载所有结果
    downloadAllButton.addEventListener('click', () => downloadAllResults(true));
    
    // 视图切换按钮
    gridViewButton.addEventListener('click', () => switchView('grid'));
    listViewButton.addEventListener('click', () => switchView('list'));
}

/**
 * 阻止默认拖放行为
 * @param {Event} e - 事件对象
 */
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * 高亮显示拖放区域
 */
function highlight() {
    dropArea.classList.add('highlight');
}

/**
 * 取消高亮显示
 */
function unhighlight() {
    dropArea.classList.remove('highlight');
}

/**
 * 处理拖放的文件
 * @param {DragEvent} e - 拖放事件对象
 */
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files } });
}

/**
 * 处理文件上传
 * @param {Event} e - 事件对象
 */
function handleFiles(e) {
    let files = [];
    
    // 处理拖放事件
    if (e.dataTransfer) {
        files = e.dataTransfer.files;
    } 
    // 处理文件输入事件
    else if (e.target && e.target.files) {
        files = e.target.files;
    }
    
    if (files.length === 0) return;
    
    // 显示预览容器
    previewContainer.style.display = 'block';
    
    // 处理每个文件
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 检查文件类型
        if (!file.type.match('image.*')) {
            alert(`文件 "${file.name}" 不是图片，已跳过`);
            continue;
        }
        
        // 检查是否已存在相同文件名的文件
        const existingIndex = uploadedFiles.findIndex(f => f.name === file.name);
        if (existingIndex !== -1) {
            // 替换现有文件
            uploadedFiles[existingIndex] = file;
            
            // 更新预览
            const previewItem = document.querySelector(`.preview-item[data-filename="${file.name}"]`);
            if (previewItem) {
                previewItem.remove();
            }
        } else {
            // 添加新文件
            uploadedFiles.push(file);
        }
        
        // 创建预览
        createPreviewItem(file);
    }
    
    // 更新图片计数
    imageCount.textContent = uploadedFiles.length;
    
    // 更新UI状态
    updateUI();
    
    // 如果有文件上传，启用页面刷新保护
    if (files.length > 0) {
        preventRefresh = true;
    }
}

/**
 * 创建图片预览项
 * @param {File} file - 图片文件
 */
function createPreviewItem(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.dataset.filename = file.name;
        
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = file.name;
        img.loading = 'lazy'; // 懒加载图片
        
        const info = document.createElement('div');
        info.className = 'preview-item-info';
        
        const name = document.createElement('div');
        name.className = 'preview-item-name';
        name.title = file.name; // 添加悬停提示
        name.textContent = file.name;
        
        const size = document.createElement('div');
        size.className = 'preview-item-size';
        size.textContent = formatFileSize(file.size);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'preview-item-remove';
        removeBtn.innerHTML = '&times;'; // 使用HTML实体，显示更好的删除图标
        removeBtn.title = '移除图片';
        removeBtn.setAttribute('aria-label', '移除图片'); // 增加无障碍支持
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFile(file.name);
        });
        
        info.appendChild(name);
        info.appendChild(size);
        previewItem.appendChild(img);
        previewItem.appendChild(info);
        previewItem.appendChild(removeBtn);
        
        // 添加点击预览项的事件，可以展开/收起详情
        previewItem.addEventListener('click', function(e) {
            if (e.target === removeBtn || e.target === removeBtn.firstChild) return;
            
            // 在列表视图中，点击可以展开/收起详情
            if (currentViewMode === 'list') {
                this.classList.toggle('expanded');
            }
        });
        
        previewList.appendChild(previewItem);
        
        // 如果图片数量超过阈值，自动切换到列表视图
        if (uploadedFiles.length >= AUTO_SWITCH_THRESHOLD && currentViewMode === 'grid') {
            switchView('list');
        }
    };
    
    reader.readAsDataURL(file);
}

/**
 * 从上传列表中移除文件
 * @param {string} filename - 要移除的文件名
 */
function removeFile(filename) {
    // 从数组中移除
    const index = uploadedFiles.findIndex(file => file.name === filename);
    if (index !== -1) {
        uploadedFiles.splice(index, 1);
    }
    
    // 从DOM中移除
    const previewItem = document.querySelector(`.preview-item[data-filename="${filename}"]`);
    if (previewItem) {
        previewItem.remove();
    }
    
    // 更新图片计数
    imageCount.textContent = uploadedFiles.length;
    
    // 更新UI状态
    updateUI();
}

/**
 * 更新UI状态
 */
function updateUI() {
    // 更新图片计数
    imageCount.textContent = uploadedFiles.length;
    
    // 更新按钮状态
    startButton.disabled = uploadedFiles.length === 0 || isProcessing;
    clearAllButton.disabled = uploadedFiles.length === 0 || isProcessing;
    stopButton.disabled = !isProcessing;
    stopButton.style.display = isProcessing ? 'block' : 'none';
    
    // 根据图片数量自动切换视图模式
    if (uploadedFiles.length >= AUTO_SWITCH_THRESHOLD && currentViewMode === 'grid') {
        switchView('list');
    }
}

/**
 * 清除所有上传的文件
 */
function clearAll() {
    // 清除上传的文件
    uploadedFiles = [];
    
    // 清除预览列表
    clearPreviewList();
    
    // 更新图片计数
    updateImageCount();
    
    // 清除会话存储
    clearSessionStorage();
    
    // 显示会话指示器
    showSessionIndicator(false, '会话已清除');
    setTimeout(hideSessionIndicator, 3000);
    
    // 禁用页面刷新保护
    preventRefresh = false;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + ' KB';
    } else {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
}

/**
 * 停止分析过程
 */
function stopAnalysis() {
    if (!isProcessing) return;
    
    shouldStopProcessing = true;
    stopButton.disabled = true;
    stopButton.textContent = '正在停止...';
    
    // 延迟禁用页面刷新保护，确保所有任务都已停止
    setTimeout(() => {
        preventRefresh = false;
    }, 1000);
}

/**
 * 开始分析图片
 */
async function startAnalysis() {
    // 如果没有上传文件或者正在处理中，则不执行
    if (uploadedFiles.length === 0 || isProcessing) {
        return;
    }
    
    // 启用页面刷新保护
    preventRefresh = true;
    
    // 获取当前API密钥
    apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        const confirmContinue = confirm('您尚未设置API密钥，是否继续？\n(如果服务器已配置环境变量DASHSCOPE_API_KEY，则可以继续)');
        if (!confirmContinue) {
            return;
        }
    }
    
    // 获取批量分析数量
    batchSize = parseInt(batchSizeInput.value) || 1;
    
    // 创建以时间戳命名的任务文件夹
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    currentTaskFolder = `task_${timestamp}`;
    
    // 创建任务文件夹
    try {
        await createTaskFolder(currentTaskFolder);
    } catch (error) {
        console.error('创建任务文件夹失败:', error);
        // 继续执行，即使文件夹创建失败
    }
    
    // 重置停止标志
    shouldStopProcessing = false;
    
    // 设置处理状态
    isProcessing = true;
    updateUI();
    
    // 显示进度条
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = `处理中: 0/${uploadedFiles.length}`;
    
    // 清空结果列表
    resultsList.innerHTML = '';
    analysisResults.length = 0;
    downloadAllContainer.style.display = 'none';
    
    // 重置费用计算
    resetCostCalculation();
    
    // 创建结果控制区域
    createResultsControls();
    
    // 创建滚动指示器
    createScrollIndicator();
    
    // 处理每个文件
    for (let i = 0; i < uploadedFiles.length; i += batchSize) {
        // 检查是否应该停止处理
        if (shouldStopProcessing) {
            // 更新进度信息
            progressText.textContent = `已停止: ${i}/${uploadedFiles.length}`;
            break;
        }
        
        // 计算当前批次的结束索引
        const endIndex = Math.min(i + batchSize, uploadedFiles.length);
        const currentBatchFiles = uploadedFiles.slice(i, endIndex);
        
        // 更新进度
        const progress = Math.round((i / uploadedFiles.length) * 100);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `处理中: ${i}/${uploadedFiles.length}`;
        
        // 并行处理当前批次的文件
        const batchPromises = currentBatchFiles.map(async (file, batchIndex) => {
            const fileIndex = i + batchIndex;
            try {
                // 读取文件并转换为Base64
                const base64Data = await readFileAsBase64(file);
                
                // 再次检查是否应该停止处理
                if (shouldStopProcessing) return;
                
                // 调用API
                const resultData = await analyzeImage(base64Data, file.type);
                
                // 保存结果
                analysisResults.push({
                    filename: file.name,
                    result: resultData.result,
                    inputTokens: resultData.inputTokens,
                    outputTokens: resultData.outputTokens,
                    base64: base64Data,
                    file: file,
                    index: fileIndex,
                    isError: false
                });
                
                // 显示结果
                displayResult(file, base64Data, resultData.result);
            } catch (error) {
                console.error('处理文件时出错:', error);
                
                // 如果是因为停止处理而中断，不记录错误
                if (shouldStopProcessing) return;
                
                // 保存错误结果
                analysisResults.push({
                    filename: file.name,
                    errorMessage: error.message,
                    inputTokens: 0,
                    outputTokens: 0,
                    file: file,
                    index: fileIndex,
                    isError: true
                });
                
                // 显示错误结果
                displayError(file, error.message);
            }
        });
        
        // 等待当前批次的所有文件处理完成
        await Promise.all(batchPromises);
        
        // 再次检查是否应该停止处理
        if (shouldStopProcessing) break;
    }
    
    // 完成处理
    const processedCount = shouldStopProcessing 
        ? analysisResults.length 
        : uploadedFiles.length;
    
    // 更新进度显示
    progressBar.style.width = '100%';
    progressText.textContent = `处理完成: ${processedCount}/${uploadedFiles.length}`;
    
    // 隐藏进度条
    setTimeout(() => {
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
    }, 2000);
    
    // 显示下载全部按钮
    if (analysisResults.length > 0) {
        downloadAllContainer.style.display = 'block';
        
        // 自动保存结果到任务文件夹（不弹出下载对话框）
        if (currentTaskFolder && !shouldStopProcessing) {
            setTimeout(() => {
                saveResultsToServer();
            }, 500);
        }
    }
    
    // 重置处理状态
    setTimeout(() => {
        isProcessing = false;
        shouldStopProcessing = false;
        updateUI();
    }, 1000);
}

/**
 * 读取文件并转换为Base64
 * @param {File} file - 图片文件
 * @returns {Promise<string>} Base64编码的图片数据
 */
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // 从DataURL中提取Base64部分
            const base64 = e.target.result.split(',')[1];
            resolve(base64);
        };
        
        reader.onerror = function(e) {
            reject(new Error('读取文件失败'));
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * 调用API分析图片
 * @param {string} base64Image - Base64编码的图片数据
 * @param {string} mimeType - 图片MIME类型
 * @returns {Promise<Object>} 包含分析结果和token计数的对象
 */
async function analyzeImage(base64Image, mimeType) {
    // 检查是否应该停止处理
    if (shouldStopProcessing) {
        throw new Error('用户已停止处理');
    }
    
    // 确定图片格式
    let format = 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
        format = 'jpeg';
    } else if (mimeType.includes('webp')) {
        format = 'webp';
    }
    
    // 获取用户自定义提问，如果为空则使用默认提问
    const customPrompt = customPromptInput.value.trim() || "Please describe the content of this image in detail in English";
    
    try {
        // 创建FormData对象
        const formData = new FormData();
        
        // 将Base64转换回Blob
        const byteCharacters = atob(base64Image);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: `image/${format}`});
        
        // 创建文件对象
        const filename = `image.${format}`;
        const file = new File([blob], filename, {type: `image/${format}`});
        
        // 添加到FormData
        formData.append('image', file);
        formData.append('prompt', customPrompt);
        formData.append('model', selectedModel); // 添加选择的模型
        
        // 如果有API密钥，也添加到请求中
        if (apiKey) {
            formData.append('api_key', apiKey);
        }
        
        // 在发送请求前再次检查是否应该停止处理
        if (shouldStopProcessing) {
            throw new Error('用户已停止处理');
        }
        
        // 创建AbortController用于取消请求
        const controller = new AbortController();
        const signal = controller.signal;
        
        // 设置一个检查停止状态的间隔
        const checkInterval = setInterval(() => {
            if (shouldStopProcessing) {
                controller.abort();
                clearInterval(checkInterval);
            }
        }, 100);
        
        // 发送请求到后端API
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData,
            signal: signal
        });
        
        // 清除检查间隔
        clearInterval(checkInterval);
        
        // 再次检查是否应该停止处理
        if (shouldStopProcessing) {
            throw new Error('用户已停止处理');
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API错误: ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(`API错误: ${data.error || '未知错误'}`);
        }
        
        // 计算并更新费用
        calculateAndUpdateCost(
            selectedModel, 
            data.input_tokens || 0, 
            data.output_tokens || 0
        );
        
        // 返回结果和token信息
        return {
            result: data.result,
            inputTokens: data.input_tokens || 0,
            outputTokens: data.output_tokens || 0
        };
    } catch (error) {
        // 如果是因为用户停止处理而中断，重新抛出特定错误
        if (error.name === 'AbortError' || error.message.includes('用户已停止处理')) {
            throw new Error('用户已停止处理');
        }
        
        console.error('API调用失败:', error);
        throw new Error(`API调用失败: ${error.message}`);
    }
}

/**
 * 创建结果控制区域（排序和筛选）
 */
function createResultsControls() {
    // 检查是否已存在控制区域
    const existingControls = document.querySelector('.results-controls');
    if (existingControls) {
        existingControls.remove();
    }
    
    // 创建控制区域
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'results-controls';
    
    // 创建结果计数
    const countDiv = document.createElement('div');
    countDiv.className = 'results-count';
    countDiv.textContent = '分析结果: 0';
    
    // 创建操作区域
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'results-actions';
    
    // 创建排序选择器
    const sortLabel = document.createElement('label');
    sortLabel.textContent = '排序: ';
    
    const sortSelect = document.createElement('select');
    sortSelect.className = 'sort-select';
    
    const sortOptions = [
        { value: 'time', text: '处理时间' },
        { value: 'name', text: '文件名' },
        { value: 'length', text: '结果长度' }
    ];
    
    sortOptions.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.value;
        optElement.textContent = option.text;
        if (option.value === currentSortMethod) {
            optElement.selected = true;
        }
        sortSelect.appendChild(optElement);
    });
    
    sortSelect.addEventListener('change', () => {
        currentSortMethod = sortSelect.value;
        sortAndFilterResults();
    });
    
    // 创建筛选选择器
    const filterLabel = document.createElement('label');
    filterLabel.textContent = '筛选: ';
    
    const filterSelect = document.createElement('select');
    filterSelect.className = 'filter-select';
    
    const filterOptions = [
        { value: 'all', text: '全部' },
        { value: 'success', text: '成功' },
        { value: 'error', text: '失败' }
    ];
    
    filterOptions.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.value;
        optElement.textContent = option.text;
        if (option.value === currentFilter) {
            optElement.selected = true;
        }
        filterSelect.appendChild(optElement);
    });
    
    filterSelect.addEventListener('change', () => {
        currentFilter = filterSelect.value;
        sortAndFilterResults();
    });
    
    // 创建高度调整选择器
    const heightLabel = document.createElement('label');
    heightLabel.textContent = '结果区高度: ';
    
    const heightSelect = document.createElement('select');
    heightSelect.className = 'height-select';
    
    const heightOptions = [
        { value: '400', text: '小' },
        { value: '600', text: '中' },
        { value: '800', text: '大' },
        { value: '1000', text: '超大' }
    ];
    
    // 获取保存的高度设置或使用默认值
    const savedHeight = localStorage.getItem('results_height') || '600';
    
    heightOptions.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.value;
        optElement.textContent = option.text;
        if (option.value === savedHeight) {
            optElement.selected = true;
        }
        heightSelect.appendChild(optElement);
    });
    
    // 应用保存的高度设置
    document.querySelector('.results-list').style.maxHeight = `${savedHeight}px`;
    
    heightSelect.addEventListener('change', () => {
        const height = heightSelect.value;
        document.querySelector('.results-list').style.maxHeight = `${height}px`;
        localStorage.setItem('results_height', height);
    });
    
    // 组装控制区域
    actionsDiv.appendChild(sortLabel);
    actionsDiv.appendChild(sortSelect);
    actionsDiv.appendChild(filterLabel);
    actionsDiv.appendChild(filterSelect);
    actionsDiv.appendChild(heightLabel);
    actionsDiv.appendChild(heightSelect);
    
    controlsDiv.appendChild(countDiv);
    controlsDiv.appendChild(actionsDiv);
    
    // 添加到结果容器
    const resultsTitle = resultsContainer.querySelector('h2');
    resultsContainer.insertBefore(controlsDiv, resultsTitle.nextSibling);
}

/**
 * 更新结果计数
 */
function updateResultsCount() {
    const countDiv = document.querySelector('.results-count');
    if (countDiv) {
        // 计算当前显示的结果数量
        const visibleResults = document.querySelectorAll('.result-item:not([style*="display: none"])').length;
        const totalResults = analysisResults.length;
        
        countDiv.textContent = `分析结果: ${visibleResults}/${totalResults}`;
    }
}

/**
 * 排序和筛选结果
 */
function sortAndFilterResults() {
    // 获取所有结果项
    const resultItems = Array.from(document.querySelectorAll('.result-item'));
    
    // 如果没有结果，直接返回
    if (resultItems.length === 0) return;
    
    // 先移除所有结果
    resultItems.forEach(item => item.remove());
    
    // 根据当前筛选条件过滤结果
    let filteredResults = [...analysisResults];
    if (currentFilter === 'success') {
        filteredResults = filteredResults.filter(result => !result.isError);
    } else if (currentFilter === 'error') {
        filteredResults = filteredResults.filter(result => result.isError);
    }
    
    // 根据当前排序方法排序结果
    filteredResults.sort((a, b) => {
        if (currentSortMethod === 'name') {
            return a.filename.localeCompare(b.filename);
        } else if (currentSortMethod === 'length') {
            const aLength = a.result ? a.result.length : 0;
            const bLength = b.result ? b.result.length : 0;
            return bLength - aLength; // 从长到短排序
        } else {
            // 默认按处理时间排序（索引顺序）
            return a.index - b.index;
        }
    });
    
    // 重新显示排序和筛选后的结果
    filteredResults.forEach(result => {
        if (result.isError) {
            displayError(result.file, result.errorMessage);
        } else {
            displayResult(result.file, result.base64, result.result);
        }
    });
    
    // 更新结果计数
    updateResultsCount();
}

/**
 * 创建滚动指示器
 */
function createScrollIndicator() {
    // 移除现有的滚动指示器
    const existingIndicator = document.querySelector('.scroll-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // 创建新的滚动指示器
    const indicator = document.createElement('div');
    indicator.className = 'scroll-indicator';
    indicator.textContent = '向下滚动查看更多结果';
    resultsContainer.appendChild(indicator);
    
    // 监听结果列表的滚动事件
    const resultsList = document.querySelector('.results-list');
    resultsList.addEventListener('scroll', checkScrollIndicator);
    
    // 监听窗口大小变化，重新检查是否需要显示滚动指示器
    window.addEventListener('resize', checkScrollIndicator);
    
    // 初始检查
    setTimeout(checkScrollIndicator, 500); // 延迟检查，确保内容已加载
}

/**
 * 检查是否需要显示滚动指示器
 */
function checkScrollIndicator() {
    const resultsList = document.querySelector('.results-list');
    const indicator = document.querySelector('.scroll-indicator');
    
    if (!resultsList || !indicator) return;
    
    // 如果内容高度大于容器高度，显示滚动指示器
    const isScrollable = resultsList.scrollHeight > resultsList.clientHeight;
    
    // 如果已经滚动到底部，隐藏指示器
    const isAtBottom = resultsList.scrollTop + resultsList.clientHeight >= resultsList.scrollHeight - 20;
    
    if (isScrollable && !isAtBottom && analysisResults.length > 0) {
        indicator.style.display = 'block';
        
        // 5秒后自动隐藏
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 5000);
    } else {
        indicator.style.display = 'none';
    }
}

/**
 * 显示分析结果
 * @param {File} file - 图片文件
 * @param {string} base64 - Base64编码的图片数据
 * @param {string} result - 分析结果
 */
function displayResult(file, base64, result) {
    // 确保结果容器可见
    resultsContainer.style.display = 'block';
    
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    
    // 创建结果项头部
    const header = document.createElement('div');
    header.className = 'result-item-header';
    
    const img = document.createElement('img');
    img.src = `data:${file.type};base64,${base64}`;
    img.alt = file.name;
    
    const title = document.createElement('div');
    title.className = 'result-item-title';
    title.textContent = file.name;
    
    // 添加状态图标
    const statusIcon = document.createElement('div');
    statusIcon.className = 'result-item-status';
    statusIcon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    
    header.appendChild(img);
    header.appendChild(title);
    header.appendChild(statusIcon);
    
    // 创建摘要内容
    const summary = document.createElement('div');
    summary.className = 'result-item-summary';
    // 提取结果的前50个字符作为摘要
    summary.textContent = result.length > 50 ? result.substring(0, 50) + '...' : result;
    
    // 创建完整结果内容
    const content = document.createElement('div');
    content.className = 'result-item-content';
    content.textContent = result;
    content.style.display = 'none'; // 默认隐藏完整内容
    
    // 创建展开/折叠按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-content-btn';
    toggleBtn.innerHTML = '展开 <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>';
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (content.style.display === 'none') {
            content.style.display = 'block';
            summary.style.display = 'none';
            toggleBtn.innerHTML = '折叠 <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 14l5-5 5 5z"/></svg>';
        } else {
            content.style.display = 'none';
            summary.style.display = 'block';
            toggleBtn.innerHTML = '展开 <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>';
        }
    });
    
    // 创建结果项底部
    const footer = document.createElement('div');
    footer.className = 'result-item-footer';
    
    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> 复制结果';
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(result)
            .then(() => {
                copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 已复制';
                setTimeout(() => {
                    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> 复制结果';
                }, 2000);
            })
            .catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动复制');
            });
    });
    
    const downloadBtn = document.createElement('button');
    downloadBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> 下载结果';
    downloadBtn.addEventListener('click', () => {
        downloadResult(file.name, result);
    });
    
    footer.appendChild(toggleBtn);
    footer.appendChild(copyBtn);
    footer.appendChild(downloadBtn);
    
    // 组装结果项
    resultItem.appendChild(header);
    resultItem.appendChild(summary);
    resultItem.appendChild(content);
    resultItem.appendChild(footer);
    
    // 添加到结果列表
    resultsList.appendChild(resultItem);
    
    // 更新结果计数
    updateResultsCount();
    
    // 检查滚动指示器
    checkScrollIndicator();
}

/**
 * 显示错误结果
 * @param {File} file - 图片文件
 * @param {string} errorMessage - 错误信息
 */
function displayError(file, errorMessage) {
    // 确保结果容器可见
    resultsContainer.style.display = 'block';
    
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item error';
    
    // 创建结果项头部
    const header = document.createElement('div');
    header.className = 'result-item-header';
    
    const title = document.createElement('div');
    title.className = 'result-item-title';
    title.textContent = file.name;
    
    // 添加错误状态图标
    const statusIcon = document.createElement('div');
    statusIcon.className = 'result-item-status';
    statusIcon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    
    header.appendChild(title);
    header.appendChild(statusIcon);
    
    // 创建结果内容
    const content = document.createElement('div');
    content.className = 'result-item-content';
    content.textContent = `处理失败: ${errorMessage}`;
    
    // 组装结果项
    resultItem.appendChild(header);
    resultItem.appendChild(content);
    
    // 添加到结果列表
    resultsList.appendChild(resultItem);
    
    // 更新结果计数
    updateResultsCount();
    
    // 检查滚动指示器
    checkScrollIndicator();
}

/**
 * 下载单个结果
 * @param {string} filename - 文件名
 * @param {string} content - 文件内容
 */
function downloadResult(filename, content) {
    // 创建文本文件
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename.split('.')[0]}.txt`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
}

/**
 * 下载所有结果
 * @param {boolean} autoSave - 是否自动保存到任务文件夹
 */
function downloadAllResults(autoSave = false) {
    if (analysisResults.length === 0) {
        alert('没有可下载的结果');
        return;
    }
    
    // 如果只有一个结果，直接下载
    if (analysisResults.length === 1) {
        const result = analysisResults[0];
        downloadResult(result.filename, result.result);
        
        // 如果需要自动保存，单独处理
        if (autoSave && currentTaskFolder) {
            const blob = new Blob([result.result], { type: 'text/plain;charset=utf-8' });
            const filename = `${result.filename.split('.')[0]}.txt`;
            saveZipToServer(blob, filename);
        }
        
        return;
    }
    
    // 创建ZIP文件
    if (window.JSZip) {
        createZipFile(autoSave);
    } else {
        // 动态加载JSZip库
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => createZipFile(autoSave);
        script.onerror = () => {
            alert('无法加载ZIP库，将逐个下载结果');
            downloadResultsSequentially();
        };
        document.head.appendChild(script);
    }
}

/**
 * 创建ZIP文件并下载
 * @param {boolean} autoSave - 是否自动保存到任务文件夹
 */
function createZipFile(autoSave = false) {
    const zip = new JSZip();
    
    // 添加每个结果到ZIP
    analysisResults.forEach(result => {
        const filename = `${result.filename.split('.')[0]}.txt`;
        zip.file(filename, result.result);
    });
    
    // 生成ZIP文件
    zip.generateAsync({ type: 'blob' })
        .then(blob => {
            // 创建下载链接
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            
            // 设置文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            const zipFilename = `图片分析结果_${timestamp}.zip`;
            link.download = zipFilename;
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            
            // 清理
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(link.href), 100);
            
            // 如果需要自动保存到任务文件夹
            if (autoSave && currentTaskFolder) {
                saveZipToServer(blob, zipFilename);
            }
        })
        .catch(err => {
            console.error('创建ZIP文件失败:', err);
            alert('创建ZIP文件失败，将逐个下载结果');
            downloadResultsSequentially();
        });
}

/**
 * 保存ZIP文件到服务器
 * @param {Blob} blob - ZIP文件Blob
 * @param {string} filename - 文件名
 */
async function saveZipToServer(blob, filename) {
    try {
        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('folder', currentTaskFolder);
        
        // 发送请求
        const response = await fetch('/api/save_result', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`保存文件失败: ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(`保存文件失败: ${data.error || '未知错误'}`);
        }
        
        console.log(`成功保存结果到服务器: ${data.path}`);
    } catch (error) {
        console.error('保存文件到服务器时出错:', error);
    }
}

/**
 * 逐个下载结果
 */
function downloadResultsSequentially() {
    analysisResults.forEach(result => {
        downloadResult(result.filename, result.result);
    });
}

/**
 * 切换视图模式
 * @param {string} mode - 视图模式：'grid' 或 'list'
 */
function switchView(mode) {
    if (mode === currentViewMode) return;
    
    currentViewMode = mode;
    
    // 更新按钮状态
    if (mode === 'grid') {
        gridViewButton.classList.add('active');
        listViewButton.classList.remove('active');
        previewList.classList.add('grid-view');
        previewList.classList.remove('list-view');
        
        // 重置所有展开的项
        document.querySelectorAll('.preview-item.expanded').forEach(item => {
            item.classList.remove('expanded');
        });
    } else {
        gridViewButton.classList.remove('active');
        listViewButton.classList.add('active');
        previewList.classList.remove('grid-view');
        previewList.classList.add('list-view');
    }
    
    // 保存用户偏好
    localStorage.setItem('preferred_view', mode);
}

// 初始化主题
function initTheme() {
    if (localStorage.getItem('dark_mode')) {
        document.body.classList.add('dark-mode');
    }
}

// 初始化结果区域高度
function initResultsHeight() {
    if (resultsList) {
        resultsList.style.maxHeight = `${resultsHeight}px`;
    }
}

/**
 * 计算费用并更新UI
 * @param {string} model - 使用的模型
 * @param {number} inputTokens - 输入token数量
 * @param {number} outputTokens - 输出token数量
 */
function calculateAndUpdateCost(model, inputTokens, outputTokens) {
    // 累加token数量
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    
    // 获取当前模型的费率
    const rates = modelRates[model] || modelRates['qwen-vl-max-latest']; // 默认使用通义千问VL Max的费率
    
    // 计算费用（单位：元）
    const inputCost = (totalInputTokens / 1000) * rates.input;
    const outputCost = (totalOutputTokens / 1000) * rates.output;
    const totalCost = inputCost + outputCost;
    
    // 更新UI
    inputTokensElement.textContent = totalInputTokens;
    outputTokensElement.textContent = totalOutputTokens;
    inputCostElement.textContent = `¥${inputCost.toFixed(4)}`;
    outputCostElement.textContent = `¥${outputCost.toFixed(4)}`;
    totalCostElement.textContent = `¥${totalCost.toFixed(4)}`;
    
    // 显示费用容器
    costContainer.style.display = 'block';
}

/**
 * 重置费用计算
 */
function resetCostCalculation() {
    totalInputTokens = 0;
    totalOutputTokens = 0;
    
    // 更新UI
    inputTokensElement.textContent = '0';
    outputTokensElement.textContent = '0';
    inputCostElement.textContent = '¥0.00';
    outputCostElement.textContent = '¥0.00';
    totalCostElement.textContent = '¥0.00';
    
    // 隐藏费用容器
    costContainer.style.display = 'none';
}

/**
 * 在服务器上创建任务文件夹
 * @param {string} folderName - 文件夹名称
 * @returns {Promise<void>}
 */
async function createTaskFolder(folderName) {
    try {
        const response = await fetch('/api/create_folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ folder_name: folderName })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`创建文件夹失败: ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(`创建文件夹失败: ${data.error || '未知错误'}`);
        }
        
        console.log(`成功创建任务文件夹: ${folderName}`);
    } catch (error) {
        console.error('创建任务文件夹时出错:', error);
        throw error;
    }
}

/**
 * 清除会话存储
 */
function clearSessionStorage() {
    try {
        localStorage.removeItem('imageAnalysisSession');
        console.log('会话存储已清除');
    } catch (error) {
        console.error('清除会话存储时出错:', error);
    }
}

/**
 * 清除预览列表
 */
function clearPreviewList() {
    if (previewList) {
        previewList.innerHTML = '';
    }
}

/**
 * 更新图片计数
 */
function updateImageCount() {
    if (imageCount) {
        imageCount.textContent = uploadedFiles.length.toString();
    }
}

/**
 * 仅保存结果到服务器，不触发下载对话框
 */
function saveResultsToServer() {
    if (analysisResults.length === 0 || !currentTaskFolder) {
        return;
    }
    
    // 如果只有一个结果
    if (analysisResults.length === 1) {
        const result = analysisResults[0];
        const blob = new Blob([result.result], { type: 'text/plain;charset=utf-8' });
        const filename = `${result.filename.split('.')[0]}.txt`;
        saveZipToServer(blob, filename);
        return;
    }
    
    // 多个结果，创建ZIP文件
    if (window.JSZip) {
        createZipFileForServer();
    } else {
        // 动态加载JSZip库
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        document.head.appendChild(script);
        script.onload = () => createZipFileForServer();
    }
}

/**
 * 创建ZIP文件并仅保存到服务器，不触发下载
 */
function createZipFileForServer() {
    const zip = new JSZip();
    
    // 添加每个结果到ZIP
    analysisResults.forEach(result => {
        const filename = `${result.filename.split('.')[0]}.txt`;
        zip.file(filename, result.result);
    });
    
    // 生成ZIP文件
    zip.generateAsync({ type: 'blob' })
        .then(blob => {
            // 设置文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            const zipFilename = `图片分析结果_${timestamp}.zip`;
            
            // 保存到服务器
            saveZipToServer(blob, zipFilename);
            
            // 显示会话指示器
            showSessionIndicator(false, '结果已保存');
            setTimeout(hideSessionIndicator, 3000);
        })
        .catch(err => {
            console.error('创建ZIP文件失败:', err);
            showSessionIndicator(false, '保存结果失败');
            setTimeout(hideSessionIndicator, 3000);
        });
}

/**
 * 显示会话状态指示器
 * @param {boolean} saving - 是否正在保存
 * @param {string} text - 显示的文本
 */
function showSessionIndicator(saving = false, text = null) {
    if (!sessionIndicator) return;
    
    sessionIndicator.classList.add('visible');
    
    if (saving) {
        sessionIndicatorDot.classList.add('saving');
        sessionIndicatorText.textContent = '正在保存会话...';
    } else {
        sessionIndicatorDot.classList.remove('saving');
        sessionIndicatorText.textContent = text || '会话已保存';
    }
}

/**
 * 隐藏会话状态指示器
 */
function hideSessionIndicator() {
    if (!sessionIndicator) return;
    sessionIndicator.classList.remove('visible');
}

/**
 * 启用页面刷新保护
 */
function enableRefreshProtection() {
    // 不再需要
}

/**
 * 禁用页面刷新保护
 */
function disableRefreshProtection() {
    // 不再需要
}

/**
 * 处理页面刷新事件
 */
function handleBeforeUnload(e) {
    // 不再需要
}

/**
 * 初始化页面刷新保护
 */
function initRefreshProtection() {
    window.addEventListener('beforeunload', function(e) {
        if (preventRefresh) {
            // 显示确认对话框
            e.preventDefault();
            // Chrome需要设置returnValue
            const message = '当前有任务正在进行或有未保存的更改，刷新页面将丢失所有进度。确定要刷新吗？';
            e.returnValue = message;
            return message;
        }
    });
} 