import React, { useState, useEffect, useRef } from 'react';
import { MailData, ProcessingOptions, ScanResult } from '../types';
import { extractMailData } from '../geminiService';
import { processImage } from '../imageUtils';
import { Loader2, Upload, Scan, RotateCcw, CheckCircle, AlertTriangle, ArrowRight, Image as ImageIcon, Sparkles, Cpu, Crosshair } from 'lucide-react';
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
  const [cnnLog, setCnnLog] = useState<string>("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

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

  // CNN Visualization Effect
  useEffect(() => {
    if (!isProcessing || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frames = 0;
    const logs = [
      "Initializing Neural Network...",
      "Loading Tensor Weights...",
      "Detecting Edges...",
      "Extracting ROI...",
      "Normalizing Inputs...",
      "Performing OCR Inference...",
      "Classifying Region...",
      "Confidence Analysis..."
    ];

    const animate = () => {
      // Clear semi-transparently for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (frames % 10 === 0) {
        // Draw random bounding boxes to simulate object detection
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const w = Math.random() * 100 + 50;
        const h = Math.random() * 30 + 10;
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fillRect(x, y, w, h);

        // Simulated confidence text
        ctx.fillStyle = '#00ff00';
        ctx.font = '10px monospace';
        ctx.fillText(`CONF: ${(Math.random() * 0.9 + 0.1).toFixed(2)}`, x, y - 5);
      }

      // Update pseudo-log
      if (frames % 40 === 0 && frames / 40 < logs.length) {
        setCnnLog(logs[Math.floor(frames / 40)]);
      }

      frames++;
      requestRef.current = requestAnimationFrame(animate);
    };

    // Set canvas size to match displayed image
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    animate();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isProcessing]);

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
    setCnnLog("Initializing...");
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
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex-1 flex flex-col hover:shadow-lg transition-all duration-500 relative overflow-hidden group">
          {/* Subtle tech grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

          <div className="flex items-center justify-between mb-6 relative z-10">
             <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-200">
                <ImageIcon className="w-5 h-5" />
              </div>
              Visual Input Stream
            </h2>
            {image && (
               <button 
                  onClick={reset}
                  className="text-xs font-semibold text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
            )}
          </div>

          {!image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 cursor-pointer transition-all duration-300 relative overflow-hidden bg-slate-50/50 hover:bg-blue-50/30 ${
                error ? 'border-red-300' : 'border-slate-300 hover:border-blue-400'
              }`}
            >
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-xl transition-transform duration-300 relative z-10 ${error ? 'bg-red-100 text-red-500' : 'bg-white text-blue-600'}`}>
                {error ? <AlertTriangle className="w-10 h-10" /> : <Upload className="w-10 h-10" />}
              </div>
              
              <h3 className={`text-lg font-bold mb-2 relative z-10 ${error ? 'text-red-700' : 'text-slate-700'}`}>
                {error || "Upload Envelope"}
              </h3>
              <p className="text-slate-400 text-center max-w-xs relative z-10 text-sm">
                Drop image here to initialize neural extraction pipeline.
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
            <div className="flex-1 flex flex-col gap-6 animate-fade-in relative z-10">
              {/* Image Container with "CNN" Overlay */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl aspect-video flex items-center justify-center group/img">
                <img 
                  src={processedImage || image} 
                  alt="Preview" 
                  className="max-h-full max-w-full object-contain" 
                  style={{ opacity: isProcessing ? 0.6 : 1, transition: 'opacity 0.3s' }}
                />
                
                {/* CNN Overlay Canvas */}
                {isProcessing && (
                  <>
                    <canvas 
                      ref={canvasRef} 
                      className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen"
                    />
                    {/* Scanning Line */}
                    <div className="absolute left-0 w-full h-1 bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.8)] animate-scan pointer-events-none"></div>
                    
                    {/* Tech Text Overlay */}
                    <div className="absolute bottom-4 left-4 font-mono text-xs text-green-400 bg-black/80 px-3 py-1 rounded border border-green-500/30">
                      <span className="animate-pulse">●</span> {cnnLog}
                    </div>
                  </>
                )}

                {/* Filter Badge */}
                {!isProcessing && (
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center opacity-0 group-hover/img:opacity-100 transition-all duration-300">
                    <Sparkles className="w-3 h-3 text-yellow-400 mr-2" />
                    <span className="text-xs text-white/90 font-bold uppercase tracking-wider">
                      {options.grayscale ? 'B&W ' : ''}
                      {options.highContrast ? 'Hi-Con' : 'Original'}
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-700 shadow-sm animate-fade-in">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">Processing Error</span>
                    {error}
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="flex items-center justify-between mb-3">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pre-Processing</label>
                   <Cpu className="w-4 h-4 text-slate-300" />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setOptions(p => ({ ...p, grayscale: !p.grayscale }))}
                    disabled={isProcessing}
                    className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg transition-all border ${options.grayscale ? 'bg-slate-800 text-white border-slate-800 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                  >
                    Grayscale
                  </button>
                  <button 
                    onClick={() => setOptions(p => ({ ...p, highContrast: !p.highContrast }))}
                    disabled={isProcessing}
                    className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg transition-all border ${options.highContrast ? 'bg-slate-800 text-white border-slate-800 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                  >
                    High Contrast
                  </button>
                </div>
              </div>

              <button
                onClick={handleScan}
                disabled={isProcessing}
                className="mt-auto w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 disabled:opacity-80 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all active:scale-[0.98] group"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-blue-200" />
                    <span>Neural Processing...</span>
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>Initiate Scan</span>
                    <ArrowRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Results */}
      <div className="flex flex-col gap-6">
        <div className={`bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-full flex flex-col transition-all duration-500 relative overflow-hidden ${result ? 'ring-1 ring-emerald-500/30' : ''}`}>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
              <div className={`p-2 rounded-lg shadow-md transition-colors ${result ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                {result ? <CheckCircle className="w-5 h-5" /> : <Crosshair className="w-5 h-5" />}
              </div>
              Inference Result
            </h2>
            {result && (
              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{result.confidence}% Match</span>
            )}
          </div>

          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center p-8 relative z-10">
               <div className="w-32 h-32 rounded-full border-4 border-slate-100 flex items-center justify-center mb-6 relative">
                 <div className="absolute inset-0 rounded-full border-t-4 border-blue-500 animate-spin opacity-20"></div>
                 <Scan className="w-10 h-10 opacity-30 text-blue-500" />
               </div>
               <h3 className="text-lg font-bold text-slate-600 mb-2">Awaiting Input</h3>
               <p className="max-w-xs text-sm font-medium opacity-70">Neural engine standby. Upload envelope to begin classification.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in relative z-10">
              
              {/* Confidence Meter */}
              <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Confidence Level</span>
                  <span className={`text-2xl font-black ${result.confidence > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{result.confidence}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${result.confidence > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                    style={{ width: `${result.confidence}%` }}
                  ></div>
                </div>
              </div>

              {/* Data Card */}
              <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
                 {/* Recipient */}
                 <div>
                   <label className="text-xs text-slate-400 font-bold uppercase block mb-1">Recipient</label>
                   <p className="text-xl font-bold text-slate-800">{result.recipient}</p>
                 </div>

                 {/* Address */}
                 <div>
                    <label className="text-xs text-slate-400 font-bold uppercase block mb-1">Detailed Address</label>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 font-medium leading-relaxed">
                      {result.address}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase block mb-1">PIN / ZIP</label>
                      <p className="text-lg font-mono font-bold text-blue-600">{result.pin_code}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase block mb-1">Region</label>
                      <p className="text-lg font-bold text-slate-800">{result.city}</p>
                    </div>
                 </div>
              </div>

              {/* Sorting Result Card */}
              <div className="mt-4 pt-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
                   {/* Abstract tech lines */}
                   <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                   <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500 rounded-full blur-[50px] opacity-20"></div>

                   <p className="relative text-blue-200 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                     <CheckCircle className="w-3 h-3" /> Routing Assigned
                   </p>
                   <h3 className="relative text-2xl font-black mb-1 tracking-tight text-white">{result.sorting_center_name}</h3>
                   <div className="relative inline-block bg-white/10 backdrop-blur-sm px-3 py-1 rounded-md text-sm font-mono mt-3 border border-white/20 text-blue-100">
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