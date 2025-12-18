import { ProcessingOptions } from './types';

export const processImage = (
  imageSrc: string,
  options: ProcessingOptions
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple pixel manipulation loop
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Grayscale (Luminance)
        if (options.grayscale || options.highContrast) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }

        // High Contrast (Thresholding)
        if (options.highContrast) {
           // Threshold at 128
           const gray = data[i]; // already grayscaled above
           const contrastFactor = 1.5; // Basic contrast boost
           const adjusted = (gray - 128) * contrastFactor + 128;
           const final = adjusted < 100 ? 0 : 255; // Binarize slightly
           
           data[i] = final;
           data[i + 1] = final;
           data[i + 2] = final;
        }
        
        // Simple Denoise (not implemented at pixel level for perf, but placeholder)
        // A true denoise needs convolution matrix (median filter), omitted for brevity in single-file logic
        // We rely on Gemini's robustness for noise.
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
};