'use client'

import { useState } from 'react'
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
import type { GameSettings } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'

interface GameSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: GameSettings
  onSave: (settings: GameSettings) => void
}

export function GameSettingsModal({
  open,
  onOpenChange,
  settings,
  onSave,
}: GameSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<GameSettings>(settings)

  const handleSave = () => {
    onSave(localSettings)
    onOpenChange(false)
  }

  const updateSetting = <K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Game Settings</DialogTitle>
          <DialogDescription>
            Configure the game before starting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Songs Required */}
          <div className="space-y-2">
            <Label>Songs per player</Label>
            <div className="flex gap-2">
              {([5, 10, 15] as const).map(num => (
                <Button
                  key={num}
                  variant={localSettings.songsRequired === num ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSetting('songsRequired', num)}
                  className="flex-1"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>

          {/* Christmas Songs Required */}
          <div className="space-y-2">
            <Label>Required Christmas songs</Label>
            <p className="text-xs text-muted-foreground">
              Minimum festive songs (verified by AI)
            </p>
            <div className="flex gap-2">
              {[0, Math.ceil(localSettings.songsRequired / 2), localSettings.songsRequired].map(num => (
                <Button
                  key={num}
                  variant={localSettings.christmasSongsRequired === num ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSetting('christmasSongsRequired', num)}
                  className="flex-1"
                >
                  {num === 0 ? 'None' : num === localSettings.songsRequired ? 'All' : num}
                </Button>
              ))}
            </div>
          </div>

          {/* Chameleon Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Chameleon Mode</Label>
              <p className="text-xs text-muted-foreground">
                Pick 1 song you think others will also pick
              </p>
            </div>
            <Switch
              checked={localSettings.chameleonMode}
              onCheckedChange={(checked) => updateSetting('chameleonMode', checked)}
            />
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

          {/* Reveal After Each Round */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Reveal answers</Label>
              <p className="text-xs text-muted-foreground">
                Show who picked each song after voting
              </p>
            </div>
            <Switch
              checked={localSettings.revealAfterEachRound}
              onCheckedChange={(checked) => updateSetting('revealAfterEachRound', checked)}
            />
          </div>

          {/* Allow Duplicates */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow duplicate songs</Label>
              <p className="text-xs text-muted-foreground">
                Multiple players can pick the same song
              </p>
            </div>
            <Switch
              checked={localSettings.allowDuplicateSongs}
              onCheckedChange={(checked) => updateSetting('allowDuplicateSongs', checked)}
            />
          </div>

          {/* Lobby Music */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Lobby music</Label>
              <p className="text-xs text-muted-foreground">
                Play festive music while waiting
              </p>
            </div>
            <Switch
              checked={localSettings.lobbyMusic}
              onCheckedChange={(checked) => updateSetting('lobbyMusic', checked)}
            />
          </div>

          {/* Trivia Round */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Trivia round</Label>
              <p className="text-xs text-muted-foreground">
                Add trivia questions between song halves
              </p>
            </div>
            <Switch
              checked={localSettings.triviaEnabled}
              onCheckedChange={(checked) => updateSetting('triviaEnabled', checked)}
            />
          </div>

          {/* Trivia Question Count */}
          {localSettings.triviaEnabled && (
            <div className="space-y-2">
              <Label>Trivia questions</Label>
              <div className="flex gap-2">
                {([5, 10] as const).map(num => (
                  <Button
                    key={num}
                    variant={localSettings.triviaQuestionCount === num ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSetting('triviaQuestionCount', num)}
                    className="flex-1"
                  >
                    {num}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
