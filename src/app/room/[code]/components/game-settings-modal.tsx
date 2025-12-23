'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import type { GameSettings } from '@/types/database'

interface GameSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: GameSettings
  onSave: (settings: GameSettings) => void
  isSaving?: boolean
}

export function GameSettingsModal({
  open,
  onOpenChange,
  settings,
  onSave,
  isSaving = false,
}: GameSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<GameSettings>(settings)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const handleSave = () => {
    onSave(localSettings)
    onOpenChange(false)
  }

  const clampSettings = (updatedSettings: GameSettings): GameSettings => {
    const songsRequired = Math.max(1, Math.min(20, updatedSettings.songsRequired))
    return {
      ...updatedSettings,
      songsRequired,
      christmasSongsRequired: Math.min(updatedSettings.christmasSongsRequired, songsRequired),
      recentSongsRequired: Math.min(updatedSettings.recentSongsRequired, songsRequired),
    }
  }

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setLocalSettings(prev => clampSettings({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Game Settings</DialogTitle>
          <DialogDescription>
            Configure the game before starting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Songs Required */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Songs per player</Label>
              <span className="text-sm font-medium">{localSettings.songsRequired}</span>
            </div>
            <Slider
              value={[localSettings.songsRequired]}
              onValueChange={([value]) => updateSetting('songsRequired', value)}
              max={20}
              min={1}
              step={1}
              className="w-full"
            />
          </div>

          {/* Christmas Songs Required */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Required Christmas songs</Label>
              <span className="text-sm font-medium">
                {localSettings.christmasSongsRequired === 0
                  ? 'None'
                  : localSettings.christmasSongsRequired === localSettings.songsRequired
                    ? 'All'
                    : localSettings.christmasSongsRequired}
              </span>
            </div>
            <Slider
              value={[localSettings.christmasSongsRequired]}
              onValueChange={([value]) => updateSetting('christmasSongsRequired', value)}
              max={localSettings.songsRequired}
              min={0}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Minimum festive songs (verified by AI)
            </p>
          </div>

          {/* Recent Songs Required */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Songs from this year</Label>
              <span className="text-sm font-medium">
                {localSettings.recentSongsRequired === 0
                  ? 'Off'
                  : localSettings.recentSongsRequired}
              </span>
            </div>
            <Slider
              value={[localSettings.recentSongsRequired]}
              onValueChange={([value]) => updateSetting('recentSongsRequired', value)}
              max={localSettings.songsRequired}
              min={0}
              step={1}
              className="w-full"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Chameleon Mode */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Chameleon Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Pick one song disguised as someone else&apos;s taste.
                </p>
              </div>
              <Switch
                checked={localSettings.chameleonMode}
                onCheckedChange={(checked) => updateSetting('chameleonMode', checked)}
              />
            </div>

            {/* Allow Duplicates */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Allow duplicate songs</Label>
                <p className="text-xs text-muted-foreground">Multiple players can pick the same song.</p>
              </div>
              <Switch
                checked={localSettings.allowDuplicateSongs}
                onCheckedChange={(checked) => updateSetting('allowDuplicateSongs', checked)}
              />
            </div>

            {/* Reveal After Each Round */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Reveal answers</Label>
                <p className="text-xs text-muted-foreground">Show who picked each song after voting.</p>
              </div>
              <Switch
                checked={localSettings.revealAfterEachRound}
                onCheckedChange={(checked) => updateSetting('revealAfterEachRound', checked)}
              />
            </div>

            {/* Lobby Music */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Lobby music</Label>
                <p className="text-xs text-muted-foreground">Play festive music while waiting.</p>
              </div>
              <Switch
                checked={localSettings.lobbyMusic}
                onCheckedChange={(checked) => updateSetting('lobbyMusic', checked)}
              />
            </div>

            {/* Snow Effect */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Snow effect</Label>
                <p className="text-xs text-muted-foreground">Falling snow animation in the background.</p>
              </div>
              <Switch
                checked={localSettings.snowEffect}
                onCheckedChange={(checked) => updateSetting('snowEffect', checked)}
              />
            </div>
          </div>

          {/* Guess Timer */}
          <div className="space-y-2">
            <Label>Guess timer</Label>
            <div className="flex gap-2">
              {[
                { value: null, label: 'Off' },
                { value: 15, label: '15s' },
                { value: 30, label: '30s' },
              ].map(({ value, label }) => (
                <Button
                  key={label}
                  variant={localSettings.guessTimerSeconds === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSetting('guessTimerSeconds', value)}
                  className="flex-1"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Preview Length */}
          <div className="space-y-2">
            <Label>Preview length</Label>
            <div className="flex gap-2">
              {([15, 30] as const).map(num => (
                <Button
                  key={num}
                  variant={localSettings.previewLengthSeconds === num ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSetting('previewLengthSeconds', num)}
                  className="flex-1"
                >
                  {num}s
                </Button>
              ))}
            </div>
          </div>

          {/* Trivia Round */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Trivia round</Label>
                <p className="text-xs text-muted-foreground">Add trivia questions between song halves.</p>
              </div>
              <Switch
                checked={localSettings.triviaEnabled}
                onCheckedChange={(checked) => updateSetting('triviaEnabled', checked)}
              />
            </div>
            {localSettings.triviaEnabled && (
              <div className="flex gap-2">
                {([5, 10] as const).map(num => (
                  <Button
                    key={num}
                    variant={localSettings.triviaQuestionCount === num ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSetting('triviaQuestionCount', num)}
                    className="flex-1"
                  >
                    {num} questions
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Theme colour */}
          <div className="space-y-2">
            <Label>Theme colour</Label>
            <div className="grid grid-cols-5 gap-2">
              {([
                { value: 'green', label: '🌲', bg: 'bg-green-600' },
                { value: 'red', label: '🎅', bg: 'bg-red-600' },
                { value: 'blue', label: '❄️', bg: 'bg-blue-600' },
                { value: 'purple', label: '🔮', bg: 'bg-purple-600' },
                { value: 'gold', label: '⭐', bg: 'bg-yellow-600' },
              ] as const).map(({ value, label, bg }) => (
                <Button
                  key={value}
                  variant={localSettings.themeColor === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSetting('themeColor', value)}
                  className={`flex-1 ${localSettings.themeColor === value ? bg : ''}`}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
