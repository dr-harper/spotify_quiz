declare module 'spotify-preview-finder' {
  interface TrackResult {
    name: string
    trackId: string
    previewUrls: string[]
    albumName: string
  }

  interface PreviewResult {
    success: boolean
    results?: TrackResult[]
    error?: string
  }

  function spotifyPreviewFinder(
    query: string,
    limit?: number
  ): Promise<PreviewResult>

  export default spotifyPreviewFinder
}
