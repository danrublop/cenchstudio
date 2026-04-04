'use client'

import { v4 as uuidv4 } from 'uuid'
import type { Scene, SceneNode, SceneEdge } from '../types'
import { generateSceneHTML } from '../sceneTemplate'
import {
  createTestScenes,
  createInteractiveTestScenes,
  createInteractiveStyleShowcaseScenes,
  createInteractiveProfessionalTourScenes,
  createProfessionalTooltipTestScenes,
  createWorldTestScenes,
  createMedicalTestScenes,
  createTextEditingHarnessScenes,
} from '../testScenes'
import { createCapabilityShowcaseScenes } from '../capabilityShowcaseScenes'
import { createThreeEnvironmentShowcaseScenes } from '../threeEnvironmentShowcaseScenes'
import { createAvatarShowcaseScenes } from '../avatarShowcaseScenes'
import { createTalkingHeadLipSyncTestScene } from '../talkingHeadLipSyncTestScene'
import type { Set, Get } from './types'

export function createDevActions(set: Set, get: Get) {
  return {
    seedTestScenes: async () => {
      const testScenes = createTestScenes()
      for (const scene of testScenes) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {
          // non-fatal
        }
      }
      set((state) => ({
        scenes: [...state.scenes, ...testScenes],
        selectedSceneId: testScenes[0].id,
        sceneHtmlVersion: state.sceneHtmlVersion + 1,
      }))
    },

    seedCapabilityShowcaseScenes: async () => {
      const showcaseScenes = createCapabilityShowcaseScenes()
      for (const scene of showcaseScenes) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {
          // non-fatal
        }
      }
      set((state) => ({
        scenes: [...state.scenes, ...showcaseScenes],
        selectedSceneId: showcaseScenes[0].id,
        sceneHtmlVersion: state.sceneHtmlVersion + 1,
      }))
    },

    seedThreeEnvironmentShowcaseScenes: async () => {
      const envScenes = createThreeEnvironmentShowcaseScenes()
      for (const scene of envScenes) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {
          // non-fatal
        }
      }
      set((state) => ({
        scenes: [...state.scenes, ...envScenes],
        selectedSceneId: envScenes[0].id,
        sceneHtmlVersion: state.sceneHtmlVersion + 1,
      }))
    },

    seedInteractiveTestScenes: async () => {
      const testScenes = createInteractiveTestScenes()
      // Write HTML files first
      for (const scene of testScenes) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {}
      }
      set((state) => {
        const allScenes = [...state.scenes, ...testScenes]
        // Build graph nodes for new scenes
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        testScenes.forEach((s, i) => {
          if (!existingNodeIds.has(s.id)) {
            newNodes.push({ id: s.id, position: { x: (i % 3) * 240 + 100, y: Math.floor(i / 3) * 200 + 100 } })
          }
        })
        // Build auto edges: hotspot→choice, choice branches handled by interactions,
        // quiz→tooltip, gate→tooltip, tooltip→form, form loops back via interaction
        const newEdges: SceneEdge[] = [
          ...state.project.sceneGraph.edges,
          {
            id: uuidv4(),
            fromSceneId: testScenes[0].id,
            toSceneId: testScenes[1].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
          {
            id: uuidv4(),
            fromSceneId: testScenes[3].id,
            toSceneId: testScenes[4].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
          {
            id: uuidv4(),
            fromSceneId: testScenes[4].id,
            toSceneId: testScenes[5].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
        ]
        return {
          scenes: allScenes,
          selectedSceneId: testScenes[0].id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          project: {
            ...state.project,
            outputMode: 'interactive' as const,
            sceneGraph: {
              ...state.project.sceneGraph,
              nodes: newNodes,
              edges: newEdges,
              startSceneId: state.project.sceneGraph.startSceneId || testScenes[0].id,
            },
          },
        }
      })
    },

    seedInteractiveStyleShowcaseScenes: async () => {
      const showcaseScenes = createInteractiveStyleShowcaseScenes()
      for (const scene of showcaseScenes) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {}
      }
      set((state) => {
        const [a, b] = showcaseScenes
        const allScenes = [...state.scenes, ...showcaseScenes]
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        showcaseScenes.forEach((s, i) => {
          if (!existingNodeIds.has(s.id)) {
            newNodes.push({ id: s.id, position: { x: i * 280 + 120, y: 140 } })
          }
        })
        const newEdges: SceneEdge[] = [
          ...state.project.sceneGraph.edges,
          {
            id: uuidv4(),
            fromSceneId: a.id,
            toSceneId: b.id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
          {
            id: uuidv4(),
            fromSceneId: b.id,
            toSceneId: a.id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
        ]
        return {
          scenes: allScenes,
          selectedSceneId: a.id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          project: {
            ...state.project,
            outputMode: 'interactive' as const,
            sceneGraph: {
              ...state.project.sceneGraph,
              nodes: newNodes,
              edges: newEdges,
              startSceneId: state.project.sceneGraph.startSceneId || a.id,
            },
          },
        }
      })
    },

    seedInteractiveProfessionalTourScenes: async () => {
      const tour = createInteractiveProfessionalTourScenes()
      for (const scene of tour) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {}
      }
      set((state) => {
        const [s1, s2, s3, s4, s5, s6] = tour
        const allScenes = [...state.scenes, ...tour]
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        tour.forEach((s, i) => {
          if (!existingNodeIds.has(s.id)) {
            newNodes.push({ id: s.id, position: { x: (i % 3) * 260 + 100, y: Math.floor(i / 3) * 200 + 100 } })
          }
        })
        const auto = { type: 'auto' as const, interactionId: null, variableName: null, variableValue: null }
        const newEdges: SceneEdge[] = [
          ...state.project.sceneGraph.edges,
          { id: uuidv4(), fromSceneId: s1.id, toSceneId: s2.id, condition: auto },
          { id: uuidv4(), fromSceneId: s2.id, toSceneId: s3.id, condition: auto },
          { id: uuidv4(), fromSceneId: s3.id, toSceneId: s4.id, condition: auto },
          { id: uuidv4(), fromSceneId: s4.id, toSceneId: s5.id, condition: auto },
          { id: uuidv4(), fromSceneId: s5.id, toSceneId: s6.id, condition: auto },
        ]
        return {
          scenes: allScenes,
          selectedSceneId: s1.id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          project: {
            ...state.project,
            outputMode: 'interactive' as const,
            sceneGraph: {
              ...state.project.sceneGraph,
              nodes: newNodes,
              edges: newEdges,
              startSceneId: state.project.sceneGraph.startSceneId || s1.id,
            },
          },
        }
      })
    },

    seedProfessionalTooltipTestScenes: async () => {
      const pack = createProfessionalTooltipTestScenes()
      for (const scene of pack) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {}
      }
      set((state) => {
        const [a, b, c] = pack
        const allScenes = [...state.scenes, ...pack]
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        pack.forEach((s, i) => {
          if (!existingNodeIds.has(s.id)) {
            newNodes.push({ id: s.id, position: { x: (i % 3) * 280 + 80, y: Math.floor(i / 3) * 200 + 120 } })
          }
        })
        const auto = { type: 'auto' as const, interactionId: null, variableName: null, variableValue: null }
        const newEdges: SceneEdge[] = [
          ...state.project.sceneGraph.edges,
          { id: uuidv4(), fromSceneId: a.id, toSceneId: b.id, condition: auto },
          { id: uuidv4(), fromSceneId: b.id, toSceneId: c.id, condition: auto },
        ]
        return {
          scenes: allScenes,
          selectedSceneId: a.id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          project: {
            ...state.project,
            outputMode: 'interactive' as const,
            sceneGraph: {
              ...state.project.sceneGraph,
              nodes: newNodes,
              edges: newEdges,
              startSceneId: state.project.sceneGraph.startSceneId || a.id,
            },
          },
        }
      })
    },

    seedWorldTestScenes: async () => {
      const testScenes = createWorldTestScenes()
      const gs = get().globalStyle
      // World scenes need server-side HTML generation (reads template files from disk).
      for (const scene of testScenes) {
        try {
          const res = await fetch('/api/scene/generate-world', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scene: { ...scene, globalStyle: gs } }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            console.error('[seedWorldTestScenes] generate-world failed:', scene.id, res.status, err)
          }
        } catch (e) {
          console.error('[seedWorldTestScenes] generate-world request failed:', scene.id, e)
        }
      }
      set((state) => {
        const allScenes = [...state.scenes, ...testScenes]
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        testScenes.forEach((s, i) => {
          if (!existingNodeIds.has(s.id)) {
            newNodes.push({ id: s.id, position: { x: (i % 4) * 240 + 100, y: Math.floor(i / 4) * 200 + 100 } })
          }
        })
        const newEdges: SceneEdge[] = [...state.project.sceneGraph.edges]
        for (let i = 0; i < testScenes.length - 1; i++) {
          newEdges.push({
            id: uuidv4(),
            fromSceneId: testScenes[i].id,
            toSceneId: testScenes[i + 1].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          })
        }
        return {
          scenes: allScenes,
          selectedSceneId: testScenes[0].id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          project: {
            ...state.project,
            outputMode: 'interactive' as const,
            sceneGraph: {
              ...state.project.sceneGraph,
              nodes: newNodes,
              edges: newEdges,
              startSceneId: state.project.sceneGraph.startSceneId || testScenes[0].id,
            },
          },
        }
      })
    },

    seedMedicalTestScenes: async () => {
      const testScenes = createMedicalTestScenes()
      for (const scene of testScenes) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {}
      }
      set((state) => {
        const allScenes = [...state.scenes, ...testScenes]
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        testScenes.forEach((s, i) => {
          if (!existingNodeIds.has(s.id)) {
            newNodes.push({ id: s.id, position: { x: (i % 4) * 240 + 100, y: Math.floor(i / 4) * 200 + 100 } })
          }
        })
        // Sequential edges: 1→2→3→4→5, then 6→7→8
        // Scene 5 (diagnostic) quiz jumps to scene 6 (complications) via interaction
        const newEdges: SceneEdge[] = [
          ...state.project.sceneGraph.edges,
          {
            id: uuidv4(),
            fromSceneId: testScenes[0].id,
            toSceneId: testScenes[1].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
          {
            id: uuidv4(),
            fromSceneId: testScenes[1].id,
            toSceneId: testScenes[2].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
          {
            id: uuidv4(),
            fromSceneId: testScenes[2].id,
            toSceneId: testScenes[3].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
          {
            id: uuidv4(),
            fromSceneId: testScenes[3].id,
            toSceneId: testScenes[4].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
          {
            id: uuidv4(),
            fromSceneId: testScenes[5].id,
            toSceneId: testScenes[6].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
          {
            id: uuidv4(),
            fromSceneId: testScenes[6].id,
            toSceneId: testScenes[7].id,
            condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
          },
        ]
        return {
          scenes: allScenes,
          selectedSceneId: testScenes[0].id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          project: {
            ...state.project,
            outputMode: 'interactive' as const,
            sceneGraph: {
              ...state.project.sceneGraph,
              nodes: newNodes,
              edges: newEdges,
              startSceneId: state.project.sceneGraph.startSceneId || testScenes[0].id,
            },
          },
        }
      })
    },

    seedTextEditingHarnessScenes: async () => {
      const testScenes = createTextEditingHarnessScenes()
      for (const scene of testScenes) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {
          /* non-fatal */
        }
      }
      set((state) => {
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        testScenes.forEach((s, i) => {
          if (!existingNodeIds.has(s.id)) {
            newNodes.push({
              id: s.id,
              position: { x: (i % 4) * 220 + 60, y: Math.floor(i / 4) * 180 + 60 },
            })
          }
        })
        return {
          scenes: [...state.scenes, ...testScenes],
          selectedSceneId: testScenes[0].id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          project: {
            ...state.project,
            sceneGraph: { ...state.project.sceneGraph, nodes: newNodes },
          },
        }
      })
    },

    seedAvatarShowcaseScenes: async () => {
      get().updateAudioSettings({ defaultTTSProvider: 'web-speech' })
      const showcaseScenes = createAvatarShowcaseScenes()
      for (const scene of showcaseScenes) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {
          /* non-fatal */
        }
      }
      set((state) => {
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        showcaseScenes.forEach((s, i) => {
          if (!existingNodeIds.has(s.id)) {
            newNodes.push({
              id: s.id,
              position: { x: (i % 4) * 220 + 60, y: Math.floor(i / 4) * 180 + 60 },
            })
          }
        })
        return {
          scenes: [...state.scenes, ...showcaseScenes],
          selectedSceneId: showcaseScenes[0].id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          project: {
            ...state.project,
            sceneGraph: { ...state.project.sceneGraph, nodes: newNodes },
          },
        }
      })
    },

    seedTalkingHeadLipSyncTestScene: async () => {
      const testScenes = createTalkingHeadLipSyncTestScene()
      for (const scene of testScenes) {
        const html = generateSceneHTML(scene, get().globalStyle, undefined, get().audioSettings)
        try {
          await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html }),
          })
        } catch {
          /* non-fatal */
        }
      }
      set((state) => {
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        testScenes.forEach((s, i) => {
          if (!existingNodeIds.has(s.id)) {
            newNodes.push({
              id: s.id,
              position: { x: (i % 4) * 220 + 60, y: Math.floor(i / 4) * 180 + 60 },
            })
          }
        })
        return {
          scenes: [...state.scenes, ...testScenes],
          selectedSceneId: testScenes[0].id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          project: {
            ...state.project,
            sceneGraph: { ...state.project.sceneGraph, nodes: newNodes },
          },
        }
      })
    },
  }
}
