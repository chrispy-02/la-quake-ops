import type { LayersState } from '../map/MapView'

interface Props {
  layers: LayersState
  onChange: (layers: LayersState) => void
}

const ROWS: [keyof LayersState, string][] = [
  ['hospitals', 'Hospitals'],
  ['clinics', 'Clinics'],
  ['incidents', 'Incidents'],
  ['routes', 'Routes & units'],
  ['zones', 'Shake zones'],
  ['closures', 'Road closures'],
  ['buildings', '3D buildings'],
]

export function LayerToggles({ layers, onChange }: Props) {
  return (
    <section className="panel" aria-label="Map layers">
      <div className="panel-head">
        <span className="eyebrow">Map layers</span>
      </div>
      <div className="layers-grid">
        {ROWS.map(([key, label]) => (
          <label key={key} className="lrow">
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={(e) => onChange({ ...layers, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
    </section>
  )
}
