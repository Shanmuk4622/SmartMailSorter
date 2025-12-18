import React, { useState, useEffect, useRef } from 'react';
import { MailData, ProcessingOptions, ScanResult } from '../types';
import { extractMailData } from '../geminiService';
import { processImage } from '../imageUtils';
import { Loader2, Upload, Scan, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
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

  // Load state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.options) setOptions(parsed.options);
        // We do not restore the image itself to avoid quota issues, 
        // but we can restore the last result text if needed.
        if (parsed.result) setResult(parsed.result);
      }
    } catch (e) {
      console.warn("Failed to load saved scanner state:", e);
    }
  }, []);

  // Save state on change
  useEffect(() => {
    try {
      // FIX: Do NOT save 'image' or 'processedImage' to localStorage.
      // Base64 images are too large (~2MB+) and exceed the 5MB quota immediately.
      const stateToSave = {
        result,
        options,
        // error // Don't persist errors
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      // This catch block should be less frequent now
      console.warn("Failed to auto-save scanner state:", e);
    }
  }, [result, options]); // Removed 'image' and 'error' from dependencies

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log("File selected:", file.name, file.type, file.size);
      
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        console.warn("Invalid file type uploaded:", file.type);
        setError("Invalid file type. Please upload a JPG or PNG image.");
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; 
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          console.log("File read successfully as DataURL");
          setImage(ev.target.result as string);
          setResult(null);
          setProcessedImage(null); 
        }
      };
      reader.onerror = (err) => {
        console.error("FileReader error:", err);
        setError("Failed to read file.");
      }
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (image) {
      console.log("Processing image with options:", options);
      processImage(image, options).then(processed => {
        console.log("Image processing complete.");
        setProcessedImage(processed);
      }).catch(err => {
        console.error("Image processing failed:", err);
        setError("Failed to process image filters.");
      });
    }
  }, [image, options]);

  const handleScan = async () => {
    if (!processedImage) return;
    setIsProcessing(true);
    setError(null);
    const start = Date.now();
    console.log("Starting scan operation...");

    try {
      // 1. Extract Data
      console.log("Invoking extractMailData...");
      const data = await extractMailData(processedImage);
      console.log("Extraction successful. Result:", data);
      setResult(data);

      // 2. Insert into Supabase
      console.log("Saving result to Supabase...");
      
      // Safety check: ensure confidence is an integer 0-100 before DB insert
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
          confidence: safeConfidence, // Use the sanitized value
          status: 'completed'
        }])
        .select();

      if (dbError) {
        console.error("Supabase Insert Error:", dbError.message, dbError.details);
        // We log it but don't stop the user from seeing the result
      } else {
        console.log("Supabase insert successful:", dbData);
      }

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
      console.error("Scanner Error Caught:", err);
      
      let msg = "An unexpected error occurred.";
      
      if (err.message) {
        if (err.message.includes("fetch failed") || err.message.includes("NetworkError")) {
           msg = "Network connection failed. Please check your internet.";
        } else if (err.message.includes("Invalid JSON")) {
           msg = "Could not read address data from image. Please try a clearer photo.";
        } else if (err.message.includes("429")) {
           msg = "Too many requests. Please wait a moment before trying again.";
        } else if (err.message.includes("503")) {
           msg = "AI Service is temporarily unavailable.";
        } else if (err.message.includes("API key")) {
           msg = "System Configuration Error: Invalid API Key.";
        } else {
           msg = `Extraction failed: ${err.message}`;
        }
      }
      
      setError(msg);
    } finally {
      setIsProcessing(false);
      console.log("Scan operation finished.");
    }
  };

  const reset = () => {
    console.log("Resetting scanner state.");
    setImage(null);
    setProcessedImage(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    localStorage.removeItem(STORAGE_KEY);
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
              className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 cursor-pointer transition-colors min-h-[300px] ${
                error 
                  ? 'border-red-300 bg-red-50 hover:bg-red-50' 
                  : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              {error ? (
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
              ) : (
                <Upload className="w-12 h-12 text-slate-400 mb-4" />
              )}
              
              <p className={`${error ? 'text-red-700' : 'text-slate-600'} font-medium`}>
                {error || "Click to upload envelope image"}
              </p>
              
              <p className={`${error ? 'text-red-500' : 'text-slate-400'} text-sm mt-2`}>
                Supports JPG, PNG
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
            <div className="flex-1 flex flex-col gap-4">
              <div className="relative rounded-lg overflow-hidden bg-slate-100 border border-slate-200 aspect-video flex items-center justify-center">
                <img 
                  src={processedImage || image} 
                  alt="Preview" 
                  className="max-h-full max-w-full object-contain" 
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

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