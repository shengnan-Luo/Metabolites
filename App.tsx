import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FlaskConical, Play, Square, RefreshCw } from 'lucide-react';
import { ConfigPanel } from './components/ConfigPanel';
import { InputSection } from './components/InputSection';
import { ResultsTable } from './components/ResultsTable';
import { ApiConfig, QueryItem, RequestStatus, BatchProgress } from './types';
import { fetchCompletion } from './services/apiService';
import * as XLSX from 'xlsx';

const DEFAULT_CONFIG: ApiConfig = {
  endpoint: 'https://x666.me/v1/chat/completions',
  apiKey: '',
  model: 'gemini-3-flash-preview',
  concurrency: 3,
  minResultLength: 500,
};

const DEFAULT_PROMPT = `请对化合物详细介绍，包括：编号：25-32（不需要加任何形式的括号[]！！！！！），中文名称（英文名称）、【概述】、【结构特点】、【生物活性】、【医药用途】等内容，要求内容科学、详细。输出要求：【概述】：一段文字200-300字、【结构特点】(1)、（2）、（3）。【生物活性】(1)、（2）、（3）、（4）、（5）。【医药用途】(1)、（2）、（3）、（4）、（5）。特别是对生物活性和医药用途要如实，重点，具体描述！！注意输出格式加【】，例如：【概述】、【结构特点】、【生物活性】、【医药用途】。一定要注意格式，按照要求生成！生物活性和医药用途详细一点！
化合物：{{compound}}`;
const DEFAULT_BENEFIT_PROMPT_TEMPLATE = `请判断下述化合物是否具有抗炎活性，并给出一句话结论。
化合物：{{compound}}

输出要求：
1) 只输出 JSON，不要输出其他文字。
2) JSON 格式必须为：
{"isBeneficial":"是或否","beneficialDirection":"一句话，说明是否具有抗炎活性；若无明确证据则写“暂无明确证据支持其具有抗炎活性”"}`;

const MANUAL_SHEET_NAME = '手动输入';
const MAX_RETRIES = 1;

interface ExcelSheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

interface BenefitInfo {
  isBeneficial: '是' | '否';
  beneficialDirection: string;
}

interface BenefitApiConfigInput {
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

const DEFAULT_BENEFIT_CONFIGS_TEXT = `[
  {
    "name": "模型A",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "apiKey": "",
    "model": "gpt-4o-mini"
  },
  {
    "name": "模型B",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "apiKey": "",
    "model": "gpt-4.1-mini"
  }
]`;

const parseBenefitInfo = (text: string): BenefitInfo => {
  const fallback: BenefitInfo = {
    isBeneficial: '否',
    beneficialDirection: '暂无明确证据支持其具有抗炎活性',
  };

  try {
    const match = text.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : text;
    const parsed = JSON.parse(jsonText);
    const isBeneficial = parsed?.isBeneficial === '是' ? '是' : '否';
    const beneficialDirection = String(parsed?.beneficialDirection || '').trim() || fallback.beneficialDirection;
    return { isBeneficial, beneficialDirection };
  } catch {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return fallback;
    const isBeneficial = /(^|[:：\s])是($|[，,。；;\s])/.test(normalized) ? '是' : '否';
    return {
      isBeneficial,
      beneficialDirection: normalized.slice(0, 180),
    };
  }
};

const parseBenefitConfigs = (text: string): BenefitApiConfigInput[] => {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('有益化合物多模型配置必须是 JSON 数组');
  }

  const normalized = parsed.map((item, index) => {
    const name = String(item?.name || '').trim() || `模型${index + 1}`;
    const endpoint = String(item?.endpoint || '').trim();
    const apiKey = String(item?.apiKey || '').trim();
    const model = String(item?.model || '').trim();
    if (!endpoint || !apiKey || !model) {
      throw new Error(`第 ${index + 1} 个模型配置缺少 endpoint / apiKey / model`);
    }
    return { name, endpoint, apiKey, model };
  });

  if (normalized.length < 2) {
    throw new Error('请至少提供 2 套模型配置，用于判断是否一致');
  }

  return normalized;
};

