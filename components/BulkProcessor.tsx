import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Loader2, CheckCircle, X, AlertTriangle } from 'lucide-react';

interface BulkProcessorProps {
  onBulkProcess: (results: any[]) => void;
}

interface ProcessingResult {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: any;
  error?: string;
}

const BulkProcessor: React.FC<BulkProcessorProps> = ({ onBulkProcess }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const imageFiles = selectedFiles.filter(file => 
        file.type.startsWith('image/') && file.size < 10 * 1024 * 1024 // 10MB limit
      );
      
      setFiles(prev => [...prev, ...imageFiles]);
      setResults(prev => [...prev, ...imageFiles.map(file => ({
        id: Date.now() + Math.random().toString(),
        filename: file.name,
        status: 'pending' as const
      }))]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResults(prev => prev.filter((_, i) => i !== index));
  };

  const processBulk = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    const processedResults: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Update status to processing
      setResults(prev => prev.map((result, idx) => 
        idx === i ? { ...result, status: 'processing' } : result
      ));

      try {
        // Simulate API call - replace with actual processing
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        // Mock successful result
        const mockResult = {
          id: Date.now() + i,
          filename: file.name,
          data: {
            recipient: `Recipient ${i + 1}`,
            address: `Sample Address ${i + 1}, Mumbai`,
            pin_code: `40000${i + 1}`,
            sorting_center_id: `MUM-${String(i + 1).padStart(3, '0')}`,
            confidence: 0.85 + Math.random() * 0.15
          },
          timestamp: new Date().toISOString(),
          processing_time: Math.floor(1000 + Math.random() * 2000)
        };

        // Randomly simulate some failures for demonstration
        if (Math.random() < 0.1) {
          throw new Error('Poor image quality - unable to extract clear text');
        }

        setResults(prev => prev.map((result, idx) => 
          idx === i ? { 
            ...result, 
            status: 'success', 
            result: mockResult 
          } : result
        ));

        processedResults.push(mockResult);

      } catch (error: any) {
        setResults(prev => prev.map((result, idx) => 
          idx === i ? { 
            ...result, 
            status: 'error', 
            error: error.message 
          } : result
        ));
      }
    }

    setProcessing(false);
    onBulkProcess(processedResults);
  };

  const exportResults = () => {
    const csvData = [
      ['Filename', 'Status', 'Recipient', 'Address', 'PIN Code', 'Sorting Center', 'Confidence', 'Error'].join(','),
      ...results.map(result => [
        result.filename,
        result.status,
        result.result?.data?.recipient || '',
        result.result?.data?.address || '',
        result.result?.data?.pin_code || '',
        result.result?.data?.sorting_center_id || '',
        result.result?.data?.confidence || '',
        result.error || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bulk_processing_results_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAll = () => {
    setFiles([]);
    setResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white/90 rounded-3xl shadow-lg border border-orange-200 p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500 rounded-2xl text-white shadow-lg shadow-orange-200">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">बल्क प्रोसेसिंग | Bulk Processing</h3>
            <p className="text-sm text-slate-600">एक साथ कई मेल स्कैन करें | Process multiple mails together</p>
          </div>
        </div>
        {results.length > 0 && (
          <button
            onClick={clearAll}
            className="text-slate-500 hover:text-red-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* File Upload Area */}
      <div className="mb-6">
        <div 
          className="border-2 border-dashed border-orange-300 rounded-2xl p-8 text-center hover:border-orange-400 hover:bg-orange-50/50 transition-all duration-300 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h4 className="font-semibold text-slate-700 mb-2">छवियां अपलोड करें | Upload Images</h4>
          <p className="text-sm text-slate-500 mb-4">
            Click to select or drag and drop mail images (JPG, PNG - Max 10MB each)
          </p>
          <p className="text-xs text-slate-400">
            {files.length} files selected • Supports batch processing of up to 50 images
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* File List & Processing Status */}
      {results.length > 0 && (
        <div className="mb-6 max-h-64 overflow-y-auto border border-orange-100 rounded-2xl">
          {results.map((result, index) => (
            <div 
              key={result.id}
              className={`flex items-center gap-4 p-4 border-b border-orange-50 last:border-b-0 ${
                result.status === 'success' ? 'bg-green-50/50' : 
                result.status === 'error' ? 'bg-red-50/50' : 
                result.status === 'processing' ? 'bg-blue-50/50' : 'bg-slate-50/30'
              }`}
            >
              <div className="flex-shrink-0">
                {result.status === 'pending' && <div className="w-4 h-4 border-2 border-orange-300 rounded-full"></div>}
                {result.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                {result.status === 'success' && <CheckCircle className="w-4 h-4 text-[#138808]" />}
                {result.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-500" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 truncate">{result.filename}</p>
                {result.status === 'success' && result.result && (
                  <p className="text-xs text-slate-500 truncate">
                    {result.result.data?.address} • PIN: {result.result.data?.pin_code}
                  </p>
                )}
                {result.status === 'error' && (
                  <p className="text-xs text-red-600">{result.error}</p>
                )}
              </div>
              
              {result.status === 'pending' && (
                <button
                  onClick={() => removeFile(index)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={processBulk}
          disabled={files.length === 0 || processing}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300 active:scale-95"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              प्रोसेसिंग... | Processing...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              प्रोसेस करें | Process All ({files.length})
            </>
          )}
        </button>
        
        {results.some(r => r.status === 'success' || r.status === 'error') && (
          <button
            onClick={exportResults}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold transition-all duration-300 active:scale-95"
          >
            <Download className="w-5 h-5" />
            निर्यात | Export
          </button>
        )}
      </div>

      {/* Summary Statistics */}
      {results.length > 0 && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-orange-50 rounded-xl border border-orange-200">
            <div className="text-2xl font-bold text-[#FF6600]">{results.length}</div>
            <div className="text-xs text-slate-600">कुल | Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-xl border border-green-200">
            <div className="text-2xl font-bold text-[#138808]">
              {results.filter(r => r.status === 'success').length}
            </div>
            <div className="text-xs text-slate-600">सफल | Success</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl border border-red-200">
            <div className="text-2xl font-bold text-red-500">
              {results.filter(r => r.status === 'error').length}
            </div>
            <div className="text-xs text-slate-600">त्रुटि | Error</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-200">
            <div className="text-2xl font-bold text-blue-500">
              {results.filter(r => r.status === 'processing').length}
            </div>
            <div className="text-xs text-slate-600">प्रगति | Processing</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkProcessor;