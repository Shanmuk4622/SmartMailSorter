// Quick test script for CSV import
console.log('🧪 Testing CSV import functionality...');

// Test if import function is available
if (window.importCSVData) {
  console.log('✅ CSV import function is available');
  console.log('📋 To import CSV data, run: window.importCSVData()');
  
  // Auto-import for demo
  setTimeout(() => {
    console.log('🚀 Auto-importing CSV data in 3 seconds...');
    window.importCSVData();
  }, 3000);
} else {
  console.log('❌ CSV import function not found');
}

// Display current stats
console.log('📊 Current page stats:');
console.log('- Current URL:', window.location.href);
console.log('- Available functions:', Object.keys(window).filter(k => k.includes('import')));