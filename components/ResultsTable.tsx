import React from 'react';
import { Download, CheckCircle, AlertCircle, Loader2, Copy, Database } from 'lucide-react';
import { QueryItem, RequestStatus } from '../types';

interface ResultsTableProps {
  results: QueryItem[];
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ results }) => {
  const escapeCsv = (str: string | null) => {
    if (!str) return '';
    const stringified = str.replace(/"/g, '""');
    return `"${stringified}"`;
  };

  const downloadCSV = (items: QueryItem[], sheetName: string) => {
    if (items.length === 0) return;

    const headers = ['ID', 'Sheet', 'Compound', 'Status', 'IsBeneficial', 'BeneficialDirection', 'Result', 'Error'];
    const rows = items.map(r => [
      r.id,
      escapeCsv(r.sheetName),
      escapeCsv(r.compound),
      r.status,
      escapeCsv(r.isBeneficial || ''),
      escapeCsv(r.beneficialDirection || ''),
      escapeCsv(r.result),
      escapeCsv(r.error || '')
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSheetName = sheetName.replace(/[\\/:*?"<>|]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `${safeSheetName}_results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-200 text-gray-400">
        <Database className="w-12 h-12 mb-2 opacity-20" />
        <p>暂无数据，请运行查询</p>
      </div>
    );
  }

  const groupedResults = results.reduce<Record<string, QueryItem[]>>((acc, item) => {
    if (!acc[item.sheetName]) {
      acc[item.sheetName] = [];
    }
    acc[item.sheetName].push(item);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(groupedResults).map(([sheetName, items]) => (
        <div key={sheetName} className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-[300px]">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
            <div>
              <h3 className="font-bold text-slate-700">{sheetName}</h3>
              <p className="text-xs text-gray-400">共 {items.length} 条</p>
            </div>
            <button
              onClick={() => downloadCSV(items, sheetName)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 CSV
            </button>
          </div>
          
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-100">
                <tr>
                  <th className="px-6 py-3 w-16">#</th>
                  <th className="px-6 py-3 w-48">化合物</th>
                  <th className="px-6 py-3 w-32">状态</th>
                  <th className="px-6 py-3 w-28">有益代谢物</th>
                  <th className="px-6 py-3 w-72">有益方向（结肠炎）</th>
                  <th className="px-6 py-3">AI 响应结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-400">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{item.compound}</td>
                    <td className="px-6 py-4">
                      {item.status === RequestStatus.PENDING && (
                        <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full text-xs w-fit">
                          <Loader2 className="w-3 h-3 animate-spin" /> 进行中
                        </span>
                      )}
                      {item.status === RequestStatus.SUCCESS && (
                        <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs w-fit">
                          <CheckCircle className="w-3 h-3" /> 成功
                        </span>
                      )}
                      {item.status === RequestStatus.ERROR && (
                        <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs w-fit">
                          <AlertCircle className="w-3 h-3" /> 失败
                        </span>
                      )}
                      {item.status === RequestStatus.IDLE && (
                        <span className="text-gray-400 text-xs">等待中</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.status === RequestStatus.SUCCESS ? (item.isBeneficial || '-') : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                        {item.status === RequestStatus.SUCCESS ? (item.beneficialDirection || '-') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 relative group">
                      {item.status === RequestStatus.ERROR ? (
                        <span className="text-red-500">{item.error}</span>
                      ) : (
                        <div className="whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                            {item.result || '-'}
                        </div>
                      )}
                      {item.result && (
                          <button 
                            onClick={() => copyToClipboard(item.result!)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-600 transition-opacity"
                            title="复制内容"
                          >
                              <Copy className="w-3 h-3" />
                          </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
