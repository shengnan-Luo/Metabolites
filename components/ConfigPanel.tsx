import React from 'react';
import { Settings, Zap, FileText } from 'lucide-react';
import { ApiConfig } from '../types';

interface ConfigPanelProps {
  config: ApiConfig;
  onConfigChange: (newConfig: ApiConfig) => void;
  benefitApiConfigsText: string;
  onBenefitApiConfigsTextChange: (value: string) => void;
  disabled: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  onConfigChange,
  benefitApiConfigsText,
  onBenefitApiConfigsTextChange,
  disabled,
}) => {
  const handleChange = (field: keyof ApiConfig, value: string | number) => {
    onConfigChange({ ...config, [field]: value });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col gap-6 overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4 shrink-0">
        <Settings className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-bold text-slate-800">API 配置</h2>
      </div>

      <div className="space-y-4 shrink-0">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            并发数量 (Concurrency)
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={config.concurrency}
            onChange={(e) => handleChange('concurrency', Math.max(1, parseInt(e.target.value) || 1))}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-sm transition-all"
          />
          <p className="text-xs text-gray-400 mt-1">同时进行的请求数量 (建议 1-10)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            多模型 API 配置（有益化合物判断）
          </label>
          <textarea
            value={benefitApiConfigsText}
            onChange={(e) => onBenefitApiConfigsTextChange(e.target.value)}
            disabled={disabled}
            placeholder='[{"name":"模型A","endpoint":"...","apiKey":"...","model":"..."},{"name":"模型B","endpoint":"...","apiKey":"...","model":"..."}]'
            className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-xs font-mono transition-all resize-y"
          />
          <p className="text-xs text-gray-400 mt-1">每套配置独立调用并汇总结果；最终会新增“多模型一致性”列。</p>
        </div>
      </div>

      <div className="mt-auto bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100 shrink-0">
        <p className="font-semibold mb-1">提示:</p>
        <p>查询功能已关闭。系统将仅按“多模型 API 配置（有益化合物判断）”中的各模型独立请求并汇总一致性。</p>
      </div>
    </div>
  );
};