function App() {
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [compoundsText, setCompoundsText] = useState<string>('');
  const [enableQueryPrompt, setEnableQueryPrompt] = useState<boolean>(true);
  const [promptTemplate, setPromptTemplate] = useState<string>(DEFAULT_PROMPT);
  const [enableBenefitCheck, setEnableBenefitCheck] = useState<boolean>(true);
  const [benefitPromptTemplate, setBenefitPromptTemplate] = useState<string>(DEFAULT_BENEFIT_PROMPT_TEMPLATE);
  const [benefitApiConfigsText, setBenefitApiConfigsText] = useState<string>(DEFAULT_BENEFIT_CONFIGS_TEXT);
  const [inputMode, setInputMode] = useState<'manual' | 'excel'>('manual');
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [excelSheets, setExcelSheets] = useState<ExcelSheetData[]>([]);
  const [sheetPrefix, setSheetPrefix] = useState<string>('***');
  const [selectedColumn, setSelectedColumn] = useState<string>('化学名称');
  const [maxRows, setMaxRows] = useState<number>(15);
  
  const [results, setResults] = useState<QueryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<BatchProgress>({ total: 0, completed: 0, success: 0, failed: 0 });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const availableColumns = useMemo(() => {
    const set = new Set<string>();
    excelSheets.forEach((sheet) => {
      sheet.headers.forEach((header) => {
        if (header) set.add(header);
      });
    });
    return Array.from(set);
  }, [excelSheets]);

  const matchingSheets = useMemo(() => {
    if (!sheetPrefix) return excelSheets.map((sheet) => sheet.name);
    return excelSheets
      .filter((sheet) => sheet.name.startsWith(sheetPrefix))
      .map((sheet) => sheet.name);
  }, [excelSheets, sheetPrefix]);

  useEffect(() => {
    if (availableColumns.length === 0) return;
    if (!availableColumns.includes(selectedColumn)) {
      const fallback = availableColumns.find((col) => col.includes('化学')) || availableColumns[0];
      setSelectedColumn(fallback);
    }
  }, [availableColumns, selectedColumn]);

  const handleExcelUpload = useCallback(async (file: File | null) => {
    if (!file) {
      setExcelFileName('');
      setExcelSheets([]);
      return;
    }
    setExcelFileName(file.name);
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheets: ExcelSheetData[] = workbook.SheetNames.map((name) => {
      const worksheet = workbook.Sheets[name];
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
      const headers = sheetRows[0]?.map((cell) => String(cell).trim()) ?? [];
      const rows = sheetRows.slice(1).map((row) => row.map((cell) => String(cell).trim()));
      return { name, headers, rows };
    });
    setExcelSheets(sheets);
  }, []);

  const startBatch = useCallback(async () => {
    // 1. Validation
    if (enableQueryPrompt && !config.apiKey) {
      alert('请输入 API 密钥');
      return;
    }
    if (enableQueryPrompt && !config.endpoint) {
      alert('请输入接口地址');
      return;
    }
    if (!enableQueryPrompt && !enableBenefitCheck) {
      alert('请至少开启一个功能：查询提示词 或 有益化合物判断');
      return;
    }
    if (enableQueryPrompt && !promptTemplate.includes('{{compound}}')) {
      alert('提示词模板中必须包含 {{compound}} 占位符');
      return;
    }
    if (enableBenefitCheck && !benefitPromptTemplate.includes('{{compound}}')) {
      alert('有益化合物判断提示词中必须包含 {{compound}} 占位符');
      return;
    }
    let benefitConfigs: BenefitApiConfigInput[] = [];
    if (enableBenefitCheck) {
      try {
        benefitConfigs = parseBenefitConfigs(benefitApiConfigsText);
      } catch (error: any) {
        alert(`有益化合物多模型配置有误：${error.message}`);
        return;
      }
    }
    if (inputMode === 'excel' && excelSheets.length === 0) {
      alert('请先上传 Excel 文件');
      return;
    }

    // 2. Create initial result items
    let processingItems: QueryItem[] = [];
    let prefilledItems: QueryItem[] = [];

    if (inputMode === 'manual') {
      const compounds = compoundsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (compounds.length === 0) {
        alert('请输入至少一个化合物');
        setIsProcessing(false);
        abortControllerRef.current = null;
        return;
      }

      processingItems = compounds.map((c, index) => ({
        id: `job-${Date.now()}-${index}`,
        compound: c,
        sheetName: MANUAL_SHEET_NAME,
        status: RequestStatus.IDLE,
        result: null,
        isBeneficial: null,
        beneficialDirection: null,
        benefitModelSummary: null,
        benefitConsensus: null,
      }));
    } else {
      const relevantSheets = matchingSheets.map((name) => excelSheets.find((sheet) => sheet.name === name)).filter(Boolean) as ExcelSheetData[];
      if (relevantSheets.length === 0) {
        alert('未找到匹配的 Sheet，请检查前缀');
        setIsProcessing(false);
        abortControllerRef.current = null;
        return;
      }

      relevantSheets.forEach((sheet) => {
        const columnIndex = sheet.headers.findIndex((header) => header === selectedColumn);
        if (columnIndex === -1) {
          prefilledItems.push({
            id: `sheet-error-${sheet.name}-${Date.now()}`,
            compound: selectedColumn,
            sheetName: sheet.name,
            status: RequestStatus.ERROR,
            result: null,
            isBeneficial: null,
            beneficialDirection: null,
            benefitModelSummary: null,
            benefitConsensus: null,
            error: `未找到列：${selectedColumn}`,
          });
          return;
        }

        const compounds = sheet.rows
          .map((row) => row[columnIndex]?.trim())
          .filter((value) => Boolean(value));

        const limitedCompounds = compounds.slice(0, maxRows);
        const items = limitedCompounds.map((compound, index) => ({
          id: `job-${sheet.name}-${Date.now()}-${index}`,
          compound,
          sheetName: sheet.name,
          status: RequestStatus.IDLE,
          result: null,
          isBeneficial: null,
          beneficialDirection: null,
          benefitModelSummary: null,
          benefitConsensus: null,
        }));
        processingItems = processingItems.concat(items);
      });

      if (processingItems.length === 0) {
        if (prefilledItems.length > 0) {
          setResults(prefilledItems);
          setProgress({
            total: prefilledItems.length,
            completed: prefilledItems.length,
            success: 0,
            failed: prefilledItems.length,
          });
        }
        alert('未能在匹配的 Sheet 中读取到化合物，请检查列名或内容');
        setIsProcessing(false);
        abortControllerRef.current = null;
        return;
      }
    }

    // 3. Initialization
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    const initialResults = [...prefilledItems, ...processingItems];
    setResults(initialResults);
    setProgress({
      total: initialResults.length,
      completed: prefilledItems.length,
      success: 0,
      failed: prefilledItems.length,
    });

    // 4. Processing Loop (Sequential for simplicity and rate limit safety, can be parallelized with p-limit if needed)
    const CONCURRENCY = config.concurrency || 1;
    let currentIndex = 0;
    
    const processItem = async (index: number) => {
      if (index >= processingItems.length) return;
      if (abortControllerRef.current?.signal.aborted) return;

      const item = processingItems[index];
      
      // Update status to pending
      setResults(prev => prev.map((r) => r.id === item.id ? { ...r, status: RequestStatus.PENDING } : r));

      const specificPrompt = promptTemplate.replace(/\{\{compound\}\}/g, item.compound);
      const benefitPrompt = benefitPromptTemplate.replace(/\{\{compound\}\}/g, item.compound);

      try {
        let responseText = '';
        let retryCount = 0;
        const countLength = (text: string) => text.replace(/\s+/g, '').length;

        const mainRequestTask = async () => {
          let currentResponse = await fetchCompletion(config, specificPrompt);
          while (
            countLength(currentResponse) < config.minResultLength &&
            retryCount < MAX_RETRIES &&
            !abortControllerRef.current?.signal.aborted
          ) {
            retryCount += 1;
            currentResponse = await fetchCompletion(config, specificPrompt);
          }
          return currentResponse;
        };

        const [mainResponse, benefitResponses] = await Promise.all([
          enableQueryPrompt ? mainRequestTask() : Promise.resolve<string | null>(null),
          enableBenefitCheck
            ? Promise.allSettled(
                benefitConfigs.map((benefitConfig) =>
                  fetchCompletion(
                    {
                      ...config,
                      endpoint: benefitConfig.endpoint,
                      apiKey: benefitConfig.apiKey,
                      model: benefitConfig.model,
                    },
                    benefitPrompt
                  )
                )
              )
            : Promise.resolve<PromiseSettledResult<string>[]>([]),
        ]);
        responseText = mainResponse || '';
        const parsedBenefitInfos = benefitResponses.map((result, index) => {
          if (result.status === 'fulfilled') {
            return {
              name: benefitConfigs[index].name,
              info: parseBenefitInfo(result.value),
              error: null,
            };
          }
          return {
            name: benefitConfigs[index].name,
            info: null,
            error: result.reason?.message || '请求失败',
          };
        });
        const successfulInfos = parsedBenefitInfos
          .filter((item) => item.info)
          .map((item) => item.info as BenefitInfo);
        const consensus: '一致' | '不一致' | '部分失败' =
          parsedBenefitInfos.some((item) => item.error)
            ? '部分失败'
            : new Set(successfulInfos.map((item) => item.isBeneficial)).size <= 1
              ? '一致'
              : '不一致';
        const firstBenefitInfo = successfulInfos[0] || null;
        const modelSummary = parsedBenefitInfos
          .map((item) => (item.info ? `${item.name}:${item.info.isBeneficial}` : `${item.name}:失败(${item.error})`))
          .join('；');
        
        if (abortControllerRef.current?.signal.aborted) return;

        setResults(prev => prev.map((r) => r.id === item.id ? { 
          ...r, 
          status: RequestStatus.SUCCESS, 
          result: enableQueryPrompt ? responseText : null,
          isBeneficial: enableBenefitCheck ? firstBenefitInfo?.isBeneficial || '否' : null,
          beneficialDirection: enableBenefitCheck ? firstBenefitInfo?.beneficialDirection || null : null,
          benefitModelSummary: enableBenefitCheck ? modelSummary : null,
          benefitConsensus: enableBenefitCheck ? consensus : null,
        } : r));

        setProgress(prev => ({ 
          ...prev, 
          completed: prev.completed + 1, 
          success: prev.success + 1 
        }));

      } catch (error: any) {
        if (abortControllerRef.current?.signal.aborted) return;

        setResults(prev => prev.map((r) => r.id === item.id ? { 
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
        while (currentIndex < processingItems.length) {
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

  }, [
    config,
    compoundsText,
    excelSheets,
    inputMode,
    matchingSheets,
    maxRows,
    enableBenefitCheck,
    benefitPromptTemplate,
    benefitApiConfigsText,
    enableQueryPrompt,
    promptTemplate,
    selectedColumn,
  ]);

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

  const canStart = Boolean(
    (enableQueryPrompt ? config.apiKey : true) &&
    (inputMode === 'manual' ? compoundsText.trim() : excelSheets.length > 0)
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm z-20 shrink-0 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="bg-accent/10 p-2 rounded-lg">
            <FlaskConical className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">布布 AI</h1>
            <p className="text-xs text-slate-500">一二的批量化合物智能查询系统</p>
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
                disabled={!canStart}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all shadow-md 
                ${!canStart 
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
      <main className="p-6 flex flex-col gap-8 max-w-[1920px] mx-auto w-full">
        
        {/* Top Section: Config & Inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[650px] shrink-0">
          <div className="lg:col-span-3 h-[450px] lg:h-full">
            <ConfigPanel 
              config={config} 
              onConfigChange={setConfig} 
              disabled={isProcessing} 
            />
          </div>
          <div className="lg:col-span-9 h-[450px] lg:h-full">
            <InputSection 
              inputMode={inputMode}
              setInputMode={setInputMode}
              compoundsText={compoundsText} 
              setCompoundsText={setCompoundsText}
              enableQueryPrompt={enableQueryPrompt}
              setEnableQueryPrompt={setEnableQueryPrompt}
              promptTemplate={promptTemplate}
              setPromptTemplate={setPromptTemplate}
              enableBenefitCheck={enableBenefitCheck}
              setEnableBenefitCheck={setEnableBenefitCheck}
              benefitPromptTemplate={benefitPromptTemplate}
              setBenefitPromptTemplate={setBenefitPromptTemplate}
              benefitApiConfigsText={benefitApiConfigsText}
              setBenefitApiConfigsText={setBenefitApiConfigsText}
              excelFileName={excelFileName}
              onExcelUpload={handleExcelUpload}
              sheetPrefix={sheetPrefix}
              setSheetPrefix={setSheetPrefix}
              columnOptions={availableColumns}
              selectedColumn={selectedColumn}
              setSelectedColumn={setSelectedColumn}
              maxRows={maxRows}
              setMaxRows={setMaxRows}
              matchingSheets={matchingSheets}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Bottom Section: Results */}
        <div className="relative">
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
