// Enhanced data import system for the CSV data
import { supabase } from './supabaseClient';

interface CSVRecord {
  timestamp: string;
  recipient: string;
  address: string;
  pinZip: string;
  city: string;
  country: string;
  sortingCenterId: string;
  confidence: number;
}

// Parse CSV data and convert to database format
export const parseCSVData = (csvContent: string): CSVRecord[] => {
  const lines = csvContent.split('\n').slice(1); // Skip header
  const records: CSVRecord[] = [];
  
  lines.forEach((line) => {
    if (!line.trim()) return;
    
    // Parse CSV line (handling quoted fields)
    const matches = line.match(/("([^"]|"")*"|[^",]*)(,("([^"]|"")*"|[^",]*))/g);
    if (!matches || matches.length < 8) return;
    
    const fields = matches.map(field => 
      field.replace(/^,?"?|"?$/g, '').replace(/""/g, '"')
    );
    
    records.push({
      timestamp: fields[0],
      recipient: fields[1] || '',
      address: fields[2] || '',
      pinZip: fields[3] || '',
      city: fields[4] || '',
      country: fields[5] || '',
      sortingCenterId: fields[6] || '',
      confidence: parseInt(fields[7]) || 0
    });
  });
  
  return records;
};

// Import CSV data to Supabase
export const importCSVToDatabase = async (csvContent: string) => {
  const records = parseCSVData(csvContent);
  console.log(`🔄 Importing ${records.length} records from CSV...`);
  
  const importData = records
    .filter(record => record.confidence >= 80) // Only high-confidence data
    .map(record => ({
      recipient: record.recipient || 'Unknown',
      address: record.address || 'Address not available',
      city: record.city || 'Unknown City',
      state: extractStateFromAddress(record.address),
      country: record.country || 'Unknown',
      pin_code: record.pinZip,
      sorting_center_id: record.sortingCenterId || 'UNKNOWN',
      sorting_center_name: generateSortingCenterName(record.sortingCenterId, record.city),
      confidence: record.confidence,
      created_at: new Date(record.timestamp).toISOString()
    }));
    
  try {
    const { data, error } = await supabase
      .from('mail_scans')
      .insert(importData);
      
    if (error) {
      console.error('❌ Import error:', error);
      throw error;
    }
    
    console.log(`✅ Successfully imported ${importData.length} records`);
    return data;
  } catch (err) {
    console.error('❌ Failed to import CSV data:', err);
    throw err;
  }
};

// Extract state from address string
const extractStateFromAddress = (address: string): string => {
  if (!address) return '';
  
  // Common Indian states
  const statePatterns = [
    { pattern: /maharashtra/i, state: 'MH' },
    { pattern: /rajasthan/i, state: 'RJ' },
    { pattern: /tamil nadu/i, state: 'TN' },
    { pattern: /karnataka/i, state: 'KA' },
    { pattern: /andhra pradesh/i, state: 'AP' },
    { pattern: /telangana/i, state: 'TG' },
    { pattern: /west bengal/i, state: 'WB' },
    { pattern: /uttar pradesh/i, state: 'UP' },
    { pattern: /bihar/i, state: 'BR' },
    { pattern: /delhi/i, state: 'DL' },
    { pattern: /himachal pradesh/i, state: 'HP' },
    { pattern: /assam/i, state: 'AS' },
    
    // US states
    { pattern: /michigan|mi/i, state: 'MI' },
    { pattern: /nebraska|ne/i, state: 'NE' }
  ];
  
  for (const { pattern, state } of statePatterns) {
    if (pattern.test(address)) return state;
  }
  
  return '';
};

// Generate sorting center name from ID and city
const generateSortingCenterName = (id: string, city: string): string => {
  if (!id || id === 'N/A' || id === 'UNKNOWN') {
    return `${city || 'Unknown'} Processing Center`;
  }
  
  // Handle different ID formats
  if (id.includes('PDC')) return `${city} Processing & Distribution Center`;
  if (id.includes('HUB')) return `${city} Mail Hub`;
  if (id.includes('SC')) return `${city} Sorting Center`;
  if (id.includes('RMS')) return `${city} Railway Mail Service`;
  if (id.includes('USPS')) return `USPS ${city} Facility`;
  
  return `${city || id} Mail Center`;
};

// Function to be called from browser console
export const importCSVData = async () => {
  try {
    const response = await fetch('/assets/smartmail_export_2025-12-19.csv');
    const csvContent = await response.text();
    await importCSVToDatabase(csvContent);
    console.log('🎉 CSV import completed successfully!');
  } catch (error) {
    console.error('❌ CSV import failed:', error);
  }
};

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).importCSVData = importCSVData;
  console.log('📊 CSV import function available: window.importCSVData()');
}