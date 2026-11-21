import { StatusLabel } from '../components/StatusLabel'
import { faseLabel, type Jaarplan } from './api'

/** De fase van een jaarplan naast de titel, en of het een proefjaar is. */
export function JaarplanStatus({ jaarplan }: { jaarplan: Jaarplan }) {
  return (
    <>
      <StatusLabel soort={jaarplan.fase === 'definitief' ? 'neutraal' : 'let-op'}>{faseLabel(jaarplan.fase)}</StatusLabel>
      {jaarplan.proefjaar && <StatusLabel>Proefjaar</StatusLabel>}
    </>
  )
}
