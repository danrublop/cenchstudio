'use client'

import { useState } from 'react'
import { useVideoStore } from '@/lib/store'
import { ChevronDown, FlaskConical, Trash2 } from 'lucide-react'
import AgentsSettingsTab from './settings/AgentsSettingsTab'
import ModelsAndApiPanel from './settings/ModelsAndApiPanel'
import { AudioSettingsTab } from './settings/AudioSettingsTab'
import { MediaGenSettingsTab } from './settings/MediaGenSettingsTab'
import PermissionsPanel from './settings/PermissionsPanel'
import UsageSection from './settings/UsageSection'
import GeneralSettingsTab from './settings/GeneralSettingsTab'
import { THREE_ENV_GALLERY_SCENE_COUNT } from '@/lib/threeEnvironmentShowcaseScenes'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const {
    seedTestScenes,
    seedCapabilityShowcaseScenes,
    seedThreeEnvironmentShowcaseScenes,
    seedInteractiveTestScenes,
    seedInteractiveStyleShowcaseScenes,
    seedInteractiveProfessionalTourScenes,
    seedProfessionalTooltipTestScenes,
    seedWorldTestScenes,
    seedMedicalTestScenes,
    seedTextEditingHarnessScenes,
    seedAvatarShowcaseScenes,
    seedTalkingHeadLipSyncTestScene,
    project,
    deleteProjectFromDb,
  } = useVideoStore()

  const [isSeeding, setIsSeeding] = useState(false)
  const [isSeedingAvatarShowcase, setIsSeedingAvatarShowcase] = useState(false)
  const [isSeedingTalkingHeadLipSync, setIsSeedingTalkingHeadLipSync] = useState(false)
  const [isSeedingCapability, setIsSeedingCapability] = useState(false)
  const [isSeedingEnvGallery, setIsSeedingEnvGallery] = useState(false)
  const [isSeedingInteractive, setIsSeedingInteractive] = useState(false)
  const [isSeedingInteractiveShowcase, setIsSeedingInteractiveShowcase] = useState(false)
  const [isSeedingProfessionalTour, setIsSeedingProfessionalTour] = useState(false)
  const [isSeedingProfessionalTooltipDemo, setIsSeedingProfessionalTooltipDemo] = useState(false)
  const [isSeedingWorld, setIsSeedingWorld] = useState(false)
  const [isSeedingMedical, setIsSeedingMedical] = useState(false)
  const [isSeedingTextHarness, setIsSeedingTextHarness] = useState(false)
  return (
    <div className="flex flex-col h-full text-[var(--color-text-primary)] bg-transparent">
      <div className="flex-1 overflow-y-auto">
        {/* General section */}
        <details className="group border-b border-[var(--color-border)]" open>
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            General
            <ChevronDown
              size={14}
              className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
            />
          </summary>
          <div className="px-4 pb-4">
            <GeneralSettingsTab embedded />
          </div>
        </details>

        {/* Usage section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Usage
            <ChevronDown
              size={14}
              className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
            />
          </summary>
          <div className="px-4 pb-4">
            <UsageSection />
          </div>
        </details>

        {/* Agents section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Agents
            <ChevronDown
              size={14}
              className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
            />
          </summary>
          <div className="px-4 pb-4">
            <AgentsSettingsTab />
          </div>
        </details>

        {/* Models & API section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Models & APIs
            <ChevronDown
              size={14}
              className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
            />
          </summary>
          <div className="px-4 pb-4">
            <ModelsAndApiPanel />
          </div>
        </details>

        {/* Audio section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Audio
            <ChevronDown
              size={14}
              className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
            />
          </summary>
          <div className="px-4 pb-4 space-y-4">
            <AudioSettingsTab />
          </div>
        </details>

        {/* Media Gen section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Media Gen
            <ChevronDown
              size={14}
              className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
            />
          </summary>
          <div className="px-4 pb-4 space-y-4">
            <MediaGenSettingsTab />
          </div>
        </details>

        {/* Permissions section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Permissions
            <ChevronDown
              size={14}
              className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
            />
          </summary>
          <div className="px-4 pb-4">
            <PermissionsPanel />
          </div>
        </details>

        {/* Dev section */}
        <details className="group border-b border-[var(--color-border)] last:border-b-0">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Dev
            <ChevronDown
              size={14}
              className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
            />
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <button
              onClick={async () => {
                setIsSeeding(true)
                await seedTestScenes()
                setIsSeeding(false)
              }}
              disabled={isSeeding}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[var(--color-text-muted)] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeeding ? 'Loading test scenes...' : 'Load Test Scenes'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingCapability(true)
                await seedCapabilityShowcaseScenes()
                setIsSeedingCapability(false)
              }}
              disabled={isSeedingCapability}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingCapability ? 'Loading...' : 'Load Three.js showcase (6 scenes)'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingEnvGallery(true)
                await seedThreeEnvironmentShowcaseScenes()
                setIsSeedingEnvGallery(false)
              }}
              disabled={isSeedingEnvGallery}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingEnvGallery ? 'Loading...' : `Load Three env gallery (${THREE_ENV_GALLERY_SCENE_COUNT} scenes)`}
            </button>
            <button
              onClick={async () => {
                setIsSeedingAvatarShowcase(true)
                await seedAvatarShowcaseScenes()
                setIsSeedingAvatarShowcase(false)
              }}
              disabled={isSeedingAvatarShowcase}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingAvatarShowcase ? 'Loading...' : 'Load Avatar showcase (9 scenes)'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingTalkingHeadLipSync(true)
                await seedTalkingHeadLipSyncTestScene()
                setIsSeedingTalkingHeadLipSync(false)
              }}
              disabled={isSeedingTalkingHeadLipSync}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingTalkingHeadLipSync ? 'Loading...' : 'Load TalkingHead lip sync test (1 scene)'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingInteractive(true)
                await seedInteractiveTestScenes()
                setIsSeedingInteractive(false)
              }}
              disabled={isSeedingInteractive}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingInteractive ? 'Loading...' : 'Load Interactive Scenes'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingInteractiveShowcase(true)
                await seedInteractiveStyleShowcaseScenes()
                setIsSeedingInteractiveShowcase(false)
              }}
              disabled={isSeedingInteractiveShowcase}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingInteractiveShowcase ? 'Loading...' : 'Load Interactive style showcase (2 scenes)'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingProfessionalTour(true)
                await seedInteractiveProfessionalTourScenes()
                setIsSeedingProfessionalTour(false)
              }}
              disabled={isSeedingProfessionalTour}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingProfessionalTour ? 'Loading...' : 'Load Professional interaction tour (6 scenes)'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingProfessionalTooltipDemo(true)
                await seedProfessionalTooltipTestScenes()
                setIsSeedingProfessionalTooltipDemo(false)
              }}
              disabled={isSeedingProfessionalTooltipDemo}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingProfessionalTooltipDemo ? 'Loading...' : 'Load Professional tooltip demo (3 scenes)'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingWorld(true)
                await seedWorldTestScenes()
                setIsSeedingWorld(false)
              }}
              disabled={isSeedingWorld}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingWorld ? 'Loading...' : 'Load 3D World Scenes'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingMedical(true)
                await seedMedicalTestScenes()
                setIsSeedingMedical(false)
              }}
              disabled={isSeedingMedical}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingMedical ? 'Loading...' : 'Load Medical Scenes'}
            </button>
            <button
              onClick={async () => {
                setIsSeedingTextHarness(true)
                await seedTextEditingHarnessScenes()
                setIsSeedingTextHarness(false)
              }}
              disabled={isSeedingTextHarness}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
            >
              <FlaskConical size={13} />
              {isSeedingTextHarness ? 'Loading...' : 'Load Text editing harness (8 scenes)'}
            </button>
            <div className="pt-3 border-t border-[var(--color-border)] mt-3">
              <button
                onClick={async () => {
                  if (confirm(`Delete project "${project.name}"?`)) await deleteProjectFromDb(project.id)
                }}
                className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] font-medium text-red-400 hover:text-white border border-red-900/50 bg-red-950/20 hover:bg-red-500/80 transition-all shadow-none"
              >
                <Trash2 size={13} />
                Delete Project
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}
