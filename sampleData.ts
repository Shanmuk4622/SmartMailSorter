// Sample data to populate visualizations for demonstration
import { ScanResult, MailData } from './types';

// Generate realistic mail scan data for Indian postal system
const generateSampleScans = (): ScanResult[] => {
  const sortingCenters = [
    { id: 'MUM-001', name: 'Mumbai Central', city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
    { id: 'DEL-002', name: 'Delhi GPO', city: 'New Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090 },
    { id: 'BLR-003', name: 'Bangalore South', city: 'Bangalore', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
    { id: 'CHE-004', name: 'Chennai Central', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
    { id: 'KOL-005', name: 'Kolkata GPO', city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
    { id: 'HYD-006', name: 'Hyderabad Secunderabad', city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
    { id: 'PUN-007', name: 'Pune Maharashtra', city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
    { id: 'AHM-008', name: 'Ahmedabad Gujarat', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 }
  ];

  const scans: ScanResult[] = [];
  const now = Date.now();
  
  // Generate scans from the last 7 days
  for (let i = 0; i < 150; i++) {
    const center = sortingCenters[Math.floor(Math.random() * sortingCenters.length)];
    const daysAgo = Math.floor(Math.random() * 7);
    const timestamp = now - (daysAgo * 24 * 60 * 60 * 1000) - (Math.random() * 24 * 60 * 60 * 1000);
    
    // 85% success rate
    const isSuccess = Math.random() > 0.15;
    
    const mailData: MailData | null = isSuccess ? {
      recipient: `Recipient ${i + 1}`,
      address: `${Math.floor(Math.random() * 999) + 1}/${Math.floor(Math.random() * 99) + 1}, ${['Main Road', 'Gandhi Street', 'MG Road', 'Station Road', 'Market Street'][Math.floor(Math.random() * 5)]}`,
      pin_code: `${Math.floor(Math.random() * 900000) + 100000}`, // Indian 6-digit PIN format
      city: center.city,
      state: center.state,
      country: 'India',
      sorting_center_id: center.id,
      sorting_center_name: center.name,
      confidence: 0.75 + Math.random() * 0.25
    } : null;

    scans.push({
      id: `scan_${i + 1}`,
      timestamp,
      originalImageUrl: `https://example.com/mail_${i + 1}.jpg`,
      processedImageUrl: `https://example.com/processed_${i + 1}.jpg`,
      data: mailData,
      status: isSuccess ? 'completed' : 'failed',
      error: isSuccess ? undefined : 'Address recognition failed',
      processingTimeMs: 800 + Math.random() * 3000 // 800ms to 3.8s
    });
  }

  return scans.sort((a, b) => b.timestamp - a.timestamp);
};

export const sampleData = generateSampleScans();

// Geographic coordinates for mapping - Enhanced with real CSV data centers
export const sortingCenterLocations = [
  // Original US centers
  { id: 'NYC-001', name: 'New York Central', city: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060, status: 'busy', traffic: 85 },
  { id: 'CHI-002', name: 'Chicago Hub', city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, status: 'active', traffic: 72 },
  { id: 'LAX-003', name: 'Los Angeles West', city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437, status: 'active', traffic: 68 },
  { id: 'MIA-004', name: 'Miami Southeast', city: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918, status: 'idle', traffic: 25 },
  { id: 'SEA-005', name: 'Seattle Northwest', city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, status: 'active', traffic: 45 },
  { id: 'ATL-006', name: 'Atlanta Central', city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880, status: 'busy', traffic: 78 },
  { id: 'DEN-007', name: 'Denver Mountain', city: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, status: 'active', traffic: 52 },
  { id: 'BOS-008', name: 'Boston Northeast', city: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589, status: 'active', traffic: 63 },
  
  // Enhanced with real CSV data centers
  
  // Rajasthan Centers
  { id: 'JPR-SC-302', name: 'Jaipur Sorting Center', city: 'Jaipur', state: 'RJ', lat: 26.9124, lng: 75.7873, status: 'busy', traffic: 92 },
  { id: 'HUB-302', name: 'Jaipur Mail Hub', city: 'Jaipur', state: 'RJ', lat: 26.9124, lng: 75.7873, status: 'active', traffic: 85 },
  { id: 'JPR-01', name: 'Jaipur Central', city: 'Jaipur', state: 'RJ', lat: 26.9124, lng: 75.7873, status: 'active', traffic: 78 },
  { id: 'JOD-342', name: 'Jodhpur Sorting Center', city: 'Jodhpur', state: 'RJ', lat: 26.2389, lng: 73.0243, status: 'active', traffic: 65 },
  { id: 'JDH-01', name: 'Jodhpur Central', city: 'Jodhpur', state: 'RJ', lat: 26.2389, lng: 73.0243, status: 'active', traffic: 60 },
  { id: 'HUB-342', name: 'Jodhpur Mail Hub', city: 'Jodhpur', state: 'RJ', lat: 26.2389, lng: 73.0243, status: 'idle', traffic: 45 },

  // Tamil Nadu Centers  
  { id: 'MAA_SC', name: 'Chennai Sorting Center', city: 'Chennai', state: 'TN', lat: 13.0827, lng: 80.2707, status: 'busy', traffic: 88 },
  { id: 'CHN-SH-01', name: 'Chennai South Hub', city: 'Chennai', state: 'TN', lat: 13.0827, lng: 80.2707, status: 'active', traffic: 82 },
  
  // Maharashtra Centers
  { id: 'PUNE-SC-01', name: 'Pune Sorting Center', city: 'Pune', state: 'MH', lat: 18.5204, lng: 73.8567, status: 'active', traffic: 75 },
  { id: 'HUB-411', name: 'Pune Mail Hub', city: 'Pune', state: 'MH', lat: 18.5204, lng: 73.8567, status: 'active', traffic: 70 },
  { id: 'SC-411', name: 'Pune SC-411', city: 'Pune', state: 'MH', lat: 18.5204, lng: 73.8567, status: 'active', traffic: 68 },
  { id: 'SC-MH-01', name: 'Maharashtra SC-01', city: 'Mumbai', state: 'MH', lat: 19.0760, lng: 72.8777, status: 'busy', traffic: 95 },
  
  // Karnataka Centers
  { id: 'BLR-01', name: 'Bangalore Central', city: 'Bangalore', state: 'KA', lat: 12.9716, lng: 77.5946, status: 'active', traffic: 80 },
  { id: 'HUB-560', name: 'Bangalore Mail Hub', city: 'Bangalore', state: 'KA', lat: 12.9716, lng: 77.5946, status: 'active', traffic: 72 },
  
  // Delhi Centers
  { id: 'ND-110', name: 'New Delhi Central', city: 'New Delhi', state: 'DL', lat: 28.6139, lng: 77.2090, status: 'busy', traffic: 98 },
  { id: 'DEL-01', name: 'Delhi Central', city: 'Delhi', state: 'DL', lat: 28.6139, lng: 77.2090, status: 'busy', traffic: 95 },
  
  // West Bengal Centers
  { id: 'KOL-700', name: 'Kolkata Central', city: 'Kolkata', state: 'WB', lat: 22.5726, lng: 88.3639, status: 'active', traffic: 85 },
  { id: 'KOL-RMS-01', name: 'Kolkata Railway Mail Service', city: 'Kolkata', state: 'WB', lat: 22.5726, lng: 88.3639, status: 'active', traffic: 78 },
  { id: 'KOL_RMS_01', name: 'Kolkata RMS Hub', city: 'Kolkata', state: 'WB', lat: 22.5726, lng: 88.3639, status: 'idle', traffic: 65 },
  
  // Himachal Pradesh Centers  
  { id: 'SHM-171', name: 'Shimla Central', city: 'Shimla', state: 'HP', lat: 31.1048, lng: 77.1734, status: 'active', traffic: 55 },
  { id: 'SC-171', name: 'Shimla SC-171', city: 'Shimla', state: 'HP', lat: 31.1048, lng: 77.1734, status: 'active', traffic: 50 },
  
  // Uttar Pradesh Centers
  { id: 'ALD-211', name: 'Allahabad Central', city: 'Allahabad', state: 'UP', lat: 25.4358, lng: 81.8463, status: 'active', traffic: 68 },
  { id: 'INLKO226001', name: 'Lucknow Processing Center', city: 'Lucknow', state: 'UP', lat: 26.8467, lng: 80.9462, status: 'active', traffic: 72 },
  
  // Andhra Pradesh & Telangana Centers
  { id: 'SC-AP-05', name: 'Andhra Pradesh SC-05', city: 'Vijayawada', state: 'AP', lat: 16.5062, lng: 80.6480, status: 'active', traffic: 65 },
  { id: 'SC-500', name: 'Hyderabad SC-500', city: 'Hyderabad', state: 'TG', lat: 17.3850, lng: 78.4867, status: 'active', traffic: 75 },
  
  // Assam Centers
  { id: 'SC-ASM-01', name: 'Assam SC-01', city: 'Guwahati', state: 'AS', lat: 26.1445, lng: 91.7362, status: 'active', traffic: 58 },
  
  // Various PIN-based centers
  { id: 'HUB-252', name: 'Hub-252 Processing Center', city: 'Unknown City', state: 'RJ', lat: 26.4499, lng: 74.6399, status: 'idle', traffic: 35 },
  { id: 'SC-252', name: 'SC-252 Sorting Center', city: 'Unknown City', state: 'RJ', lat: 26.4499, lng: 74.6399, status: 'idle', traffic: 30 },
  
  // US Centers from CSV
  { id: 'LINCOLN_NE_PDC', name: 'Lincoln NE Processing Center', city: 'Crete', state: 'NE', lat: 40.6136, lng: -96.9617, status: 'active', traffic: 60 },
  { id: 'LINCOLN-NE-PDC', name: 'Lincoln NE Distribution Center', city: 'Crete', state: 'NE', lat: 40.6136, lng: -96.9617, status: 'active', traffic: 58 },
  { id: 'MI-GR-494', name: 'Michigan Grand Rapids PDC', city: 'Zeeland', state: 'MI', lat: 42.8125, lng: -86.0187, status: 'active', traffic: 62 },
  { id: 'GRR-PDC', name: 'Grand Rapids Processing Center', city: 'Zeeland', state: 'MI', lat: 42.8125, lng: -86.0187, status: 'active', traffic: 55 },
  { id: 'USPS-MI-494', name: 'USPS Michigan 494', city: 'Zeeland', state: 'MI', lat: 42.8125, lng: -86.0187, status: 'active', traffic: 65 }
];