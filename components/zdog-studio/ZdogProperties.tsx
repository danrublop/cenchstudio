'use client'

import { useMemo } from 'react'
import { Move, RotateCw, Maximize, Plus, Trash2, Box, Save } from 'lucide-react'
import { useZdogStudio } from './store'

export default function ZdogProperties() {
  const scene = useZdogStudio((s) => s.scene)
  const assetName = useZdogStudio((s) => s.assetName)
  const saving = useZdogStudio((s) => s.saving)
  const { updateShape, updateProperty, updateTransform, setAssetName } = useZdogStudio()

  const selectedShape = useMemo(
    () => scene.shapes.find((s) => s.id === scene.selectedId),
    [scene.shapes, scene.selectedId],
  )

  if (!selectedShape) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] p-4">
        <div className="text-center">
          <Box size={28} className="mx-auto mb-2 opacity-20" />
          <p className="text-[11px]">Select a shape to edit</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex gap-4">
        {/* General + Transform */}
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex gap-3">
            {/* Name/Type */}
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                General
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={selectedShape.name}
                  onChange={(e) => updateShape(selectedShape.id, { name: e.target.value })}
                  className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[11px] w-24 focus:border-blue-500 outline-none"
                />
                <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{selectedShape.type}</span>
              </div>
            </div>

            {/* Translate */}
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-1">
                <Move size={8} /> Position
              </label>
              <div className="flex gap-1">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <div key={axis} className="space-y-0.5">
                    <span className="text-[7px] text-[var(--color-text-muted)] uppercase">{axis}</span>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="0.5"
                      value={(selectedShape.transforms.translate as any)[axis] || 0}
                      onChange={(e) => updateTransform(selectedShape.id, 'translate', axis, parseFloat(e.target.value))}
                      className="w-16 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-[8px] font-mono text-[var(--color-text-muted)] block">
                      {(selectedShape.transforms.translate as any)[axis] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rotate */}
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-1">
                <RotateCw size={8} /> Rotation
              </label>
              <div className="flex gap-1">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <div key={axis} className="space-y-0.5">
                    <span className="text-[7px] text-[var(--color-text-muted)] uppercase">{axis}</span>
                    <input
                      type="range"
                      min={-Math.PI}
                      max={Math.PI}
                      step="0.01"
                      value={(selectedShape.transforms.rotate as any)[axis] || 0}
                      onChange={(e) => updateTransform(selectedShape.id, 'rotate', axis, parseFloat(e.target.value))}
                      className="w-16 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <span className="text-[8px] font-mono text-[var(--color-text-muted)] block">
                      {((selectedShape.transforms.rotate as any)[axis] || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scale */}
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-1">
                <Maximize size={8} /> Scale
              </label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={typeof selectedShape.transforms.scale === 'number' ? selectedShape.transforms.scale : 1}
                onChange={(e) => updateTransform(selectedShape.id, 'scale', null, parseFloat(e.target.value))}
                className="w-16 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <span className="text-[8px] font-mono text-[var(--color-text-muted)] block">
                {typeof selectedShape.transforms.scale === 'number' ? selectedShape.transforms.scale.toFixed(1) : '1.0'}
              </span>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="space-y-1 flex-shrink-0">
          <label className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            Appearance
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedShape.properties.color || '#636'}
              onChange={(e) => updateProperty(selectedShape.id, 'color', e.target.value)}
              className="w-6 h-6 rounded bg-transparent border-none cursor-pointer"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-[var(--color-text-muted)]">Stroke</span>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={selectedShape.properties.stroke || 0}
                  onChange={(e) => updateProperty(selectedShape.id, 'stroke', parseFloat(e.target.value))}
                  className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                  {selectedShape.properties.stroke || 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-0.5 text-[8px] text-[var(--color-text-muted)]">
                  <input
                    type="checkbox"
                    checked={selectedShape.properties.fill || false}
                    onChange={(e) => updateProperty(selectedShape.id, 'fill', e.target.checked)}
                    className="w-3 h-3 accent-blue-500"
                  />{' '}
                  Fill
                </label>
                <label className="flex items-center gap-0.5 text-[8px] text-[var(--color-text-muted)]">
                  <input
                    type="checkbox"
                    checked={selectedShape.properties.visible !== false}
                    onChange={(e) => updateProperty(selectedShape.id, 'visible', e.target.checked)}
                    className="w-3 h-3 accent-blue-500"
                  />{' '}
                  Vis
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Shape-specific */}
        <div className="space-y-1 flex-shrink-0 min-w-[120px]">
          <label className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Shape</label>
          <div className="space-y-1">
            {['Ellipse', 'Cylinder', 'Cone', 'Hemisphere'].includes(selectedShape.type) && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-[var(--color-text-muted)] w-10">Diam</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={selectedShape.properties.diameter || 0}
                  onChange={(e) => updateProperty(selectedShape.id, 'diameter', parseFloat(e.target.value))}
                  className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                  {selectedShape.properties.diameter || 0}
                </span>
              </div>
            )}
            {['Rect', 'RoundedRect', 'Box'].includes(selectedShape.type) && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-[var(--color-text-muted)] w-10">W</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={selectedShape.properties.width || 0}
                    onChange={(e) => updateProperty(selectedShape.id, 'width', parseFloat(e.target.value))}
                    className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                    {selectedShape.properties.width || 0}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-[var(--color-text-muted)] w-10">H</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={selectedShape.properties.height || 0}
                    onChange={(e) => updateProperty(selectedShape.id, 'height', parseFloat(e.target.value))}
                    className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                    {selectedShape.properties.height || 0}
                  </span>
                </div>
              </>
            )}
            {selectedShape.type === 'Box' && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-[var(--color-text-muted)] w-10">D</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={selectedShape.properties.depth || 0}
                  onChange={(e) => updateProperty(selectedShape.id, 'depth', parseFloat(e.target.value))}
                  className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                  {selectedShape.properties.depth || 0}
                </span>
              </div>
            )}
            {['Cylinder', 'Cone'].includes(selectedShape.type) && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-[var(--color-text-muted)] w-10">Len</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={selectedShape.properties.length || 0}
                  onChange={(e) => updateProperty(selectedShape.id, 'length', parseFloat(e.target.value))}
                  className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                  {selectedShape.properties.length || 0}
                </span>
              </div>
            )}
            {selectedShape.type === 'Polygon' && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-[var(--color-text-muted)] w-10">Sides</span>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    step="1"
                    value={selectedShape.properties.sides || 3}
                    onChange={(e) => updateProperty(selectedShape.id, 'sides', parseInt(e.target.value))}
                    className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                    {selectedShape.properties.sides || 3}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-[var(--color-text-muted)] w-10">Rad</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={selectedShape.properties.radius || 0}
                    onChange={(e) => updateProperty(selectedShape.id, 'radius', parseFloat(e.target.value))}
                    className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                    {selectedShape.properties.radius || 0}
                  </span>
                </div>
              </>
            )}
            {selectedShape.type === 'Ellipse' && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-[var(--color-text-muted)] w-10">Qtr</span>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={selectedShape.properties.quarters || 4}
                  onChange={(e) => updateProperty(selectedShape.id, 'quarters', parseInt(e.target.value))}
                  className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                  {selectedShape.properties.quarters || 4}
                </span>
              </div>
            )}
            {selectedShape.type === 'RoundedRect' && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-[var(--color-text-muted)] w-10">Rad</span>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={selectedShape.properties.cornerRadius || 0}
                  onChange={(e) => updateProperty(selectedShape.id, 'cornerRadius', parseFloat(e.target.value))}
                  className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[8px] font-mono text-[var(--color-text-muted)]">
                  {selectedShape.properties.cornerRadius || 0}
                </span>
              </div>
            )}
            {/* Path points (inline) */}
            {selectedShape.properties.path && (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-[var(--color-text-muted)]">
                    Path ({selectedShape.properties.path.length} pts)
                  </span>
                  <span
                    onClick={() =>
                      updateProperty(selectedShape.id, 'path', [
                        ...(selectedShape.properties.path || []),
                        { x: 0, y: 0, z: 0 },
                      ])
                    }
                    className="cursor-pointer text-blue-400"
                  >
                    <Plus size={8} />
                  </span>
                </div>
                {selectedShape.properties.path.map((p, i) => (
                  <div key={i} className="flex items-center gap-0.5">
                    {(['x', 'y', 'z'] as const).map((a) => (
                      <input
                        key={a}
                        type="number"
                        value={(p as any)[a] || 0}
                        onChange={(e) => {
                          const np = [...selectedShape.properties.path!]
                          np[i] = { ...np[i], [a]: parseFloat(e.target.value) || 0 }
                          updateProperty(selectedShape.id, 'path', np)
                        }}
                        className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-1 py-0 text-[8px] w-10 outline-none"
                      />
                    ))}
                    <span
                      onClick={() =>
                        updateProperty(
                          selectedShape.id,
                          'path',
                          selectedShape.properties.path!.filter((_, idx) => idx !== i),
                        )
                      }
                      className="cursor-pointer text-red-400"
                    >
                      <Trash2 size={8} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Box face colors */}
        {selectedShape.type === 'Box' && (
          <div className="space-y-1 flex-shrink-0">
            <label className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
              Faces
            </label>
            <div className="grid grid-cols-3 gap-1">
              {['frontFace', 'rearFace', 'leftFace', 'rightFace', 'topFace', 'bottomFace'].map((face) => (
                <div key={face} className="flex items-center gap-0.5">
                  <input
                    type="color"
                    value={
                      typeof (selectedShape.properties as any)[face] === 'string'
                        ? (selectedShape.properties as any)[face]
                        : '#636'
                    }
                    onChange={(e) => updateProperty(selectedShape.id, face, e.target.value)}
                    className="w-4 h-4 rounded bg-transparent border-none cursor-pointer"
                  />
                  <span className="text-[7px] text-[var(--color-text-muted)]">{face.replace('Face', '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
