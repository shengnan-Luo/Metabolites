import React from 'react';
import { Database, MessageSquare, FileSpreadsheet } from 'lucide-react';

interface InputSectionProps {
  inputMode: 'manual' | 'excel';
  setInputMode: (mode: 'manual' | 'excel') => void;
  compoundsText: string;
  setCompoundsText: (text: string) => void;
  enableBenefitCheck: boolean;
  setEnableBenefitCheck: (enabled: boolean) => void;
  benefitPromptTemplate: string;
  setBenefitPromptTemplate: (text: string) => void;
  excelFileName: string;
  onExcelUpload: (file: File | null) => void;
  sheetPrefix: string;
  setSheetPrefix: (value: string) => void;
  columnOptions: string[];
  selectedColumn: string;
  setSelectedColumn: (value: string) => void;
  maxRows: number;
  setMaxRows: (value: number) => void;
  matchingSheets: string[];
  disabled: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({
  inputMode,
  setInputMode,
  compoundsText,
  setCompoundsText,
  enableBenefitCheck,
  setEnableBenefitCheck,
  benefitPromptTemplate,
  setBenefitPromptTemplate,
  excelFileName,
  onExcelUpload,
  sheetPrefix,
  setSheetPrefix,
  columnOptions,
  selectedColumn,
  setSelectedColumn,
  maxRows,
  setMaxRows,
  matchingSheets,
  disabled
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      {/* Compounds Input */}
      <div className="flex flex-col h-full bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            {inputMode === 'manual' ? (
              <Database className="w-4 h-4 text-accent" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-accent" />
            )}
            <span>{inputMode === 'manual' ? '化合物列表' : 'Excel 导入'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              disabled={disabled}
              className={`px-2 py-1 rounded border ${
                inputMode === 'manual'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-gray-200 text-gray-400 hover:text-gray-600'
              }`}
            >
              手动输入
            </button>
            <button
              type="button"
              onClick={() => setInputMode('excel')}
              disabled={disabled}
              className={`px-2 py-1 rounded border ${
                inputMode === 'excel'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-gray-200 text-gray-400 hover:text-gray-600'
              }`}
            >
              Excel 上传
            </button>
          </div>
        </div>

        {inputMode === 'manual' ? (
          <>
            <textarea
              value={compoundsText}
              onChange={(e) => setCompoundsText(e.target.value)}
              disabled={disabled}
              placeholder="例如：&#10;Aspirin&#10;Caffeine&#10;Sodium Chloride"
              className="flex-1 w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none resize-none font-mono text-sm"
            />
            <div className="mt-2 text-right text-xs text-gray-400">
              共 {compoundsText.trim() ? compoundsText.trim().split('\n').length : 0} 个条目
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">上传 Excel 文件</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={disabled}
                onChange={(e) => onExcelUpload(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-400 mt-1">
                当前文件：{excelFileName || '未选择'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Sheet 前缀</label>
                <input
                  type="text"
                  value={sheetPrefix}
                  onChange={(e) => setSheetPrefix(e.target.value)}
                  disabled={disabled}
                  placeholder="例如：***"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">每个 Sheet 取前 N 条</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxRows}
                  onChange={(e) => setMaxRows(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">化学名称列</label>
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                disabled={disabled || columnOptions.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-accent focus:border-transparent bg-white"
              >
                {columnOptions.length === 0 && <option value="">请先上传 Excel</option>}
                {columnOptions.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                匹配到的 Sheet：{matchingSheets.length > 0 ? matchingSheets.join('，') : '暂无'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Prompt Template Input */}
      <div className="flex flex-col h-full bg-white p-6 rounded-xl shadow-sm border border-gray-200 gap-4 overflow-y-auto">
        <div className="border border-gray-200 rounded-lg p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              <MessageSquare className="w-4 h-4 text-accent" />
              有益化合物判断（BENEFIT_PROMPT_TEMPLATE）
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={enableBenefitCheck}
                onChange={(e) => setEnableBenefitCheck(e.target.checked)}
                disabled={disabled}
              />
              开启
            </label>
          </div>
          <textarea
            value={benefitPromptTemplate}
            onChange={(e) => setBenefitPromptTemplate(e.target.value)}
            disabled={disabled || !enableBenefitCheck}
            placeholder="请输入判断提示词，需包含 {{compound}}。默认仅判断抗炎活性。"
            className="h-40 w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none resize-none text-sm leading-relaxed disabled:bg-gray-100"
          />
          <div className="mt-2 text-xs text-gray-500">
            可自定义判断逻辑；默认提示词仅判断是否具有抗炎活性。
          </div>
        </div>
      </div>
    </div>
  );
};
