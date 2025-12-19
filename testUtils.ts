// Test utility to add sample data to Supabase for testing real-time updates
import { supabase } from './supabaseClient';
import { sampleData } from './sampleData';

export const insertSampleData = async () => {
  console.log('🔄 Inserting sample data to Supabase...');
  
  try {
    // Clear existing data first (optional)
    await supabase.from('mail_scans').delete().neq('id', '');
    
    // Insert sample data in the correct format for individual columns
    const dataToInsert = sampleData.map(scan => ({
      id: scan.id,
      recipient: scan.data?.recipient || 'Unknown',
      address: scan.data?.address || 'Unknown Address',
      pin_code: scan.data?.pin_code || '00000',
      city: scan.data?.city || 'Unknown City',
      state: scan.data?.state || '',
      country: scan.data?.country || 'USA',
      sorting_center_id: scan.data?.sorting_center_id || 'UNK-001',
      sorting_center_name: scan.data?.sorting_center_name || 'Unknown Center',
      confidence: Math.round((scan.data?.confidence || 0.8) * 100),
      status: scan.status,
      created_at: new Date(scan.timestamp).toISOString()
    }));

    const { data, error } = await supabase
      .from('mail_scans')
      .insert(dataToInsert)
      .select();

    if (error) {
      console.error('❌ Error inserting sample data:', error);
      return { success: false, error };
    }

    console.log(`✅ Successfully inserted ${data?.length} sample records`);
    return { success: true, count: data?.length };
    
  } catch (error) {
    console.error('❌ Exception while inserting sample data:', error);
    return { success: false, error };
  }
};

// Add a single new scan for testing real-time updates
export const addTestScan = async () => {
  const testScan = {
    id: `test_${Date.now()}`,
    recipient: "Test User",
    address: "123 Test Street", 
    pin_code: "12345",
    city: "Test City",
    state: "NY",
    country: "USA",
    sorting_center_id: "NYC-001",
    sorting_center_name: "New York Central",
    confidence: 95,
    status: 'completed' as const,
    created_at: new Date().toISOString()
  };

  console.log('🧪 Adding test scan for real-time testing...');
  
  const { data, error } = await supabase
    .from('mail_scans')
    .insert([testScan])
    .select();

  if (error) {
    console.error('❌ Error adding test scan:', error);
    return { success: false, error };
  }

  console.log('✅ Test scan added:', data?.[0]?.id);
  return { success: true, data: data?.[0] };
};