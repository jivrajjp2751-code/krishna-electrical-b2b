/**
 * Krishna Electrical Works — Supabase Cloud API
 * All data is stored permanently in Supabase (PostgreSQL + Storage)
 * No local Express backend needed anymore!
 */

import { supabase } from '../lib/supabase';

// ── Key-Value Store ──────────────────────────────

/** Fetch all data from Supabase (returns object of all keys) */
export async function fetchAllData() {
  try {
    const { data, error } = await supabase.from('store').select('key, value');
    if (error) throw error;
    if (!data || data.length === 0) return {};
    const result = {};
    data.forEach(row => {
      result[row.key] = row.value;
    });
    return result;
  } catch (err) {
    console.warn('[API] fetchAllData failed:', err.message);
    return null;
  }
}

/** Fetch a single key from Supabase */
export async function fetchData(key) {
  try {
    const { data, error } = await supabase
      .from('store')
      .select('value')
      .eq('key', key)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw error;
    }
    return data?.value ?? null;
  } catch (err) {
    console.warn(`[API] fetchData(${key}) failed:`, err.message);
    return null;
  }
}

/** Save a single key to Supabase */
export async function saveData(key, value) {
  try {
    const { error } = await supabase
      .from('store')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn(`[API] saveData(${key}) failed:`, err.message);
    return null;
  }
}

/** Save multiple keys at once */
export async function saveAllData(data) {
  try {
    const rows = Object.entries(data).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('store').upsert(rows);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn('[API] saveAllData failed:', err.message);
    return null;
  }
}

// ── File Operations (Supabase Storage) ──────────

/** Upload a file for a customer */
export async function uploadFile(customerId, file) {
  try {
    const docId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    const fileExt = file.name.split('.').pop();
    const storagePath = `${customerId}/${docId}.${fileExt}`;

    // 1. Upload to Supabase Storage bucket "uploads"
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    // 2. Save metadata to "files" table
    const meta = {
      id: docId,
      customer_id: customerId,
      name: file.name,
      type: file.type,
      size: file.size,
      upload_date: new Date().toISOString(),
    };
    const { error: dbError } = await supabase.from('files').insert(meta);
    if (dbError) throw dbError;

    return {
      success: true,
      document: {
        id: docId,
        customerId,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadDate: meta.upload_date,
        storagePath,
      },
    };
  } catch (err) {
    console.warn('[API] File upload failed:', err.message);
    return null;
  }
}

/** Get documents for a customer */
export async function getCustomerFiles(customerId) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('customer_id', customerId)
      .order('upload_date', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      customerId: r.customer_id,
      name: r.name,
      type: r.type,
      size: r.size,
      uploadDate: r.upload_date,
    }));
  } catch (err) {
    console.warn('[API] getCustomerFiles failed:', err.message);
    return [];
  }
}

/** Helper: find the storage path for a file by listing the customer folder */
async function findFileStoragePath(docId, customerId) {
  // If we know the customer, search in their folder
  if (customerId) {
    const { data } = await supabase.storage.from('uploads').list(customerId);
    if (data) {
      const match = data.find(f => f.name.startsWith(docId));
      if (match) return `${customerId}/${match.name}`;
    }
  }
  // Fallback: look up the customer_id from the files table
  const { data: fileRow } = await supabase
    .from('files')
    .select('customer_id')
    .eq('id', docId)
    .single();
  if (fileRow) {
    const { data: listing } = await supabase.storage
      .from('uploads')
      .list(fileRow.customer_id);
    if (listing) {
      const match = listing.find(f => f.name.startsWith(docId));
      if (match) return `${fileRow.customer_id}/${match.name}`;
    }
  }
  return null;
}

/** Get the download URL for a file */
export function getFileDownloadUrl(docId) {
  // We return a function that resolves async since we need to look up the path
  return `/api/files/download/${docId}`; // will be overridden — see getFileUrl below
}

/** Get a signed URL for download or preview */
export async function getFileUrl(docId, customerId) {
  const storagePath = await findFileStoragePath(docId, customerId);
  if (!storagePath) return null;

  const { data } = supabase.storage
    .from('uploads')
    .getPublicUrl(storagePath);

  return data?.publicUrl || null;
}

/** Get the preview URL for a file */
export function getFilePreviewUrl(docId) {
  return `/api/files/preview/${docId}`; // will be overridden — see getFileUrl above
}

/** Delete a file */
export async function deleteFile(docId) {
  try {
    // 1. Find the file in storage
    const { data: fileRow } = await supabase
      .from('files')
      .select('customer_id')
      .eq('id', docId)
      .single();

    if (fileRow) {
      const storagePath = await findFileStoragePath(docId, fileRow.customer_id);
      if (storagePath) {
        await supabase.storage.from('uploads').remove([storagePath]);
      }
    }

    // 2. Delete metadata
    const { error } = await supabase.from('files').delete().eq('id', docId);
    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.warn('[API] deleteFile failed:', err.message);
    return null;
  }
}
