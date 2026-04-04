/**
 * GSAP CDN script tags injected into every scene HTML <head>.
 * GSAP is 100% free including all plugins (acquired by Webflow).
 */

export const GSAP_HEAD = `
  <!-- GSAP (free, commercial use — all plugins free as of 3.13) -->
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/DrawSVGPlugin.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/MorphSVGPlugin.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/MotionPathPlugin.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/SplitText.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/TextPlugin.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/CustomEase.min.js"></script>
  <script>gsap.registerPlugin(DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, SplitText, TextPlugin, CustomEase);</script>
  <!-- Lottie-web for LottieFiles animations -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js"></script>
  <!-- CenchMotion component library -->
  <script src="/sdk/cench-motion.js"></script>
  <!-- CenchCamera cinematic camera motion -->
  <script src="/sdk/cench-camera.js"></script>
  <!-- CenchInteract interaction components -->
  <script src="/sdk/interaction-components.js"></script>
`
