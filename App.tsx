import React, { useState, useCallback, useRef } from 'react';
import { FlaskConical, Play, Square, RefreshCw, AlertTriangle } from 'lucide-react';
import { ConfigPanel } from './components/ConfigPanel';
import { InputSection } from './components/InputSection';
import { ResultsTable } from './components/ResultsTable';
import { ApiConfig, QueryItem, RequestStatus, BatchProgress } from './types';
import { fetchCompletion } from './services/apiService';

const DEFAULT_CONFIG: ApiConfig = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  concurrency: 3,
};

const DEFAULT_PROMPT = `请提供以下化合物的信息：{{compound}}。
请包含：
1. IUPAC 名称
2. 分子式
3. 摩尔质量
4. 主要药理作用或工业用途 (简述)
请用中文回答。`;

function App() {
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [compoundsText, setCompoundsText] = useState<string>('');
  const [promptTemplate, setPromptTemplate] = useState<string>(DEFAULT_PROMPT);
  
  const [results, setResults] = useState<QueryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<BatchProgress>({ total: 0, completed: 0, success: 0, failed: 0 });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const startBatch = useCallback(async () => {
    // 1. Validation
    if (!config.apiKey) {
      alert('请输入 API 密钥');
      return;
    }
    if (!config.endpoint) {
      alert('请输入接口地址');
      return;
    }
    const compounds = compoundsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (compounds.length === 0) {
      alert('请输入至少一个化合物');
      return;
    }
    if (!promptTemplate.includes('{{compound}}')) {
      alert('提示词模板中必须包含 {{compound}} 占位符');
      return;
    }

    // 2. Initialization
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();
    
    // Create initial result items
    const initialItems: QueryItem[] = compounds.map((c, index) => ({
      id: `job-${Date.now()}-${index}`,
      compound: c,
      status: RequestStatus.IDLE,
      result: null,
    }));
    
    setResults(initialItems);
    setProgress({ total: initialItems.length, completed: 0, success: 0, failed: 0 });

    // 3. Processing Loop (Sequential for simplicity and rate limit safety, can be parallelized with p-limit if needed)
    const CONCURRENCY = config.concurrency || 1;
    let currentIndex = 0;
    
    const processItem = async (index: number) => {
      if (index >= initialItems.length) return;
      if (abortControllerRef.current?.signal.aborted) return;

      const item = initialItems[index];
      
      // Update status to pending
      setResults(prev => prev.map((r, i) => i === index ? { ...r, status: RequestStatus.PENDING } : r));

      const specificPrompt = promptTemplate.replace(/\{\{compound\}\}/g, item.compound);

      try {
        const responseText = await fetchCompletion(config, specificPrompt);
        
        if (abortControllerRef.current?.signal.aborted) return;

        setResults(prev => prev.map((r, i) => i === index ? { 
          ...r, 
          status: RequestStatus.SUCCESS, 
          result: responseText 
        } : r));

        setProgress(prev => ({ 
          ...prev, 
          completed: prev.completed + 1, 
          success: prev.success + 1 
        }));

      } catch (error: any) {
        if (abortControllerRef.current?.signal.aborted) return;

        setResults(prev => prev.map((r, i) => i === index ? { 
          ...r, 
          status: RequestStatus.ERROR, 
          error: error.message 
        } : r));

        setProgress(prev => ({ 
          ...prev, 
          completed: prev.completed + 1, 
          failed: prev.failed + 1 
        }));
      }
    };

    // Worker pool logic
    const workers = [];
    // Queue manager
    const queueWorker = async () => {
        while (currentIndex < initialItems.length) {
             if (abortControllerRef.current?.signal.aborted) break;
             const indexToProcess = currentIndex++;
             await processItem(indexToProcess);
        }
    }

    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(queueWorker());
    }

    await Promise.all(workers);
    
    setIsProcessing(false);
    abortControllerRef.current = null;

  }, [config, compoundsText, promptTemplate]);

  const stopBatch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setProgress({ total: 0, completed: 0, success: 0, failed: 0 });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="bg-accent/10 p-2 rounded-lg">
            <FlaskConical className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">ChemBatch AI</h1>
            <p className="text-xs text-slate-500">批量化合物智能查询系统</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            {isProcessing && (
                <div className="flex items-center gap-2 mr-4">
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-accent transition-all duration-300"
                            style={{ width: `${(progress.completed / Math.max(progress.total, 1)) * 100}%` }}
                        />
                    </div>
                    <span className="text-sm text-slate-600 font-mono">
                        {progress.completed}/{progress.total}
                    </span>
                </div>
            )}

            {!isProcessing ? (
            <button
                onClick={startBatch}
                disabled={!compoundsText.trim() || !config.apiKey}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all shadow-md 
                ${!compoundsText.trim() || !config.apiKey 
                    ? 'bg-gray-400 cursor-not-allowed opacity-70' 
                    : 'bg-accent hover:bg-blue-600 hover:shadow-lg active:scale-95'}`}
            >
                <Play className="w-4 h-4 fill-current" />
                开始批量查询
            </button>
            ) : (
            <button
                onClick={stopBatch}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium bg-red-500 hover:bg-red-600 shadow-md transition-all active:scale-95"
            >
                <Square className="w-4 h-4 fill-current" />
                停止
            </button>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-6 flex flex-col gap-6 max-w-[1920px] mx-auto w-full">
        
        {/* Top Section: Config & Inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[450px]">
          <div className="lg:col-span-3 h-full">
            <ConfigPanel 
              config={config} 
              onConfigChange={setConfig} 
              disabled={isProcessing} 
            />
          </div>
          <div className="lg:col-span-9 h-full">
            <InputSection 
              compoundsText={compoundsText} 
              setCompoundsText={setCompoundsText}
              promptTemplate={promptTemplate}
              setPromptTemplate={setPromptTemplate}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Bottom Section: Results */}
        <div className="flex-1 min-h-0 relative">
            {results.length > 0 && !isProcessing && (
                 <button 
                 onClick={clearResults}
                 className="absolute top-4 right-32 z-10 flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 px-3 py-1 bg-white border border-gray-200 rounded shadow-sm transition-colors"
               >
                 <RefreshCw className="w-3 h-3" /> 清空结果
               </button>
            )}
          <ResultsTable results={results} />
        </div>

      </main>
    </div>
  );
}

export default App;