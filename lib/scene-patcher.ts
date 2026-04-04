/**
 * Scene patcher — sends property changes to scene iframes via postMessage
 * for instant live preview without reloading.
 */

export function patchElementInIframe(
  iframe: HTMLIFrameElement | null,
  elementId: string,
  property: string,
  value: unknown,
) {
  iframe?.contentWindow?.postMessage(
    {
      target: 'cench-scene',
      type: 'patch_element',
      elementId,
      property,
      value,
    },
    '*',
  )
}

export function highlightElementInIframe(iframe: HTMLIFrameElement | null, elementId: string | null) {
  iframe?.contentWindow?.postMessage(
    {
      target: 'cench-scene',
      type: 'highlight_element',
      elementId,
    },
    '*',
  )
}

export function requestElementsFromIframe(iframe: HTMLIFrameElement | null) {
  iframe?.contentWindow?.postMessage(
    {
      target: 'cench-scene',
      type: 'get_elements',
    },
    '*',
  )
}

export function sendAvatarCommand(
  iframe: HTMLIFrameElement | null,
  command: string,
  args: Record<string, unknown> = {},
) {
  iframe?.contentWindow?.postMessage(
    {
      target: 'cench-scene',
      type: 'avatar_command',
      command,
      ...args,
    },
    '*',
  )
}
