import { useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthProvider'
import {
  ACTIVITEIT_SLEUTEL,
  bepaalInactiviteit,
  leesLaatsteActiviteit,
  registreerActiviteit,
  type InactiviteitStatus,
} from './inactiviteit'
import { Button } from '../components/Button'

const ACTIVITEIT_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/** Schrijft activiteit hooguit eens per 5 seconden weg. */
const SCHRIJF_INTERVAL_MS = 5000

export function InactiviteitBewaker({ timeoutMinutes }: { timeoutMinutes: number }) {
  const { uitloggen } = useAuth()
  const timeoutMs = timeoutMinutes * 60 * 1000
  const [status, setStatus] = useState<InactiviteitStatus>({ soort: 'actief' })
  const laatstGeschreven = useRef(0)

  useEffect(() => {
    let gestopt = false

    const controleer = () => {
      if (gestopt) return
      const nieuw = bepaalInactiviteit(leesLaatsteActiviteit(localStorage), Date.now(), timeoutMs)
      setStatus(nieuw)
      if (nieuw.soort === 'verlopen') {
        gestopt = true
        void uitloggen(`Je bent automatisch uitgelogd na ${timeoutMinutes} minuten zonder activiteit.`)
      }
    }

    const opActiviteit = () => {
      const nu = Date.now()
      if (nu - laatstGeschreven.current < SCHRIJF_INTERVAL_MS) return
      laatstGeschreven.current = nu
      registreerActiviteit(localStorage, nu)
      controleer()
    }

    // Activiteit in een ander tabblad telt ook.
    const opOpslag = (e: StorageEvent) => {
      if (e.key === ACTIVITEIT_SLEUTEL) controleer()
    }

    controleer()
    const interval = window.setInterval(controleer, 1000)
    for (const naam of ACTIVITEIT_EVENTS) window.addEventListener(naam, opActiviteit, { passive: true })
    window.addEventListener('storage', opOpslag)
    // Na slaapstand lopen timers achter: direct controleren bij terugkomst.
    document.addEventListener('visibilitychange', controleer)

    return () => {
      gestopt = true
      window.clearInterval(interval)
      for (const naam of ACTIVITEIT_EVENTS) window.removeEventListener(naam, opActiviteit)
      window.removeEventListener('storage', opOpslag)
      document.removeEventListener('visibilitychange', controleer)
    }
  }, [timeoutMs, timeoutMinutes, uitloggen])

  if (status.soort !== 'waarschuwing') return null

  return (
    <Waarschuwing
      resterendMs={status.resterendMs}
      opBlijven={() => {
        laatstGeschreven.current = Date.now()
        registreerActiviteit(localStorage)
        setStatus({ soort: 'actief' })
      }}
    />
  )
}

function Waarschuwing({ resterendMs, opBlijven }: { resterendMs: number; opBlijven: () => void }) {
  const dialoog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialoog.current
    if (el && !el.open) el.showModal()
    return () => el?.close()
  }, [])

  const seconden = Math.max(0, Math.ceil(resterendMs / 1000))
  const tijd = `${Math.floor(seconden / 60)}:${String(seconden % 60).padStart(2, '0')}`

  return (
    <dialog
      ref={dialoog}
      aria-labelledby="inactief-titel"
      aria-describedby="inactief-tekst"
      // Escape sluit de dialoog niet stilzwijgend: kiezen gebeurt met de knop.
      onCancel={(e) => {
        e.preventDefault()
        opBlijven()
      }}
      className="m-auto max-w-md rounded-card bg-neutral-0 p-6 text-anthracite shadow-raised backdrop:bg-anthracite/60"
    >
      <h2 id="inactief-titel" className="text-subkop font-bold">
        Ben je er nog?
      </h2>
      <p id="inactief-tekst" className="mt-3">
        Je wordt over <span className="font-semibold tabular-nums">{tijd}</span> automatisch
        uitgelogd.
      </p>
      <div className="mt-6">
        <Button onClick={opBlijven}>Ingelogd blijven</Button>
      </div>
    </dialog>
  )
}
