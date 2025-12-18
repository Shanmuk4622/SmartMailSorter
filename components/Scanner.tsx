import React, { useState, useEffect, useRef } from 'react';
import { MailData, ProcessingOptions, ScanResult } from '../types';
import { extractMailData } from '../geminiService';
import { processImage } from '../imageUtils';
import { Loader2, Upload, Scan, RotateCcw, CheckCircle, AlertTriangle, ArrowRight, Image as ImageIcon, Sparkles } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface ScannerProps {
  onScanComplete: (result: ScanResult) => void;
}

const STORAGE_KEY = 'smartmail_scanner_state';

const Scanner: React.FC<ScannerProps> = ({ onScanComplete }) => {
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<MailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>({
    grayscale: false,
    highContrast: false,
    denoise: false
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.options) setOptions(parsed.options);
        if (parsed.result) setResult(parsed.result);
      }
    } catch (e) {
      console.warn("Failed to load saved scanner state:", e);
    }
  }, []);

  useEffect(() => {
    try {
      const stateToSave = { result, options };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn("Failed to auto-save scanner state:", e);
    }
  }, [result, options]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setError("Invalid file type. Please upload a JPG or PNG image.");
        if (fileInputRef.current) fileInputRef.current.value = ""; 
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setImage(ev.target.result as string);
          setResult(null);
          setProcessedImage(null); 
        }
      };
      reader.onerror = (err) => {
        setError("Failed to read file.");
      }
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (image) {
      processImage(image, options).then(processed => {
        setProcessedImage(processed);
      }).catch(err => {
        setError("Failed to process image filters.");
      });
    }
  }, [image, options]);

  const handleScan = async () => {
    if (!processedImage) return;
    setIsProcessing(true);
    setError(null);
    const start = Date.now();

    try {
      const data = await extractMailData(processedImage);
      setResult(data);
      
      const safeConfidence = Math.round(data.confidence);

      const { data: dbData, error: dbError } = await supabase
        .from('mail_scans')
        .insert([{
          recipient: data.recipient,
          address: data.address,
          pin_code: data.pin_code,
          city: data.city,
          state: data.state || '',
          country: data.country,
          sorting_center_id: data.sorting_center_id,
          sorting_center_name: data.sorting_center_name,
          confidence: safeConfidence,
          status: 'completed'
        }])
        .select();

      if (dbError) console.error("Supabase Insert Error:", dbError.message);

      const scanResult: ScanResult = {
        id: dbData ? dbData[0].id : crypto.randomUUID(),
        timestamp: Date.now(),
        originalImageUrl: image!,
        processedImageUrl: processedImage,
        data: data,
        status: 'completed',
        processingTimeMs: Date.now() - start
      };
      
      onScanComplete(scanResult);

    } catch (err: any) {
      let msg = "An unexpected error occurred.";
      if (err.message) {
        if (err.message.includes("fetch failed") || err.message.includes("NetworkError")) msg = "Network connection failed.";
        else if (err.message.includes("Invalid JSON")) msg = "Could not read address. Try a clearer photo.";
        else if (err.message.includes("API key")) msg = "Invalid API Key.";
        else msg = `Extraction failed: ${err.message}`;
      }
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setProcessedImage(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Left Column: Input */}
      <div className="flex flex-col gap-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex-1 flex flex-col hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200">
                <ImageIcon className="w-5 h-5" />
              </div>
              Image Input
            </h2>
            {image && (
               <button 
                  onClick={reset}
                  className="text-sm font-semibold text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
            )}
          </div>

          {!image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 border-3 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 cursor-pointer transition-all duration-300 group relative overflow-hidden ${
                error 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-slate-200 bg-slate-50/50 hover:bg-indigo-50/50 hover:border-indigo-400'
              }`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(#e0e7ff_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none opacity-50"></div>
              
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl transition-transform group-hover:scale-110 duration-300 relative z-10 ${error ? 'bg-red-100 text-red-500' : 'bg-white text-indigo-600'}`}>
                {error ? <AlertTriangle className="w-10 h-10" /> : <Upload className="w-10 h-10" />}
              </div>
              
              <h3 className={`text-lg font-bold mb-2 relative z-10 ${error ? 'text-red-700' : 'text-slate-700'}`}>
                {error || "Upload Envelope Image"}
              </h3>
              <p className="text-slate-400 text-center max-w-xs relative z-10 font-medium">
                Drag and drop or click to browse. Supports high-resolution JPG & PNG.
              </p>
              
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/png, image/jpeg, image/jpg" 
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-6 animate-fade-in">
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-inner aspect-video flex items-center justify-center group">
                <img 
                  src={processedImage || image} 
                  alt="Preview" 
                  className="max-h-full max-w-full object-contain transition-opacity duration-300" 
                />
                {/* Overlay with filters info */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100">
                    <span className="text-xs text-white/90 font-bold uppercase tracking-wider">
                      {options.grayscale ? 'B&W • ' : ''}
                      {options.highContrast ? 'High Contrast' : 'Original'}
                    </span>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-700 shadow-sm">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">Processing Error</span>
                    {error}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Image Enhancements</label>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setOptions(p => ({ ...p, grayscale: !p.grayscale }))}
                    className={`flex-1 py-3 px-4 text-sm rounded-xl font-bold transition-all border ${options.grayscale ? 'bg-slate-800 text-white border-slate-800 shadow-lg transform -translate-y-0.5' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    Grayscale
                  </button>
                  <button 
                    onClick={() => setOptions(p => ({ ...p, highContrast: !p.highContrast }))}
                    className={`flex-1 py-3 px-4 text-sm rounded-xl font-bold transition-all border ${options.highContrast ? 'bg-slate-800 text-white border-slate-800 shadow-lg transform -translate-y-0.5' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    High Contrast
                  </button>
                </div>
              </div>

              <button
                onClick={handleScan}
                disabled={isProcessing}
                className="mt-auto w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analyzing Image...</span>
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5" />
                    <span>Run AI Extraction</span>
                    <ArrowRight className="w-5 h-5 opacity-50" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Results */}
      <div className="flex flex-col gap-6">
        <div className={`bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-full flex flex-col transition-all duration-500 hover:shadow-lg ${result ? 'ring-2 ring-emerald-500/20' : ''}`}>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shadow-md ${result ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                {result ? <CheckCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              Extraction Results
            </h2>
            {result && (
              <span className="text-xs font-mono font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{new Date().toLocaleTimeString()}</span>
            )}
          </div>

          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center p-8">
               <div className="w-24 h-24 bg-gradient-to-br from-slate-50 to-slate-100 rounded-full flex items-center justify-center mb-6 animate-pulse shadow-inner">
                 <Scan className="w-10 h-10 opacity-20" />
               </div>
               <h3 className="text-lg font-bold text-slate-600 mb-2">Ready to Analyze</h3>
               <p className="max-w-xs text-sm font-medium opacity-70">Upload an image and click "Run AI Extraction" to see intelligent sorting details here.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              {/* Confidence Score */}
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-100 shadow-sm">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Confidence Score</p>
                  <div className="flex items-baseline gap-1">
                     <span className={`text-4xl font-black ${result.confidence > 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{result.confidence}</span>
                     <span className="text-sm font-bold text-slate-400">%</span>
                  </div>
                </div>
                <div className="text-right">
                   <div className={`px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2 ${result.confidence > 80 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                     {result.confidence > 80 ? (
                       <><CheckCircle className="w-4 h-4" /> High Accuracy</>
                     ) : (
                       <><AlertTriangle className="w-4 h-4" /> Verify Manually</>
                     )}
                   </div>
                </div>
              </div>

              {/* Data Card */}
              <div className="relative">
                 <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 to-indigo-200"></div>
                 
                 <div className="space-y-6 pl-8 relative">
                    {/* Recipient */}
                    <div className="relative group">
                      <div className="absolute -left-[39px] top-1 w-5 h-5 rounded-full bg-blue-500 border-4 border-white shadow-md z-10 ring-1 ring-slate-100"></div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Recipient</p>
                      <p className="text-xl font-bold text-slate-800">{result.recipient}</p>
                    </div>

                    {/* Address */}
                    <div className="relative group">
                       <div className="absolute -left-[39px] top-1 w-5 h-5 rounded-full bg-indigo-500 border-4 border-white shadow-md z-10 ring-1 ring-slate-100"></div>
                       <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Address</p>
                       <p className="text-base text-slate-700 leading-relaxed bg-slate-50/80 p-4 rounded-xl border border-slate-100 font-medium">{result.address}</p>
                    </div>

                    {/* Grid for Pin/City */}
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                         <div className="absolute -left-[39px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-300 border-4 border-white shadow-md z-10 ring-1 ring-slate-100"></div>
                         <p className="text-xs text-slate-400 font-bold uppercase mb-1">PIN / ZIP</p>
                         <p className="text-2xl font-mono font-bold text-slate-800 tracking-wider">{result.pin_code}</p>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                         <p className="text-xs text-slate-400 font-bold uppercase mb-1">City / Region</p>
                         <p className="text-lg font-bold text-slate-800">{result.city}</p>
                         <p className="text-xs font-semibold text-slate-500">{result.country}</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Sorting Result */}
              <div className="mt-4 pt-6 border-t border-slate-100">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Scan className="w-32 h-32 transform rotate-12" />
                   </div>
                   
                   <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-2">Routing Destination</p>
                   <h3 className="text-3xl font-black mb-1 tracking-tight">{result.sorting_center_name}</h3>
                   <div className="inline-block bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-mono mt-3 border border-white/30 font-bold shadow-sm">
                     ID: {result.sorting_center_id}
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