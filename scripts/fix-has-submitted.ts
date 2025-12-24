/**
 * Quick fix script to sync has_submitted flag based on actual submissions
 * Run with: npx tsx scripts/fix-has-submitted.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables from .env.local
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixHasSubmitted() {
  // Participant IDs that need fixing
  const participantIds = [
    '30cb3f66-1471-4b26-8b38-d3717e4a630f', // Mikey Harper
    '415c2263-b7f5-4089-b092-2362eb9dc781', // Mum
  ]

  console.log('Fixing has_submitted for participants:', participantIds)

  const { data, error } = await supabase
    .from('participants')
    .update({ has_submitted: true })
    .in('id', participantIds)
    .select()

  if (error) {
    console.error('Error updating participants:', error)
    return
  }

  console.log('Updated participants:', data)
  console.log('Done!')
}

fixHasSubmitted()
