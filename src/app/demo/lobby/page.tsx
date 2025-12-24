'use client'

import { LobbyView } from '@/app/room/[code]/components/lobby-view'
import { FestiveBackground } from '@/components/festive-background'
import {
  DEMO_ROOM,
  DEMO_PARTICIPANTS,
  DEMO_CURRENT_PARTICIPANT,
} from '@/lib/demo-data'

/**
 * Demo page for the room lobby - used for screenshots
 * Access at /demo/lobby
 */
export default function DemoLobbyPage() {
  return (
    <>
      <FestiveBackground showSnow={true} />
      <LobbyView
        room={DEMO_ROOM}
        participants={DEMO_PARTICIPANTS}
        currentParticipant={DEMO_CURRENT_PARTICIPANT}
        onStartGame={() => {}}
        onPickSongs={() => {}}
        onUpdateRoomName={() => {}}
        onRemoveParticipant={async () => {}}
      />
    </>
  )
}
