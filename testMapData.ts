// Test utility to add sample data for testing the geographic map
import { supabase } from './supabaseClient';

export const addTestMapData = async () => {
  const testData = [
    {
      recipient: "John Doe",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      sorting_center_id: "NYC-001",
      sorting_center_name: "NYC Main Hub",
      confidence: 95,
      status: "completed"
    },
    {
      recipient: "Jane Smith", 
      address: "456 Oak Ave",
      city: "Los Angeles",
      state: "CA", 
      sorting_center_id: "LAX-003",
      sorting_center_name: "LA West Coast Hub",
      confidence: 88,
      status: "completed"
    },
    {
      recipient: "Bob Johnson",
      address: "789 Pine St", 
      city: "Chicago",
      state: "IL",
      sorting_center_id: "CHI-002",
      sorting_center_name: "Chicago Central",
      confidence: 92,
      status: "processing"
    },
    {
      recipient: "Alice Brown",
      address: "321 Elm Dr",
      city: "Miami", 
      state: "FL",
      sorting_center_id: "MIA-004",
      sorting_center_name: "Miami Southeast",
      confidence: 85,
      status: "completed"
    },
    {
      recipient: "Charlie Wilson",
      address: "654 Maple Ln",
      city: "Seattle",
      state: "WA",
      sorting_center_id: "SEA-005", 
      sorting_center_name: "Seattle Pacific Northwest",
      confidence: 91,
      status: "processing"
    }
  ];

  try {
    const { data, error } = await supabase
      .from('mail_scans')
      .insert(testData);
      
    if (error) {
      console.error('Error inserting test data:', error);
    } else {
      console.log('✅ Test geographic data added successfully');
    }
  } catch (err) {
    console.error('Error adding test data:', err);
  }
};

// Call this function to add test data
if (typeof window !== 'undefined') {
  (window as any).addTestMapData = addTestMapData;
  console.log('🗺️ Test data function available: window.addTestMapData()');
}