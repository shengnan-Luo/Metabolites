import React from 'react';
import { Database, MessageSquare } from 'lucide-react';

interface InputSectionProps {
  compoundsText: string;
  setCompoundsText: (text: string) => void;
  promptTemplate: string;
  setPromptTemplate: (text: string) => void;
  disabled: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({
  compoundsText,
  setCompoundsText,
  promptTemplate,
  setPromptTemplate,
  disabled
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      {/* Compounds Input */}
      <div className="flex flex-col h-full bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <Database className="w-4 h-4 text-accent" />
            化合物列表
          </label>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">一行一个</span>
        </div>
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
      </div>

      {/* Prompt Template Input */}
      <div className="flex flex-col h-full bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <MessageSquare className="w-4 h-4 text-accent" />
            查询提示词模板
          </label>
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
            使用 {"{{compound}}"} 作为占位符
          </span>
        </div>
        <textarea
          value={promptTemplate}
          onChange={(e) => setPromptTemplate(e.target.value)}
          disabled={disabled}
          placeholder="请输入针对 AI 的提示词。&#10;例如：&#10;请告诉我 {{compound}} 的分子式、摩尔质量和主要用途。请用简洁的中文回答。"
          className="flex-1 w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none resize-none text-sm leading-relaxed"
        />
        <div className="mt-2 text-xs text-gray-500">
          系统会自动将 <code>{"{{compound}}"}</code> 替换为左侧列表中的每一项。
        </div>
      </div>
    </div>
  );
};
