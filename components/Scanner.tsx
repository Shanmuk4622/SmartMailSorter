import React, { useState, useEffect, useRef } from 'react';
import { MailData, ProcessingOptions, ScanResult } from '../types';
import { extractMailData } from '../geminiService';
import { processImage } from '../imageUtils';
import { Loader2, Upload, Scan, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';

interface ScannerProps {
  onScanComplete: (result: ScanResult) => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScanComplete }) => {
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<MailData | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>({
    grayscale: false,
    highContrast: false,
    denoise: false
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setImage(ev.target.result as string);
          setResult(null);
          setProcessedImage(null); // Reset processed
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Re-run image processing when options change or image loads
  useEffect(() => {
    if (image) {
      processImage(image, options).then(setProcessedImage);
    }
  }, [image, options]);

  const handleScan = async () => {
    if (!processedImage) return;
    setIsProcessing(true);
    const start = Date.now();
    try {
      const data = await extractMailData(processedImage);
      setResult(data);
      const scanResult: ScanResult = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        originalImageUrl: image!,
        processedImageUrl: processedImage,
        data: data,
        status: 'completed',
        processingTimeMs: Date.now() - start
      };
      onScanComplete(scanResult);
    } catch (err) {
      console.error(err);
      alert("Extraction failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setProcessedImage(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Column: Input & Preprocessing */}
      <div className="flex flex-col gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Scan className="w-5 h-5 text-blue-600" />
            Image Input
          </h2>

          {!image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-50 transition-colors min-h-[300px]"
            >
              <Upload className="w-12 h-12 text-slate-400 mb-4" />
              <p className="text-slate-600 font-medium">Click to upload envelope image</p>
              <p className="text-slate-400 text-sm mt-2">Supports JPG, PNG</p>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4">
              <div className="relative rounded-lg overflow-hidden bg-slate-100 border border-slate-200 aspect-video flex items-center justify-center">
                <img 
                  src={processedImage || image} 
                  alt="Preview" 
                  className="max-h-full max-w-full object-contain" 
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setOptions(p => ({ ...p, grayscale: !p.grayscale }))}
                  className={`px-3 py-2 text-sm rounded-md font-medium border ${options.grayscale ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  Grayscale
                </button>
                <button 
                  onClick={() => setOptions(p => ({ ...p, highContrast: !p.highContrast }))}
                  className={`px-3 py-2 text-sm rounded-md font-medium border ${options.highContrast ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  High Contrast
                </button>
                <button 
                  onClick={reset}
                  className="px-3 py-2 text-sm rounded-md font-medium border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <div className="flex items-center justify-center gap-1">
                    <RotateCcw className="w-4 h-4" /> Reset
                  </div>
                </button>
              </div>

              <button
                onClick={handleScan}
                disabled={isProcessing}
                className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5" />
                    Extract & Classify
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Results */}
      <div className="flex flex-col gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Extraction Results
          </h2>

          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                 <Scan className="w-8 h-8 opacity-20" />
               </div>
               <p>Scan an image to see details here</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Score Card */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <p className="text-sm text-slate-500">AI Confidence Score</p>
                  <p className="text-2xl font-bold text-slate-800">{result.confidence}%</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${result.confidence > 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {result.confidence > 80 ? 'High Accuracy' : 'Review Needed'}
                </div>
              </div>

              {/* Address Details */}
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4 py-1">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Recipient</p>
                  <p className="text-lg font-medium text-slate-900">{result.recipient}</p>
                </div>
                
                <div className="border-l-4 border-indigo-500 pl-4 py-1">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Address</p>
                  <p className="text-base text-slate-700">{result.address}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-slate-50 p-3 rounded-md">
                     <p className="text-xs text-slate-500">Extracted PIN/ZIP</p>
                     <p className="text-xl font-mono font-bold text-slate-900">{result.pin_code}</p>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-md">
                     <p className="text-xs text-slate-500">Region</p>
                     <p className="text-base font-medium text-slate-900">{result.city}, {result.country}</p>
                   </div>
                </div>
              </div>

              {/* Sorting Suggestion */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Suggested Routing</h3>
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 p-4 rounded-lg flex items-start gap-3">
                   <div className="p-2 bg-white rounded-md shadow-sm text-emerald-600">
                     <CheckCircle className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="text-sm text-emerald-800 font-medium">Primary Sorting Center</p>
                     <p className="text-lg font-bold text-emerald-900">{result.sorting_center_name}</p>
                     <p className="text-xs text-emerald-600 font-mono mt-1">ID: {result.sorting_center_id}</p>
                   </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scanner;