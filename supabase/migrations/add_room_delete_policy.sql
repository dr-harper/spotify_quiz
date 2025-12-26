-- Add DELETE policy for rooms table
-- Allows hosts to delete their own rooms

CREATE POLICY "Hosts can delete their rooms" ON public.rooms
  FOR DELETE USING (host_id = auth.uid());
